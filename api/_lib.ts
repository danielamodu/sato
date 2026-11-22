// api/_lib.ts — shared security, normalization, rate-limiting, claim idempotency,
// and Stacks message signature verification helpers for Sato's Vercel APIs.
//
// Files prefixed with `_` in Vercel's `api/` folder are not exposed as HTTP
// endpoints, while staying cleanly importable via extensionless `./_lib`.

import { createHash } from "node:crypto";
import {
  getAddressFromPublicKey,
  publicKeyFromSignatureRsv,
} from "@stacks/transactions";

export type ApiHeaders = Record<string, string | string[] | undefined>;

// Normalize a 32-byte Stacks transaction ID into 64 lowercase hex characters,
// stripping an optional `0x` / `0X` prefix. Returns null if malformed.
export function normalizeTxid(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const hex = raw.trim().replace(/^0x/i, "").toLowerCase();
  return /^[0-9a-f]{64}$/.test(hex) ? hex : null;
}

// Extract the caller IP from Vercel / reverse-proxy headers.
export function clientIp(req: { headers?: ApiHeaders }): string {
  const fwd = req.headers?.["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers?.["x-real-ip"];
  return (Array.isArray(real) ? real[0] : real)?.trim() || "unknown";
}

function upstashConfig(): { url?: string; token?: string; required: boolean } {
  return {
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
    required: process.env.SATO_REQUIRE_REDIS === "true",
  };
}

async function redis(url: string, token: string, cmd: (string | number)[]): Promise<any> {
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(cmd),
  });
  if (!resp.ok) throw new Error(`upstash ${resp.status}`);
  return ((await resp.json()) as { result?: unknown }).result ?? null;
}

const memHits = new Map<string, { n: number; resetAt: number }>();
const memClaimedTxids = new Set<string>();

// Best-effort in-memory counter when Upstash isn't configured.
function memIncr(key: string, windowSeconds: number): number {
  const now = Date.now();
  const e = memHits.get(key);
  if (!e || e.resetAt <= now) {
    memHits.set(key, { n: 1, resetAt: now + windowSeconds * 1000 });
    return 1;
  }
  e.n += 1;
  return e.n;
}

// Reset in-memory rate-limit & claim stores (for deterministic unit tests).
export function _resetMemoryStoresForTest(): void {
  memHits.clear();
  memClaimedTxids.clear();
}

// Fixed-window counter under `sato:<namespace>:<id>`. Returns true when the
// caller is OVER `max` hits for the current window.
// When `SATO_REQUIRE_REDIS=true`, missing or failing Redis fails closed (throws
// so callers return 503 rather than silently bypassing limits).
export async function rateLimit(
  namespace: string,
  id: string,
  max: number,
  windowSeconds: number
): Promise<boolean> {
  const key = `sato:${namespace}:${id}`;
  const { url, token, required } = upstashConfig();
  let used: number;

  if (url && token) {
    try {
      used = Number((await redis(url, token, ["INCR", key])) ?? 0);
      if (used === 1) await redis(url, token, ["EXPIRE", key, windowSeconds]);
    } catch (err) {
      if (required) throw err;
      used = memIncr(key, windowSeconds);
    }
  } else {
    if (required) throw new Error("Redis rate-limit store is not configured.");
    used = memIncr(key, windowSeconds);
  }

  return used > max;
}

export type ClaimResult =
  | { ok: true }
  | { ok: false; reason: "duplicate" | "store_unavailable" };

const CLAIM_TTL_SECONDS = 2_592_000; // 30 days

// Claim a treasury payment txid once across ALL treasury-fulfilling endpoints
// (`/api/pay` and `/api/offramp`) so a single on-chain payment cannot be
// redeemed on both endpoints or replayed with different `0x`/hex casing.
export async function claimTreasuryTxid(
  rawTxid: string,
  opts?: { requireDurable?: boolean }
): Promise<ClaimResult> {
  const txid = normalizeTxid(rawTxid);
  if (!txid) return { ok: false, reason: "duplicate" };

  const key = `sato:treasury:txid:${txid}`;
  const { url, token, required } = upstashConfig();
  const mustBeDurable = Boolean(opts?.requireDurable) || required;

  if (url && token) {
    try {
      const res = await redis(url, token, ["SET", key, "1", "NX", "EX", CLAIM_TTL_SECONDS]);
      return res === "OK" ? { ok: true } : { ok: false, reason: "duplicate" };
    } catch {
      if (mustBeDurable) return { ok: false, reason: "store_unavailable" };
    }
  } else if (mustBeDurable) {
    return { ok: false, reason: "store_unavailable" };
  }

  if (memClaimedTxids.has(key)) return { ok: false, reason: "duplicate" };
  memClaimedTxids.add(key);
  return { ok: true };
}

function encodeVarint(n: number): Buffer {
  if (n < 0xfd) return Buffer.from([n]);
  if (n <= 0xffff) {
    const b = Buffer.alloc(3);
    b[0] = 0xfd;
    b.writeUInt16LE(n, 1);
    return b;
  }
  const b = Buffer.alloc(5);
  b[0] = 0xfe;
  b.writeUInt32LE(n, 1);
  return b;
}

// Exact Stacks signed-message SHA-256 hash (`\x17Stacks Signed Message:\n` +
// varint byte length + UTF-8 message bytes), matching @stacks/connect &
// @stacks/encryption's `hashMessage`.
export function hashStacksMessage(message: string): string {
  const prefix = Buffer.from("\x17Stacks Signed Message:\n", "utf8");
  const body = Buffer.from(message, "utf8");
  return createHash("sha256")
    .update(Buffer.concat([prefix, encodeVarint(body.length), body]))
    .digest("hex");
}

// Verify an RSV signature (130 hex chars, optional `0x` prefix) recovered
// against `expectedAddress` on the given Stacks network.
export function verifyPayerSignature(args: {
  message: string;
  signature: string;
  expectedAddress: string;
  network: "testnet" | "mainnet";
}): boolean {
  try {
    if (!args.signature || !args.expectedAddress) return false;
    const cleanSig = args.signature.trim().replace(/^0x/i, "").toLowerCase();
    if (!/^[0-9a-f]{130}$/.test(cleanSig)) return false;
    const hash = hashStacksMessage(args.message);
    const pubKey = publicKeyFromSignatureRsv(hash, cleanSig);
    const recovered = getAddressFromPublicKey(pubKey, args.network);
    return recovered === args.expectedAddress;
  } catch {
    return false;
  }
}
