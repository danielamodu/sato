import { useEffect, useState } from "react";
import { ArrowRight, ArrowUpRight, AtSign, Banknote, Check, ChevronDown, ChevronRight, CircleDollarSign, Cookie, Mail, Menu, ShieldCheck, Sparkles, X } from "lucide-react";

const logoSrc = "/assets/sato-logo.png";

const features = [
  { icon: AtSign, label: "Payments", title: "Send to @anyone", body: "Skip the wallet address. Find a person or business by username and send in a few taps." },
  { icon: CircleDollarSign, label: "Balance", title: "Earn while it sits", body: "Your sBTC balance keeps working in the background, without another account to manage." },
  { icon: Banknote, label: "Off-ramp", title: "Cash out when you need it", body: "Move from Bitcoin to your local currency and back to your bank, on your terms." },
];

const faqs = [
  { question: "Who holds my money?", answer: "Sato is being designed around clear control and visibility. Before launch, we’ll explain exactly how balances are held, what Sato can and cannot access, and what your recovery options are. We won’t ask you to take custody claims on trust." },
  { question: "What does a payment cost?", answer: "You’ll see the amount, any Sato fee, and any network or conversion cost before you confirm. The final fee model and supported currencies will be published before invitations open." },
  { question: "How long do payments take to settle?", answer: "Sato will show a clear payment state—from sending to confirmed—so you know what has happened. Timing can depend on the Bitcoin and Stacks networks, the recipient, and the local-currency rail used for cash out." },
  { question: "Where will Sato be available?", answer: "Availability depends on local-currency partners and regional requirements. Join the waitlist and tell us where you’re based so we can share launch updates for your region first." },
];

export default function Home() {
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [consentVisible, setConsentVisible] = useState(false);
  const [activeSection, setActiveSection] = useState("product");

  useEffect(() => {
    setConsentVisible(window.localStorage.getItem("sato-cookie-consent") !== "set");
    const revealItems = document.querySelectorAll<HTMLElement>(".reveal");
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("in-view");
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.14, rootMargin: "0px 0px -8% 0px" });
    revealItems.forEach((item) => observer.observe(item));
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const sections = ["product", "why-sato", "trust", "waitlist"];
    const updateActiveSection = () => {
      const marker = window.scrollY + window.innerHeight * 0.35;
      let current = "product";
      sections.forEach((id) => {
        const section = document.getElementById(id);
        if (section && section.offsetTop <= marker) current = id;
      });
      setActiveSection(current);
    };
    updateActiveSection();
    window.addEventListener("scroll", updateActiveSection, { passive: true });
    window.addEventListener("resize", updateActiveSection);
    return () => { window.removeEventListener("scroll", updateActiveSection); window.removeEventListener("resize", updateActiveSection); };
  }, []);

  function saveConsent() {
    window.localStorage.setItem("sato-cookie-consent", "set");
    setConsentVisible(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setSubmitError("");
    try {
      const response = await fetch("/api/waitlist", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: email.trim(), audience: "people" }) });
      if (!response.ok) throw new Error("Unable to join the waitlist yet.");
      setSubmitted(true);
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "Unable to join the waitlist yet.");
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="site-shell">
      <header className="site-header">
        <a className="brand" href="#top" aria-label="Sato home"><span className="brand-mark"><img src={logoSrc} alt="" /></span><span className="brand-name">sato</span></a>
        <nav className="top-links" aria-label="Audience navigation">
          <a href="/people">For people</a><a href="/businesses">For businesses</a><a href="mailto:team.satofinance@gmail.com">Company</a><a className="top-login" href="mailto:team.satofinance@gmail.com">Contact</a><a className="top-signup" href="#waitlist">Sign up <ArrowUpRight size={13} /></a>
        </nav>
        <button className="menu-toggle" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>{menuOpen ? <X size={19} /> : <Menu size={19} />}</button>
      </header>

      <nav className={menuOpen ? "floating-dock dock-open" : "floating-dock"} aria-label="Main navigation"><a className="dock-brand" href="#top" aria-label="Sato home"><span className="brand-mark"><img src={logoSrc} alt="" /></span></a><a className={activeSection === "product" ? "dock-link active" : "dock-link"} href="#product" onClick={() => setMenuOpen(false)}>Product</a><a className={activeSection === "why-sato" ? "dock-link active" : "dock-link"} href="#why-sato" onClick={() => setMenuOpen(false)}>Why Sato</a><a className={activeSection === "trust" ? "dock-link active" : "dock-link"} href="#trust" onClick={() => setMenuOpen(false)}>Trust</a><a className={activeSection === "waitlist" ? "dock-link active" : "dock-link"} href="#waitlist" onClick={() => setMenuOpen(false)}>For merchants</a><a className="dock-cta" href="#waitlist" onClick={() => setMenuOpen(false)}>Get started <ArrowRight size={14} /></a></nav>

      <main id="top">
        <section className="hero section-pad" id="product">
          <div className="hero-copy reveal reveal-one">
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

        <section className="trust-section section-pad" id="trust"><div className="trust-heading"><span className="section-kicker">Before you join</span><h2>Clear answers<br />build trust.</h2><p>Money products should be direct about what happens behind the button. Here’s what we can say now—and what we’ll publish before launch.</p></div><div className="trust-content"><div className="trust-grid"><div className="trust-card"><ShieldCheck size={20} /><strong>Visible by design</strong><p>Amount, currency, fees, and status stay in view before you confirm.</p></div><div className="trust-card"><Check size={20} /><strong>No hidden steps</strong><p>We’ll explain custody, settlement, and regional availability in plain language.</p></div></div><div className="faq-list">{faqs.map((faq, index) => { const isOpen = openFaq === index; return <div className={isOpen ? "faq-item faq-open" : "faq-item"} key={faq.question}><button className="faq-trigger" aria-expanded={isOpen} onClick={() => setOpenFaq(isOpen ? null : index)}><span>{faq.question}</span><ChevronDown size={17} /></button><div className="faq-answer"><p>{faq.answer}</p></div></div>; })}</div></div></section>

        <section className="waitlist-section section-pad" id="waitlist"><div className="waitlist-inner"><div><div className="status-label light"><span className="status-pulse" /> Now building</div><h2>Be first<br />in line.</h2><p>Join the early access list. We’ll share the first invite when Sato is ready in your region.</p></div><div className="waitlist-panel">{submitted ? <div className="success-message"><span><Check size={17} /></span><div><strong>You’re on the list.</strong><small>We’ll be in touch when Sato is ready.</small></div></div> : <form className="waitlist-form" onSubmit={handleSubmit}><label htmlFor="email">Email address</label><div className="input-row"><input id="email" type="email" required placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} /><button type="submit" aria-label="Join the Sato waitlist" disabled={sending}><ArrowRight size={19} /></button></div><small>{submitError || (sending ? "Sending your note…" : "One useful email. No noise.")}</small></form>}<div className="audience-note"><span>For people</span><span>For businesses</span><span>Built on Bitcoin</span></div></div></div></section>
      </main>
      <footer className="site-footer section-pad"><div className="footer-main"><div className="footer-brand-block"><a className="brand" href="#top"><span className="brand-mark"><img src={logoSrc} alt="" /></span><span className="brand-name">sato</span></a><p>Bitcoin payments<br />that feel human.</p></div><div className="footer-column"><span>Explore</span><a href="#product">Product</a><a href="#why-sato">Why Sato</a><a href="#trust">Trust & FAQ</a><a href="#waitlist">Early access</a></div><div className="footer-column"><span>For your peace of mind</span><a href="/security">Security <ArrowUpRight size={13} /></a><a href="/privacy">Privacy <ArrowUpRight size={13} /></a><a href="/terms">Terms <ArrowUpRight size={13} /></a></div><div className="footer-column"><span>Stay in touch</span><a href="mailto:team.satofinance@gmail.com"><Mail size={14} /> team.satofinance@gmail.com</a><a href="https://x.com/satofinance" target="_blank" rel="noreferrer">𝕏 @satofinance</a></div></div><div className="footer-bottom"><span>© 2026 Sato. Built on Bitcoin.</span><span>Simple by default · Clear at every step</span><a href="#top">Back to top <ArrowUpRight size={13} /></a></div></footer>
      {consentVisible && <aside className="consent-banner" role="dialog" aria-label="Cookie and analytics preferences"><div className="consent-icon"><Cookie size={18} /></div><div className="consent-copy"><strong>Privacy, without the fine print.</strong><p>We use essential storage to remember your preferences. Optional analytics help us understand what makes Sato clearer. Nothing is enabled until you choose.</p><div className="consent-links"><a href="/privacy">Privacy policy <ArrowUpRight size={12} /></a><span>·</span><a href="/terms">Terms <ArrowUpRight size={12} /></a></div></div><div className="consent-actions"><button className="consent-secondary" onClick={saveConsent}>Only essential</button><button className="consent-primary" onClick={saveConsent}>Allow analytics <ArrowRight size={14} /></button></div></aside>}
    </div>
  );
}
