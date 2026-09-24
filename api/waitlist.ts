// api/waitlist.ts — waitlist signup notifier.
//
// Public, unauthenticated write endpoint: it emails the owner (via Resend) when
// someone joins the waitlist. Because it is public and spends a third-party
// email quota into a real inbox, it defends itself:
//   - strict method + email validation, with a hard length cap,
//   - HTML-escapes anything user-controlled before it lands in the email body,
//   - a honeypot field silently absorbs naive bots,
//   - a per-IP rate limit (durable when Upstash is configured) caps abuse.

type Request = {
  method?: string;
  body?: { email?: string; audience?: string; company?: string };
  headers?: Record<string, string | string[] | undefined>;
};

type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const OWNER_EMAIL = "team.satofinance@gmail.com";
const FROM_EMAIL = "Sato <onboarding@resend.dev>";
const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum forward-path length

// Per-IP rate limit. Durable when Upstash Redis is configured; otherwise a
// best-effort in-memory counter that resets on cold start and isn't shared
// across instances (same pattern as api/sponsor.ts). Tunable via env.
const WINDOW_SECONDS = Number(process.env.WAITLIST_WINDOW_SECONDS) || 3600;
const MAX_PER_WINDOW = Number(process.env.WAITLIST_MAX_PER_WINDOW) || 8;
const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

// Escape the five HTML-significant characters so a crafted address can't inject
// markup into the notification email the owner opens.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
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

async function redis(cmd: (string | number)[]): Promise<number> {
  const resp = await fetch(UPSTASH_URL as string, {
    method: "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd),
  });
  if (!resp.ok) throw new Error(`upstash ${resp.status}`);
  const data = (await resp.json()) as { result?: number };
  return Number(data.result ?? 0);
}

// Count this attempt against the caller's IP window. Incr-first so bursts can't
// race past the cap; degrades to the in-memory counter if the store hiccups.
async function overRateLimit(ip: string): Promise<boolean> {
  const key = `sato:waitlist:rl:${ip}`;
  let used: number;
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    try {
      used = await redis(["INCR", key]);
      if (used === 1) await redis(["EXPIRE", key, WINDOW_SECONDS]);
    } catch {
      used = memIncr(key);
    }
  } else {
    used = memIncr(key);
  }
  return used > MAX_PER_WINDOW;
}

function clientIp(req: Request): string {
  const fwd = req.headers?.["x-forwarded-for"];
  const first = (Array.isArray(fwd) ? fwd[0] : fwd)?.split(",")[0]?.trim();
  if (first) return first;
  const real = req.headers?.["x-real-ip"];
  return (Array.isArray(real) ? real[0] : real) || "unknown";
}

export default async function handler(req: Request, res: Response) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  // Honeypot: a hidden field real users never see or fill. If it has content,
  // treat the caller as a bot — accept silently (so it gets no signal) but send
  // nothing. Checked before validation so bots can't probe our rules either.
  const honeypot = req.body?.company;
  if (typeof honeypot === "string" && honeypot.trim().length > 0) {
    return res.status(200).json({ ok: true });
  }

  const email = req.body?.email?.trim();
  const audience = req.body?.audience === "businesses" ? "businesses" : "people";
  if (!email || email.length > MAX_EMAIL_LENGTH || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  // Cap how often one IP can spend our email quota / fill the owner's inbox.
  if (await overRateLimit(clientIp(req))) {
    return res.status(429).json({ error: "Too many signups from here. Please try again later." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Email service is not configured yet." });

  const safeEmail = escapeHtml(email);
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `New Sato ${audience} waitlist signup`,
      text: `New Sato waitlist signup\n\nAudience: ${audience}\nEmail: ${email}\nSource: satofinance.vercel.app`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;padding:28px;background:#f5f4ef;color:#111925"><div style="background:#111925;color:#fff;border-radius:16px;padding:28px"><p style="color:#ff8d66;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Sato waitlist</p><h1 style="font-size:28px;margin:10px 0 22px">New ${audience} signup.</h1><p style="color:#b8c2ce;line-height:1.6">Someone joined the ${audience} waitlist from the Sato landing page.</p><div style="border:1px solid #344354;border-radius:10px;padding:16px;margin-top:22px"><p style="margin:0 0 8px;color:#8d9aaa;font-size:12px">EMAIL</p><strong style="font-size:18px">${safeEmail}</strong></div></div></div>`,
    }),
  });

  if (!response.ok) return res.status(502).json({ error: "Resend could not accept the signup yet." });
  return res.status(200).json({ ok: true });
}
