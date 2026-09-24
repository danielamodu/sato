// Formatting + explorer + price helpers, ported from the web client so figures
// read identically on mobile. We never invent a USD number: a failed price
// fetch leaves values null and amounts fall back to their native unit.

export const short = (a: string) => (a.length > 12 ? `${a.slice(0, 5)}…${a.slice(-4)}` : a);

export const fmt = (n: bigint) => n.toLocaleString("en-US");

// micro-STX (1e6 = 1 STX) → friendly STX string.
export const fmtStx = (micro: bigint) =>
  (Number(micro) / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 6 });

// sats (1e8 = 1 BTC) → trimmed BTC string.
export const fmtBtc = (sats: bigint) =>
  (Number(sats) / 1e8).toLocaleString("en-US", { maximumFractionDigits: 8 });

// sats × live BTC/USD → "$1,340.00".
export const fmtUsd = (sats: bigint, btcUsd: number) =>
  ((Number(sats) / 1e8) * btcUsd).toLocaleString("en-US", { style: "currency", currency: "USD" });

// A plain USD amount → "$12.34".
export const fmtUsdNum = (usd: number) =>
  usd.toLocaleString("en-US", { style: "currency", currency: "USD" });

export const explorerTx = (txid: string) => `https://explorer.hiro.so/txid/${txid}?chain=testnet`;
export const explorerAddr = (a: string) => `https://explorer.hiro.so/address/${a}?chain=testnet`;

// Compact "3m ago" / "2h ago" / "Apr 3" relative time for the activity feed.
export function timeAgo(ms: number | null): string {
  if (!ms) return "Pending";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Live BTC + STX spot from CoinGecko (no key, CORS-open). Nulls on any failure
// so amounts fall back to their native unit rather than a fake number.
export async function fetchPrices(): Promise<{ btc: number | null; stx: number | null }> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,blockstack&vs_currencies=usd",
    );
    if (!r.ok) return { btc: null, stx: null };
    const d = (await r.json()) as { bitcoin?: { usd?: number }; blockstack?: { usd?: number } };
    const pick = (v?: number) => (typeof v === "number" && v > 0 ? v : null);
    return { btc: pick(d.bitcoin?.usd), stx: pick(d.blockstack?.usd) };
  } catch {
    return { btc: null, stx: null };
  }
}
