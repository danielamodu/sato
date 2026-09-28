// api/pay.ts — Sato "Pay bills": turn sBTC into airtime via VTPass.
//
// The on-chain leg reuses sato-yield-v3 `send`: the user pays sBTC to the Sato
// treasury (gaslessly, through api/sponsor.ts). This endpoint holds no key and
// moves no money itself. It only:
//   1) QUOTES a naira bill in sats at the live BTC/NGN rate, and signs the
//      quote (HMAC) so the naira→sats ratio can't be tampered client-side;
//   2) once it has INDEPENDENTLY verified a confirmed on-chain payment of at
//      least the quoted sats to the treasury, fulfills the bill via VTPass.
// No verified payment → no fulfillment.
//
// SECURITY: fulfillment is payment-gated, not auth-gated — anyone who actually
// paid the treasury can complete their own order; nobody can complete one
// without paying. A single order can't be fulfilled twice: the VTPass
// request_id is derived deterministically from the paying txid (VTPass dedupes
// on it) and a one-shot claim guards the txid. That claim is durable only with
// Upstash; the in-memory fallback resets on cold start and isn't shared across
// instances — configure Upstash before real value flows. Sato carries the
// BTC/NGN move for the confirmation window (minutes) — fine on testnet;
// requote/hedge for mainnet. Testnet + VTPass sandbox by default.

import { createHmac, createHash, timingSafeEqual } from "node:crypto";

// Vercel serverless signature (inline — api/ isn't part of the client tsconfig).
type Request = { method?: string; body?: Record<string, any> };
type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
const LEDGER = "sato-yield-v3";
// Where bill payments land. Receives sBTC only (no hot key here); keep in step
// with the client TREASURY in client/src/lib/sato.ts.
const TREASURY = process.env.SATO_TREASURY_ADDRESS || DEPLOYER;
const HIRO = "https://api.testnet.hiro.so";

// VTPass (sandbox by default). secret-key authenticates POSTs; never committed.
const VTPASS_BASE = process.env.VTPASS_BASE_URL || "https://sandbox.vtpass.com/api";
const VTPASS_API_KEY = process.env.VTPASS_API_KEY || "";
const VTPASS_SECRET_KEY = process.env.VTPASS_SECRET_KEY || "";
// Signs quotes. Falls back to the VTPass secret so there's one less env to set.
const SIGNING_SECRET = process.env.PAY_SIGNING_SECRET || VTPASS_SECRET_KEY;

// Spread added over spot to cover the FX/settlement window (basis points).
const SPREAD_BPS = Number(process.env.PAY_SPREAD_BPS) || 150;
// Per-order naira bounds for amounts the user types (airtime, electricity).
const MIN_NGN = 50;
const MAX_NGN = 50_000;
// Sanity ceiling for fixed-price plans the server prices itself (data, cable);
// a DStv Premium bouquet already runs ~₦45k, so this can't be as tight.
const MAX_FIXED_NGN = 500_000;
// How long a signed quote stays fulfillable (rate lock + confirmation window).
const QUOTE_TTL_MS = 20 * 60 * 1000;

// Bill categories, and our friendly token -> VTPass serviceID within each. The
// client speaks the friendly token (mtn, dstv, ikeja…); VTPass gets the mapped
// serviceID. Add a biller by dropping it in here.
type Category = "airtime" | "data" | "electricity" | "cable";

const BILLERS: Record<Category, Record<string, string>> = {
  airtime: { mtn: "mtn", glo: "glo", airtel: "airtel", "9mobile": "etisalat" },
  data: { mtn: "mtn-data", glo: "glo-data", airtel: "airtel-data", "9mobile": "etisalat-data" },
  electricity: {
    ikeja: "ikeja-electric", eko: "eko-electric", abuja: "abuja-electric",
    ibadan: "ibadan-electric", enugu: "enugu-electric", ph: "portharcourt-electric",
    kano: "kano-electric", jos: "jos-electric", kaduna: "kaduna-electric", benin: "benin-electric",
  },
  cable: { dstv: "dstv", gotv: "gotv", startimes: "startimes" },
};

// Where the price is set by the chosen plan/bouquet (server looks it up so the
// client can't understate it), vs. an amount the user types.
const FIXED_PRICE = new Set<Category>(["data", "cable"]);
// Categories that carry a billersCode we can verify (meter / smartcard).
const VERIFIABLE = new Set<Category>(["electricity", "cable"]);

// Friendly token -> VTPass serviceID, or null if it isn't in the category.
function billerId(service: string, token: string): string | null {
  return BILLERS[service as Category]?.[token] ?? null;
}

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// --- signed quote --------------------------------------------------------

interface Quote {
  service: Category;
  serviceID: string; // friendly biller token within the category
  variation_code: string; // data/cable plan, or electricity meter type; "" for airtime
  amountNgn: number;
  sats: string; // sats the payer must send to the treasury
  treasury: string;
  exp: number; // ms epoch after which the quote is stale
}

function signQuote(q: Quote): string {
  const msg = [q.service, q.serviceID, q.variation_code, q.amountNgn, q.sats, q.treasury, q.exp].join("|");
  return createHmac("sha256", SIGNING_SECRET).update(msg).digest("hex");
}

function quoteValid(q: Quote, sig: string): boolean {
  if (!SIGNING_SECRET || !sig) return false;
  const good = Buffer.from(signQuote(q), "utf8");
  const got = Buffer.from(String(sig), "utf8");
  return good.length === got.length && timingSafeEqual(good, got);
}

// --- live rate -----------------------------------------------------------

// BTC/NGN spot from CoinGecko (server-side, no key). Throws on any bad read so
// we never quote off an invented rate.
async function btcNgn(): Promise<number> {
  const r = await fetch(
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=ngn"
  );
  if (!r.ok) throw new Error("rate unavailable");
  const d = (await r.json()) as { bitcoin?: { ngn?: number } };
  const v = d?.bitcoin?.ngn;
  if (typeof v !== "number" || v <= 0) throw new Error("rate unavailable");
  return v;
}

// Naira -> sats at `rate`, plus the spread, rounded up (payer covers the edge).
function ngnToSats(amountNgn: number, rate: number): number {
  const base = Math.ceil((amountNgn / rate) * 1e8);
  return Math.ceil((base * (10000 + SPREAD_BPS)) / 10000);
}

// --- on-chain verification ----------------------------------------------

type PayCheck =
  | { ok: true; sender: string; whenMs: number }
  | { ok: false; pending: boolean; error: string };

// Independently confirm the payment: a successful sato-yield-v3 `send` of at
// least `minSats` to the treasury. Never trusts the client's word for it.
async function verifyPayment(txid: string, minSats: bigint): Promise<PayCheck> {
  let r: { ok: boolean; status: number; json: () => Promise<any> };
  try {
    r = await fetch(`${HIRO}/extended/v1/tx/${txid}`);
  } catch {
    return { ok: false, pending: true, error: "Could not read the payment yet." };
  }
  if (r.status === 404) return { ok: false, pending: true, error: "Payment not seen yet." };
  if (!r.ok) return { ok: false, pending: true, error: "Could not read the payment yet." };
  const tx = await r.json();
  const status = String(tx.tx_status || "");
  if (status === "pending") return { ok: false, pending: true, error: "Payment is confirming." };
  if (!status.startsWith("success"))
    return { ok: false, pending: false, error: "Payment failed on-chain." };
  const cc = tx.contract_call || {};
  if (tx.tx_type !== "contract_call" || cc.contract_id !== `${DEPLOYER}.${LEDGER}`)
    return { ok: false, pending: false, error: "Not a Sato ledger payment." };
  if (cc.function_name !== "send")
    return { ok: false, pending: false, error: "Payment is not a send." };
  const args: any[] = cc.function_args || [];
  const recipient = args
    .find((a) => String(a.type || "").includes("principal"))
    ?.repr?.replace(/'/g, "");
  const amtArg = args.find((a) => a.type === "uint" || /^u\d+$/.test(String(a.repr || "")));
  let amt = 0n;
  try {
    amt = BigInt(String(amtArg?.repr || "u0").replace(/^u/, ""));
  } catch {
    amt = 0n;
  }
  if (recipient !== TREASURY)
    return { ok: false, pending: false, error: "Payment didn't go to the Sato treasury." };
  if (amt < minSats)
    return { ok: false, pending: false, error: "Payment is less than the quote." };
  const whenMs = tx.burn_block_time ? tx.burn_block_time * 1000 : Date.now();
  return { ok: true, sender: tx.sender_address, whenMs };
}

// --- idempotency ---------------------------------------------------------

// One Upstash REST command; returns the raw result. Throws on non-2xx.
async function redis(cmd: (string | number)[]): Promise<any> {
  const resp = await fetch(UPSTASH_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!resp.ok) throw new Error(`upstash ${resp.status}`);
  return ((await resp.json()) as { result?: unknown }).result ?? null;
}

const memTxids = new Set<string>();

// Claim a txid exactly once. Returns true if THIS call won the claim (proceed
// to fulfill), false if it was already claimed (a duplicate/concurrent submit).
async function claimTxid(txid: string): Promise<boolean> {
  const key = `sato:pay:txid:${txid}`;
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      return (await redis(["SET", key, "1", "NX", "EX", 2_592_000])) === "OK";
    } catch {
      /* store hiccup — fall back to best-effort memory */
    }
  }
  if (memTxids.has(key)) return false;
  memTxids.add(key);
  return true;
}

// VTPass wants request_id prefixed with a GMT+1 datetime (YYYYMMDDHHmm). Derive
// it from the confirming block time + a hash of the txid so it's identical on
// every retry of the same order — which is exactly what makes VTPass dedupe it.
function requestIdFor(txid: string, whenMs: number): string {
  const d = new Date(whenMs + 60 * 60 * 1000); // GMT+1
  const p = (n: number) => String(n).padStart(2, "0");
  const stamp = `${d.getUTCFullYear()}${p(d.getUTCMonth() + 1)}${p(d.getUTCDate())}${p(d.getUTCHours())}${p(d.getUTCMinutes())}`;
  return stamp + createHash("sha256").update(txid).digest("hex").slice(0, 12);
}

// --- VTPass --------------------------------------------------------------

async function vtPost(path: string, body: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${VTPASS_BASE}/${path}`, {
    method: "POST",
    headers: {
      "api-key": VTPASS_API_KEY,
      "secret-key": VTPASS_SECRET_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  return r.json().catch(() => ({}));
}

async function vtGet(path: string): Promise<any> {
  const r = await fetch(`${VTPASS_BASE}/${path}`, {
    headers: { "api-key": VTPASS_API_KEY, "secret-key": VTPASS_SECRET_KEY },
  });
  return r.json().catch(() => ({}));
}

interface Variation {
  variation_code: string;
  name: string;
  amount: number; // naira, rounded
  fixedPrice: boolean;
}

// A product's plans/bouquets (data bundles, TV packages). VTPass nests these
// under content.variations (some older endpoints spell it "varations" — accept
// both). Drops any malformed row so the client only sees usable options.
async function fetchVariations(vtServiceID: string): Promise<Variation[]> {
  const res = await vtGet(`service-variations?serviceID=${encodeURIComponent(vtServiceID)}`);
  const arr: any[] = res?.content?.variations || res?.content?.varations || [];
  return arr
    .map((v) => ({
      variation_code: String(v?.variation_code ?? ""),
      name: String(v?.name ?? ""),
      amount: Math.round(Number(v?.variation_amount) || 0),
      fixedPrice: String(v?.fixedPrice ?? "").toLowerCase() === "yes",
    }))
    .filter((v) => v.variation_code && v.amount > 0);
}

// The naira price of one plan — used to price data/cable quotes server-side so
// the client can't understate the amount. null if the plan isn't offered.
async function variationAmount(vtServiceID: string, code: string): Promise<number | null> {
  const found = (await fetchVariations(vtServiceID)).find((v) => v.variation_code === code);
  return found ? found.amount : null;
}

// Verify a meter/smartcard with the biller; returns the customer name on file
// (or null if the code is unknown). Electricity also needs the meter `type`.
async function verifyBillersCode(
  vtServiceID: string,
  billersCode: string,
  type?: string
): Promise<{ name: string; address?: string } | null> {
  const body: Record<string, unknown> = { billersCode, serviceID: vtServiceID };
  if (type) body.type = type;
  const c = (await vtPost("merchant-verify", body))?.content || {};
  const name = c.Customer_Name || c.customerName || c.Customer_Name_1 || "";
  if (!name || c.error || c.WrongBillersCode) return null;
  return { name: String(name), address: c.Address ? String(c.Address) : undefined };
}

// Normalise a VTPass pay/requery response to our order status.
function readVtpass(res: any): { status: "delivered" | "processing" | "failed"; detail: string } {
  const code = String(res?.code || "");
  const tstatus = String(res?.content?.transactions?.status || "");
  if (code === "000" && tstatus === "delivered") return { status: "delivered", detail: "Delivered" };
  if (code === "000") return { status: "processing", detail: "Processing at the network" };
  return { status: "failed", detail: res?.response_description || "The biller rejected this." };
}

// --- handler -------------------------------------------------------------

export default async function handler(req: Request, res: Response) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });
  if (!SIGNING_SECRET)
    return res.status(500).json({ error: "Pay bills isn't configured yet." });

  const action = String(req.body?.action || "");

  // Resolve + validate a (service, token) pair. Returns the VTPass serviceID,
  // or sends a 400 and returns null for the caller to bail on.
  const resolve = (service: string, token: string, res: Response): string | null => {
    const vt = billerId(service, token);
    if (!vt) {
      res.status(400).json({ error: "Unknown biller." });
      return null;
    }
    return vt;
  };

  // LIST — plans/bouquets for a data or cable biller (feeds the plan picker).
  if (action === "variations") {
    const service = String(req.body?.service || "");
    const token = String(req.body?.serviceID || "");
    if (!FIXED_PRICE.has(service as Category))
      return res.status(400).json({ error: "No plans for this biller." });
    const vt = resolve(service, token, res);
    if (!vt) return;
    try {
      return res.status(200).json({ variations: await fetchVariations(vt) });
    } catch {
      return res.status(502).json({ error: "Couldn't load plans — try again." });
    }
  }

  // VERIFY — confirm a meter/smartcard and return the customer name on file.
  if (action === "verify") {
    const service = String(req.body?.service || "");
    const token = String(req.body?.serviceID || "");
    const billersCode = String(req.body?.billersCode || "").trim();
    const type = String(req.body?.type || "").trim() || undefined;
    if (!VERIFIABLE.has(service as Category))
      return res.status(400).json({ error: "Nothing to verify for this biller." });
    const vt = resolve(service, token, res);
    if (!vt) return;
    if (!/^\d{5,20}$/.test(billersCode))
      return res.status(400).json({ error: "Enter a valid meter/smartcard number." });
    try {
      const who = await verifyBillersCode(vt, billersCode, service === "electricity" ? type : undefined);
      if (!who) return res.status(400).json({ error: "Couldn't verify that number." });
      return res.status(200).json(who);
    } catch {
      return res.status(502).json({ error: "Verification is unavailable — try again." });
    }
  }

  // 1) QUOTE — price a bill in sats and sign it. Fixed-price categories (data,
  // cable) are priced from the chosen plan; the rest from the user's naira.
  if (action === "quote") {
    const service = String(req.body?.service || "airtime") as Category;
    const token = String(req.body?.serviceID || "");
    const variation = String(req.body?.variation_code || "").trim();
    const vt = resolve(service, token, res);
    if (!vt) return;

    let amountNgn: number;
    if (FIXED_PRICE.has(service)) {
      if (!variation) return res.status(400).json({ error: "Pick a plan first." });
      let priced: number | null;
      try {
        priced = await variationAmount(vt, variation);
      } catch {
        return res.status(502).json({ error: "Couldn't load plans — try again." });
      }
      if (priced == null) return res.status(400).json({ error: "That plan isn't available." });
      if (priced < MIN_NGN || priced > MAX_FIXED_NGN)
        return res.status(400).json({ error: "That plan is out of range." });
      amountNgn = priced;
    } else {
      amountNgn = Math.floor(Number(req.body?.amountNgn));
      if (!Number.isFinite(amountNgn) || amountNgn < MIN_NGN || amountNgn > MAX_NGN)
        return res.status(400).json({ error: `Enter ₦${MIN_NGN}–₦${MAX_NGN.toLocaleString()}.` });
      if (service === "electricity" && variation !== "prepaid" && variation !== "postpaid")
        return res.status(400).json({ error: "Choose prepaid or postpaid." });
    }

    let rate: number;
    try {
      rate = await btcNgn();
    } catch {
      return res.status(502).json({ error: "Live rate unavailable — try again." });
    }
    const q: Quote = {
      service,
      serviceID: token,
      variation_code: service === "airtime" ? "" : variation,
      amountNgn,
      sats: String(ngnToSats(amountNgn, rate)),
      treasury: TREASURY,
      exp: Date.now() + QUOTE_TTL_MS,
    };
    return res.status(200).json({ ...q, rate, sig: signQuote(q) });
  }

  // 2) SUBMIT — verify the on-chain payment, then fulfill via VTPass. Safe to
  // call repeatedly: 202 = still confirming; retries are idempotent.
  if (action === "submit") {
    const q = req.body?.quote as Quote | undefined;
    const sig = String(req.body?.sig || "");
    const txid = String(req.body?.txid || "").trim().replace(/^0x/, "");
    const phone = String(req.body?.phone || "").trim();
    if (!q || !quoteValid(q, sig))
      return res.status(400).json({ error: "Invalid or tampered quote." });
    if (q.exp < Date.now())
      return res.status(410).json({ error: "Quote expired — get a fresh one." });
    const vt = billerId(q.service, q.serviceID);
    if (!vt) return res.status(400).json({ error: "Unknown biller." });
    if (!/^(0\d{10}|234\d{10})$/.test(phone))
      return res.status(400).json({ error: "Enter a valid phone number." });
    if (!/^[0-9a-fA-F]{64}$/.test(txid))
      return res.status(400).json({ error: "Missing payment reference." });

    // billersCode: the meter/smartcard to credit; data credits the phone, and
    // airtime has none. Verifiable categories must carry a plausible code.
    let billersCode = String(req.body?.billersCode || "").trim();
    if (q.service === "data" && !billersCode) billersCode = phone;
    if (VERIFIABLE.has(q.service) && !/^\d{5,20}$/.test(billersCode))
      return res.status(400).json({ error: "Enter a valid meter/smartcard number." });

    const check = await verifyPayment(txid, BigInt(q.sats));
    if (!check.ok)
      return res
        .status(check.pending ? 202 : 400)
        .json({ status: check.pending ? "pending" : "failed", error: check.error });

    const requestId = requestIdFor(txid, check.whenMs);
    // The pay body VTPass expects varies by category; build it from the signed
    // quote (never a client-echoed amount) plus the submit-time destination.
    const payBody: Record<string, unknown> = {
      request_id: requestId,
      serviceID: vt,
      amount: q.amountNgn,
      phone,
    };
    if (q.service !== "airtime") payBody.billersCode = billersCode || phone;
    if (q.variation_code) payBody.variation_code = q.variation_code;
    if (q.service === "cable") payBody.subscription_type = "change";

    // Only the winner of the one-shot claim calls /pay; a duplicate submit
    // re-queries the original instead (also idempotent on requestId).
    const won = await claimTxid(txid);
    const raw = won
      ? await vtPost("pay", payBody)
      : await vtPost("requery", { request_id: requestId });
    const out = readVtpass(raw);
    return res.status(out.status === "failed" ? 502 : 200).json({
      status: out.status,
      detail: out.detail,
      requestId,
      service: q.service,
      serviceID: q.serviceID,
      amountNgn: q.amountNgn,
      sats: q.sats,
      phone,
      billersCode: billersCode || undefined,
      txid,
    });
  }

  return res.status(400).json({ error: "Unknown action." });
}

