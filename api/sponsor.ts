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
import { clientIp, rateLimit, type ApiHeaders } from "./_lib";

// Vercel serverless signature (kept inline — api/ mirrors api/waitlist.ts and
// isn't part of the client tsconfig; no @vercel/node dependency to import).
type Request = {
  method?: string;
  body?: { txHex?: string };
  headers?: ApiHeaders;
};
type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
const NETWORK = "testnet" as const;

// Only these (contract, function) pairs are ever eligible for sponsorship.
// Read-only/owner-only/superseded contracts are excluded. `deposit` is the
// testnet faucet (mints valueless test sBTC to the caller); it's sponsorable so
// an embedded-wallet user holding zero STX can onboard and transact — bounded,
// like everything here, by the fixed fee + per-user/per-IP rate limits below.
const ALLOWED: Record<string, string[]> = {
  "sato-yield-v3": ["send", "deposit", "lock", "claim-lock"],
  "sato-names": ["register-name", "transfer-name"],
  "sato-sponsor": ["top-up"],
};

// Fixed fee the pool pays per sponsored tx, in micro-STX (0.05 STX). Because we
// set it ourselves, it doubles as the hard per-tx cap on how much the hot
// wallet can spend — the client never gets to choose the fee.
const SPONSOR_FEE = 50_000;

// --- per-user and per-IP rate limits -------------------------------------
//
// The allow-list + fixed fee bound WHAT and HOW MUCH per tx; these bound how
// OFTEN one principal or IP can spend from the pool.
const WINDOW_SECONDS = Number(process.env.SPONSOR_WINDOW_SECONDS) || 86_400;
export const MAX_PER_WINDOW = Number(process.env.SPONSOR_MAX_PER_WINDOW) || 200;
export const IP_MAX_PER_WINDOW = Number(process.env.SPONSOR_IP_MAX_PER_WINDOW) || 40;

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

// Count this attempt against the principal's window. Atomic incr-first so
// concurrent requests can't race past the cap; a send that later fails to
// broadcast still spends one unit (the safe direction — it protects the key).
export async function overRateLimit(principal: string): Promise<boolean> {
  return rateLimit("sponsor:rl", principal, MAX_PER_WINDOW, WINDOW_SECONDS);
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

  // Identify the sending principal (fail closed if unrecognized so an unusual
  // auth condition can never bypass rate limits).
  let who: string;
  try {
    who = originPrincipal(tx);
  } catch {
    return res.status(400).json({ error: "Could not identify transaction sender." });
  }

  // Enforce both per-IP and per-principal rate limits to slow fresh-keypair spam.
  try {
    const ip = clientIp(req);
    if (await rateLimit("sponsor:ip", ip, IP_MAX_PER_WINDOW, WINDOW_SECONDS)) {
      return res.status(429).json({
        error: "Too many sponsored requests from this network. Please try again later.",
      });
    }
    if (await overRateLimit(who)) {
      return res.status(429).json({
        error: `Gas limit reached — ${MAX_PER_WINDOW} sponsored sends per window. Try later, or turn off Gasless to send with your own STX.`,
      });
    }
  } catch {
    return res.status(503).json({ error: "Rate limit store unavailable — try again shortly." });
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
