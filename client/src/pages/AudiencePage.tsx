import { useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { ArrowLeft, ArrowRight, Check, ShieldCheck, X } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";

type AudiencePageProps = { eyebrow: string; title: ReactNode; intro: string; bullets: string[]; cta: string };

export default function AudiencePage({ eyebrow, title, intro, bullets, cta }: AudiencePageProps) {
  usePageMeta(`Sato ${eyebrow.toLowerCase()} — Bitcoin payments made human.`, intro);
  const [modalOpen, setModalOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const audience = eyebrow.toLowerCase();

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), audience }) });
      if (!response.ok) throw new Error("Unable to join the waitlist yet.");
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to join the waitlist yet.");
    } finally {
      setSending(false);
    }
  }

  return <div className="audience-shell"><header className="site-header audience-header"><Link className="brand" href="/" aria-label="Sato home"><span className="brand-mark"><img src="/assets/sato-logo.png" alt="" /></span><span className="brand-name">sato</span></Link><Link className="audience-back" href="/"><ArrowLeft size={15} /> Back to Sato</Link></header><main className="audience-main section-pad"><div className="audience-kicker"><span className="section-kicker">{eyebrow}</span><span className="audience-status"><span /> Coming soon</span></div><div className="audience-hero"><h1>{title}</h1><p>{intro}</p><button className="primary-button" onClick={() => { setModalOpen(true); setSubmitted(false); setSubmitError(""); }}>{cta} <ArrowRight size={17} /></button></div><div className="audience-promise"><div className="audience-promise-head"><ShieldCheck size={19} /><strong>Designed around real money movement.</strong></div><div className="audience-bullets">{bullets.map((bullet) => <div key={bullet}><span><Check size={13} /></span><p>{bullet}</p></div>)}</div></div></main><footer className="audience-footer section-pad"><Link className="brand" href="/"><span className="brand-mark"><img src="/assets/sato-logo.png" alt="" /></span><span className="brand-name">sato</span></Link><span>© 2026 Sato. Built on Bitcoin.</span></footer>{modalOpen && <div className="waitlist-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.currentTarget === event.target) setModalOpen(false); }}><section className="waitlist-modal" role="dialog" aria-modal="true" aria-labelledby="waitlist-modal-title"><button className="modal-close" aria-label="Close waitlist form" onClick={() => setModalOpen(false)}><X size={17} /></button>{submitted ? <div className="modal-success"><span className="modal-success-icon"><Check size={19} /></span><span className="section-kicker">You’re on the list</span><h2 id="waitlist-modal-title">A little note<br /><em>is on its way.</em></h2><p>We’ve saved your place for the {audience} waitlist. When Sato is ready, we’ll send a short, useful update to <strong>{email}</strong>.</p><div className="email-preview"><small>FROM SATO · SUBJECT</small><strong>You’re in. Welcome to Sato.</strong><p>Thanks for joining us. We’re building a simpler way to move money with Bitcoin.</p></div><button className="modal-secondary" onClick={() => setModalOpen(false)}>Back to page</button></div> : <><span className="section-kicker">Early access · {audience}</span><h2 id="waitlist-modal-title">Join the<br /><em>first wave.</em></h2><p className="modal-intro">Leave your email and we’ll send one thoughtful note when Sato is ready for you.</p><form className="modal-form" onSubmit={handleSubmit}><label htmlFor="audience-email">Email address</label><div><input id="audience-email" type="email" required autoFocus placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="submit" aria-label="Join waitlist" disabled={sending}><ArrowRight size={17} /></button></div><small>{submitError || (sending ? "Sending your note…" : "No noise. Just the useful stuff.")}</small></form></>}</section></div>}</div>;
}
