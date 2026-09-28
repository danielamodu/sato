// api/offramp.ts — Sato "Cash out": turn sBTC into Naira in a bank account.
//
// Mirrors api/pay.ts. The on-chain leg is a sato-yield-v3 `send` of sBTC to
// the Sato treasury (gaslessly, via api/sponsor.ts). This endpoint holds no
// wallet key and moves no crypto itself. It:
//   1) QUOTES a naira withdrawal in sats at the live BTC/NGN rate (minus an
//      offramp spread) and signs the quote (HMAC) so the sats↔naira ratio
//      can't be tampered client-side;
//   2) RESOLVES a bank account to the name on file (via the payout provider);
//   3) once it has INDEPENDENTLY verified a confirmed on-chain payment of at
//      least the quoted sats to the treasury, initiates the bank payout.
//
// SECURITY — READ BEFORE GOING LIVE. This endpoint sends FIAT OUT to a bank
// account, so unlike Pay bills (where the value delivered equals the value
// paid) payment-gating alone is NOT enough:
//   * A real offramp MUST be auth-gated and KYC/AML-checked, with per-user
//     limits and sanctions screening, before a payout key is wired in.
//   * The payout provider (Paystack/Flutterwave/Monnify) needs a funded
//     business balance + secret key. The transfer leg here is a SCAFFOLD: it
//     records the intent and returns "processing" but moves no money. Account
//     resolution is read-only and runs for real when PAYOUT_SECRET_KEY is set.
//   * Idempotency (one payout per txid) uses the same Upstash claim as pay.ts.
// Testnet default: funds aren't real, so the stubbed payout is intended.

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
// Where cash-out payments land. Receives sBTC only (no hot key here); keep in
// step with the client TREASURY in client/src/lib/sato.ts.
const TREASURY = process.env.SATO_TREASURY_ADDRESS || DEPLOYER;
const HIRO = "https://api.testnet.hiro.so";

// Payout provider (Paystack by default). Secret key never committed; when it's
// missing, account resolution + the payout leg are stubbed (testnet).
const PAYOUT_BASE = process.env.PAYOUT_BASE_URL || "https://api.paystack.co";
const PAYOUT_SECRET = process.env.PAYOUT_SECRET_KEY || "";
// Signs quotes. Falls back so there's one less env to set on testnet.
const SIGNING_SECRET =
  process.env.OFFRAMP_SIGNING_SECRET || process.env.PAY_SIGNING_SECRET || PAYOUT_SECRET || "dev-offramp-secret";

// Offramp spread (bps) taken off spot — the naira you receive is priced a
// little worse than mid to cover FX/settlement + provider fees.
const SPREAD_BPS = Number(process.env.OFFRAMP_SPREAD_BPS) || 200;
const MIN_NGN = 1_000;
const MAX_NGN = 500_000;
// How long a signed quote stays fulfillable (rate lock + confirmation window).
const QUOTE_TTL_MS = 20 * 60 * 1000;

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// --- signed quote --------------------------------------------------------

interface Quote {
  amountNgn: number; // naira the user receives in-bank
  sats: string; // sats the user must send to the treasury
  treasury: string;
  exp: number; // ms epoch after which the quote is stale
}

// rate isn't signed (display only); the sats↔naira commitment is amountNgn+sats.
function signQuote(q: Quote): string {
  const msg = [q.amountNgn, q.sats, q.treasury, q.exp].join("|");
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

// Naira -> sats at `rate`, plus the spread, rounded up (payer covers the edge
// so they pay slightly more sats for the naira they receive).
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
// to pay out), false if it was already claimed (a duplicate/concurrent submit).
async function claimTxid(txid: string): Promise<boolean> {
  const key = `sato:offramp:txid:${txid}`;
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

// A deterministic payout reference from the paying txid, so retries of the same
// order carry the same reference (the provider can dedupe on it).
function referenceFor(txid: string): string {
  return "SATO-OFR-" + createHash("sha256").update(txid).digest("hex").slice(0, 16);
}

// --- payout provider (Paystack) ------------------------------------------

// A short, static list of major Nigerian banks with their NIP/Paystack codes,
// so the account picker works with no provider key on testnet. When a key is
// set you could swap this for a live GET /bank?currency=NGN fetch.
const BANKS: { code: string; name: string }[] = [
  { code: "044", name: "Access Bank" },
  { code: "023", name: "Citibank Nigeria" },
  { code: "050", name: "Ecobank Nigeria" },
  { code: "070", name: "Fidelity Bank" },
  { code: "011", name: "First Bank of Nigeria" },
  { code: "214", name: "First City Monument Bank (FCMB)" },
  { code: "058", name: "Guaranty Trust Bank (GTBank)" },
  { code: "301", name: "Jaiz Bank" },
  { code: "082", name: "Keystone Bank" },
  { code: "50211", name: "Kuda Bank" },
  { code: "076", name: "Polaris Bank" },
  { code: "101", name: "Providus Bank" },
  { code: "221", name: "Stanbic IBTC Bank" },
  { code: "068", name: "Standard Chartered Bank" },
  { code: "232", name: "Sterling Bank" },
  { code: "100", name: "SunTrust Bank" },
  { code: "032", name: "Union Bank of Nigeria" },
  { code: "033", name: "United Bank for Africa (UBA)" },
  { code: "215", name: "Unity Bank" },
  { code: "035", name: "Wema Bank" },
  { code: "057", name: "Zenith Bank" },
  { code: "999992", name: "OPay" },
  { code: "50515", name: "Moniepoint MFB" },
  { code: "50126", name: "PalmPay" },
];

function bankName(code: string): string {
  return BANKS.find((b) => b.code === code)?.name || code;
}

type Resolved = { ok: true; accountName: string } | { ok: false; error: string };

// Resolve a bank account to the name on file. Read-only, so it runs for real
// against Paystack whenever PAYOUT_SECRET is set (even on testnet). Without a
// key it can't hit the provider, so it returns a soft "unavailable" that the
// UI treats as "type the name yourself" rather than a hard failure.
async function resolveAccount(bankCode: string, accountNumber: string): Promise<Resolved> {
  if (!PAYOUT_SECRET)
    return { ok: false, error: "Account name check isn't available yet — enter it manually." };
  let r: { ok: boolean; status: number; json: () => Promise<any> };
  try {
    const qs = `account_number=${encodeURIComponent(accountNumber)}&bank_code=${encodeURIComponent(bankCode)}`;
    r = await fetch(`${PAYOUT_BASE}/bank/resolve?${qs}`, {
      headers: { Authorization: `Bearer ${PAYOUT_SECRET}` },
    });
  } catch {
    return { ok: false, error: "Couldn't reach the bank right now." };
  }
  const d = await r.json().catch(() => ({}));
  if (!r.ok || !d?.status || !d?.data?.account_name)
    return { ok: false, error: d?.message || "Couldn't verify that account." };
  return { ok: true, accountName: String(d.data.account_name) };
}

interface Payout {
  status: "processing" | "failed";
  reference: string;
  stubbed: boolean;
  detail?: string;
  error?: string;
}

// Initiate the bank payout. SCAFFOLD: on testnet (no PAYOUT_SECRET) this records
// the intent and returns "processing" but moves NO money. Going live means
// wiring a real Paystack transfer here — create a transfer recipient, then
// POST /transfer with the reference — BEHIND auth + KYC/AML + limits, never on
// payment-gating alone. Deliberately left unwired so no key can leak fiat.
async function payout(args: {
  reference: string;
  amountNgn: number;
  bankCode: string;
  accountNumber: string;
  accountName: string;
}): Promise<Payout> {
  if (!PAYOUT_SECRET) {
    return {
      status: "processing",
      reference: args.reference,
      stubbed: true,
      detail: "Payout recorded (testnet scaffold — no real transfer sent).",
    };
  }
  // Live payouts intentionally not implemented: sending fiat requires auth +
  // KYC/AML gating that this payment-only endpoint doesn't have. Record intent.
  return {
    status: "processing",
    reference: args.reference,
    stubbed: true,
    detail: "Payout queued for manual review (live transfers not enabled).",
  };
}

// --- handler -------------------------------------------------------------

const ACCT_RE = /^\d{10}$/; // Nigerian NUBAN account numbers are 10 digits.

function bad(res: Response, code: number, error: string) {
  res.status(code).json({ error });
}

export default async function handler(req: Request, res: Response) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return bad(res, 405, "Method not allowed.");
  const body = req.body || {};
  const action = String(body.action || "");

  // List supported banks for the picker.
  if (action === "banks") {
    return res.status(200).json({ banks: BANKS });
  }

  // Resolve an account number to the name on file (read-only).
  if (action === "resolve") {
    const bankCode = String(body.bankCode || "");
    const accountNumber = String(body.accountNumber || "");
    if (!BANKS.some((b) => b.code === bankCode)) return bad(res, 400, "Unknown bank.");
    if (!ACCT_RE.test(accountNumber)) return bad(res, 400, "Enter a 10-digit account number.");
    const r = await resolveAccount(bankCode, accountNumber);
    if (!r.ok) return bad(res, 422, r.error);
    return res.status(200).json({ name: r.accountName });
  }

  // Price a naira cash-out in sats and sign the quote.
  if (action === "quote") {
    const amountNgn = Math.floor(Number(body.amountNgn));
    if (!Number.isFinite(amountNgn) || amountNgn < MIN_NGN)
      return bad(res, 400, `Minimum cash-out is ₦${MIN_NGN.toLocaleString()}.`);
    if (amountNgn > MAX_NGN)
      return bad(res, 400, `Maximum cash-out is ₦${MAX_NGN.toLocaleString()}.`);
    let rate: number;
    try {
      rate = await btcNgn();
    } catch {
      return bad(res, 503, "Rate unavailable — try again in a moment.");
    }
    const sats = String(ngnToSats(amountNgn, rate));
    const exp = Date.now() + QUOTE_TTL_MS;
    const q: Quote = { amountNgn, sats, treasury: TREASURY, exp };
    return res.status(200).json({ ...q, rate, sig: signQuote(q) });
  }

  // Fulfil a paid cash-out: verify the on-chain payment, then pay the bank.
  if (action === "submit") {
    const body_q = body.quote || {};
    const q: Quote = {
      amountNgn: Math.floor(Number(body_q.amountNgn)),
      sats: String(body_q.sats || ""),
      treasury: String(body_q.treasury || ""),
      exp: Number(body_q.exp),
    };
    const sig = String(body.sig || "");
    const txid = String(body.txid || "").trim();
    const bankCode = String(body.bankCode || "");
    const accountNumber = String(body.accountNumber || "");
    const accountName = String(body.accountName || "").trim();

    if (!quoteValid(q, sig)) return bad(res, 400, "Quote signature invalid.");
    if (Date.now() > q.exp) return bad(res, 400, "Quote expired — get a fresh one.");
    if (q.treasury !== TREASURY) return bad(res, 400, "Quote is for a different treasury.");
    if (!/^0x?[0-9a-fA-F]{64}$/.test(txid) && !/^[0-9a-fA-F]{64}$/.test(txid))
      return bad(res, 400, "Missing or malformed transaction id.");
    if (!BANKS.some((b) => b.code === bankCode)) return bad(res, 400, "Unknown bank.");
    if (!ACCT_RE.test(accountNumber)) return bad(res, 400, "Enter a 10-digit account number.");
    if (!accountName) return bad(res, 400, "Missing account name.");

    // Independently verify the sBTC payment before any payout is initiated.
    let minSats: bigint;
    try {
      minSats = BigInt(q.sats);
    } catch {
      return bad(res, 400, "Bad quote.");
    }
    const check = await verifyPayment(txid, minSats);
    if (!check.ok) {
      // 202 = still confirming; the client re-submits the same txid (idempotent).
      return res.status(check.pending ? 202 : 400).json({ error: check.error });
    }

    // One payout per txid. If the claim is lost, it's already been handled.
    if (!(await claimTxid(txid)))
      return res.status(200).json({
        status: "processing",
        detail: "This payment was already cashed out.",
        reference: referenceFor(txid),
      });

    const reference = referenceFor(txid);
    const result = await payout({
      reference,
      amountNgn: q.amountNgn,
      bankCode,
      accountNumber,
      accountName,
    });
    if (result.status === "failed")
      return res.status(502).json({ error: result.error || "Payout failed.", reference });
    return res.status(200).json({
      status: result.status,
      reference: result.reference,
      stubbed: result.stubbed,
      detail: result.detail,
      bank: bankName(bankCode),
      accountNumber,
      accountName,
      amountNgn: q.amountNgn,
    });
  }

  return bad(res, 400, "Unknown action.");
}






