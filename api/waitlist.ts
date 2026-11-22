// api/waitlist.ts — waitlist signup via Resend, using official Sato mail.
//
// On every signup two emails go out, both sent FROM the official Sato address
// (requires the sending domain to be verified in Resend):
//   1. owner notification  -> the team inbox (must succeed, else 502)
//   2. user confirmation   -> the person who signed up (best-effort; a failure
//      here still returns 200 so one Resend hiccup never blocks a signup)
//
// Because the endpoint is public and spends a third-party email quota, it
// defends itself:
//   - strict method + email validation, with a hard length cap,
//   - HTML-escapes anything user-controlled before it lands in an email body,
//   - a honeypot field silently absorbs naive bots,
//   - a per-IP rate limit (durable when Upstash is configured) caps abuse.

import { clientIp, rateLimit, type ApiHeaders } from "./_lib";

type Request = {
  method?: string;
  body?: { email?: string; audience?: string; company?: string };
  headers?: ApiHeaders;
};

type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

// Official sending identity. The domain part MUST be verified in Resend
// (dashboard -> Domains) or the API rejects the send. Override via env.
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL || "Sato <hello@satoxbt.com>";
const OWNER_EMAIL = process.env.WAITLIST_OWNER_EMAIL || "team.satofinance@gmail.com";
const MAX_EMAIL_LENGTH = 254; // RFC 5321 maximum forward-path length

// Per-IP rate limit. Durable when Upstash Redis is configured; otherwise a
// best-effort in-memory counter that resets on cold start and isn't shared
// across instances (same pattern as api/sponsor.ts). Tunable via env.
const WINDOW_SECONDS = Number(process.env.WAITLIST_WINDOW_SECONDS) || 3600;
const MAX_PER_WINDOW = Number(process.env.WAITLIST_MAX_PER_WINDOW) || 8;

// Escape the five HTML-significant characters so a crafted address can't inject
// markup into the emails anyone opens.
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

// Count this attempt against the caller's IP window. Incr-first so bursts can't
// race past the cap; degrades to the in-memory counter unless Redis is required.
async function overRateLimit(ip: string): Promise<boolean> {
  return rateLimit("waitlist:rl", ip, MAX_PER_WINDOW, WINDOW_SECONDS);
}

type EmailPayload = {
  to: string[];
  reply_to?: string;
  subject: string;
  text: string;
  html: string;
};

async function sendEmail(apiKey: string, payload: EmailPayload): Promise<boolean> {
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM_EMAIL, ...payload }),
  });
  if (!response.ok) {
    console.error(`resend rejected "${payload.subject}": ${response.status}`);
    return false;
  }
  return true;
}

function ownerHtml(email: string, audience: string): string {
  const safeEmail = escapeHtml(email);
  return `<div style="font-family:Arial,sans-serif;max-width:560px;padding:28px;background:#f5f4ef;color:#111925"><div style="background:#111925;color:#fff;border-radius:16px;padding:28px"><p style="color:#ff8d66;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Sato waitlist</p><h1 style="font-size:28px;margin:10px 0 22px">New ${audience} signup.</h1><p style="color:#b8c2ce;line-height:1.6">Someone joined the ${audience} waitlist from the Sato landing page.</p><div style="border:1px solid #344354;border-radius:10px;padding:16px;margin-top:22px"><p style="margin:0 0 8px;color:#8d9aaa;font-size:12px">EMAIL</p><strong style="font-size:18px">${safeEmail}</strong></div></div></div>`;
}

function userHtml(audience: string): string {
  const line =
    audience === "businesses"
      ? "We'll reach out with business onboarding and regional availability first."
      : "We'll email you the moment your invite is ready in your region.";
  return `<div style="font-family:Arial,Helvetica,sans-serif;max-width:560px;margin:0 auto;padding:28px 16px;background:#f5f4ef;color:#111925"><div style="background:#111925;color:#fff;border-radius:20px;padding:36px 30px;overflow:hidden"><p style="margin:0;font-size:22px;font-weight:800;letter-spacing:-.04em;color:#fff">sato</p><p style="color:#ff8d66;font-size:11px;letter-spacing:.16em;text-transform:uppercase;margin:22px 0 0">Early access confirmed</p><h1 style="font-size:32px;line-height:1.05;margin:12px 0 16px;color:#fff">You're on the list.</h1><p style="color:#b8c2ce;font-size:15px;line-height:1.7;margin:0 0 8px">Sato is Bitcoin money that feels human — send to @usernames, earn on your balance, and cash out to local currency.</p><p style="color:#b8c2ce;font-size:15px;line-height:1.7;margin:0">${line}</p><a href="https://satoxbt.com" style="display:inline-block;margin-top:24px;background:#f15a24;color:#fff;font-size:14px;font-weight:800;text-decoration:none;border-radius:999px;padding:14px 28px">Explore Sato</a><div style="border-top:1px solid #2b3949;margin-top:28px;padding-top:16px"><p style="color:#7d8b9c;font-size:12px;line-height:1.6;margin:0">One useful email. No noise. Sato is in preview — features shown on the site are illustrative and subject to change. Just reply to this email if you need anything.</p><p style="margin:12px 0 0;font-size:12px"><a href="https://satoxbt.com/security" style="color:#8d9aaa;text-decoration:underline">Security</a><span style="color:#3a4656"> · </span><a href="https://satoxbt.com/privacy" style="color:#8d9aaa;text-decoration:underline">Privacy</a><span style="color:#3a4656"> · </span><a href="https://testnet.satoxbt.com/app" style="color:#8d9aaa;text-decoration:underline">Testnet app</a></p></div></div><p style="text-align:center;color:#8c98aa;font-size:11px;margin:16px 0 0">© 2026 Sato · Built on Bitcoin</p></div>`;
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
  try {
    if (await overRateLimit(clientIp(req))) {
      return res.status(429).json({ error: "Too many signups from here. Please try again later." });
    }
  } catch {
    return res.status(503).json({ error: "Rate limit store unavailable — try again shortly." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Email service is not configured yet." });

  // Send team notification and user confirmation in parallel to halve response latency.
  // Team notification must succeed; user confirmation remains best-effort.
  const [ownerSent, userSent] = await Promise.all([
    sendEmail(apiKey, {
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `New Sato ${audience} waitlist signup`,
      text: `New Sato waitlist signup\n\nAudience: ${audience}\nEmail: ${email}\nSource: satoxbt.com`,
      html: ownerHtml(email, audience),
    }),
    sendEmail(apiKey, {
      to: [email],
      reply_to: OWNER_EMAIL,
      subject: "You're on the Sato waitlist",
      text: `You're on the Sato waitlist.\n\nSato is Bitcoin money that feels human — send to @usernames, earn on your balance, and cash out to local currency.\n\n${audience === "businesses" ? "We'll reach out with business onboarding and regional availability first." : "We'll email you the moment your invite is ready in your region."}\n\nOne useful email. No noise. Just reply to this email if you need anything.`,
      html: userHtml(audience),
    }),
  ]);
  if (!ownerSent) return res.status(502).json({ error: "Resend could not accept the signup yet." });
  if (!userSent) console.error(`waitlist confirmation failed for ${email}`);

  return res.status(200).json({ ok: true });
}
