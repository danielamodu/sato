import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronDown,
  Coins,
  Copy,
  Landmark,
  Plus,
  Receipt,
  Send,
  Smartphone,
  TrendingUp,
} from "lucide-react";
import type { BalanceEvent, EarnStats, SatoTx } from "@/lib/sato";
import {
  explorerAddr,
  explorerTx,
  fmt,
  fmtBtc,
  fmtUsd,
  fmtUsdNum,
  short,
  timeAgo,
  txIcon,
  type View,
} from "./helpers";

// Small copy-to-clipboard button used on the account card.
export function CopyButton({ value, what = "Address" }: { value: string; what?: string }) {
  return (
    <button
      className="icon-btn"
      title={`Copy ${what.toLowerCase()}`}
      onClick={() => {
        navigator.clipboard?.writeText(value);
        toast.success(`${what} copied`);
      }}
    >
      <Copy size={13} />
    </button>
  );
}

// --- motion helpers ------------------------------------------------------

// True when the OS "reduce motion" setting is on, kept live. Every count-up,
// ticker, and draw animation reads this and snaps to a static state so we
// never fight the user's accessibility preference.
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const m = window.matchMedia("(prefers-reduced-motion: reduce)");
    const on = () => setReduced(m.matches);
    on();
    m.addEventListener?.("change", on);
    return () => m.removeEventListener?.("change", on);
  }, []);
  return reduced;
}

// Ease a number from its previous value to `value` (easeOutCubic). We only ever
// animate the transition between two *real* readings — never invent data — so
// balances and counts feel alive. Snaps instantly under reduced motion.
export function useCountUp(value: number, duration = 650): number {
  const reduced = usePrefersReducedMotion();
  const [display, setDisplay] = useState(value);
  const fromRef = useRef(value);
  const rafRef = useRef(0);
  useEffect(() => {
    if (reduced || value === fromRef.current) {
      setDisplay(value);
      fromRef.current = value;
      return;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (value - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = value;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration, reduced]);
  return display;
}

// A number that eases to its latest value; `format` maps it to a string.
export function AnimatedNumber({
  value,
  format = (n: number) => Math.round(n).toLocaleString(),
  duration,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
}) {
  const shown = useCountUp(value, duration);
  return <>{format(shown)}</>;
}

// Stream a live-growing figure between on-chain reads. The v3 ledger accrues
// every block, so instead of sitting still between refreshes we extend the last
// two real readings at their observed velocity (with the annualised rate as a
// floor), then snap back to truth on the next read. Never ticks downward (a
// spend or claim resets the base), and stays static under reduced motion.
// `amount` is the value to stream; `principal` is the balance the rate earns on.
export function useLiveAmount(
  amount: bigint,
  principal: bigint,
  rateBps: bigint
): number {
  const reduced = usePrefersReducedMotion();
  const target = Number(amount);
  const [live, setLive] = useState(target);
  const sampleRef = useRef({ value: target, at: performance.now() });
  const velRef = useRef(0); // sats per second
  const shownRef = useRef(Math.floor(target)); // last integer we rendered
  const rafRef = useRef(0);

  useEffect(() => {
    const now = performance.now();
    const prev = sampleRef.current;
    const dt = (now - prev.at) / 1000;
    const observed = dt > 0 ? (target - prev.value) / dt : 0;
    // Annualised-rate floor: principal * (rateBps/10000) / seconds-per-year.
    const floor = (Number(principal) * (Number(rateBps) / 10000)) / 31_557_600;
    // Damp the observed rate so we systematically under-project between reads;
    // each re-sync then nudges the figure *up* to the true value rather than
    // ever snapping it down. A spend/claim still drops cleanly (target falls).
    velRef.current = principal > 0n ? Math.max(0, observed * 0.6, floor) : 0;
    sampleRef.current = { value: target, at: now };
    shownRef.current = Math.floor(target);
    setLive(target);
  }, [target, principal, rateBps]);

  useEffect(() => {
    if (reduced || velRef.current <= 0) return;
    const loop = () => {
      const { value, at } = sampleRef.current;
      const next = value + velRef.current * ((performance.now() - at) / 1000);
      // Only re-render when the whole-sat figure actually changes.
      if (Math.floor(next) !== shownRef.current) {
        shownRef.current = Math.floor(next);
        setLive(next);
      }
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [reduced, target, principal, rateBps]);

  return reduced ? target : live;
}

// A glanceable metric tile for the overview header row.
export function StatTile(props: {
  label: string;
  icon: typeof Coins;
  value?: ReactNode;
  countTo?: number;
  unit?: string;
  countFormat?: (n: number) => string;
  sub?: string;
  big?: boolean;
  gauge?: number;
}) {
  const {
    label,
    icon: Icon,
    value,
    countTo,
    unit,
    countFormat,
    sub,
    big,
    gauge,
  } = props;
  return (
    <div className={big ? "stat-tile big" : "stat-tile"}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        <span className="stat-ico">
          <Icon size={15} />
        </span>
      </div>
      <div className="stat-value">
        {countTo != null ? (
          <>
            <AnimatedNumber value={countTo} format={countFormat} />
            {unit ? (
              <>
                {" "}
                <small>{unit}</small>
              </>
            ) : null}
          </>
        ) : (
          value
        )}
      </div>
      {sub && <span className="stat-sub">{sub}</span>}
      {gauge != null && (
        <span className="stat-gauge">
          <span
            className="stat-gauge-fill"
            style={{ width: `${Math.max(0, Math.min(1, gauge)) * 100}%` }}
          />
        </span>
      )}
    </div>
  );
}

// Coloured status chip for a transaction.
export function StatusPill({ status }: { status: SatoTx["status"] }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

// One transaction row — expands inline with receipt detail (status timeline,
// txid + copy, explorer link) instead of navigating away on tap.
export function TxRow({ tx }: { tx: SatoTx }) {
  const [open, setOpen] = useState(false);
  const Icon = txIcon(tx.label);
  const steps =
    tx.status === "success"
      ? ["Submitted", "Confirming", "Confirmed"]
      : tx.status === "pending"
        ? ["Submitted", "Confirming"]
        : ["Submitted", "Failed"];
  return (
    <div className={`tx-row${open ? " open" : ""}`}>
      <button
        type="button"
        className="tx-row-head"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <span className="tx-ico">
          <Icon size={16} />
        </span>
        <span className="tx-main">
          <span className="tx-label">{tx.label}</span>
          <span className="tx-sub">{tx.contract}</span>
        </span>
        <span className="tx-right">
          <StatusPill status={tx.status} />
          <span className="tx-time">{timeAgo(tx.time)}</span>
          <ChevronDown size={14} className={`tx-chev${open ? " open" : ""}`} />
        </span>
      </button>
      {open && (
        <div className="tx-detail">
          <div className="tx-steps">
            {steps.map((s, i) => {
              const last = i === steps.length - 1;
              const cls =
                tx.status === "success"
                  ? "done"
                  : tx.status === "pending"
                    ? last
                      ? "active"
                      : "done"
                    : last
                      ? "bad"
                      : "done";
              return (
                <span key={s} className={`tx-step ${cls}`}>
                  <i />
                  {s}
                </span>
              );
            })}
          </div>
          <div className="tx-idrow">
            <span className="tx-id mono">{short(tx.txId)}</span>
            <CopyButton value={tx.txId} what="Transaction ID" />
          </div>
          <div className="tx-datesub">
            {tx.time ? new Date(tx.time).toLocaleString() : "Awaiting confirmation"}
          </div>
          <a
            className="tx-explorer-link"
            href={explorerTx(tx.txId)}
            target="_blank"
            rel="noreferrer"
            onClick={(e) => e.stopPropagation()}
          >
            View on explorer <ArrowUpRight size={13} />
          </a>
        </div>
      )}
    </div>
  );
}

// Activity feed: skeletons while loading, an honest empty state, else rows.
export function TxTable(props: {
  txs: SatoTx[];
  loading: boolean;
  address: string;
  limit?: number;
  emptyHint?: string;
}) {
  const { txs, loading, address, limit, emptyHint } = props;
  if (loading && txs.length === 0) {
    return (
      <div className="tx-loading">
        <span className="tx-skel" />
        <span className="tx-skel" />
        <span className="tx-skel" />
      </div>
    );
  }
  if (txs.length === 0) {
    return (
      <div className="tx-empty">
        <span className="empty-icon">
          <Receipt size={20} />
        </span>
        <p>{emptyHint || "No on-chain activity yet. Your sends and claims will show up here."}</p>
        <a
          className="tx-empty-link"
          href={explorerAddr(address)}
          target="_blank"
          rel="noreferrer"
        >
          View address on explorer <ArrowUpRight size={13} />
        </a>
      </div>
    );
  }
  const rows = limit ? txs.slice(0, limit) : txs;
  return (
    <div className="tx-list">
      {rows.map((tx) => (
        <TxRow key={tx.txId} tx={tx} />
      ))}
    </div>
  );
}

// Turn the wallet's balance-affecting events into an evenly-spaced staircase:
// one node per change, so every send and receive is a distinct, equal-width
// step you can land on — never a flat month with a single cliff at the edge.
// Node 0 is the balance before the first shown event; the last node is today's
// live balance. Anchoring to that live balance keeps the tail exact even if the
// event log was truncated.
export interface ChartNode {
  sats: number;
  event: BalanceEvent | null; // the change that produced this level (null = baseline)
}

export function buildBalanceSeries(balance: bigint, events: BalanceEvent[]): ChartNode[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.time - b.time);
  const total = sorted.reduce((s, e) => s + e.delta, 0n);
  let run = balance - total; // balance just before the earliest shown event
  if (run < 0n) run = 0n; // clamp: truncated log / unseen credit
  const nodes: ChartNode[] = [{ sats: Number(run), event: null }];
  for (const e of sorted) {
    run += e.delta;
    if (run < 0n) run = 0n;
    nodes.push({ sats: Number(run), event: e });
  }
  return nodes;
}

// The dashboard headline: the balance's live value plus a real, interactive
// chart of the balance itself — one step per on-chain change, sends and
// receives alike. With no activity yet we show the figure and a hint, never a
// drawn-from-nothing line.
export function BalanceHero({
  balance,
  btcUsd,
  events,
  onFaucet,
  busy,
}: {
  balance: bigint;
  btcUsd: number | null;
  events: BalanceEvent[];
  onFaucet: () => void;
  busy: string | null;
}) {
  const nodes = buildBalanceSeries(balance, events);
  const maxSats = nodes.length ? Math.max(...nodes.map((n) => n.sats)) : 0;
  const showChart = nodes.length >= 2 && maxSats > 0;
  const baseSats = nodes.length ? nodes[0].sats : 0;
  const endSats = nodes.length ? nodes[nodes.length - 1].sats : 0;
  // Real change across the shown history. From a zero baseline any percentage
  // is meaningless, so we flag it as newly funded instead.
  const pct =
    showChart && baseSats > 0 ? ((endSats - baseSats) / baseSats) * 100 : null;
  const fromZero = showChart && baseSats === 0 && endSats > 0;
  const up = (pct ?? 0) >= 0;

  return (
    <section className="balance-hero bh-dark">
      <div className="bh-top">
        <div>
          <span className="bh-eyebrow">Total balance</span>
          <div className="bh-value">
            {btcUsd != null ? (
              <span className="bh-num">
                <AnimatedNumber
                  value={(Number(balance) / 1e8) * btcUsd}
                  format={fmtUsdNum}
                />
              </span>
            ) : (
              <span className="bh-num">
                {fmtBtc(balance)} <small>BTC</small>
              </span>
            )}
          </div>
          <span className="bh-sub">
            {btcUsd != null ? (
              <>
                <span className="bh-sub-a">{fmtBtc(balance)} BTC</span>
                <span className="bh-sub-b">{fmt(balance)} sats · testnet</span>
              </>
            ) : (
              <span className="bh-sub-b">{fmt(balance)} sats · testnet</span>
            )}
          </span>
        </div>
        {fromZero ? (
          <span className="bh-trend up">New</span>
        ) : (
          pct != null && (
            <span className={up ? "bh-trend up" : "bh-trend down"}>
              {up ? "+" : "−"}
              {Math.abs(pct).toFixed(1)}%
            </span>
          )
        )}
      </div>
      {showChart ? (
        <BalanceSparkline
          nodes={nodes}
          btcUsd={btcUsd}
          changeCount={events.length}
        />
      ) : balance > 0n ? (
        <div className="bh-empty">
          Your balance history will appear as you add, send, and receive.
        </div>
      ) : (
        <div className="bh-empty actionable">
          <span>No sats yet — grab some test sBTC.</span>
          <button
            type="button"
            className="bh-empty-cta"
            onClick={onFaucet}
            disabled={busy === "faucet"}
          >
            <Plus size={14} /> {busy === "faucet" ? "Funding…" : "Get test sBTC"}
          </button>
        </div>
      )}
    </section>
  );
}

// Interactive balance staircase: one equal-width step per on-chain change, so
// every send and receive is a distinct point you can land on — no time axis, so
// no flat dead zones. Hover or drag to read what happened, how much, with whom,
// and the resulting balance. Width is measured so drawing and pointer math share
// one coordinate space.
export function BalanceSparkline({
  nodes,
  btcUsd,
  changeCount,
}: {
  nodes: ChartNode[];
  btcUsd: number | null;
  changeCount: number;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(0);
  const [hi, setHi] = useState<number | null>(null); // active event index (1..N-1)
  const H = 116;
  const padY = 16;

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    setW(el.clientWidth);
    const ro = new ResizeObserver((es) => setW(es[0].contentRect.width));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const N = nodes.length; // levels; N-1 = number of changes
  const seg = w / N; // equal plateau width per level
  const vals = nodes.map((n) => n.sats);
  const min = Math.min(...vals);
  const maxV = Math.max(...vals);
  const flat = maxV === min;
  const span = maxV - min || 1;
  const yAt = (s: number) =>
    flat ? H / 2 : padY + (1 - (s - min) / span) * (H - 2 * padY);
  const xOf = (k: number) => k * seg; // x of the k-th riser (event k)

  // Baseline plateau, a riser at each change, then the current plateau out to
  // the right edge — every level keeps an equal plateau so no step is crushed.
  let line = `M 0 ${yAt(nodes[0].sats).toFixed(2)}`;
  for (let k = 1; k < N; k++) {
    line += ` L ${xOf(k).toFixed(2)} ${yAt(nodes[k - 1].sats).toFixed(2)}`;
    line += ` L ${xOf(k).toFixed(2)} ${yAt(nodes[k].sats).toFixed(2)}`;
  }
  line += ` L ${w.toFixed(2)} ${yAt(nodes[N - 1].sats).toFixed(2)}`;
  const area = w > 0 ? `${line} L ${w.toFixed(2)} ${H} L 0 ${H} Z` : "";

  const onMove = (e: React.PointerEvent) => {
    const r = wrap.current!.getBoundingClientRect();
    const x = Math.max(0, Math.min(r.width, e.clientX - r.left));
    const k = Math.round(x / (r.width / N)); // snap to the nearest riser
    setHi(Math.max(1, Math.min(N - 1, k)));
  };

  const active = hi != null ? nodes[hi] : null;
  const ev = active?.event ?? null;
  const ax = hi != null ? xOf(hi) : 0;
  const tipLeft = Math.max(64, Math.min(w - 64, ax));
  return (
    <div
      className="bchart"
      ref={wrap}
      onPointerMove={onMove}
      onPointerDown={onMove}
      onPointerLeave={() => setHi(null)}
      role="img"
      aria-label={`sBTC balance across ${changeCount} on-chain ${
        changeCount === 1 ? "change" : "changes"
      }`}
    >
      {w > 0 && (
        <svg
          className="bchart-svg"
          width={w}
          height={H}
          viewBox={`0 0 ${w} ${H}`}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="bchart-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--ink)" stopOpacity="0.12" />
              <stop offset="100%" stopColor="var(--ink)" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="bchart-area" d={area} fill="url(#bchart-fill)" />
          <path
            className="bchart-line"
            pathLength={1}
            d={line}
            fill="none"
            stroke="var(--ink)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {nodes.slice(1).map((nd, i) => {
            const k = i + 1;
            const on = hi === k;
            return (
              <circle
                key={nd.event?.txId ?? k}
                cx={xOf(k)}
                cy={yAt(nd.sats)}
                r={on ? 5 : 3}
                fill={on ? "var(--orange)" : "var(--white)"}
                stroke="var(--ink)"
                strokeWidth={on ? 2 : 1.5}
              />
            );
          })}
          {hi != null && (
            <line
              x1={ax}
              y1={padY - 8}
              x2={ax}
              y2={H}
              stroke="var(--line)"
              strokeWidth={1}
            />
          )}
        </svg>
      )}
      {ev && (
        <div className="bchart-tip" style={{ left: `${tipLeft}px` }}>
          <span className={`bct-kind ${ev.delta >= 0n ? "in" : "out"}`}>
            {ev.kind === "sent" ? (
              <ArrowUpRight size={12} />
            ) : ev.kind === "received" ? (
              <ArrowDownLeft size={12} />
            ) : (
              <Plus size={12} />
            )}
            {ev.kind === "sent"
              ? "Sent"
              : ev.kind === "received"
                ? "Received"
                : "Added test sBTC"}
          </span>
          <strong>
            {ev.delta >= 0n ? "+" : "−"}
            {fmtBtc(ev.delta < 0n ? -ev.delta : ev.delta)} <span>BTC</span>
          </strong>
          {btcUsd != null && (
            <small className="bct-usd">
              {ev.delta >= 0n ? "+" : "−"}
              {fmtUsd(ev.delta < 0n ? -ev.delta : ev.delta, btcUsd)}
            </small>
          )}
          {ev.peer && (
            <small className="bct-peer">
              {ev.kind === "sent" ? "to" : "from"} {short(ev.peer)}
            </small>
          )}
          <small className="bct-meta">
            Balance {fmtBtc(BigInt(active!.sats))} BTC
          </small>
        </div>
      )}
      <div className="bchart-foot">
        <span>
          {changeCount} {changeCount === 1 ? "change" : "changes"}
        </span>
        {ev ? (
          <span>{new Date(ev.time).toLocaleString()}</span>
        ) : (
          <span>hover to explore</span>
        )}
      </div>
    </div>
  );
}

// --- Overview view -------------------------------------------------------
// First-run guide: the breadth of Sato at a glance, plus a 3-step path to the
// "aha" moment (fund → claim a name → send). It fades out for good once the
// user has done all three, or if they dismiss it — returning users get the
// clean dashboard, never a nag.
export function WelcomeGuide(props: {
  balance: bigint;
  myName: string | null;
  txCount: number;
  busy: string | null;
  onFaucet: () => void;
  go: (v: View) => void;
  hydrated: boolean;
}) {
  const { balance, myName, txCount, busy, onFaucet, go, hydrated } = props;
  const [dismissed, setDismissed] = useState(
    () => typeof localStorage !== "undefined" && localStorage.getItem("sato-welcome") === "done"
  );

  const funded = balance > 0n;
  const named = !!myName;
  const sent = txCount > 0;
  // Wait for the first load to settle before deciding — otherwise a set-up
  // wallet flashes the guide for a frame while balance/name/txs are still 0.
  if (!hydrated || dismissed || (funded && named && sent)) return null;

  function dismiss() {
    try {
      localStorage.setItem("sato-welcome", "done");
    } catch {
      /* private mode — just hide for this session */
    }
    setDismissed(true);
  }
  function scrollToClaim() {
    document
      .getElementById("claim-username")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  const steps: { n: number; label: string; done: boolean; busy: boolean; action: () => void }[] = [
    { n: 1, label: "Get test sBTC", done: funded, busy: busy === "faucet", action: onFaucet },
    { n: 2, label: "Claim your @username", done: named, busy: false, action: scrollToClaim },
    { n: 3, label: "Send your first payment", done: sent, busy: false, action: () => go("send") },
  ];

  return (
    <section className="panel start-card">
      <div className="start-head">
        <div>
          <span className="panel-eyebrow">Get started</span>
          <h2 className="start-title">Three steps to your first payment</h2>
        </div>
        <button className="start-dismiss" onClick={dismiss} title="Hide this">
          <Check size={13} /> Got it
        </button>
      </div>

      <div className="start-steps">
        {steps.map((s) => (
          <button
            key={s.n}
            className={s.done ? "start-step done" : "start-step"}
            onClick={s.action}
            disabled={s.done || s.busy}
          >
            <span className="start-num">{s.done ? <Check size={13} /> : s.n}</span>
            <span className="start-label">{s.busy ? "Funding…" : s.label}</span>
          </button>
        ))}
      </div>
    </section>
  );
}

// Action dock — the five money moves plus the faucet, one tap each.
// Replaces the old quick-actions row with bigger, thumb-first targets.
export function Dock(props: {
  goSend: () => void;
  goReceive: () => void;
  goBills: () => void;
  goCashout: () => void;
  goEarn: () => void;
  onFaucet: () => void;
  busy: string | null;
}) {
  const { goSend, goReceive, goBills, goCashout, goEarn, onFaucet, busy } = props;
  const tiles = [
    { label: "Send", icon: Send, onClick: goSend, primary: true },
    { label: "Receive", icon: ArrowDownLeft, onClick: goReceive, primary: false },
    { label: "Bills", icon: Smartphone, onClick: goBills, primary: false },
    { label: "Cash out", icon: Landmark, onClick: goCashout, primary: false },
    { label: "Earn", icon: TrendingUp, onClick: goEarn, primary: false },
    { label: busy === "faucet" ? "Funding…" : "Faucet", icon: Plus, onClick: onFaucet, primary: false, disabled: busy === "faucet" },
  ];
  return (
    <div className="dock" role="group" aria-label="Money actions">
      {tiles.map(({ label, icon: Icon, onClick, primary, disabled }) => (
        <button
          key={label}
          type="button"
          className={`dock-btn${primary ? " primary" : ""}`}
          onClick={onClick}
          disabled={disabled}
        >
          <span className="dock-ico">
            <Icon size={20} />
          </span>
          <span className="dock-label">{label}</span>
        </button>
      ))}
    </div>
  );
}

// --- Earn view (sato-yield pool) -----------------------------------------
// A radial gauge for a 0..1 fraction — a faint ink track under an orange arc
// that draws in from empty on mount (and eases to any new value). Center slot
// holds a label. Static offset under reduced motion.
export function Ring({
  fraction,
  size = 128,
  stroke = 11,
  children,
}: {
  fraction: number;
  size?: number;
  stroke?: number;
  children?: ReactNode;
}) {
  const reduced = usePrefersReducedMotion();
  const f = Math.max(0, Math.min(1, isFinite(fraction) ? fraction : 0));
  const [shown, setShown] = useState(reduced ? f : 0);
  useEffect(() => {
    if (reduced) {
      setShown(f);
      return;
    }
    const id = requestAnimationFrame(() => setShown(f));
    return () => cancelAnimationFrame(id);
  }, [f, reduced]);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const half = size / 2;
  return (
    <div className="ring-wrap" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle
          className="ring-track"
          cx={half}
          cy={half}
          r={r}
          strokeWidth={stroke}
          fill="none"
        />
        <circle
          className="ring-arc"
          cx={half}
          cy={half}
          r={r}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - shown)}
          transform={`rotate(-90 ${half} ${half})`}
        />
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}

// The Earn headline: the user's liquid balance, streaming upward at the base
// rate it auto-earns — the whole pitch of the v3 ledger, shown live. The ring
// tracks how much of their position sits in the higher boost (locked) tier.
// Both are real on-chain values; the ticker just extends the last reading at
// the rate the chain is paying and re-syncs on every poll.
export function EarnHero({
  earn,
  btcUsd,
}: {
  earn: EarnStats;
  btcUsd: number | null;
}) {
  const liveBalance = useLiveAmount(earn.liquid, earn.liquid, earn.baseRateBps);
  const shown = Math.floor(liveBalance);
  const earning = earn.liquid > 0n;
  const baseApr = Number(earn.baseRateBps) / 100; // bps -> %
  const boostApr = Number(earn.boostRateBps) / 100;
  // Honest per-day growth on the liquid balance from the annual base rate.
  const perDay = (Number(earn.liquid) * (Number(earn.baseRateBps) / 10000)) / 365;
  const hasLock = earn.locked > 0n;
  const total = earn.liquid + earn.lockValue;
  const lockedShare = total > 0n ? Number(earn.lockValue) / Number(total) : 0;
  const blocksLeft =
    earn.lockUnlock > earn.height ? earn.lockUnlock - earn.height : 0n;
  const sharePctText =
    lockedShare > 0 && lockedShare < 0.001
      ? "<0.1"
      : (lockedShare * 100).toLocaleString(undefined, {
          maximumFractionDigits: lockedShare < 0.1 ? 1 : 0,
        });

  return (
    <section className="earn-hero">
      <div className="eh-main">
        <div className="eh-head">
          <span className="eh-eyebrow">Balance earning</span>
          {earning && (
            <span
              className="eh-live"
              title="Your balance earns automatically, every block"
            >
              <span className="eh-live-dot" /> Live
            </span>
          )}
        </div>
        <div className="eh-value">
          <span className="eh-num">{shown.toLocaleString()}</span>
          <span className="eh-unit">sats</span>
        </div>
        <div className="eh-meta">
          {baseApr > 0 && (
            <span className="eh-apr">{baseApr.toLocaleString()}% APR</span>
          )}
          {earning ? (
            <span className="eh-note">
              ≈ {Math.round(perDay).toLocaleString()} sats/day
              {btcUsd != null ? ` · ${fmtUsd(BigInt(shown), btcUsd)}` : ""}
            </span>
          ) : (
            <span className="eh-note">
              Get test sBTC — it earns the moment you hold it
            </span>
          )}
        </div>
      </div>
      <div className="eh-ring">
        <Ring fraction={lockedShare}>
          <span className="ring-pct">{sharePctText}%</span>
          <span className="ring-cap">locked</span>
        </Ring>
        <span className="eh-ring-sub">
          {hasLock
            ? blocksLeft > 0n
              ? `${fmt(blocksLeft)} blocks to unlock`
              : "Lock matured — ready to claim"
            : `Lock to earn ${boostApr.toLocaleString()}%`}
        </span>
      </div>
    </section>
  );
}
