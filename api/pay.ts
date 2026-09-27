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
// Per-order naira bounds.
const MIN_NGN = 50;
const MAX_NGN = 50_000;
// How long a signed quote stays fulfillable (rate lock + confirmation window).
const QUOTE_TTL_MS = 20 * 60 * 1000;

// Airtime billers: our token -> VTPass serviceID.
const AIRTIME: Record<string, string> = {
  mtn: "mtn",
  glo: "glo",
  airtel: "airtel",
  "9mobile": "etisalat",
};

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// --- signed quote --------------------------------------------------------

interface Quote {
  service: "airtime";
  serviceID: string; // mtn | glo | airtel | 9mobile
  amountNgn: number;
  sats: string; // sats the payer must send to the treasury
  treasury: string;
  exp: number; // ms epoch after which the quote is stale
}

function signQuote(q: Quote): string {
  const msg = [q.service, q.serviceID, q.amountNgn, q.sats, q.treasury, q.exp].join("|");
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

async function vtpass(path: string, body: Record<string, unknown>): Promise<any> {
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

  // 1) QUOTE — price a naira bill in sats and sign it.
  if (action === "quote") {
    const serviceID = String(req.body?.serviceID || "");
    const amountNgn = Math.floor(Number(req.body?.amountNgn));
    if (!AIRTIME[serviceID]) return res.status(400).json({ error: "Unknown network." });
    if (!Number.isFinite(amountNgn) || amountNgn < MIN_NGN || amountNgn > MAX_NGN)
      return res
        .status(400)
        .json({ error: `Enter ₦${MIN_NGN}–₦${MAX_NGN.toLocaleString()}.` });
    let rate: number;
    try {
      rate = await btcNgn();
    } catch {
      return res.status(502).json({ error: "Live rate unavailable — try again." });
    }
    const q: Quote = {
      service: "airtime",
      serviceID,
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
    if (!AIRTIME[q.serviceID]) return res.status(400).json({ error: "Unknown network." });
    if (!/^(0\d{10}|234\d{10})$/.test(phone))
      return res.status(400).json({ error: "Enter a valid phone number." });
    if (!/^[0-9a-fA-F]{64}$/.test(txid))
      return res.status(400).json({ error: "Missing payment reference." });

    const check = await verifyPayment(txid, BigInt(q.sats));
    if (!check.ok)
      return res
        .status(check.pending ? 202 : 400)
        .json({ status: check.pending ? "pending" : "failed", error: check.error });

    const requestId = requestIdFor(txid, check.whenMs);
    // Only the winner of the one-shot claim calls /pay; a duplicate submit
    // re-queries the original instead (also idempotent on requestId).
    const won = await claimTxid(txid);
    const raw = won
      ? await vtpass("pay", {
          request_id: requestId,
          serviceID: q.serviceID,
          amount: q.amountNgn,
          phone,
        })
      : await vtpass("requery", { request_id: requestId });
    const out = readVtpass(raw);
    return res.status(out.status === "failed" ? 502 : 200).json({
      status: out.status,
      detail: out.detail,
      requestId,
      serviceID: q.serviceID,
      amountNgn: q.amountNgn,
      sats: q.sats,
      phone,
      txid,
    });
  }

  return res.status(400).json({ error: "Unknown action." });
}

