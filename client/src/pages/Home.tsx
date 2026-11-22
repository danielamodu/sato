import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll } from "framer-motion";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Banknote,
  Bitcoin,
  Check,
  ChevronDown,
  Fingerprint,
  KeyRound,
  Lock,
  Menu,
  PiggyBank,
  Plus,
  QrCode,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { Link } from "wouter";
import "./HomeIris.css";

const logoSrc = "/assets/sato-logo.png";
const BTC_USD = 65000;
const USD_NGN = 1580;

/* ---------- shared waitlist hook ---------- */
function useWaitlist(audience: string) {
  const [email, setEmail] = useState("");
  const [company, setCompany] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim() || sending) return;
    setSending(true);
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), audience, company }),
      });
      if (!res.ok) throw new Error("Unable to join yet — try again in a moment.");
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to join yet.");
    } finally {
      setSending(false);
    }
  }
  return { email, setEmail, company, setCompany, submitted, sending, error, submit };
}

/* ---------- thinking-orbs (orbs.jakubantalik.com): 3x3 dot-matrix wave ---------- */
function ThinkingOrb({ color = "#4ade80" }: { color?: string }) {
  return (
    <svg className="sato-think-orb" width="11" height="11" viewBox="0 0 11 11" aria-hidden="true">
      {[0, 1, 2].map((r) =>
        [0, 1, 2].map((c) => {
          const delay = ((r + c) * 0.15).toFixed(2);
          return (
            <circle
              key={`${r}-${c}`}
              cx={2 + c * 3.5}
              cy={2 + r * 3.5}
              r="1.15"
              fill={color}
              style={{ animationDelay: `${delay}s` }}
            />
          );
        }),
      )}
    </svg>
  );
}

/* ---------- masked line-rise (atoma.fi / pay.ethena.fi) ---------- */
function RiseLines({ lines, delay = 0 }: { lines: ReactNode[]; delay?: number }) {
  const reduceMotion = useReducedMotion();
  return (
    <>
      {lines.map((line, i) => (
        <span className="sato-line" key={i}>
          <motion.span
            className="sato-line-in"
            initial={reduceMotion ? { y: 0 } : { y: "108%" }}
            whileInView={{ y: 0 }}
            viewport={{ once: true, margin: "-8% 0px" }}
            transition={{ duration: 0.85, delay: delay + i * 0.09, ease: [0.22, 1, 0.36, 1] }}
          >
            {line}
          </motion.span>
        </span>
      ))}
    </>
  );
}

/* ---------- cursor spotlight for dark & light surfaces ---------- */
function useSpotlight() {
  const reduceMotion = useReducedMotion();
  return useMemo(() => {
    if (reduceMotion) return {};
    return {
      onMouseMove: (e: React.MouseEvent<HTMLElement>) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${(e.clientX - r.left).toFixed(0)}px`);
        el.style.setProperty("--my", `${(e.clientY - r.top).toFixed(0)}px`);
      },
    };
  }, [reduceMotion]);
}

/* ---------- data ---------- */
const tickerItems = [
  { tag: "SETTLED", text: "@amani → 0.012 sBTC ($780.00)", meta: "0.4s · Gasless" },
  { tag: "YIELD", text: "sBTC Vault v3 · +4.8% APY", meta: "SIP-010 · Accruing" },
  { tag: "CASHOUT", text: "0.008 sBTC → NGN Bank Rail", meta: "HMAC Quote · Verified" },
  { tag: "MERCHANT", text: "@corner-cafe · QR Receipt #8F4A", meta: "Zero address copy" },
  { tag: "SPONSOR", text: "Gas Pool Active · 100% fee coverage", meta: "Stacks L2 Testnet" },
  { tag: "CUSTODY", text: "Hardware Enclave Keys · Self-custodial", meta: "Passkey / Biometric" },
];

const slides = [
  {
    key: "send",
    num: "01",
    pill: "Send",
    headline: "Pay by @username, never an address.",
    body: "Type a human name or scan a merchant QR. Sato displays the exact sBTC and local currency amounts side-by-side and sponsors the network fee before you confirm.",
    conn: ["You", "@amani"],
    badge: "GASLESS CO-SIGN",
    docs: [
      { icon: Send, accent: "#f15a24", title: "@amani · 0.012 sBTC", sub: "≈ $780.00 · Fee $0.00 (Sponsored)" },
      { icon: QrCode, accent: "#0d1117", title: "@corner-cafe · Merchant QR", sub: "Dual-party receipt #8F4A · Settled" },
    ],
    feed: [
      { dot: "#16a34a", text: "Stacks L2 settlement confirmed", time: "12:42:08" },
      { dot: "#f15a24", text: "sato-sponsor co-signed gas fee", time: "12:42:04" },
      { dot: "#64748b", text: "Enclave biometric signature verified", time: "12:42:02" },
    ],
  },
  {
    key: "earn",
    num: "02",
    pill: "Earn",
    headline: "Your Bitcoin works while it sits.",
    body: "No second account, no staking homework, no lockup maze. Your sBTC balance accrues yield automatically via sato-yield-v3 while staying liquid to spend anytime.",
    conn: ["sBTC Balance", "sato-yield-v3"],
    badge: "+4.8% APY PREVIEW",
    docs: [
      { icon: PiggyBank, accent: "#16a34a", title: "Vault Balance · $2,480.65", sub: "0.03812 sBTC · +$3.12 this week" },
      { icon: Sparkles, accent: "#f15a24", title: "Continuous SIP-010 accrual", sub: "Liquid withdrawal · Zero lockup" },
    ],
    feed: [
      { dot: "#16a34a", text: "Daily yield epoch distributed", time: "09:00:00" },
      { dot: "#16a34a", text: "Compound index updated (v3)", time: "Yesterday" },
      { dot: "#64748b", text: "Vault solvency proof verified", time: "Mon" },
    ],
  },
  {
    key: "cashout",
    num: "03",
    pill: "Cash out",
    headline: "Back to local bank rails on your terms.",
    body: "Move from sBTC to your local bank account or settle everyday utility bills with HMAC-SHA256 signed exchange rates locked upfront for 30 seconds.",
    conn: ["sBTC", "Local Bank"],
    badge: "HMAC-SIGNED QUOTE",
    docs: [
      { icon: Banknote, accent: "#0d1117", title: "$500.00 → GTBank ····4219", sub: "Rate locked 30s · Arrives instantly" },
      { icon: Receipt, accent: "#f15a24", title: "Fee $1.20 · Shown before confirm", sub: "Zero hidden spread · Full receipt" },
    ],
    feed: [
      { dot: "#16a34a", text: "Bank rail payout settled", time: "10:15:42" },
      { dot: "#f15a24", text: "HMAC-SHA256 quote verified", time: "10:15:11" },
      { dot: "#64748b", text: "On-chain sBTC transfer confirmed", time: "10:15:04" },
    ],
  },
];

const directory = [
  { name: "@amani", role: "Design · Lagos", color: "#f15a24" },
  { name: "@corner-cafe", role: "Merchant QR", color: "#1d7a4c" },
  { name: "@mama-nkechi", role: "Family", color: "#3b82f6" },
  { name: "@jules", role: "Engineering", color: "#8b5cf6" },
  { name: "@satoshi", role: "Protocol", color: "#f59e0b" },
];

const yieldCurves: Record<"1W" | "1M" | "1Y", { delta: string; path: string; area: string }> = {
  "1W": {
    delta: "+$3.12 (+0.12%)",
    path: "M0 68 C40 65 75 56 120 52 C165 48 210 38 260 30 C300 24 335 18 360 14",
    area: "M0 68 C40 65 75 56 120 52 C165 48 210 38 260 30 C300 24 335 18 360 14 L360 88 L0 88 Z",
  },
  "1M": {
    delta: "+$14.80 (+0.60%)",
    path: "M0 74 C50 70 95 62 140 50 C190 38 235 42 285 26 C320 16 342 12 360 8",
    area: "M0 74 C50 70 95 62 140 50 C190 38 235 42 285 26 C320 16 342 12 360 8 L360 88 L0 88 Z",
  },
  "1Y": {
    delta: "+$119.07 (+4.80%)",
    path: "M0 80 C60 76 110 64 165 48 C215 34 260 28 310 14 C335 8 350 5 360 3",
    area: "M0 80 C60 76 110 64 165 48 C215 34 260 28 310 14 C335 8 350 5 360 3 L360 88 L0 88 Z",
  },
};

const trustPillars = [
  {
    num: "01",
    icon: Fingerprint,
    title: "Hardware enclave custody",
    body: "Private keys are generated and sealed inside your phone's Secure Enclave or Android Keystore. Sato never sees or stores your keys.",
  },
  {
    num: "02",
    icon: Zap,
    title: "Gasless meta-transactions",
    body: "Our sato-sponsor relay co-signs Stacks network fees automatically, so you send Bitcoin without ever holding or managing STX.",
  },
  {
    num: "03",
    icon: Lock,
    title: "Cryptographic rate locks",
    body: "Every utility payment and bank cash-out quote is HMAC-SHA256 signed with an explicit 30-second countdown. Zero hidden spreads.",
  },
  {
    num: "04",
    icon: KeyRound,
    title: "Open Clarity contracts",
    body: "Built transparently on Stacks L2 with verifiable sato-yield-v3, sato-names, and SIP-010 vault contracts you can inspect anytime.",
  },
];

const faqs = [
  { q: "What is Sato, exactly?", a: "Sato is a non-custodial Bitcoin money app built on Stacks: send sBTC to @usernames without gas friction, earn on your balance, and cash out to local bank rails or pay everyday bills from one calm interface." },
  { q: "Do I need a crypto wallet or seed phrase?", a: "No. Sato creates an embedded hardware-backed wallet tied to your device biometrics. You own your keys locally without having to copy hex addresses or juggle external browser extensions." },
  { q: "How do gasless Bitcoin transfers work?", a: "When you tap confirm, your phone signs the sBTC transfer locally and sends it to our sato-sponsor relay. The sponsor co-signs the STX network fee on your behalf without ever touching your funds." },
  { q: "What does a payment or cash-out cost?", a: "Every transfer and cash-out displays the exact sBTC amount, local currency equivalent, network/sponsor fee, and arrival window before your thumb moves. Nothing is buried." },
  { q: "Does my balance really earn?", a: "Yes — eligible sBTC balances route through our sato-yield-v3 Clarity vault while remaining liquid. Any APY numbers shown in preview are illustrative; live yield mechanics and audits will publish before mainnet launch." },
  { q: "Can businesses accept payments with Sato?", a: "Yes. Merchants register a clean @name, display a static or dynamic QR code, and receive instant verifiable receipts for every sale with direct settlement to local currency." },
  { q: "Where is Sato launching first?", a: "We are live on Stacks Testnet today with Nigerian utility bill settlement (VTPass) and NGN/USD cash-out rails in active rollout. Join the waitlist for regional mainnet invites." },
];

export default function Home() {
  usePageMeta(
    "Sato — Bitcoin money that feels human.",
    "Non-custodial Bitcoin payments on Stacks: send sBTC by @username with zero gas friction, earn yield, and cash out to local currency.",
  );

  const reduce = useReducedMotion();
  const spotlight = useSpotlight();
  const { scrollYProgress } = useScroll();

  const [scrolled, setScrolled] = useState(false);
  const [navLight, setNavLight] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [bentoFilter, setBentoFilter] = useState<"all" | "send" | "earn" | "cashout">("all");
  const [timeframe, setTimeframe] = useState<"1W" | "1M" | "1Y">("1M");
  const [calcBtc, setCalcBtc] = useState(0.25);

  const ctaWait = useWaitlist("people");
  const newsWait = useWaitlist("newsletter");

  /* Interactive hero terminal send state */
  const [to, setTo] = useState("@amani");
  const [satAmt, setSatAmt] = useState(0.012);
  const [sendStage, setSendStage] = useState<"idle" | "signing" | "sponsoring" | "done">("idle");
  const [dirQuery, setDirQuery] = useState("");
  const [picked, setPicked] = useState<string | null>(null);
  const [earnBal, setEarnBal] = useState(2480.65);

  const fiatUsd = useMemo(() => satAmt * BTC_USD, [satAmt]);
  const fiatNgn = useMemo(() => Math.round(fiatUsd * USD_NGN), [fiatUsd]);
  const projectedYieldBtc = useMemo(() => calcBtc * 0.048, [calcBtc]);
  const projectedYieldUsd = useMemo(() => projectedYieldBtc * BTC_USD, [projectedYieldBtc]);

  const dirMatches = useMemo(
    () => directory.filter((d) => d.name.toLowerCase().includes(dirQuery.trim().toLowerCase())),
    [dirQuery],
  );

  function triggerSend() {
    if (sendStage !== "idle") return;
    setSendStage("signing");
    window.setTimeout(() => setSendStage("sponsoring"), 550);
    window.setTimeout(() => setSendStage("done"), 1200);
  }

  function pickRecipient(name: string) {
    setTo(name);
    setSendStage("idle");
    setPicked(name);
  }

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 32);
      const howEl = document.getElementById("how");
      const whyEl = document.getElementById("why");
      const trustEl = document.getElementById("trust");
      if (howEl && whyEl && trustEl) {
        const howTop = howEl.getBoundingClientRect().top;
        const whyTop = whyEl.getBoundingClientRect().top;
        const trustTop = trustEl.getBoundingClientRect().top;
        const inLightHow = howTop <= 72 && whyTop > 72;
        const inLightTrust = trustTop <= 72;
        setNavLight(inLightHow || inLightTrust);
      }
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (reduce || paused) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % slides.length), 6000);
    return () => window.clearInterval(t);
  }, [reduce, paused, slide]);

  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setEarnBal((b) => b + 0.02), 2600);
    return () => window.clearInterval(t);
  }, [reduce]);

  const active = slides[slide];
  const curve = yieldCurves[timeframe];

  return (
    <div className="sato-root" id="top">
      <motion.span className="sato-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />

      {/* ---------- floating glass navigation ---------- */}
      <div className="sato-navwrap">
        <nav
          className={`sato-nav ${scrolled ? "scrolled" : ""} ${navLight ? "on-light" : "on-dark"}`}
          aria-label="Main navigation"
        >
          <a className="sato-brand" href="#top">
            <span className="sato-brand-mark">
              <img src={logoSrc} alt="" />
            </span>
            <span className="sato-brand-word">sato</span>
          </a>

          <div className={menuOpen ? "sato-nav-links open" : "sato-nav-links"}>
            <div
              className={dropOpen ? "sato-has-drop open" : "sato-has-drop"}
              onMouseEnter={() => setDropOpen(true)}
              onMouseLeave={() => setDropOpen(false)}
            >
              <button className="sato-nav-link" aria-expanded={dropOpen} onClick={() => setDropOpen(!dropOpen)}>
                Product <ChevronDown size={14} />
              </button>
              <div className="sato-dropdown">
                {[
                  { icon: Send, t: "Send to @anyone", s: "Gasless sBTC by username or QR", href: "#how" },
                  { icon: PiggyBank, t: "Earn on sBTC", s: "Continuous sato-yield-v3 accrual", href: "#why" },
                  { icon: Banknote, t: "Cash out & Bills", s: "HMAC-signed local currency rails", href: "#how" },
                ].map((d) => (
                  <a key={d.t} className="sato-drop-item" href={d.href} onClick={() => { setMenuOpen(false); setDropOpen(false); }}>
                    <span className="sato-drop-ic"><d.icon size={15} /></span>
                    <span><strong>{d.t}</strong><small>{d.s}</small></span>
                  </a>
                ))}
              </div>
            </div>
            <a className="sato-nav-link" href="#how" onClick={() => setMenuOpen(false)}>How it works</a>
            <a className="sato-nav-link" href="#why" onClick={() => setMenuOpen(false)}>Architecture</a>
            <a className="sato-nav-link" href="https://docs.satoxbt.com" target="_blank" rel="noopener noreferrer">Docs</a>
            <a className="sato-nav-link" href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>

          <button className="sato-burger" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={19} /> : <Menu size={19} />}
          </button>

          <a className="sato-btn sato-btn-primary sato-nav-cta" href="#get">
            Early access <ArrowRight size={14} />
          </a>
        </nav>
      </div>

      {/* ---------- SECTION 1: OBSIDIAN HERO + INTERACTIVE STAGE ---------- */}
      <header className="sato-hero">
        <div className="sato-hero-grid" aria-hidden="true" />
        <div className="sato-hero-glow" aria-hidden="true" />

        <div className="sato-hero-inner">
          <motion.div
            className="sato-status-pill"
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          >
            <ThinkingOrb color="#4ade80" />
            <span>STACKS L2 TESTNET</span>
            <span className="sato-pill-sep">·</span>
            <span className="sato-pill-dim">GASLESS sBTC RAILS</span>
          </motion.div>

          <h1 aria-label="Bitcoin money that feels human.">
            <RiseLines
              lines={[
                "Bitcoin money",
                <>that <span className="sato-hero-accent">feels human.</span></>,
              ]}
            />
          </h1>

          <motion.p
            className="sato-hero-sub"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.16, ease: [0.22, 1, 0.36, 1] }}
          >
            Send sBTC to @usernames with zero gas complexity, earn yield automatically on your balance,
            and cash out to local bank rails — one non-custodial app built on Bitcoin.
          </motion.p>

          <motion.div
            className="sato-hero-actions"
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.24, ease: [0.22, 1, 0.36, 1] }}
          >
            <motion.a
              className="sato-btn sato-btn-primary sato-btn-lg"
              href="#get"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2 }}
            >
              Get early access <ArrowRight size={16} />
            </motion.a>
            <motion.a
              className="sato-btn sato-btn-ghost sato-btn-lg"
              href="https://testnet.satoxbt.com/app"
              target="_blank"
              rel="noopener noreferrer"
              whileTap={{ scale: 0.96 }}
              whileHover={{ y: -2 }}
            >
              Launch testnet app <ArrowUpRight size={16} />
            </motion.a>
          </motion.div>

          <motion.div
            className="sato-hero-meta"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.35 }}
          >
            <span>NON-CUSTODIAL ENCLAVE</span>
            <i>·</i>
            <span>ZERO STX REQUIRED</span>
            <i>·</i>
            <span>2,400+ ON WAITLIST</span>
          </motion.div>
        </div>

        {/* ---------- INTERACTIVE PRODUCT STAGE (liquid.trade / pay.ethena.fi / aave.com) ---------- */}
        <motion.div
          className="sato-stage-wrap"
          initial={{ opacity: 0, y: 36 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="sato-stage beam-border" {...spotlight}>
            <div className="sato-stage-bar">
              <div className="sato-stage-brand">
                <span className="sato-stage-dot" />
                <span>SATO TERMINAL · INTERACTIVE PREVIEW</span>
              </div>
              <div className="sato-stage-pills">
                <span>SPONSOR POOL: ACTIVE</span>
                <span className="ok">sBTC / USD ${BTC_USD.toLocaleString()}</span>
              </div>
            </div>

            <div className="sato-stage-grid">
              {/* Column 1: Interactive Gasless Send */}
              <div className="sato-pane">
                <div className="sato-pane-head">
                  <span className="sato-pane-kicker">01 · INSTANT TRANSFER</span>
                  <span className="sato-pane-chip ok"><ThinkingOrb color="#4ade80" /> LIVE</span>
                </div>

                <div className="sato-input-box">
                  <label htmlFor="hero-to">RECIPIENT HANDLE</label>
                  <div className="sato-input-row">
                    <AtSign size={14} />
                    <input
                      id="hero-to"
                      value={to}
                      onChange={(e) => { setTo(e.target.value); setSendStage("idle"); }}
                      placeholder="@amani"
                    />
                  </div>
                </div>

                <div className="sato-quick-handles">
                  {["@amani", "@corner-cafe", "@mama-nkechi"].map((h) => (
                    <button
                      key={h}
                      type="button"
                      className={to === h ? "sato-qh active" : "sato-qh"}
                      onClick={() => { setTo(h); setSendStage("idle"); }}
                    >
                      {h}
                    </button>
                  ))}
                </div>

                <div className="sato-input-box">
                  <div className="sato-amt-top">
                    <label>AMOUNT</label>
                    <span className="sato-fiat-eq">≈ ${fiatUsd.toLocaleString(undefined, { maximumFractionDigits: 2 })} · ₦{fiatNgn.toLocaleString()}</span>
                  </div>
                  <div className="sato-amt-val">
                    <strong>{satAmt.toFixed(3)}</strong>
                    <span>sBTC</span>
                  </div>
                  <input
                    className="sato-slider"
                    type="range"
                    min={0.001}
                    max={0.05}
                    step={0.001}
                    value={satAmt}
                    onChange={(e) => { setSatAmt(Number(e.target.value)); setSendStage("idle"); }}
                    aria-label="Amount in sBTC"
                  />
                </div>

                <div className="sato-quote-line">
                  <span>Network gas fee</span>
                  <strong className="ok">$0.00 · Sponsored</strong>
                </div>

                <AnimatePresence mode="wait">
                  {sendStage === "done" ? (
                    <motion.div
                      key="settled"
                      className="sato-settled-box"
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                    >
                      <span className="sato-settled-ic"><Check size={14} /></span>
                      <div>
                        <strong>Sent {satAmt.toFixed(3)} sBTC to {to || "@amani"}</strong>
                        <small>TX #8F4A · Receipt saved for both sides</small>
                      </div>
                      <button type="button" className="sato-reset-btn" onClick={() => setSendStage("idle")}>Reset</button>
                    </motion.div>
                  ) : (
                    <motion.button
                      key="cta"
                      type="button"
                      className="sato-send-btn"
                      onClick={triggerSend}
                      disabled={sendStage !== "idle"}
                      whileTap={{ scale: 0.98 }}
                    >
                      {sendStage === "signing"
                        ? "Signing in hardware enclave…"
                        : sendStage === "sponsoring"
                          ? "Co-signing gasless tx…"
                          : <>Confirm & send {satAmt.toFixed(3)} sBTC <ArrowRight size={15} /></>}
                    </motion.button>
                  )}
                </AnimatePresence>
              </div>

              {/* Column 2: Live Yield & Balance Curve */}
              <div className="sato-pane sato-pane-center">
                <div className="sato-pane-head">
                  <span className="sato-pane-kicker">02 · sBTC YIELD VAULT v3</span>
                  <div className="sato-tf-tabs" role="tablist" aria-label="Yield timeframe">
                    {(["1W", "1M", "1Y"] as const).map((tf) => (
                      <button
                        key={tf}
                        type="button"
                        role="tab"
                        aria-selected={timeframe === tf}
                        className={timeframe === tf ? "sato-tf active" : "sato-tf"}
                        onClick={() => setTimeframe(tf)}
                      >
                        {timeframe === tf && (
                          <motion.span
                            layoutId="hero-tf-pill"
                            className="sato-tf-bg"
                            transition={{ type: "spring", stiffness: 460, damping: 32 }}
                          />
                        )}
                        <span>{tf}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="sato-bal-block">
                  <span className="sato-bal-label">TOTAL LIQUID BALANCE</span>
                  <div className="sato-bal-num">
                    ${earnBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </div>
                  <div className="sato-bal-sub">
                    <span>0.03812 sBTC</span>
                    <span className="ok">{curve.delta}</span>
                  </div>
                </div>

                <div className="sato-chart-wrap">
                  <svg viewBox="0 0 360 90" width="100%" height="96" preserveAspectRatio="none" aria-hidden="true">
                    <defs>
                      <linearGradient id="satoYieldArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f15a24" stopOpacity="0.32" />
                        <stop offset="100%" stopColor="#f15a24" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <motion.path
                      key={`area-${timeframe}`}
                      d={curve.area}
                      fill="url(#satoYieldArea)"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.45 }}
                    />
                    <motion.path
                      key={`line-${timeframe}`}
                      d={curve.path}
                      fill="none"
                      stroke="#f15a24"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                      initial={{ pathLength: 0.2, opacity: 0.5 }}
                      animate={{ pathLength: 1, opacity: 1 }}
                      transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
                    />
                  </svg>
                </div>

                <div className="sato-vault-stats">
                  <div>
                    <span>VAULT APY</span>
                    <strong className="ok">+4.80%</strong>
                  </div>
                  <div>
                    <span>LOCKUP</span>
                    <strong>None · Liquid</strong>
                  </div>
                  <div>
                    <span>CONTRACT</span>
                    <strong>sato-yield-v3</strong>
                  </div>
                </div>
              </div>

              {/* Column 3: Settlement Feed & Local Cashout */}
              <div className="sato-pane">
                <div className="sato-pane-head">
                  <span className="sato-pane-kicker">03 · SETTLEMENT LEDGER</span>
                  <span className="sato-pane-chip">REALTIME</span>
                </div>

                <div className="sato-ledger-list">
                  {[
                    { title: "Sent to @amani", meta: "0.012 sBTC · Gasless", status: "SETTLED", ok: true },
                    { title: "Yield epoch · Vault v3", meta: "+0.000048 sBTC", status: "CREDITED", ok: true },
                    { title: "EKEDC Power · Meter", meta: "₦15,000 · VTPass", status: "VERIFIED", ok: true },
                    { title: "GTBank ····4219", meta: "$500.00 · HMAC Quote", status: "LOCKED 30S", ok: false },
                  ].map((row) => (
                    <div className="sato-ledger-row" key={row.title}>
                      <div>
                        <strong>{row.title}</strong>
                        <small>{row.meta}</small>
                      </div>
                      <span className={row.ok ? "sato-status-tag ok" : "sato-status-tag"}>{row.status}</span>
                    </div>
                  ))}
                </div>

                <div className="sato-rail-footer">
                  <span>LOCAL RAILS</span>
                  <strong>NGN · USD · INSTANT PAYOUT</strong>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* ---------- edge-faded live marquee (pay.ethena.fi) ---------- */}
        <div className="sato-ticker" aria-label="Live protocol telemetry">
          <div className="sato-ticker-track">
            {[...tickerItems, ...tickerItems].map((item, idx) => (
              <div className="sato-ticker-item" key={idx}>
                <span className="sato-ticker-tag">{item.tag}</span>
                <span className="sato-ticker-text">{item.text}</span>
                <span className="sato-ticker-meta">{item.meta}</span>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* ---------- SECTION 2: WARM EDITORIAL PAPER — HOW IT WORKS (jeton / increase) ---------- */}
      <section
        className="sato-band sato-band-paper"
        id="how"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="sato-container sato-how-grid">
          <div className="sato-how-copy">
            <span className="sato-eyebrow">HOW IT WORKS</span>
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                <h2>{active.headline}</h2>
                <p className="sato-body">{active.body}</p>
              </motion.div>
            </AnimatePresence>

            <div className="sato-step-bar" role="tablist" aria-label="Product workflow steps">
              {slides.map((s, i) => (
                <button
                  key={s.key}
                  type="button"
                  role="tab"
                  aria-selected={i === slide}
                  className={i === slide ? "sato-step-btn active" : "sato-step-btn"}
                  onClick={() => setSlide(i)}
                >
                  {i === slide && (
                    <motion.span
                      layoutId="how-step-pill"
                      className="sato-step-btn-bg"
                      transition={{ type: "spring", stiffness: 440, damping: 32 }}
                    />
                  )}
                  <span className="sato-step-btn-txt">
                    <em>{s.num}</em> {s.pill}
                  </span>
                </button>
              ))}
            </div>

            {!reduce && (
              <div className="sato-auto-bar" aria-hidden="true">
                <motion.i
                  key={slide + (paused ? "-p" : "-r")}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: paused ? 0 : 1 }}
                  transition={paused ? { duration: 0.2 } : { duration: 6, ease: "linear" }}
                />
              </div>
            )}
          </div>

          <div className="sato-how-stage">
            <AnimatePresence mode="wait">
              <motion.div
                key={active.key}
                className="sato-how-card"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -16 }}
                transition={{ duration: 0.36, ease: [0.22, 1, 0.36, 1] }}
              >
                <div className="sato-how-card-head">
                  <span className="sato-how-live"><ThinkingOrb color="#16a34a" /> {active.badge}</span>
                  <span className="sato-how-idx">{active.num} / 03</span>
                </div>

                <div className="sato-route-row">
                  <span className="sato-route-node">{active.conn[0]}</span>
                  <span className="sato-route-line" />
                  <span className="sato-route-mid"><ArrowLeftRight size={14} /></span>
                  <span className="sato-route-line" />
                  <span className="sato-route-node accent">{active.conn[1]}</span>
                </div>

                <div className="sato-doc-stack">
                  {active.docs.map((d) => (
                    <div className="sato-doc-row" key={d.title}>
                      <span className="sato-doc-ic" style={{ background: `${d.accent}12`, color: d.accent }}>
                        <d.icon size={16} />
                      </span>
                      <div>
                        <strong>{d.title}</strong>
                        <small>{d.sub}</small>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="sato-feed-list">
                  {active.feed.map((f) => (
                    <div className="sato-feed-item" key={f.text + f.time}>
                      <span className="sato-feed-dot" style={{ background: f.dot }} />
                      <span>{f.text}</span>
                      <time>{f.time}</time>
                    </div>
                  ))}
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </section>

      {/* ---------- SECTION 3: OBSIDIAN DARK — INTERACTIVE BENTO ARCHITECTURE ---------- */}
      <section className="sato-band sato-band-dark" id="why">
        <div className="sato-container">
          <div className="sato-section-head">
            <div>
              <span className="sato-eyebrow on-dark">THE OPERATING LAYER</span>
              <h2><RiseLines lines={["Everyday money,", "on Bitcoin rails."]} /></h2>
            </div>
            <p className="sato-body on-dark">
              Every module states its cost, rate lock, and settlement status before you confirm — engineered for real payments, not crypto tutorials.
            </p>
          </div>

          <div className="sato-filter-bar" role="tablist" aria-label="Filter product modules">
            {(["all", "send", "earn", "cashout"] as const).map((f) => {
              const isAct = bentoFilter === f;
              return (
                <button
                  key={f}
                  type="button"
                  role="tab"
                  aria-selected={isAct}
                  className={isAct ? "sato-filter-btn active" : "sato-filter-btn"}
                  onClick={() => setBentoFilter(f)}
                >
                  {isAct && (
                    <motion.span
                      layoutId="bento-filter-pill"
                      className="sato-filter-bg"
                      transition={{ type: "spring", stiffness: 440, damping: 32 }}
                    />
                  )}
                  <span className="sato-filter-txt">
                    {f === "all" ? "All modules" : f === "send" ? "Send & Receipts" : f === "earn" ? "Yield Vault" : "Cash out & L2"}
                    <em>{f === "all" ? 5 : f === "send" ? 3 : f === "earn" ? 1 : 2}</em>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="sato-bento">
            {/* Card 1: Interactive @username Directory */}
            <div className={`sato-tile tall ${bentoFilter !== "all" && bentoFilter !== "send" ? "dimmed" : ""}`} {...spotlight}>
              <div className="sato-tile-top">
                <span className="sato-tile-tag">SEND · DIRECTORY</span>
                <span className="sato-tile-ic accent"><AtSign size={16} /></span>
              </div>
              <h3>Send to @anyone in seconds.</h3>
              <p>Search verified handles registered in sato-names. Click any contact to load them into the live terminal above.</p>

              <div className="sato-dir-box">
                <label className="sato-dir-search">
                  <AtSign size={14} />
                  <input
                    value={dirQuery}
                    onChange={(e) => setDirQuery(e.target.value)}
                    placeholder="Filter @amani, @cafe, @mama…"
                    aria-label="Search Sato usernames"
                  />
                </label>
                <div className="sato-dir-list">
                  {dirMatches.length === 0 ? (
                    <span className="sato-dir-empty">No matches — invite them to claim a @name.</span>
                  ) : (
                    dirMatches.map((u) => (
                      <button
                        key={u.name}
                        type="button"
                        className={picked === u.name ? "sato-dir-row picked" : "sato-dir-row"}
                        onClick={() => pickRecipient(u.name)}
                      >
                        <span className="sato-dir-ava" style={{ background: u.color }}>{u.name.slice(1, 3).toUpperCase()}</span>
                        <span className="sato-dir-meta">
                          <strong>{u.name}</strong>
                          <small>{u.role}</small>
                        </span>
                        <span className="sato-dir-act">{picked === u.name ? "Loaded" : "Select"}</span>
                      </button>
                    ))
                  )}
                </div>
                {picked && (
                  <a href="#top" className="sato-dir-jump">
                    {picked} loaded in terminal — test send ↑
                  </a>
                )}
              </div>
            </div>

            {/* Middle Stack: Clarity + Receipts */}
            <div className="sato-tile-stack">
              <div className={`sato-tile ${bentoFilter !== "all" && bentoFilter !== "send" ? "dimmed" : ""}`} {...spotlight}>
                <div className="sato-tile-top">
                  <span className="sato-tile-tag">CLARITY</span>
                  <span className="sato-tile-ic"><Receipt size={16} /></span>
                </div>
                <h3>Costs before confirm.</h3>
                <p>Network fee, sponsor coverage, and 30-second rate lock — zero surprises.</p>
                <div className="sato-kv-grid">
                  <div><span>GAS FEE</span><strong className="ok">$0.00 Sponsored</strong></div>
                  <div><span>RATE LOCK</span><strong>00:30 HMAC</strong></div>
                </div>
              </div>

              <div className={`sato-tile ${bentoFilter !== "all" && bentoFilter !== "send" ? "dimmed" : ""}`} {...spotlight}>
                <div className="sato-tile-top">
                  <span className="sato-tile-tag">RECEIPTS</span>
                  <span className="sato-tile-ic"><Check size={16} /></span>
                </div>
                <h3>Both sides see done.</h3>
                <p>Sender and merchant share one verifiable on-chain confirmation.</p>
                <div className="sato-proof-bar">
                  <span><i>✓</i> @you</span>
                  <b />
                  <em>TX #8F4A · SETTLED</em>
                  <b />
                  <span><i>✓</i> @cafe</span>
                </div>
              </div>
            </div>

            {/* Card 3: Interactive Yield Calculator (titan.com / aave.com + border beam) */}
            <div className={`sato-tile tall beam-border ${bentoFilter !== "all" && bentoFilter !== "earn" ? "dimmed" : ""}`} {...spotlight}>
              <div className="sato-tile-top">
                <span className="sato-tile-tag accent">EARN · sato-yield-v3</span>
                <span className="sato-tile-ic accent"><PiggyBank size={16} /></span>
              </div>
              <h3>Balance that compounds quietly.</h3>
              <p>Model your projected annual yield on liquid sBTC. No staking lockups or external bridges.</p>

              <div className="sato-calc-box">
                <div className="sato-calc-row">
                  <span>DEPOSIT AMOUNT</span>
                  <strong>{calcBtc.toFixed(2)} sBTC</strong>
                </div>
                <input
                  className="sato-slider"
                  type="range"
                  min={0.01}
                  max={1.0}
                  step={0.01}
                  value={calcBtc}
                  onChange={(e) => setCalcBtc(Number(e.target.value))}
                  aria-label="Simulated sBTC deposit"
                />
                <div className="sato-calc-out">
                  <div>
                    <span>EST. 1Y YIELD (+4.8% APY)</span>
                    <strong className="ok">+{projectedYieldBtc.toFixed(4)} sBTC</strong>
                  </div>
                  <div className="right">
                    <span>USD EQUIVALENT</span>
                    <strong>+${projectedYieldUsd.toLocaleString(undefined, { maximumFractionDigits: 0 })}</strong>
                  </div>
                </div>
                <div className="sato-calc-note">Illustrative preview · Live vault mechanics at launch</div>
              </div>
            </div>
          </div>

          {/* Bottom 2-column Row */}
          <div className="sato-bento-row">
            <div className={`sato-tile row ${bentoFilter !== "all" && bentoFilter !== "cashout" ? "dimmed" : ""}`} {...spotlight}>
              <span className="sato-tile-ic"><Banknote size={17} /></span>
              <div className="sato-tile-row-body">
                <div className="sato-tile-row-head">
                  <span className="sato-tile-tag">CASH OUT & BILLS</span>
                  <span className="sato-rail-meta">NGN · USD · VTPASS</span>
                </div>
                <h3>Back to your local bank.</h3>
                <p>Convert sBTC directly to bank accounts or pay electricity and airtime with idempotent verification.</p>
              </div>
            </div>

            <div className={`sato-tile row ${bentoFilter !== "all" && bentoFilter !== "cashout" ? "dimmed" : ""}`} {...spotlight}>
              <span className="sato-tile-ic"><ShieldCheck size={17} /></span>
              <div className="sato-tile-row-body">
                <div className="sato-tile-row-head">
                  <span className="sato-tile-tag">FOUNDATION</span>
                  <span className="sato-rail-meta">STACKS L2 · SIP-010</span>
                </div>
                <h3>Settled on Bitcoin finality.</h3>
                <p>Non-custodial Clarity smart contracts with verifiable on-chain state and zero custodial balance sheets.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- SECTION 4: WARM EDITORIAL PAPER — TRUST & OWNERSHIP (pay.ethena.fi / topology.vc) ---------- */}
      <section className="sato-band sato-band-paper" id="trust">
        <div className="sato-container">
          <div className="sato-trust-head">
            <span className="sato-eyebrow">SECURITY BY ARCHITECTURE</span>
            <h2><RiseLines lines={["Your money stays yours.", "Always."]} /></h2>
            <p className="sato-body">
              Sato is non-custodial software, not a bank. We never hold user balances or touch private keys.
            </p>
          </div>

          <div className="sato-pillars">
            {trustPillars.map((p) => (
              <div className="sato-pillar" key={p.num}>
                <div className="sato-pillar-top">
                  <span className="sato-pillar-num">{p.num}</span>
                  <span className="sato-pillar-ic"><p.icon size={17} /></span>
                </div>
                <h3>{p.title}</h3>
                <p>{p.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- SECTION 5: EDITORIAL FAQ (topology.vc / increase.com) ---------- */}
      <section className="sato-band sato-band-paper sato-band-tight" id="faq">
        <div className="sato-container sato-faq-grid">
          <div className="sato-faq-side">
            <span className="sato-eyebrow">BEFORE YOU JOIN</span>
            <h2><RiseLines lines={["Clear answers", "build trust."]} /></h2>
            <p className="sato-body">
              Money products should be direct about what happens behind every button. Read our full architecture in the docs or reach the team directly.
            </p>
            <div className="sato-faq-actions">
              <a className="sato-btn sato-btn-ink" href="mailto:team.satofinance@gmail.com">
                Talk to us <Send size={14} />
              </a>
              <a className="sato-text-link" href="https://docs.satoxbt.com" target="_blank" rel="noopener noreferrer">
                Read protocol docs <ArrowUpRight size={14} />
              </a>
            </div>
          </div>

          <div className="sato-acc">
            {faqs.map((f, i) => {
              const open = openFaq === i;
              return (
                <div className={open ? "sato-acc-item open" : "sato-acc-item"} key={f.q}>
                  <button type="button" className="sato-acc-btn" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                    <span className="sato-acc-q">
                      <em>0{i + 1}</em>
                      <span>{f.q}</span>
                    </span>
                    <span className="sato-acc-plus"><Plus size={15} /></span>
                  </button>
                  <div className="sato-acc-panel">
                    <p>{f.a}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ---------- SECTION 6: OBSIDIAN FINAL CTA ---------- */}
      <section className="sato-band sato-band-paper sato-cta-band" id="get">
        <div className="sato-container">
          <div className="sato-cta-card beam-border" {...spotlight}>
            <div className="sato-cta-glow" aria-hidden="true" />
            <div className="sato-cta-inner">
              <span className="sato-eyebrow on-dark">EARLY ACCESS · 2026</span>
              <h2><RiseLines lines={["Be first in line."]} /></h2>
              <p className="sato-body on-dark">
                Join the waitlist for your region. One useful email when your invite opens — zero noise.
              </p>

              {ctaWait.submitted ? (
                <div className="sato-cta-success">
                  <span><Check size={15} /></span> You're on the list. We'll be in touch.
                </div>
              ) : (
                <form className="sato-cta-form" onSubmit={ctaWait.submit}>
                  <input
                    type="text"
                    name="company"
                    tabIndex={-1}
                    autoComplete="off"
                    aria-hidden="true"
                    value={ctaWait.company}
                    onChange={(e) => ctaWait.setCompany(e.target.value)}
                    style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }}
                  />
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={ctaWait.email}
                    onChange={(e) => ctaWait.setEmail(e.target.value)}
                    aria-label="Email address"
                  />
                  <button className="sato-btn sato-btn-primary" type="submit" disabled={ctaWait.sending}>
                    {ctaWait.sending ? "Joining…" : <>Join waitlist <ArrowRight size={15} /></>}
                  </button>
                </form>
              )}

              <div className="sato-cta-note">
                {ctaWait.error || "BUILT ON BITCOIN · POWERED BY STACKS · NON-CUSTODIAL PREVIEW"}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- FOOTER ---------- */}
      <footer className="sato-footer">
        <div className="sato-container">
          <div className="sato-foot-grid">
            <div className="sato-foot-brand">
              <a className="sato-brand dark-text" href="#top">
                <span className="sato-brand-mark"><img src={logoSrc} alt="" /></span>
                <span className="sato-brand-word">sato</span>
              </a>
              <p>Sato is in active testnet preview. Screens and yield figures shown are illustrative and subject to change before mainnet launch.</p>
            </div>

            <div className="sato-foot-col">
              <span>Product</span>
              <a href="#how">Send</a>
              <a href="#why">Earn</a>
              <a href="#how">Cash out</a>
              <a href="https://docs.satoxbt.com" target="_blank" rel="noopener noreferrer">Docs</a>
            </div>

            <div className="sato-foot-col">
              <span>Company</span>
              <Link href="/people">For people</Link>
              <Link href="/businesses">For businesses</Link>
              <a href="https://testnet.satoxbt.com/app" target="_blank" rel="noopener noreferrer">Testnet app</a>
              <a href="mailto:team.satofinance@gmail.com">Contact</a>
            </div>

            <div className="sato-foot-col">
              <span>Legal & Trust</span>
              <Link href="/privacy">Privacy Policy</Link>
              <Link href="/terms">Terms of Service</Link>
              <Link href="/security">Security</Link>
            </div>

            <div className="sato-news">
              <span className="sato-news-label">STAY IN THE LOOP</span>
              <p>Launch updates for your region. Unsubscribe anytime.</p>
              {newsWait.submitted ? (
                <div className="sato-news-done"><Check size={14} /> Subscribed.</div>
              ) : (
                <form className="sato-news-form" onSubmit={newsWait.submit}>
                  <input
                    type="email"
                    required
                    placeholder="you@example.com"
                    value={newsWait.email}
                    onChange={(e) => newsWait.setEmail(e.target.value)}
                    aria-label="Email for newsletter"
                  />
                  <button type="submit" disabled={newsWait.sending}>{newsWait.sending ? "…" : "Join"}</button>
                </form>
              )}
            </div>
          </div>

          <div className="sato-foot-bottom">
            <span>© 2026 Sato. Built on Bitcoin.</span>
            <div className="sato-foot-legal">
              <a href="https://docs.satoxbt.com" target="_blank" rel="noopener noreferrer">Docs</a>
              <i>·</i>
              <Link href="/privacy">Privacy Policy</Link>
              <i>·</i>
              <Link href="/terms">Terms of Service</Link>
              <i>·</i>
              <Link href="/security">Security</Link>
            </div>
            <a href="#top" className="sato-back-top">Back to top ↑</a>
          </div>
        </div>

        <div className="sato-wordmark" aria-hidden="true">sato</div>
      </footer>
    </div>
  );
}
