// api/sponsor.ts — the gasless co-signer.
//
// The Stacks sponsored-transaction protocol is the only way to make a send
// actually free for the user: they sign a contract call with `sponsored:true`
// (fee + sponsor nonce left blank), and a service holding a funded STX key
// fills those in, signs as sponsor, and broadcasts. The SPONSOR's account pays
// the miner fee — the user pays nothing.
//
// SECURITY: process.env.SPONSOR_KEY is a hot wallet. This endpoint is the only
// thing standing between it and a drained balance, so it will ONLY sponsor:
//   - a real *sponsored* transaction (AuthType.Sponsored),
//   - that is a contract call to one of Sato's own deployed contracts,
//   - for an allow-listed function,
//   - at a fixed, bounded fee we set ourselves (never the client's).
// Anything else is refused before the key ever touches it. Testnet only.

import {
  deserializeTransaction,
  sponsorTransaction,
  broadcastTransaction,
  addressToString,
  addressHashModeToVersion,
  AuthType,
  PayloadType,
  StacksWireType,
  type StacksTransactionWire,
} from "@stacks/transactions";

// Vercel serverless signature (kept inline — api/ mirrors api/waitlist.ts and
// isn't part of the client tsconfig; no @vercel/node dependency to import).
type Request = { method?: string; body?: { txHex?: string } };
type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
const NETWORK = "testnet" as const;

// Only these (contract, function) pairs are ever eligible for sponsorship.
// Read-only/owner-only functions are deliberately absent.
const ALLOWED: Record<string, string[]> = {
  "sato-transfer": ["send"],
  "sato-names": ["register-name", "transfer-name"],
  "sato-yield": ["deposit", "withdraw", "fund-sbtc"],
  "sato-sponsor": ["top-up"],
};

// Fixed fee the pool pays per sponsored tx, in micro-STX (0.05 STX). Because we
// set it ourselves, it doubles as the hard per-tx cap on how much the hot
// wallet can spend — the client never gets to choose the fee.
const SPONSOR_FEE = 50_000;

// --- per-user rate limit -------------------------------------------------
//
// The allow-list + fixed fee bound WHAT and HOW MUCH per tx; this bounds how
// OFTEN one principal can spend from the pool. It mirrors the on-chain policy
// in sato-sponsor: the per-user cap (10 STX) divided by our fee (0.05 STX) is
// 200 sponsored sends per window. We can't drive the contract's own counter —
// `sponsor-tx` is owner-only AND pays the user, so calling it here would
// double-pay — so we track spend off-chain, keyed by the tx's origin principal.
//
// Durable when Upstash Redis is configured (env below); otherwise a best-effort
// in-memory counter that resets on cold start and isn't shared across instances
// — real protection needs the store. Overridable via env for tuning.
const WINDOW_SECONDS = Number(process.env.SPONSOR_WINDOW_SECONDS) || 86_400;
export const MAX_PER_WINDOW = Number(process.env.SPONSOR_MAX_PER_WINDOW) || 200;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// The "ST…" principal that signed (and will send) this tx. For a sponsored tx
// the ORIGIN spending condition is the user; rebuild their address from its
// hash160 + hash mode. Single- or multi-sig both carry a signer hash.
export function originPrincipal(tx: StacksTransactionWire): string {
  const sc = tx.auth.spendingCondition;
  const version = addressHashModeToVersion(sc.hashMode, NETWORK);
  return addressToString({
    type: StacksWireType.Address,
    version,
    hash160: sc.signer,
  });
}

// Best-effort per-instance fallback when no durable store is configured.
const memHits = new Map<string, { n: number; resetAt: number }>();
function memIncr(key: string): number {
  const now = Date.now();
  const e = memHits.get(key);
  if (!e || e.resetAt <= now) {
    memHits.set(key, { n: 1, resetAt: now + WINDOW_SECONDS * 1000 });
    return 1;
  }
  e.n += 1;
  return e.n;
}

// One Upstash REST command (["INCR","k"] / ["EXPIRE","k","60"]); throws on any
// non-2xx so the caller can degrade to the in-memory counter.
async function redis(cmd: (string | number)[]): Promise<number> {
  const resp = await fetch(UPSTASH_URL as string, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${UPSTASH_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!resp.ok) throw new Error(`upstash ${resp.status}`);
  const data = (await resp.json()) as { result?: number };
  return Number(data.result ?? 0);
}

// Count this attempt against the principal's window. Atomic incr-first so
// concurrent requests can't race past the cap; a send that later fails to
// broadcast still spends one unit (the safe direction — it protects the key).
export async function overRateLimit(principal: string): Promise<boolean> {
  const key = `sato:sponsor:rl:${principal}`;
  let used: number;
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      used = await redis(["INCR", key]);
      if (used === 1) await redis(["EXPIRE", key, WINDOW_SECONDS]);
    } catch {
      used = memIncr(key); // store hiccup — degrade, don't lock everyone out
    }
  } else {
    used = memIncr(key);
  }
  return used > MAX_PER_WINDOW;
}

export type Check =
  | { ok: true; contract: string; fn: string }
  | { ok: false; error: string };

// Pure + testable: is this a sponsored call to one of our contracts/functions?
export function validateSponsoredTx(tx: StacksTransactionWire): Check {
  if (tx.auth.authType !== AuthType.Sponsored) {
    return { ok: false, error: "Not a sponsored transaction." };
  }
  const payload = tx.payload;
  if (payload.payloadType !== PayloadType.ContractCall) {
    return { ok: false, error: "Only contract calls can be sponsored." };
  }
  if (addressToString(payload.contractAddress) !== DEPLOYER) {
    return { ok: false, error: "Not a Sato contract." };
  }
  const contract = payload.contractName.content;
  const fn = payload.functionName.content;
  if (!ALLOWED[contract]?.includes(fn)) {
    return { ok: false, error: `${contract}.${fn} is not sponsorable.` };
  }
  return { ok: true, contract, fn };
}

export default async function handler(req: Request, res: Response) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const txHex = req.body?.txHex;
  if (typeof txHex !== "string" || txHex.length < 2) {
    return res.status(400).json({ error: "Missing signed transaction." });
  }

  // The sponsor's funded testnet key. Set in the Vercel project env — NEVER
  // commit it. Without it we cannot (and must not) sponsor anything.
  const sponsorKey = process.env.SPONSOR_KEY;
  if (!sponsorKey) {
    return res.status(500).json({ error: "Gas pool is not configured yet." });
  }

  let tx: StacksTransactionWire;
  try {
    tx = deserializeTransaction(txHex);
  } catch {
    return res.status(400).json({ error: "Could not decode transaction." });
  }

  const check = validateSponsoredTx(tx);
  if (!check.ok) return res.status(403).json({ error: check.error });

  // Rate-limit by the sending principal. If we can't identify them, skip it
  // (the fixed fee + allow-list still bound the damage) rather than block a
  // legitimate but unusual wallet.
  let who: string | null = null;
  try {
    who = originPrincipal(tx);
  } catch {
    who = null;
  }
  if (who && (await overRateLimit(who))) {
    return res.status(429).json({
      error: `Gas limit reached — ${MAX_PER_WINDOW} sponsored sends per window. Try later, or turn off Gasless to send with your own STX.`,
    });
  }

  try {
    // Fill in the sponsor fee + nonce and sign as sponsor. We pass our own
    // fixed fee so the client can never make the pool overpay.
    const sponsored = await sponsorTransaction({
      transaction: tx,
      sponsorPrivateKey: sponsorKey,
      fee: SPONSOR_FEE,
      network: NETWORK,
    });
    const result = await broadcastTransaction({
      transaction: sponsored,
      network: NETWORK,
    });
    // Ok = { txid }; rejected adds { error, reason }. Read via a widened shape
    // so the check is robust regardless of how the union narrows.
    const r = result as { txid?: string; error?: string; reason?: string };
    if (r.error) {
      return res
        .status(502)
        .json({ error: r.reason || r.error || "Broadcast rejected." });
    }
    return res.status(200).json({ txId: r.txid });
  } catch {
    return res.status(500).json({ error: "Could not sponsor this transaction." });
  }
}
