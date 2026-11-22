import {
  ArrowDownLeft,
  ArrowUpRight,
  AtSign,
  Fuel,
  Receipt,
  TrendingUp,
} from "lucide-react";

export const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;

// Load an <img> and resolve once it's ready, for drawing onto a canvas.
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Path a rounded rectangle (broader support than ctx.roundRect).
export function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
export const fmt = (n: bigint) => n.toLocaleString();
// micro-STX (1e6 = 1 STX) → a friendly STX string for the gas pool.
export const fmtStx = (micro: bigint) =>
  (Number(micro) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
// sats (1e8 = 1 BTC) → a trimmed BTC string, e.g. 2_000_000n → "0.02".
export const fmtBtc = (sats: bigint) =>
  (Number(sats) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 });
// sats × live BTC/USD spot → "$1,340.00". Only shown when a real price is
// loaded — we never invent one.
export const fmtUsd = (sats: bigint, btcUsd: number) =>
  ((Number(sats) / 1e8) * btcUsd).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
// A plain USD amount → "$12.34". For the live "as you type" echo under an
// amount field, where the figure is already in dollars.
export const fmtUsdNum = (usd: number) =>
  usd.toLocaleString(undefined, { style: "currency", currency: "USD" });
// Live BTC + STX spot from CoinGecko (no key, CORS-open). Returns nulls on any
// failure so amounts fall back to their native unit rather than a fake number.
export async function fetchPrices(): Promise<{
  btc: number | null;
  stx: number | null;
}> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,blockstack&vs_currencies=usd"
    );
    if (!r.ok) return { btc: null, stx: null };
    const d = (await r.json()) as {
      bitcoin?: { usd?: number };
      blockstack?: { usd?: number };
    };
    const pick = (v?: number) => (typeof v === "number" && v > 0 ? v : null);
    return { btc: pick(d.bitcoin?.usd), stx: pick(d.blockstack?.usd) };
  } catch {
    return { btc: null, stx: null };
  }
}

export const explorerTx = (txid: string) =>
  `https://explorer.hiro.so/txid/${txid}?chain=testnet`;
export const explorerAddr = (a: string) =>
  `https://explorer.hiro.so/address/${a}?chain=testnet`;

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
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Pick an icon for a transaction by its function label.
export function txIcon(label: string) {
  if (label.startsWith("Sent")) return ArrowUpRight;
  if (label.includes("Earn")) return TrendingUp;
  if (label.includes("gas") || label.includes("Gas")) return Fuel;
  if (label.startsWith("Added")) return ArrowDownLeft;
  if (label.includes("username")) return AtSign;
  return Receipt;
}

// Pull a txid out of the varied shapes @stacks/connect can return.
export function txidOf(res: any): string | undefined {
  return res?.txid ?? res?.txId ?? res?.result?.txid;
}

export type View = "overview" | "send" | "receive" | "bills" | "cashout" | "earn" | "gas" | "activity";
