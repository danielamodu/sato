import { ArrowLeft, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { Link } from "wouter";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  sections: { heading: string; body: string }[];
};

export default function LegalPage({ eyebrow, title, intro, updated, sections }: LegalPageProps) {
  return (
    <div className="legal-shell">
      <header className="site-header legal-header">
        <Link className="brand" href="/" aria-label="Sato home"><span className="brand-mark"><img src="/assets/sato-logo.png" alt="" /></span><span className="brand-name">sato</span></Link>
        <Link className="legal-back" href="/"><ArrowLeft size={15} /> Back to Sato</Link>
      </header>
      <main className="legal-main section-pad">
        <div className="legal-topline"><span className="section-kicker">{eyebrow}</span><span className="legal-status"><span /> Placeholder · {updated}</span></div>
        <div className="legal-hero"><h1>{title}</h1><p>{intro}</p></div>
        <div className="legal-layout">
          <aside className="legal-aside"><div className="legal-aside-icon"><ShieldCheck size={20} /></div><strong>Built for clarity.</strong><p>These placeholder pages outline the information Sato plans to publish before launch.</p><Link href="/" className="legal-aside-link">Return home <ArrowUpRight size={14} /></Link></aside>
          <div className="legal-sections">{sections.map((section) => <section className="legal-section" key={section.heading}><div className="legal-section-mark"><Check size={14} /></div><div><h2>{section.heading}</h2><p>{section.body}</p></div></section>)}</div>
        </div>
        <div className="legal-notice"><strong>Placeholder notice</strong><p>This page is an early content placeholder, not a final legal document. Sato will publish reviewed policies and terms before the product becomes available.</p></div>
      </main>
      <footer className="site-footer section-pad"><Link className="brand" href="/"><span className="brand-mark"><img src="/assets/sato-logo.png" alt="" /></span><span className="brand-name">sato</span></Link><p>© 2026 Sato. Built on Bitcoin.</p></footer>
    </div>
  );
}
