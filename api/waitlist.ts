type Request = {
  method?: string;
  body?: { email?: string; audience?: string };
};

type Response = {
  status: (code: number) => Response;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

const OWNER_EMAIL = "team.satofinance@gmail.com";
const FROM_EMAIL = "Sato <onboarding@resend.dev>";

export default async function handler(req: Request, res: Response) {
  res.setHeader("Content-Type", "application/json");
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const email = req.body?.email?.trim();
  const audience = req.body?.audience === "businesses" ? "businesses" : "people";
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ error: "Enter a valid email address." });
  }

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "Email service is not configured yet." });

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: FROM_EMAIL,
      to: [OWNER_EMAIL],
      reply_to: email,
      subject: `New Sato ${audience} waitlist signup`,
      text: `New Sato waitlist signup\n\nAudience: ${audience}\nEmail: ${email}\nSource: satofinance.vercel.app`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;padding:28px;background:#f5f4ef;color:#111925"><div style="background:#111925;color:#fff;border-radius:16px;padding:28px"><p style="color:#ff8d66;font-size:12px;letter-spacing:.12em;text-transform:uppercase">Sato waitlist</p><h1 style="font-size:28px;margin:10px 0 22px">New ${audience} signup.</h1><p style="color:#b8c2ce;line-height:1.6">Someone joined the ${audience} waitlist from the Sato landing page.</p><div style="border:1px solid #344354;border-radius:10px;padding:16px;margin-top:22px"><p style="margin:0 0 8px;color:#8d9aaa;font-size:12px">EMAIL</p><strong style="font-size:18px">${email}</strong></div></div></div>`,
    }),
  });

  if (!response.ok) return res.status(502).json({ error: "Resend could not accept the signup yet." });
  return res.status(200).json({ ok: true });
}
