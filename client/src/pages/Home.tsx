import { useState } from "react";
import { ArrowRight, ArrowUpRight, AtSign, Banknote, Check, CircleDollarSign, Menu, X } from "lucide-react";

const logoSrc = "/manus-storage/sato-logo_570c63a5.png";

const features = [
  {
    number: "01",
    icon: AtSign,
    title: "Send by username",
    body: "No wallet addresses. No copy-paste errors. Just @username and done.",
    note: "For people, not protocols",
  },
  {
    number: "02",
    icon: CircleDollarSign,
    title: "Your money works for you",
    body: "Your sBTC earns yield automatically while it sits. Watch your balance grow without doing anything.",
    note: "A little more, over time",
  },
  {
    number: "03",
    icon: Banknote,
    title: "Cash out anytime",
    body: "Convert to your local currency and withdraw to your bank whenever you need it.",
    note: "Bitcoin, on your terms",
  },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim()) return;
    setSubmitted(true);
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Sato home">
          <span className="brand-mark"><img src={logoSrc} alt="" /></span>
          <span className="brand-name">sato</span>
        </a>
        <nav className={menuOpen ? "nav-links nav-open" : "nav-links"} aria-label="Main navigation">
          <a href="#why-sato" onClick={() => setMenuOpen(false)}>Why Sato</a>
          <a href="#waitlist" onClick={() => setMenuOpen(false)}>Early access</a>
          <a href="#waitlist" className="nav-cta" onClick={() => setMenuOpen(false)}>Join the waitlist <ArrowUpRight size={15} /></a>
        </nav>
        <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </header>

      <main id="top">
        <section className="hero section-pad">
          <div className="hero-copy reveal reveal-one">
            <p className="eyebrow"><span className="signal-dot" /> Built on Bitcoin · Made for everyday life</p>
            <h1>Send Bitcoin<br /><em>like a text.</em></h1>
            <p className="hero-lede">Sato is a Bitcoin payment app for real people. Send to <strong>@anyone</strong>, earn on your balance, cash out whenever.</p>
            <a className="primary-button" href="#waitlist">Join the waitlist <ArrowRight size={18} /></a>
            <p className="micro-note">Be first to use Sato when we open the doors.</p>
          </div>

          <div className="hero-visual reveal reveal-two" aria-label="Sato balance preview">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <div className="phone-card">
              <div className="phone-top"><span>Sato balance</span><span className="live-pill"><span /> Live</span></div>
              <div className="balance">₿ 0.0842</div>
              <div className="balance-usd">$5,480.12 <span>+4.8%</span></div>
              <div className="chart" aria-hidden="true"><span /><span /><span /><span /><span /><span /><span /><span /></div>
              <div className="phone-divider" />
              <div className="transaction"><span className="transaction-avatar">AM</span><span><strong>@amani</strong><small>Sent you sBTC</small></span><b>+₿ 0.012</b></div>
              <div className="transaction"><span className="transaction-avatar orange">↗</span><span><strong>Cash out</strong><small>To local bank</small></span><b className="muted">−$120.00</b></div>
              <div className="phone-footer"><span>Yield is on</span><span className="yield-dot" /></div>
            </div>
            <div className="visual-caption"><span>01</span><span>Money that moves<br />at your speed.</span></div>
          </div>
        </section>

        <section className="ticker" aria-label="Sato principles">
          <div className="ticker-track"><span>simple by design</span><i>✳</i><span>built on Stacks</span><i>✳</i><span>made for real life</span><i>✳</i><span>simple by design</span><i>✳</i><span>built on Stacks</span><i>✳</i></div>
        </section>

        <section className="why-section section-pad" id="why-sato">
          <div className="section-intro reveal"><p className="eyebrow">Why Sato</p><h2>Bitcoin, without<br /><em>the homework.</em></h2><p>Money should feel simple. Sato keeps the power of Bitcoin and removes the parts that get in the way.</p></div>
          <div className="feature-list">
            {features.map(({ number, icon: Icon, title, body, note }) => (
              <article className="feature-row reveal" key={number}>
                <div className="feature-number">{number}</div>
                <div className="feature-icon"><Icon size={22} strokeWidth={1.5} /></div>
                <div className="feature-content"><h3>{title}</h3><p>{body}</p></div>
                <div className="feature-note">{note}<ArrowUpRight size={16} /></div>
              </article>
            ))}
          </div>
        </section>

        <section className="waitlist-section section-pad" id="waitlist">
          <div className="waitlist-inner reveal">
            <div><p className="eyebrow"><span className="signal-dot" /> Early access</p><h2>Be early.<br /><em>Stay in control.</em></h2></div>
            <div className="waitlist-form-wrap">
              <p>We’re building Sato in public. Leave your email and we’ll let you know when it’s ready for you.</p>
              {submitted ? (
                <div className="success-message"><span><Check size={16} /></span><div><strong>You’re on the list.</strong><small>We’ll be in touch when Sato is ready.</small></div></div>
              ) : (
                <form className="waitlist-form" onSubmit={handleSubmit}>
                  <label htmlFor="email">Your email address</label>
                  <div className="input-row"><input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="submit" aria-label="Join the Sato waitlist"><ArrowRight size={20} /></button></div>
                  <small>No spam. Just one email when it matters.</small>
                </form>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer section-pad"><a className="brand" href="#top"><span className="brand-mark"><img src={logoSrc} alt="" /></span><span className="brand-name">sato</span></a><p>© 2026 Sato. Built on Bitcoin.</p><a href="#top" className="back-top">Back to top <ArrowUpRight size={15} /></a></footer>
    </div>
  );
}
