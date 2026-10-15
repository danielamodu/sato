import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import {
  ArrowLeftRight,
  ArrowRight,
  ArrowUpRight,
  AtSign,
  Banknote,
  Bitcoin,
  Building2,
  Check,
  ChevronDown,
  Globe,
  Menu,
  PiggyBank,
  Plus,
  QrCode,
  Receipt,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
  X,
  Zap,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import "./HomeIris.css";

const logoSrc = "/assets/sato-logo.png";
const BTC_USD = 65000;

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

/* ---------- scroll reveal ---------- */function useIrisReveal() {
  useEffect(() => {
    const els = Array.from(document.querySelectorAll<HTMLElement>(".iris-reveal"));
    if (!("IntersectionObserver" in window)) {
      els.forEach((el) => el.classList.add("in"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => entries.forEach((en) => {
        if (en.isIntersecting) { (en.target as HTMLElement).classList.add("in"); io.unobserve(en.target); }
      }),
      { threshold: 0.12, rootMargin: "0px 0px -6% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);
}

/* ---------- animated counter (counts up when scrolled into view) ---------- */
function CountUp({ to, duration = 1400 }: { to: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [val, setVal] = useState(0);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([en]) => {
      if (en.isIntersecting && !started.current) {
        started.current = true;
        const t0 = performance.now();
        const tick = (t: number) => {
          const p = Math.min(1, (t - t0) / duration);
          setVal(Math.round(to * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
        io.disconnect();
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{val.toLocaleString()}</span>;
}

type LiveTarget = { currentTarget: HTMLElement; clientX: number; clientY: number };

/* ---------- 3D tilt props for cards (fine pointers only) ---------- */
function useTilt(max = 7) {
  const reduceMotion = useReducedMotion();
  const fine = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer:fine)").matches,
    [],
  );
  const active = !reduceMotion && fine;
  return useMemo(() => {
    if (!active) return {};
    return {
      onMouseMove: (e: LiveTarget) => {
        const el = e.currentTarget;
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        el.style.transition = "transform .12s ease-out";
        el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) translateY(-4px)`;
      },
      onMouseLeave: (e: LiveTarget) => {
        const el = e.currentTarget;
        el.style.transition = "transform .55s cubic-bezier(.23,1,.32,1)";
        el.style.transform = "";
      },
    };
  }, [active, max]);
}

/* ---------- magnetic pull for primary CTAs (fine pointers only) ---------- */
function useMagnetic(strength = 6) {
  const reduceMotion = useReducedMotion();
  const fine = useMemo(
    () => typeof window !== "undefined" && window.matchMedia("(pointer:fine)").matches,
    [],
  );
  const active = !reduceMotion && fine;
  return useMemo(() => {
    if (!active) return {};
    return {
      onMouseMove: (e: LiveTarget) => {
        const el = e.currentTarget;
        const r = (el as HTMLElement).getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width - 0.5;
        const py = (e.clientY - r.top) / r.height - 0.5;
        (el as HTMLElement).style.transition = "transform .12s ease-out";
        (el as HTMLElement).style.transform = `translate(${(px * strength * 2).toFixed(1)}px, ${(py * strength * 2).toFixed(1)}px)`;
      },
      onMouseLeave: (e: LiveTarget) => {
        const el2 = e.currentTarget as HTMLElement;
        el2.style.transition = "transform .45s cubic-bezier(.23,1,.32,1)";
        el2.style.transform = "";
      },
    };
  }, [active, strength]);
}

/* ---------- carousel data ---------- */
const slides = [
  {
    key: "send",
    pill: "Send",
    headline: "From @username to done, clearly.",
    body: "Pick a person or business by name, see Bitcoin and local money side by side, and confirm knowing exactly what moves.",
    grad: "linear-gradient(135deg,#fbe3d3 0%,#f6d9e2 38%,#c9d8f2 100%)",
    conn: ["You", "@amani"],
    docs: [
      { icon: Send, bg: "#f15a24", title: "@amani · 0.012 sBTC", sub: "≈ $780.42 · fee $0.40 · preview" },
      { icon: QrCode, bg: "#111925", title: "Corner café · paid", sub: "Receipt shared · preview" },
    ],
    feed: [
      { dot: "#1d7a4c", text: "Payment confirmed", time: "12:42" },
      { dot: "#f15a24", text: "Fee shown before confirm", time: "12:41" },
      { dot: "#8c98aa", text: "Receipt saved", time: "12:40" },
    ],
  },
  {
    key: "earn",
    pill: "Earn",
    headline: "Your balance keeps working quietly.",
    body: "No second account, no homework. The sBTC sitting in Sato keeps earning in the background while you spend.",
    grad: "linear-gradient(135deg,#fdf3e3 0%,#e4ecf9 55%,#cfe0f5 100%)",
    conn: ["Balance", "+ yield"],
    docs: [
      { icon: PiggyBank, bg: "#1d7a4c", title: "Balance · $2,480.65", sub: "+$3.12 this week · illustrative" },
      { icon: Sparkles, bg: "#f15a24", title: "Yield accrues daily", sub: "No lockups in preview" },
    ],
    feed: [
      { dot: "#1d7a4c", text: "Yield added", time: "09:00" },
      { dot: "#1d7a4c", text: "Yield added", time: "Mon" },
      { dot: "#8c98aa", text: "Balance updated", time: "Sun" },
    ],
  },
  {
    key: "cashout",
    pill: "Cash out",
    headline: "Back to local money on your terms.",
    body: "Move from Bitcoin to your bank when you need it, with the cost and timing stated before you tap confirm.",
    grad: "linear-gradient(135deg,#e6edf8 0%,#f6e3d4 60%,#f9cfae 100%)",
    conn: ["sBTC", "Your bank"],
    docs: [
      { icon: Banknote, bg: "#111925", title: "$500 → Chase ····42", sub: "Arrives 1–2 days · preview" },
      { icon: Receipt, bg: "#c4502a", title: "Fee $1.20 · shown upfront", sub: "No surprises at confirm" },
    ],
    feed: [
      { dot: "#f15a24", text: "Cash out started", time: "10:15" },
      { dot: "#8c98aa", text: "Rate locked for 30s", time: "10:15" },
      { dot: "#1d7a4c", text: "Last cash out arrived", time: "Fri" },
    ],
  },
];

const orbs = [
  { icon: Bitcoin, bg: "#f7931a", label: "Bitcoin", size: 70 },
  { icon: Zap, bg: "#111925", label: "Stacks", size: 62 },
  { icon: Wallet, bg: "#f15a24", label: "sBTC balance", size: 68 },
  { icon: AtSign, bg: "#1d7a4c", label: "@username directory", size: 60 },
  { icon: Building2, bg: "#2e6bf0", label: "Bank rails", size: 66 },
  { icon: QrCode, bg: "#0d1117", label: "Merchant QR", size: 58 },
  { icon: Receipt, bg: "#c4502a", label: "Receipts", size: 60 },
  { icon: ArrowLeftRight, bg: "#5b6b7f", label: "Send + cash out", size: 64 },
];

const faqs = [
  { q: "What is Sato, exactly?", a: "Sato is a Bitcoin money app in preview: send sBTC to @usernames, earn on your balance, and cash out to local currency. One app for the payments you already make — no wallet addresses to copy." },
  { q: "Do I need a crypto wallet or seed phrase?", a: "No. Sato is designed so you sign in and pay people by name. Before launch we'll publish exactly how balances are held, what Sato can and cannot access, and what your recovery options are." },
  { q: "What does a payment cost?", a: "You'll see the amount, any Sato fee, and any network or conversion cost before you confirm — in both Bitcoin and your local currency. The final fee model will be published before invites open." },
  { q: "How long do payments take?", a: "Sato shows a clear state from sending to confirmed so you always know what happened. Timing can depend on the Bitcoin and Stacks networks, the recipient, and the local rail used for cash out." },
  { q: "Does my balance really earn?", a: "That's the plan: your sBTC balance works in the background with no second account to manage. Rates, mechanics, and risks will be published in plain language before launch — anything shown now is an illustrative preview." },
  { q: "Can my business get paid with Sato?", a: "Yes — businesses get a @name, a QR code, and a clear paid receipt for every sale. Join the waitlist as a business and tell us where you operate so we can prioritize your region." },
  { q: "Where will Sato be available first?", a: "Availability depends on local-currency partners and regional requirements. Join the list and tell us where you're based — we'll share launch updates for your region first." },
];

export default function Home() {
  usePageMeta(
    "Sato — Bitcoin money that feels human.",
    "Sato is a Bitcoin money app: send to @anyone, earn on your balance, cash out to local currency.",
  );
  useIrisReveal();
  const reduce = useReducedMotion();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [dropOpen, setDropOpen] = useState(false);
  const [slide, setSlide] = useState(0);
  const [paused, setPaused] = useState(false);
  const [burstId, setBurstId] = useState(0);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const orbitRef = useRef<HTMLDivElement>(null);
  const heroRef = useRef<HTMLElement>(null);
  const tilt = useTilt(7);
  const magnet = useMagnetic(5);
  const { scrollYProgress } = useScroll();
  const { scrollYProgress: heroProgress } = useScroll({
    target: heroRef,
    offset: ["start start", "end start"],
  });

  const heroWait = useWaitlist("people");
  const ctaWait = useWaitlist("people");
  const newsWait = useWaitlist("newsletter");

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 760px)");
    const sync = () => setIsMobile(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* interactive send demo */
  const [to, setTo] = useState("@amani");
  const [satAmt, setSatAmt] = useState(0.012);
  const [sendState, setSendState] = useState<"idle" | "sending" | "done">("idle");
  const fiat = useMemo(() => satAmt * BTC_USD, [satAmt]);
  function reviewSend() {
    if (sendState !== "idle") return;
    setSendState("sending");
    window.setTimeout(() => {
      setSendState("done");
      setBurstId((b) => b + 1);
    }, 1400);
  }
  const burstParts = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2 + Math.random() * 0.5;
        const d = 46 + Math.random() * 54;
        return {
          x: Math.cos(a) * d,
          y: Math.sin(a) * d - 20,
          c: ["#f15a24", "#1d7a4c", "#111925", "#2e6bf0"][i % 4],
          s: 5 + (i % 3) * 2,
          r: (i * 47) % 180,
        };
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [burstId],
  );

  /* autoplay the how-it-works carousel (pauses on hover) */
  useEffect(() => {
    if (reduce || paused) return;
    const t = window.setInterval(() => setSlide((s) => (s + 1) % slides.length), 5500);
    return () => window.clearInterval(t);
  }, [reduce, paused, slide]);

  /* earn ticker (illustrative) */
  const [earnBal, setEarnBal] = useState(2480.65);
  useEffect(() => {
    if (reduce) return;
    const t = window.setInterval(() => setEarnBal((b) => b + 0.02), 2500);
    return () => window.clearInterval(t);
  }, [reduce]);

  const active = slides[slide];
  const cloudA = useTransform(heroProgress, [0, 1], [0, 60]);
  const cloudB = useTransform(heroProgress, [0, 1], [0, 110]);
  const phoneSink = useTransform(heroProgress, [0, 1], [0, -70]);

  return (
    <div className="iris-page">
      {/* ---------- floating nav ---------- */}
      <div className="iris-navwrap">
        <motion.span className="iris-progress" style={{ scaleX: scrollYProgress }} aria-hidden="true" />
        <nav className={scrolled ? "iris-nav scrolled" : "iris-nav"} aria-label="Main">
          <a className="iris-nav-brand" href="#top">
            <span className="iris-nav-mark"><img src={logoSrc} alt="" /></span><span className="iris-nav-word">sato</span>
          </a>
          <div className={menuOpen ? "iris-nav-links mobile-open" : "iris-nav-links"}>
            <div
              className={dropOpen ? "iris-has-drop open" : "iris-has-drop"}
              onMouseEnter={() => setDropOpen(true)}
              onMouseLeave={() => setDropOpen(false)}
            >
              <button className="iris-nav-link" aria-expanded={dropOpen} onClick={() => setDropOpen(!dropOpen)}>
                Product <ChevronDown size={14} />
              </button>
              <div className="iris-dropdown">
                {[
                  { icon: Send, t: "Send to @anyone", s: "Skip the address, pay by name" },
                  { icon: PiggyBank, t: "Earn on balance", s: "sBTC works while it sits" },
                  { icon: Banknote, t: "Cash out", s: "Back to local currency" },
                ].map((d) => (
                  <a key={d.t} className="iris-drop-item" href="#how" onClick={() => { setMenuOpen(false); setDropOpen(false); }}>
                    <span className="iris-drop-ic"><d.icon size={16} /></span>
                    <span><strong>{d.t}</strong><small>{d.s}</small></span>
                  </a>
                ))}
              </div>
            </div>
            <a className="iris-nav-link" href="#why" onClick={() => setMenuOpen(false)}>Why Sato</a>
            <a className="iris-nav-link" href="#faq" onClick={() => setMenuOpen(false)}>FAQ</a>
          </div>
          <button className="iris-burger" aria-label={menuOpen ? "Close menu" : "Open menu"} onClick={() => setMenuOpen(!menuOpen)}>
            {menuOpen ? <X size={20} /> : <Menu size={20} />}
          </button>
          <a className="iris-btn iris-btn-dark iris-nav-cta" href="#get" {...magnet}>Get early access <ArrowRight size={15} /></a>
        </nav>
      </div>

      {/* ---------- hero ---------- */}
      <header
        className="iris-hero"
        id="top"
        ref={heroRef}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect();
          setMouse({ x: (e.clientX - r.left) / r.width - 0.5, y: (e.clientY - r.top) / r.height - 0.5 });
        }}
      >
        <div className="iris-clouds" aria-hidden="true">
          <motion.i className="iris-cloud c1" style={reduce ? undefined : { y: cloudA }} />
          <motion.i className="iris-cloud c2" style={reduce ? undefined : { y: cloudB }} />
          <i className="iris-cloud c3" /><i className="iris-cloud c4" /><i className="iris-cloud c5" />
        </div>
        <div className="iris-mist" aria-hidden="true" />
        <div className="iris-hero-inner">
          <h1 aria-label="Bitcoin money that feels human.">
            {(["Bitcoin money", "that feels human."] as const).map((line, i) => (
              <span className="iris-line" aria-hidden="true" key={line}>
                <motion.span
                  className="iris-line-in"
                  initial={reduce ? { y: 0 } : { y: "112%" }}
                  animate={{ y: 0 }}
                  transition={{ duration: 0.9, delay: i * 0.1, ease: [0.23, 1, 0.32, 1] }}
                >
                  {line}
                </motion.span>
              </span>
            ))}
          </h1>
          <motion.p
            className="iris-hero-sub"
            initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.12 }}
          >
            Send to @usernames, earn on your balance, and cash out to local
            currency — one simple app for everyday money on Bitcoin.
          </motion.p>
          <motion.div
            className="iris-hero-ctas"
            initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, delay: 0.28 }}
          >
            <a className="iris-btn iris-btn-dark" href="#get" {...magnet}>Get early access <ArrowRight size={16} /></a>
            <a className="iris-btn iris-btn-light" href="https://testnet.satoxbt.com/app" {...magnet}>Try the testnet app <ArrowUpRight size={16} /></a>
          </motion.div>
          <div className="iris-microcopy">Free to join · One useful email · No noise</div>
          <div className="iris-waitrow">
            <span className="iris-avatars" aria-hidden="true">
              <span style={{ background: "#f15a24" }}>SA</span>
              <span style={{ background: "#1d7a4c" }}>AM</span>
              <span style={{ background: "#111925" }}>JK</span>
              <span style={{ background: "#2e6bf0" }}>+</span>
            </span>
            <span>{reduce ? "2,400" : <CountUp to={2400} />}+ on the waitlist</span>
            <button
              className="iris-share"
              onClick={() => {
                const url = window.location.href;
                if (navigator.share) navigator.share({ title: "Sato", url }).catch(() => {});
                else { navigator.clipboard?.writeText(url).catch(() => {}); heroWait.setEmail(""); }
              }}
            >
              Share the waitlist
            </button>
          </div>
        </div>

        {/* phones */}
        <motion.div className="iris-phones" style={reduce ? undefined : { y: phoneSink }}>
          <motion.div
            className="iris-phone left"
            animate={reduce ? undefined : { y: [0, -10, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
            style={reduce || isMobile ? undefined : { x: mouse.x * -14, rotate: -7 + mouse.x * 2 }}
          >
            <div className="iris-screen">
              <div className="iris-notch"><i /></div>
              <div className="iris-screen-body">
                <div className="iris-screen-top"><small>SATO · PREVIEW</small><span className="iris-live"><i />LIVE DEMO</span></div>
                <h3 className="iris-send-title">Send to<br />anyone.</h3>
                <div className="iris-field">
                  <label>RECIPIENT</label>
                  <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="@username" aria-label="Recipient username" />
                </div>
                <div className="iris-field">
                  <div className="iris-amount-row">
                    <strong>{satAmt.toFixed(3)} <span style={{ fontSize: 13, color: "#8c98aa" }}>sBTC</span></strong>
                    <small>≈ ${fiat.toLocaleString(undefined, { maximumFractionDigits: 2 })}</small>
                  </div>
                  <input
                    className="iris-range" type="range" min={0.001} max={0.05} step={0.001}
                    value={satAmt} onChange={(e) => { setSatAmt(Number(e.target.value)); setSendState("idle"); }}
                    aria-label="Amount in sBTC"
                  />
                </div>
                <div className="iris-fee-row"><span>Fee $0.40 · shown upfront</span><span>≈ 10 min</span></div>
                <AnimatePresence mode="wait">
                  {sendState === "done" ? (
                    <motion.div
                      key="done" className="iris-receipt"
                      style={{ position: "relative" }}
                      initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
                    >
                      <span className="ri"><Check size={15} color="#fff" /></span>
                      <span><strong>Sent to {to || "@amani"}</strong><small>Receipt saved · preview</small></span>
                      <b>{satAmt.toFixed(3)} ₿</b>
                      {!reduce && (
                        <span className="iris-burst" key={burstId} aria-hidden="true">
                          {burstParts.map((p, i) => (
                            <motion.i
                              key={i}
                              initial={{ x: 0, y: 0, opacity: 1, rotate: 0, scale: 1 }}
                              animate={{ x: p.x, y: p.y, opacity: 0, rotate: p.r, scale: 0.6 }}
                              transition={{ duration: 0.9, ease: "easeOut" }}
                              style={{ background: p.c, width: p.s, height: p.s }}
                            />
                          ))}
                        </span>
                      )}
                    </motion.div>
                  ) : (
                    <motion.button
                      key="btn" className="iris-review-btn" onClick={reviewSend} disabled={sendState === "sending"}
                      whileTap={{ scale: 0.98 }}
                    >
                      {sendState === "sending" ? "Sending…" : <>Review payment <ArrowRight size={15} /></>}
                    </motion.button>
                  )}
                </AnimatePresence>
                {sendState === "done" && (
                  <button className="iris-share" style={{ color: "#6b6b6b", textDecoration: "underline" }} onClick={() => setSendState("idle")}>
                    Send another
                  </button>
                )}
                <div className="iris-preview-tag">INTERACTIVE PREVIEW — TRY ME</div>
              </div>
            </div>
          </motion.div>

          <motion.div
            className="iris-phone right"
            animate={reduce ? undefined : { y: [0, 10, 0] }}
            transition={{ duration: 7, repeat: Infinity, ease: "easeInOut", delay: 0.6 }}
            style={reduce || isMobile ? undefined : { x: mouse.x * 14, rotate: 6 + mouse.x * 2 }}
          >
            <div className="iris-screen">
              <div className="iris-notch"><i /></div>
              <div className="iris-screen-body">
                <div className="iris-screen-top"><small>GOOD MORNING, SAM</small><span className="iris-live"><i />EARNING</span></div>
                <div className="iris-balance-card">
                  <small>TOTAL BALANCE</small>
                  <div className="big">${earnBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                  <div className="sub"><span>₿ 0.03812</span><span className="pos">+$3.12 this week</span></div>
                  <svg className="iris-spark" viewBox="0 0 300 54" width="100%" height="44" aria-hidden="true">
                    <path d="M0 44 C30 43 38 30 62 34 S92 42 116 28 S146 30 168 22 S198 30 220 16 S256 20 300 4" fill="none" stroke="currentColor" strokeWidth="2.5" />
                  </svg>
                </div>
                <div className="iris-chip-row">
                  <div className="iris-chip"><b>Send</b><small>to @name</small></div>
                  <div className="iris-chip"><b>Earn</b><small>daily</small></div>
                  <div className="iris-chip"><b>Cash out</b><small>to bank</small></div>
                </div>
                {[
                  { icon: Check, bg: "#1d7a4c", t: "Yield added · +$0.44", s: "Today · illustrative" },
                  { icon: QrCode, bg: "#111925", t: "Paid corner café", s: "Receipt shared" },
                  { icon: Banknote, bg: "#c4502a", t: "Cash out arrived", s: "$500 · Chase ····42" },
                ].map((r) => (
                  <div className="iris-txn" key={r.t}>
                    <span className="ti" style={{ background: `${r.bg}14`, color: r.bg }}><r.icon size={15} /></span>
                    <span><strong>{r.t}</strong><small>{r.s}</small></span>
                  </div>
                ))}
                <div className="iris-preview-tag">SEND · EARN · CASH OUT</div>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </header>

      {/* ---------- how it works ---------- */}
      <section
        className="iris-section iris-how" id="how"
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div className="iris-reveal">
          <span className="iris-eyebrow"><Zap size={13} /> How it works</span>
          <AnimatePresence mode="wait">
            <motion.div key={active.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -12 }} transition={{ duration: 0.35 }}>
              <h2>{active.headline}</h2>
              <p className="iris-body">{active.body}</p>
            </motion.div>
          </AnimatePresence>
          <div className="iris-carousel-ctrl">
            <button className="iris-arrow" aria-label="Previous step" onClick={() => setSlide((s) => (s + slides.length - 1) % slides.length)}>←</button>
            <button className="iris-arrow" aria-label="Next step" onClick={() => setSlide((s) => (s + 1) % slides.length)}>→</button>
            <span className="iris-dots">
              {slides.map((s, i) => (
                <button key={s.key} className={i === slide ? "iris-dot active" : "iris-dot"} aria-label={`Go to ${s.pill}`} onClick={() => setSlide(i)} />
              ))}
            </span>
          </div>
          {!reduce && (
            <span className="iris-auto" aria-hidden="true">
              <motion.i
                key={slide + (paused ? "-p" : "-r")}
                initial={{ scaleX: 0 }}
                animate={{ scaleX: paused ? 0 : 1 }}
                transition={paused ? { duration: 0.2 } : { duration: 5.5, ease: "linear" }}
              />
            </span>
          )}
        </div>
        <div className="iris-reveal">
          <AnimatePresence mode="wait">
            <motion.div
              key={active.key}
              className="iris-how-card"
              style={{ background: active.grad }}
              initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
              transition={{ duration: 0.45, ease: [0.23, 1, 0.32, 1] }}
            >
              <span className="iris-step-tag">0{slide + 1} / 03 · {active.pill.toUpperCase()}</span>
              <div
                className="iris-glass"
                onMouseMove={(e) => {
                  const el = e.currentTarget;
                  const r = el.getBoundingClientRect();
                  el.style.setProperty("--gx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
                  el.style.setProperty("--gy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
                }}
              >
                <div className="iris-conn-row">
                  <span className="iris-conn-ic" style={{ background: "#0d1117" }}>{active.conn[0].slice(0, 2)}</span>
                  <span className="iris-conn-link" />
                  <span className="iris-conn-ic" style={{ background: "#f15a24" }}><ArrowLeftRight size={15} /></span>
                  <span className="iris-conn-link" />
                  <span className="iris-conn-ic" style={{ background: "#1d7a4c" }}>{active.conn[1].slice(0, 2)}</span>
                </div>
                {active.docs.map((d) => (
                  <div className="iris-doc" key={d.title}>
                    <span className="di" style={{ background: `${d.bg}14`, color: d.bg }}><d.icon size={16} /></span>
                    <span><strong>{d.title}</strong><small>{d.sub}</small></span>
                  </div>
                ))}
                <div className="iris-feed">
                  {active.feed.map((f) => (
                    <div className="iris-feed-row" key={f.text + f.time}>
                      <span className="fdot" style={{ background: f.dot }} />{f.text}<time>{f.time}</time>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        </div>
      </section>

      {/* ---------- integrations arc ---------- */}
      <section className="iris-section iris-arc" id="flow">
        <div className="iris-orbit" ref={orbitRef} aria-hidden="true">
          {orbs.map((o, i) => {
            const angle = Math.PI - (i / (orbs.length - 1)) * Math.PI;
            const left = 50 + 43 * Math.cos(angle);
            const top = 92 - 78 * Math.sin(angle);
            return (
              <span key={o.label} className="iris-orb-pos" style={{ left: `${left}%`, top: `${top}%` }}>
                <motion.span
                  className="iris-orb-drag"
                  style={{ width: o.size, height: o.size }}
                  drag={!reduce && !isMobile}
                  dragConstraints={orbitRef}
                  dragElastic={0.4}
                  dragMomentum={false}
                  dragSnapToOrigin
                  onDragStart={(e) => e.preventDefault()}
                  whileHover={reduce || isMobile ? undefined : { scale: 1.12 }}
                  whileDrag={{ scale: 1.25, zIndex: 6 }}
                >
                  <motion.span
                    className="iris-orb"
                    style={{ width: "100%", height: "100%", background: o.bg, borderColor: "transparent" }}
                    animate={reduce || isMobile ? undefined : { y: [0, -9, 0] }}
                    transition={{ duration: 4 + (i % 4), repeat: Infinity, ease: "easeInOut", delay: i * 0.35 }}
                  >
                    <o.icon size={22} color="#fff" />
                    <span className="tip">{o.label}</span>
                  </motion.span>
                </motion.span>
              </span>
            );
          })}
        </div>
        <div className="iris-arc-copy iris-reveal">
          <span className="iris-eyebrow"><Globe size={13} /> The whole flow</span>
          <h2>One app for the whole flow.</h2>
          <p className="iris-body" style={{ marginInline: "auto" }}>
            Bitcoin in, friends paid, balance earning, money back at your bank.
            Sato connects the pieces so you never touch an address or a second app.
          </p>
          <a className="iris-btn iris-btn-dark" href="#get" {...magnet}>Start with Sato <ArrowRight size={16} /></a>
          <p className="iris-drag-hint">Psst — grab a bubble.</p>
        </div>
      </section>

      {/* ---------- bento ---------- */}
      <section className="iris-section" id="why">
        <div className="iris-bento-head">
          <div className="iris-reveal">
            <span className="iris-eyebrow"><Sparkles size={13} /> The operating layer</span>
            <h2>Everyday money,<br />on Bitcoin rails.</h2>
            <p className="iris-body">Three jobs, one calm surface. Everything states its cost and status before you confirm — no tutorials required.</p>
          </div>
          <div className="iris-mini-cards iris-reveal">
            <div className="iris-mini"><strong>No addresses, ever</strong><p>Pay people and shops by @name or QR. Copy-paste is not a feature here.</p></div>
            <div className="iris-mini"><strong>Fees stated upfront</strong><p>Amount, fee, arrival estimate — all visible before your thumb moves.</p></div>
          </div>
        </div>
        <div className="iris-bento-grid">
          <div className="iris-card peach tall iris-reveal" {...tilt}>
            <span className="iris-tag">Send</span>
            <span className="iris-ic"><AtSign size={18} /></span>
            <h3>Send to @anyone in seconds.</h3>
            <p>Type a name, set an amount, see both currencies. The receipt both sides can read.</p>
            <div className="iris-card-mock" style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {["@amani", "@corner-cafe", "@jules"].map((u, i) => (
                <span className="iris-user-pill" key={u}>
                  <i style={{ background: ["#f15a24", "#111925", "#1d7a4c"][i] }}>{u.slice(1, 3).toUpperCase()}</i>{u}
                </span>
              ))}
            </div>
          </div>
          <div className="iris-col-stack">
            <div className="iris-card iris-reveal" {...tilt}>
              <span className="iris-tag">Clarity</span>
              <span className="iris-ic"><Receipt size={18} /></span>
              <h3 style={{ fontSize: 22 }}>Costs before confirm.</h3>
              <p>Fee, rate lock, arrival window. Nothing buried.</p>
            </div>
            <div className="iris-card iris-reveal" {...tilt}>
              <span className="iris-tag">Receipts</span>
              <span className="iris-ic"><Check size={18} /></span>
              <h3 style={{ fontSize: 22 }}>Both sides see done.</h3>
              <p>Sender and merchant share one clear confirmation.</p>
            </div>
          </div>
          <div className="iris-card black tall iris-reveal" {...tilt}>
            <span className="iris-tag">Earn · Preview</span>
            <span className="iris-ic"><PiggyBank size={18} /></span>
            <h3>Balance that works while it sits.</h3>
            <p>No second account. Watch it tick — illustrative, live mechanics at launch.</p>
            <div className="iris-card-mock">
              <div className="iris-earn-num">${earnBal.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
              <div className="iris-earn-bar"><i /></div>
            </div>
          </div>
        </div>
        <div className="iris-bento-bottom">
          <div className="iris-card iris-card-row iris-reveal" {...tilt}>
            <span className="iris-ic"><Banknote size={18} /></span>
            <div><span className="iris-tag">Cash out</span><h3 style={{ fontSize: 22, marginTop: 10 }}>Back to your bank.</h3><p style={{ margin: 0 }}>Local currency, stated timing, on your terms.</p></div>
          </div>
          <div className="iris-card iris-card-row iris-reveal" {...tilt}>
            <span className="iris-ic"><ShieldCheck size={18} /></span>
            <div><span className="iris-tag">Foundation</span><h3 style={{ fontSize: 22, marginTop: 10 }}>Built on Bitcoin.</h3><p style={{ margin: 0 }}>Powered by Stacks · sBTC · visible status, always.</p></div>
          </div>
        </div>
      </section>

      {/* ---------- faq ---------- */}
      <section className="iris-section iris-faq" id="faq">
        <div className="iris-faq-left iris-reveal">
          <span className="iris-eyebrow"><ShieldCheck size={13} /> Before you join</span>
          <h2>Clear answers build trust.</h2>
          <p className="iris-body">Money products should be direct about what happens behind the button. Here's what we can say now — and what we'll publish before launch.</p>
          <a className="iris-talk" href="mailto:team.satofinance@gmail.com"><Send size={14} /> Talk to us</a>
        </div>
        <div className="iris-acc iris-reveal">
          {faqs.map((f, i) => {
            const open = openFaq === i;
            return (
              <div className={open ? "iris-acc-item open" : "iris-acc-item"} key={f.q}>
                <button className="iris-acc-btn" aria-expanded={open} onClick={() => setOpenFaq(open ? null : i)}>
                  {f.q}
                  <span className="iris-plus"><Plus size={15} /></span>
                </button>
                <div className="iris-acc-panel"><p>{f.a}</p></div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ---------- cta band ---------- */}
      <div className="iris-cta-wrap" id="get">
        <div className="iris-cta-card iris-reveal">
          <div className="iris-clouds" aria-hidden="true">
            <i className="iris-cloud c1" /><i className="iris-cloud c2" />
          </div>
          <div style={{ position: "relative", zIndex: 2 }}>
            <span className="iris-eyebrow on-sky"><Sparkles size={13} /> Early access</span>
            <h2>Be first in line.</h2>
            <p className="iris-hero-sub">Join the list for your region. One useful email when<br />your invite is ready — nothing else.</p>
            {ctaWait.submitted ? (
              <span className="iris-success"><i><Check size={16} /></i> You're on the list. We'll be in touch.</span>
            ) : (
              <form className="iris-cta-form" onSubmit={ctaWait.submit}>
                <input type="text" name="company" tabIndex={-1} autoComplete="off" aria-hidden="true" value={ctaWait.company} onChange={(e) => ctaWait.setCompany(e.target.value)} style={{ position: "absolute", left: -9999, width: 1, height: 1, opacity: 0 }} />
                <input type="email" required placeholder="you@example.com" value={ctaWait.email} onChange={(e) => ctaWait.setEmail(e.target.value)} aria-label="Email address" />
                <button className="iris-btn iris-btn-dark" type="submit" disabled={ctaWait.sending} style={{ padding: "13px 24px" }}>
                  {ctaWait.sending ? "Joining…" : <>Join <ArrowRight size={15} /></>}
                </button>
              </form>
            )}
            <div className="iris-cta-note">{ctaWait.error || "Built on Bitcoin · Powered by Stacks · Preview — features subject to change"}</div>
            <div style={{ display: heroWait.submitted ? "none" : "block", marginTop: 6 }} />
          </div>
        </div>
      </div>

      {/* ---------- footer ---------- */}
      <footer className="iris-footer">
        <div className="iris-foot-grid">
          <div className="iris-foot-brand">
            <a className="iris-nav-brand" href="#top" style={{ border: 0, padding: 0 }}>
              <span className="iris-nav-mark"><img src={logoSrc} alt="" /></span><span className="iris-nav-word">sato</span>
            </a>
            <p>Sato is in preview. Screens and numbers shown are illustrative and subject to change before launch.</p>
          </div>
          <div className="iris-foot-col">
            <span>Product</span>
            <a href="#how">Send</a><a href="#how">Earn</a><a href="#how">Cash out</a><a href="/security">Security</a>
          </div>
          <div className="iris-foot-col">
            <span>Company</span>
            <a href="/people">For people</a><a href="/businesses">For businesses</a><a href="https://testnet.satoxbt.com/app">Testnet app</a><a href="mailto:team.satofinance@gmail.com">Contact</a>
          </div>
          <div className="iris-news">
            <div className="iris-foot-col" style={{ marginBottom: 12 }}><span>Stay in the loop</span></div>
            <p>Launch updates for your region. No noise, unsubscribe anytime.</p>
            {newsWait.submitted ? (
              <span className="iris-success" style={{ boxShadow: "none", border: "1px solid #e2e0d9" }}><i><Check size={16} /></i> Subscribed.</span>
            ) : (
              <form className="iris-news-form" onSubmit={newsWait.submit}>
                <input type="email" required placeholder="you@example.com" value={newsWait.email} onChange={(e) => newsWait.setEmail(e.target.value)} aria-label="Email for newsletter" />
                <button type="submit" disabled={newsWait.sending}>{newsWait.sending ? "…" : "Subscribe"}</button>
              </form>
            )}
          </div>
        </div>
        <div className="iris-foot-bottom">
          <span>© 2026 Sato. Built on Bitcoin.</span>
          <span><a href="/privacy" style={{ color: "inherit" }}>Privacy</a> · <a href="/terms" style={{ color: "inherit" }}>Terms</a></span>
          <a href="#top" style={{ color: "inherit" }}>Back to top ↑</a>
        </div>
        <div className="iris-wordmark iris-reveal" aria-hidden="true">sato</div>
      </footer>
    </div>
  );
}
