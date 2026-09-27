// bills.ts — client for Sato "Pay bills" (airtime via sBTC).
//
// Flow: quote a naira amount in sats (server-signed) → pay those sats to the
// Sato treasury with a normal gasless send → hand the txid + signed quote back
// to /api/pay, which independently verifies the on-chain payment and fulfills
// via VTPass. The wallet only ever signs a plain sBTC send; no new contract and
// no keys live here. See api/pay.ts for the server side.

import { sendSbtc, sendSbtcSponsored, NO_SPONSORED_TX } from "./sato";

const PAY_ENDPOINT = "/api/pay";

export type Network = "mtn" | "glo" | "airtel" | "9mobile";

export interface BillQuote {
  service: "airtime";
  serviceID: Network;
  amountNgn: number;
  sats: string; // sats to send to `treasury`
  treasury: string;
  exp: number;
  rate: number; // BTC/NGN used for this quote
  sig: string; // opaque server signature — pass back untouched
}

export interface BillResult {
  status: "delivered" | "processing" | "pending" | "failed";
  detail?: string;
  requestId?: string;
  error?: string;
}

async function post(body: unknown): Promise<{ ok: boolean; httpStatus: number; data: any }> {
  const r = await fetch(PAY_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await r.json().catch(() => ({}));
  return { ok: r.ok, httpStatus: r.status, data };
}

// Price `amountNgn` of airtime on `serviceID` in sats (server-signed quote).
export async function quoteAirtime(serviceID: Network, amountNgn: number): Promise<BillQuote> {
  const { ok, data } = await post({ action: "quote", serviceID, amountNgn });
  if (!ok || !data?.sig) throw new Error(data?.error || "Couldn't get a quote.");
  return data as BillQuote;
}

// Pay the quoted sats to the treasury, gaslessly, and return the broadcast
// txid. Falls back to a user-pays send if the wallet can't do sponsored txs.
async function payTreasury(quote: BillQuote): Promise<string> {
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

// Submit a paid order for fulfillment. `txid` is the sBTC payment to treasury.
async function submit(quote: BillQuote, txid: string, phone: string): Promise<BillResult> {
  const { httpStatus, data } = await post({ action: "submit", quote, sig: quote.sig, txid, phone });
  // 202 = payment still confirming on-chain; normalise to our "pending".
  if (httpStatus === 202) return { status: "pending", detail: data?.error || "Confirming…" };
  return data as BillResult;
}

// Pay an airtime bill end to end. Reports progress so the UI can narrate:
// "paying" (wallet + broadcast) → "confirming" (on-chain, then fulfilling).
export async function payAirtime(
  quote: BillQuote,
  phone: string,
  onStage?: (stage: "paying" | "confirming", txid?: string) => void
): Promise<BillResult> {
  onStage?.("paying");
  const txid = await payTreasury(quote);
  onStage?.("confirming", txid);
  // Poll: the payment must mine before VTPass fulfills. Bounded so we never
  // hang; if it's still confirming when we give up, the order isn't lost —
  // re-submitting the same txid later is idempotent server-side.
  const deadline = Date.now() + 8 * 60 * 1000;
  let last: BillResult = { status: "pending" };
  while (Date.now() < deadline) {
    const r = await submit(quote, txid, phone);
    if (r.status === "pending") {
      last = r;
      await new Promise((res) => setTimeout(res, 6000));
      continue;
    }
    return r; // delivered | processing | failed
  }
  return { ...last, detail: last.detail || "Still confirming — check Activity shortly." };
}

