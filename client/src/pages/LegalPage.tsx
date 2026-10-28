import { ArrowLeft, ArrowUpRight, Check, ShieldCheck } from "lucide-react";
import { Link } from "wouter";
import { usePageMeta } from "@/hooks/usePageMeta";

type LegalPageProps = {
  eyebrow: string;
  title: string;
  intro: string;
  updated: string;
  statusBadge?: string;
  asideTitle?: string;
  asideText?: string;
  sections: { heading: string; body: string | string[] }[];
};

export default function LegalPage({
  eyebrow,
  title,
  intro,
  updated,
  statusBadge = "Active Policy",
  asideTitle = "Built for transparency.",
  asideText = "Sato is designed to make Bitcoin payments simple, secure, and clear. Read our full operational terms and policies below.",
  sections,
}: LegalPageProps) {
  usePageMeta(`${eyebrow} · Sato`, intro);

  return (
    <div className="legal-shell">
      <header className="site-header legal-header">
        <Link className="brand" href="/" aria-label="Sato home">
          <span className="brand-mark">
            <img src="/assets/sato-logo.png" alt="" />
          </span>
          <span className="brand-name">sato</span>
        </Link>
        <Link className="legal-back" href="/">
          <ArrowLeft size={15} /> Back to Sato
        </Link>
      </header>

      <main className="legal-main section-pad">
        <div className="legal-topline">
          <span className="section-kicker">{eyebrow}</span>
          <span className="legal-status">
            <span /> {statusBadge} · {updated}
          </span>
        </div>

        <div className="legal-hero">
          <h1>{title}</h1>
          <p>{intro}</p>
        </div>

        <div className="legal-layout">
          <aside className="legal-aside">
            <div className="legal-aside-icon">
              <ShieldCheck size={20} />
            </div>
            <strong>{asideTitle}</strong>
            <p>{asideText}</p>
            <div className="policy-links" style={{ borderTop: "1px solid var(--line)", marginTop: 16, paddingTop: 14 }}>
              <Link href="/privacy" style={{ display: "block", marginBottom: 6 }}>Privacy Policy</Link>
              <Link href="/terms" style={{ display: "block", marginBottom: 6 }}>Terms of Service</Link>
              <Link href="/security" style={{ display: "block", marginBottom: 12 }}>Security Architecture</Link>
              <a href="https://docs.satoxbt.com" target="_blank" rel="noopener noreferrer" style={{ display: "flex", alignItems: "center", gap: 4, color: "var(--orange)", fontWeight: 700 }}>
                Developer Docs <ArrowUpRight size={13} />
              </a>
            </div>
            <Link href="/" className="legal-aside-link" style={{ marginTop: 16 }}>
              Return home <ArrowUpRight size={14} />
            </Link>
          </aside>

          <div className="legal-sections">
            {sections.map((section, idx) => (
              <section className="legal-section" key={section.heading}>
                <div className="legal-section-mark">
                  <span style={{ fontSize: 11, fontWeight: 700 }}>{idx + 1}</span>
                </div>
                <div>
                  <h2>{section.heading}</h2>
                  {Array.isArray(section.body) ? (
                    section.body.map((paragraph, pIdx) => (
                      <p key={pIdx} style={{ marginBottom: pIdx < section.body.length - 1 ? 12 : 0 }}>
                        {paragraph}
                      </p>
                    ))
                  ) : (
                    <p>{section.body}</p>
                  )}
                </div>
              </section>
            ))}
          </div>
        </div>

        <div className="legal-notice" style={{ marginTop: "4rem" }}>
          <strong>Legal & Compliance Inquiries</strong>
          <p>
            If you have questions regarding our terms, data practices, or regulatory compliance, please reach out directly
            to our legal team at{" "}
            <a href="mailto:team.satofinance@gmail.com" style={{ color: "var(--orange)", fontWeight: 700 }}>
              team.satofinance@gmail.com
            </a>
            .
          </p>
        </div>
      </main>

      <footer className="site-footer section-pad">
        <Link className="brand" href="/">
          <span className="brand-mark">
            <img src="/assets/sato-logo.png" alt="" />
          </span>
          <span className="brand-name">sato</span>
        </Link>
        <p>© 2026 Sato. Built on Bitcoin.</p>
      </footer>
    </div>
  );
}
