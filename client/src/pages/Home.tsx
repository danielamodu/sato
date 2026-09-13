import { useState } from "react";
import { ArrowRight, ArrowUpRight, AtSign, Banknote, Check, ChevronRight, CircleDollarSign, Menu, ShieldCheck, Sparkles, X } from "lucide-react";

const logoSrc = "/manus-storage/sato-logo_570c63a5.png";

const features = [
  { icon: AtSign, label: "Payments", title: "Send to @anyone", body: "Skip the wallet address. Find a person or business by username and send in a few taps." },
  { icon: CircleDollarSign, label: "Balance", title: "Earn while it sits", body: "Your sBTC balance keeps working in the background, without another account to manage." },
  { icon: Banknote, label: "Off-ramp", title: "Cash out when you need it", body: "Move from Bitcoin to your local currency and back to your bank, on your terms." },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (email.trim()) setSubmitted(true);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Sato home"><span className="brand-mark"><img src={logoSrc} alt="" /></span><span className="brand-name">sato</span></a>
        <nav className={menuOpen ? "nav-links nav-open" : "nav-links"} aria-label="Main navigation">
          <a href="#product" onClick={() => setMenuOpen(false)}>Product</a><a href="#why-sato" onClick={() => setMenuOpen(false)}>Why Sato</a><a href="#waitlist" onClick={() => setMenuOpen(false)}>For merchants</a><a className="nav-cta" href="#waitlist" onClick={() => setMenuOpen(false)}>Get early access <ArrowUpRight size={15} /></a>
        </nav>
        <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </header>

      <main id="top">
        <section className="hero section-pad" id="product">
          <div className="hero-copy reveal reveal-one">
            <div className="status-label"><span className="status-pulse" /> Built on Bitcoin <span className="label-separator">·</span> Powered by Stacks</div>
            <h1>Bitcoin payments<br /><span>that feel human.</span></h1>
            <p className="hero-lede">Send to <strong>@anyone</strong>, earn on your balance, and cash out to your local currency. Sato puts everyday money movement in one simple place.</p>
            <div className="hero-actions"><a className="primary-button" href="#waitlist">Get early access <ArrowRight size={17} /></a><a className="text-link" href="#why-sato">See how it works <ChevronRight size={15} /></a></div>
            <div className="trust-row"><span><ShieldCheck size={15} /> No wallet addresses</span><span><Sparkles size={14} /> Made for everyday use</span></div>
          </div>

          <div className="product-stage reveal reveal-two" aria-label="Illustrative Sato product preview">
            <div className="stage-glow" />
            <div className="app-window">
              <div className="app-topbar"><div className="window-dots"><i /><i /><i /></div><span className="preview-label">SATO PREVIEW</span><span className="app-avatar">SA</span></div>
              <div className="app-content">
                <div className="app-heading"><div><small>Good morning, Sam</small><h2>Your money, moving.</h2></div><button aria-label="Open notifications"><span className="notification-dot" /></button></div>
                <div className="balance-card"><div className="balance-top"><span>Total balance</span><span className="eye-dot">•••</span></div><div className="balance-amount">$2,480<span>.65</span></div><div className="balance-meta"><span>₿ 0.03812</span><span className="positive">+4.8% this month</span></div><div className="balance-chart"><svg viewBox="0 0 360 70" preserveAspectRatio="none" aria-hidden="true"><path d="M0 58 C28 57 34 40 60 46 S88 57 113 36 S143 41 164 30 S193 42 214 24 S249 28 265 18 S299 31 319 10 S346 15 360 2" fill="none" stroke="currentColor" strokeWidth="2.5" /><path d="M0 58 C28 57 34 40 60 46 S88 57 113 36 S143 41 164 30 S193 42 214 24 S249 28 265 18 S299 31 319 10 S346 15 360 2 V70 H0Z" fill="currentColor" opacity=".06" /></svg></div></div>
                <div className="send-card"><div className="send-card-head"><span>Quick send</span><span className="orange-tag">sBTC</span></div><div className="recipient"><span className="recipient-avatar">AM</span><span><small>Sending to</small><strong>@amani</strong></span><Check size={16} /></div><div className="send-amount"><span>0.012</span><small>sBTC&nbsp; ≈ $780.42</small></div><button className="send-button">Review payment <ArrowRight size={15} /></button></div>
                <div className="activity-row"><span className="activity-icon"><Check size={13} /></span><span><strong>Last payment confirmed</strong><small>Today · 12:42 PM</small></span><b>+₿ 0.004</b></div>
              </div>
            </div>
            <div className="merchant-toast"><span className="merchant-icon"><Check size={15} /></span><span><small>Merchant preview</small><strong>Payment received</strong></span><b>₿ 0.012</b></div>
            <div className="stage-caption"><span className="caption-line" /> An everyday money app<br />for a Bitcoin world.</div>
          </div>
        </section>

        <section className="proof-strip"><div><span className="proof-kicker">01</span><strong>Simple by default</strong><small>Familiar flows, no crypto homework.</small></div><div><span className="proof-kicker">02</span><strong>Clear at every step</strong><small>See the amount, fee, and status.</small></div><div><span className="proof-kicker">03</span><strong>For both sides</strong><small>Pay simply. Get paid simply.</small></div></section>

        <section className="why-section section-pad" id="why-sato">
          <div className="section-heading reveal"><span className="section-kicker">The Sato way</span><h2>All the good<br />parts of Bitcoin.</h2><p>None of the parts that make people ask for a tutorial.</p></div>
          <div className="feature-grid">{features.map(({ icon: Icon, label, title, body }, index) => <article className="feature-card reveal" key={label}><div className="feature-card-top"><span className="feature-index">0{index + 1}</span><span className="feature-icon"><Icon size={19} /></span></div><span className="feature-label">{label}</span><h3>{title}</h3><p>{body}</p><a href="#waitlist" aria-label={`Learn more about ${title}`}>Learn more <ArrowUpRight size={14} /></a></article>)}</div>
        </section>

        <section className="steps-section section-pad"><div className="steps-heading"><span className="section-kicker">How it works</span><h2>From <span>@username</span><br />to <strong>done.</strong></h2></div><div className="steps-track"><div className="step active"><span>01</span><div className="step-icon"><AtSign size={21} /></div><strong>Choose who to pay</strong><p>Find a person or business by @username.</p></div><div className="step"><span>02</span><div className="step-icon"><ArrowRight size={21} /></div><strong>Set the amount</strong><p>See Bitcoin and local currency together.</p></div><div className="step"><span>03</span><div className="step-icon"><Check size={21} /></div><strong>Payment confirmed</strong><p>Both sides get a clear receipt.</p></div></div></section>

        <section className="waitlist-section section-pad" id="waitlist"><div className="waitlist-inner"><div><div className="status-label light"><span className="status-pulse" /> Now building</div><h2>Be first<br />in line.</h2><p>Join the early access list. We’ll share the first invite when Sato is ready in your region.</p></div><div className="waitlist-panel">{submitted ? <div className="success-message"><span><Check size={17} /></span><div><strong>You’re on the list.</strong><small>We’ll be in touch when Sato is ready.</small></div></div> : <form className="waitlist-form" onSubmit={handleSubmit}><label htmlFor="email">Email address</label><div className="input-row"><input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="submit" aria-label="Join the Sato waitlist"><ArrowRight size={19} /></button></div><small>One useful email. No noise.</small></form>}<div className="audience-note"><span>For people</span><span>For businesses</span><span>Built on Bitcoin</span></div></div></div></section>
      </main>
      <footer className="site-footer section-pad"><a className="brand" href="#top"><span className="brand-mark"><img src={logoSrc} alt="" /></span><span className="brand-name">sato</span></a><div className="footer-links"><a href="#product">Product</a><a href="#why-sato">Why Sato</a><a href="#waitlist">Early access</a></div><p>© 2026 Sato. Built on Bitcoin.</p></footer>
    </div>
  );
}
