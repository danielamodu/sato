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
  AuthType,
  PayloadType,
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
