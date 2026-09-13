import { ArrowLeft, ArrowRight, Check, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import type { ReactNode } from "react";

type AudiencePageProps = { eyebrow: string; title: ReactNode; intro: string; bullets: string[]; cta: string };

export default function AudiencePage({ eyebrow, title, intro, bullets, cta }: AudiencePageProps) {
  return <div className="audience-shell"><header className="site-header audience-header"><Link className="brand" href="/" aria-label="Sato home"><span className="brand-mark"><img src="/manus-storage/sato-logo_570c63a5.png" alt="" /></span><span className="brand-name">sato</span></Link><Link className="audience-back" href="/"><ArrowLeft size={15} /> Back to Sato</Link></header><main className="audience-main section-pad"><div className="audience-kicker"><span className="section-kicker">{eyebrow}</span><span className="audience-status"><span /> Coming soon</span></div><div className="audience-hero"><h1>{title}</h1><p>{intro}</p><Link className="primary-button" href="/#waitlist">{cta} <ArrowRight size={17} /></Link></div><div className="audience-promise"><div className="audience-promise-head"><ShieldCheck size={19} /><strong>Designed around real money movement.</strong></div><div className="audience-bullets">{bullets.map((bullet) => <div key={bullet}><span><Check size={13} /></span><p>{bullet}</p></div>)}</div></div></main><footer className="audience-footer section-pad"><Link className="brand" href="/"><span className="brand-mark"><img src="/manus-storage/sato-logo_570c63a5.png" alt="" /></span><span className="brand-name">sato</span></Link><span>© 2026 Sato. Built on Bitcoin.</span></footer></div>;
}
