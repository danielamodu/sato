// offramp.ts — client for Sato "Cash out": turn sBTC into Naira in a bank.
//
// Flow mirrors bills.ts: quote a naira withdrawal in sats (server-signed) → pay
// those sats to the Sato treasury with a normal gasless send → hand the txid +
// signed quote back to /api/offramp, which independently verifies the on-chain
// payment and then initiates the bank payout. The wallet only ever signs a
// plain sBTC send; no keys live here.
//
// NOTE: on testnet the payout leg is a scaffold — the server records the intent
// and returns "processing" but moves no real money (see api/offramp.ts). A live
// offramp must be auth-gated + KYC/AML-checked before a payout key is wired in.

import { sendSbtc, sendSbtcSponsored, NO_SPONSORED_TX } from "./sato";

const OFFRAMP_ENDPOINT = "/api/offramp";

export interface Bank {
  code: string;
  name: string;
}

export interface OfframpQuote {
  amountNgn: number; // naira the user receives in-bank
  sats: string; // sats to send to `treasury`
  treasury: string;
  exp: number;
  rate: number; // BTC/NGN used for this quote
  sig: string; // opaque server signature — pass back untouched
}

export interface OfframpResult {
  status: "processing" | "pending" | "failed";
  reference?: string;
  stubbed?: boolean;
  detail?: string;
  bank?: string;
  accountNumber?: string;
  accountName?: string;
  amountNgn?: number;
  error?: string;
}

async function post(body: unknown): Promise<{ ok: boolean; httpStatus: number; data: any }> {
  const r = await fetch(OFFRAMP_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, httpStatus: r.status, data };
}

// The banks the payout provider supports (for the picker).
export async function listBanks(): Promise<Bank[]> {
  const { ok, data } = await post({ action: "banks" });
  if (!ok) throw new Error(data?.error || "Couldn't load banks.");
  return (data?.banks || []) as Bank[];
}

// Resolve an account number to the name on file. Throws when the provider can't
// verify it (including on testnet with no key) so the UI can fall back to a
// manually typed name.
export async function resolveAccount(bankCode: string, accountNumber: string): Promise<string> {
  const { ok, data } = await post({ action: "resolve", bankCode, accountNumber });
  if (!ok || !data?.name) throw new Error(data?.error || "Couldn't verify that account.");
  return String(data.name);
}

// Price a naira cash-out in sats (server-signed quote).
export async function quoteOfframp(amountNgn: number): Promise<OfframpQuote> {
  const { ok, data } = await post({ action: "quote", amountNgn });
  if (!ok || !data?.sig) throw new Error(data?.error || "Couldn't get a quote.");
  return data as OfframpQuote;
}

// Pay the quoted sats to the treasury, gaslessly, and return the broadcast
// txid. Falls back to a user-pays send if the wallet can't do sponsored txs.
async function payTreasury(quote: OfframpQuote): Promise<string> {
  const amount = BigInt(quote.sats);
  try {
    return await sendSbtcSponsored(quote.treasury, amount);
  } catch (e: any) {
    if (e?.message !== NO_SPONSORED_TX) throw e;
    const res: any = await sendSbtc(quote.treasury, amount);
    const txid = res?.txid ?? res?.txId ?? res?.result?.txid;
    if (!txid) throw new Error("Wallet didn't return a transaction id.");
    return txid;
  }
}

async function submit(
  quote: OfframpQuote,
  txid: string,
  bankCode: string,
  accountNumber: string,
  accountName: string
): Promise<OfframpResult> {
  const { httpStatus, data } = await post({
    action: "submit",
    quote,
    sig: quote.sig,
    txid,
    bankCode,
    accountNumber,
    accountName,
  });
  // 202 = payment still confirming on-chain; normalise to our "pending".
  if (httpStatus === 202) return { status: "pending", detail: data?.error || "Confirming…" };
  return data as OfframpResult;
}

// Cash out to a bank end to end. Reports progress so the UI can narrate:
// "paying" (wallet + broadcast) → "confirming" (on-chain, then payout).
export async function sendToBank(
  quote: OfframpQuote,
  bankCode: string,
  accountNumber: string,
  accountName: string,
  onStage?: (stage: "paying" | "confirming", txid?: string) => void
): Promise<OfframpResult> {
  onStage?.("paying");
  const txid = await payTreasury(quote);
  onStage?.("confirming", txid);
  // Poll: the payment must mine before the payout initiates. Bounded so we
  // never hang; re-submitting the same txid later is idempotent server-side.
  const deadline = Date.now() + 8 * 60 * 1000;
  let last: OfframpResult = { status: "pending" };
  while (Date.now() < deadline) {
    const r = await submit(quote, txid, bankCode, accountNumber, accountName);
    if (r.status === "pending") {
      last = r;
      await new Promise((res) => setTimeout(res, 6000));
      continue;
    }
    return r; // processing | failed
  }
  return { ...last, detail: last.detail || "Still confirming — check Activity shortly." };
}
