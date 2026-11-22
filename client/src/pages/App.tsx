// App.tsx — the Sato dapp shell, wired to live testnet contracts.
//
// Individual tab views and shared dashboard components live under ./app/*.

import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";
import {
  ArrowUpRight,
  Fuel,
  Landmark,
  LayoutGrid,
  LogOut,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  Smartphone,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { StacksProvider, useStacks } from "@/contexts/StacksContext";
import {
  earnClaim,
  earnLock,
  fundEarn,
  fundSelf,
  getBalanceHistory,
  getEarnStats,
  getName,
  getRecentTransactions,
  getSponsorStats,
  getTxStatus,
  isNameAvailable,
  NO_SPONSORED_TX,
  registerName,
  resolveName,
  sendSbtc,
  sendSbtcSponsored,
  sponsorTopUp,
  type BalanceEvent,
  type EarnStats,
  type SatoTx,
  type SponsorStats,
} from "@/lib/sato";
import { explorerTx, fetchPrices, fmt, short, txidOf, type View } from "./app/helpers";
import { Overview } from "./app/Overview";
import { shellStyles } from "./app/styles";

const SendView = lazy(() => import("./app/SendView").then((m) => ({ default: m.SendView })));
const ReceiveView = lazy(() => import("./app/ReceiveView").then((m) => ({ default: m.ReceiveView })));
const BillsView = lazy(() => import("./app/BillsView").then((m) => ({ default: m.BillsView })));
const SendBankView = lazy(() => import("./app/SendBankView").then((m) => ({ default: m.SendBankView })));
const EarnView = lazy(() => import("./app/EarnView").then((m) => ({ default: m.EarnView })));
const GasView = lazy(() => import("./app/GasView").then((m) => ({ default: m.GasView })));
const ActivityView = lazy(() => import("./app/ActivityView").then((m) => ({ default: m.ActivityView })));

function SatoApp() {
  const { address, isConnecting, connectWallet, disconnectWallet } = useStacks();

  const [view, setView] = useState<View>("overview");
  const [myName, setMyName] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [regInput, setRegInput] = useState("");
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [lookupState, setLookupState] = useState<
    "idle" | "pending" | "found" | "missing"
  >("idle");
  const [busy, setBusy] = useState<string | null>(null);
  const [txs, setTxs] = useState<SatoTx[]>([]);
  const [txLoading, setTxLoading] = useState(true);
  // Flips true once the first full wallet load settles, and stays true. The
  // first-run guide waits on it so a set-up wallet never flashes the guide
  // during the initial async load.
  const [hydrated, setHydrated] = useState(false);
  const [earn, setEarn] = useState<EarnStats>({
    liquid: 0n,
    locked: 0n,
    lockValue: 0n,
    lockUnlock: 0n,
    height: 0n,
    baseRateBps: 0n,
    boostRateBps: 0n,
    totalSupply: 0n,
  });
  const [earnAmount, setEarnAmount] = useState("");
  const [earnTerm, setEarnTerm] = useState("100");
  const [sponsor, setSponsor] = useState<SponsorStats>({
    poolBalance: 0n,
    remaining: 0n,
    cap: 0n,
    sponsoredCount: 0n,
    windowLength: 0n,
  });
  const [topUpAmount, setTopUpAmount] = useState("");
  const [gasless, setGasless] = useState(true);
  const [nameState, setNameState] = useState<
    "idle" | "checking" | "available" | "taken"
  >("idle");
  const [btcUsd, setBtcUsd] = useState<number | null>(null);
  const [stxUsd, setStxUsd] = useState<number | null>(null);
  const [events, setEvents] = useState<BalanceEvent[]>([]);
  // Login pass deep-3D state (see spin rig below).
  const [flipped, setFlipped] = useState(false);

  // Pay bills (airtime/data/electricity/cable) owns its own state inside
  // BillsView — it only needs balance + rate from here.

  // Refresh the connected user's name + balance + earn position + activity in parallel
  // (no sequential waterfall, and reuses e.liquid instead of fetching get-balance twice).
  const refresh = async (addr: string) => {
    setTxLoading(true);
    try {
      const [n, e, s, hist, recentTxs] = await Promise.all([
        getName(addr),
        getEarnStats(addr),
        getSponsorStats(addr),
        getBalanceHistory(addr),
        getRecentTransactions(addr, 25),
      ]);
      setMyName(n);
      setBalance(e.liquid);
      setEarn(e);
      setSponsor(s);
      setEvents(hist.events);
      setTxs(recentTxs);
    } catch (e) {
      console.error("refresh failed", e);
    } finally {
      setTxLoading(false);
      setHydrated(true);
    }
  };

  // Follow a just-submitted tx to the chain through a single live toast:
  // submitted → confirming → confirmed (or failed on-chain). Balances refresh
  // the moment it's mined, and every state keeps the explorer link one tap
  // away. If we never got a txid (a wallet that doesn't return one), it falls
  // back to a plain confirmation so the user is never left without feedback.
  const trackTx = (
    txid: string | undefined,
    copy: { pending: string; confirmed: string; description?: string },
  ) => {
    const view = () =>
      txid
        ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
        : undefined;
    if (!txid) {
      toast.success(copy.pending, { description: copy.description });
      if (address) setTimeout(() => refresh(address), 4000);
      return;
    }
    const id = toast.loading(copy.pending, {
      description: "Submitted to testnet",
      duration: Infinity,
      action: view(),
    });
    let tries = 0;
    let refreshed = false;
    const timer = setInterval(async () => {
      tries += 1;
      const s = await getTxStatus(txid);
      if (s.state === "success") {
        // The balance moves as soon as it's mined — refresh once, even while
        // we wait on the anchor block.
        if (!refreshed && address) {
          refreshed = true;
          refresh(address);
        }
        if (s.anchored) {
          clearInterval(timer);
          toast.success(copy.confirmed, {
            id,
            description: copy.description,
            duration: 7000,
            action: view(),
          });
        } else if (tries >= 30) {
          // Mined but still unanchored after ~3 min (shouldn't happen on a
          // microblock-free testnet) — accept the success rather than spin.
          clearInterval(timer);
          toast.success(copy.confirmed, {
            id,
            description: copy.description,
            duration: 7000,
            action: view(),
          });
        } else {
          toast.loading("Confirming…", {
            id,
            description: "Mined — waiting for the anchor block",
            duration: Infinity,
            action: view(),
          });
        }
        return;
      }
      if (s.state === "failed") {
        clearInterval(timer);
        toast.error("Transaction failed on-chain", {
          id,
          description: s.reason,
          duration: 9000,
          action: view(),
        });
        return;
      }
      // pending / unknown → keep waiting, but don't spin forever (~3 min).
      if (tries >= 30) {
        clearInterval(timer);
        toast.info("Still confirming", {
          id,
          description: "Taking longer than usual — follow it on the explorer.",
          duration: 8000,
          action: view(),
        });
        if (address) setTimeout(() => refresh(address), 2000);
      }
    }, 6000);
  };

  useEffect(() => {
    if (address) refresh(address);
    else {
      setMyName(null);
      setBalance(0n);
      setTxs([]);
      setEvents([]);
      setEarn({
        liquid: 0n,
        locked: 0n,
        lockValue: 0n,
        lockUnlock: 0n,
        height: 0n,
        baseRateBps: 0n,
        boostRateBps: 0n,
        totalSupply: 0n,
      });
      setSponsor({
        poolBalance: 0n,
        remaining: 0n,
        cap: 0n,
        sponsoredCount: 0n,
        windowLength: 0n,
      });
    }
  }, [address]);

  // Live BTC + STX prices for the USD figures across the connected app.
  // Only polls once a wallet is connected so disconnected visitors don't pay
  // an unnecessary third-party network call on mount.
  useEffect(() => {
    if (!address) return;
    let alive = true;
    const load = () =>
      fetchPrices().then((p) => {
        if (!alive) return;
        setBtcUsd(p.btc);
        setStxUsd(p.stx);
      });
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [address]);

  // While the Earn tab is open, re-read the ledger position on a short interval
  // so the live-yield ticker re-syncs to the chain and the figures stay current.
  // The v3 balance accrues every block, so this keeps the numbers honestly
  // moving without a full page refresh.
  useEffect(() => {
    if (view !== "earn" || !address) return;
    let alive = true;
    const id = setInterval(() => {
      getEarnStats(address)
        .then((e) => {
          // The public testnet node rate-limits; getEarnStats degrades failed
          // reads to 0n. base-rate-bps is a nonzero contract constant, so
          // baseRateBps===0 means this poll partially failed — skip it rather
          // than flash the live figures to zero and snap back on the next tick.
          if (alive && e.baseRateBps > 0n) setEarn(e);
        })
        .catch(() => {});
    }, 12_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [view, address]);

  // Honor a payment link (?to=@name|address&amount=sats): prefill the Send
  // form and jump to it, so a shared Sato link lands the payer on a ready-to-
  // send screen. We resolve a @username to its principal, then wipe the query
  // from the URL so a refresh doesn't replay it.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const to = params.get("to");
    if (!to) return;
    const amt = params.get("amount");
    setView("send");
    if (amt && /^\d+$/.test(amt)) setSendAmount(amt);
    const raw = to.trim().replace(/^@/, "");
    if (raw.startsWith("S")) {
      setSendTo(raw); // already a principal
    } else {
      setSendTo(raw);
      setLookupState("pending");
      resolveName(raw)
        .then((owner) => {
          if (owner) {
            setSendTo(owner);
            setLookupState("found");
          } else {
            setLookupState("missing");
          }
        })
        .catch(() => setLookupState("missing"));
    }
    window.history.replaceState({}, "", window.location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live username availability — debounced read of the on-chain registry so
  // the claim form can confirm a handle before the user spends a tx on it.
  useEffect(() => {
    const name = regInput.trim();
    if (!name) {
      setNameState("idle");
      return;
    }
    setNameState("checking");
    const t = setTimeout(async () => {
      try {
        setNameState((await isNameAvailable(name)) ? "available" : "taken");
      } catch {
        setNameState("idle");
      }
    }, 350);
    return () => clearTimeout(t);
  }, [regInput]);

  const onRegister = async () => {
    const name = regInput.trim();
    if (!name) return;
    setBusy("register");
    try {
      const res = await registerName(name);
      trackTx(txidOf(res), {
        pending: `Registering @${name}`,
        confirmed: `@${name} is yours`,
        description: "Username registered on testnet",
      });
      setRegInput("");
    } catch (e: any) {
      toast.error("Registration cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  // Resolve the send recipient if it's a @username (not a raw principal).
  const onResolveRecipient = async () => {
    const val = sendTo.trim().replace(/^@/, "");
    if (!val || val.startsWith("S")) return; // looks like a principal already
    setLookupState("pending");
    try {
      const owner = await resolveName(val);
      if (owner) {
        setSendTo(owner);
        setLookupState("found");
      } else {
        setLookupState("missing");
      }
    } catch {
      setLookupState("missing");
    }
  };

  const onSend = async () => {
    const amount = BigInt(sendAmount || "0");
    if (!sendTo || amount <= 0n) return;
    setBusy("send");
    try {
      // Gasless path: the wallet signs a sponsored tx, the co-signer pays the
      // fee and broadcasts. If the wallet can't produce a sponsored tx, fall
      // back to a normal (user-pays) send so the user is never stuck.
      if (gasless) {
        try {
          const txId = await sendSbtcSponsored(sendTo, amount);
          trackTx(txId, {
            pending: `Sending ${fmt(amount)} sats — gas covered`,
            confirmed: `${fmt(amount)} sats delivered`,
            description: `to ${short(sendTo)}`,
          });
          setSendAmount("");
          return;
        } catch (e: any) {
          if (e?.message !== NO_SPONSORED_TX) throw e; // real failure/cancel
          toast.message("Wallet can't do gasless — sending normally", {
            description: "You'll pay this network fee.",
          });
        }
      }
      const res = await sendSbtc(sendTo, amount);
      trackTx(txidOf(res), {
        pending: `Sending ${fmt(amount)} sats`,
        confirmed: `${fmt(amount)} sats delivered`,
        description: `to ${short(sendTo)}`,
      });
      setSendAmount("");
    } catch (e: any) {
      toast.error("Send cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onFaucet = async () => {
    setBusy("faucet");
    try {
      const res = await fundSelf(1_000_000n);
      trackTx(txidOf(res), {
        pending: "Funding 1,000,000 sats",
        confirmed: "1,000,000 sats added",
        description: "testnet faucet",
      });
    } catch (e: any) {
      toast.error("Faucet cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onLock = async () => {
    const amount = BigInt(earnAmount || "0");
    const term = BigInt(earnTerm || "0");
    if (amount <= 0n || term <= 0n) return;
    setBusy("earn-lock");
    try {
      const res = await earnLock(amount, term);
      trackTx(txidOf(res), {
        pending: `Locking ${fmt(amount)} sats`,
        confirmed: `${fmt(amount)} sats locked at the boost rate`,
        description: `${fmt(term)} blocks`,
      });
      setEarnAmount("");
    } catch (e: any) {
      toast.error("Lock cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onClaim = async () => {
    setBusy("earn-claim");
    try {
      const res = await earnClaim();
      trackTx(txidOf(res), {
        pending: "Claiming your lock",
        confirmed: "Lock claimed — funds back in your balance",
        description: "principal + boost yield",
      });
    } catch (e: any) {
      toast.error("Claim cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onEarnFaucet = async () => {
    setBusy("earn-fund");
    try {
      const res = await fundEarn(1_000_000n);
      trackTx(txidOf(res), {
        pending: "Funding 1,000,000 sats",
        confirmed: "1,000,000 sats added to Earn",
        description: "to your Earn balance",
      });
    } catch (e: any) {
      toast.error("Faucet cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onTopUp = async () => {
    const stx = parseFloat(topUpAmount || "0");
    if (!(stx > 0)) return;
    const micro = BigInt(Math.round(stx * 1_000_000));
    if (micro <= 0n) return;
    setBusy("topup");
    try {
      const res = await sponsorTopUp(micro);
      trackTx(txidOf(res), {
        pending: `Adding ${topUpAmount} STX to the gas pool`,
        confirmed: `${topUpAmount} STX added to the gas pool`,
        description: "covers transaction fees for everyone",
      });
      setTopUpAmount("");
    } catch (e: any) {
      toast.error("Top-up cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  // Deep-3D spin rig for the pass: drag to spin with momentum, tap to flip.
  // Writes transforms directly (no re-renders); one rAF loop, parked idle.
  const flipRef = useRef<HTMLDivElement>(null);
  const spin = useRef({
    y: 0, x: 0, vx: 0, ly: 0, ox: 0, oy: 0, sx: 0, sy: 0, moved: 0,
    target: null as number | null, raf: 0, dragging: false,
  });
  const paintSpin = () => {
    flipRef.current?.style.setProperty(
      "transform",
      `rotateX(${spin.current.x.toFixed(2)}deg) rotateY(${spin.current.y.toFixed(2)}deg)`,
    );
  };
  const spinLoop = () => {
    const s = spin.current;
    if (s.target != null) {
      s.vx += (s.target - s.y) * 0.12;
      s.vx *= 0.82;
      s.y += s.vx;
      if (Math.abs(s.target - s.y) < 0.1 && Math.abs(s.vx) < 0.1) {
        s.y = s.target;
        s.vx = 0;
        s.target = null;
      }
    } else if (!s.dragging) {
      s.y += s.vx;
      s.vx *= 0.95;
      s.x += (0 - s.x) * 0.08;
      if (Math.abs(s.vx) < 0.02 && Math.abs(s.x) < 0.05) {
        s.vx = 0;
        s.x = 0;
        paintSpin();
        s.raf = 0;
        return;
      }
    }
    paintSpin();
    s.raf = requestAnimationFrame(spinLoop);
  };
  const kickSpin = () => {
    if (!spin.current.raf) spin.current.raf = requestAnimationFrame(spinLoop);
  };

  // --- disconnected: testnet pass — one object, minimal copy ----
  if (!address) {
    return (
      <div className="sato-shell auth-pass">
        <style>{shellStyles}</style>
        <div className="pass-aurora" aria-hidden="true">
          <i className="pa a1" />
          <i className="pa a2" />
        </div>
        <div className="pass-noise" aria-hidden="true" />

        <header className="pass-nav">
          <span className="auth-brand">
            <span className="brand-mark">
              <img src="/assets/sato-logo.png" alt="Sato" width={30} height={30} fetchPriority="high" decoding="async" />
            </span>
            <span className="brand-name">sato</span>
          </span>
          <a className="pass-back" href="https://satoxbt.com">
            Back to site <ArrowUpRight size={14} />
          </a>
        </header>

        <main className="pass-main">
          <h1 className="pass-title" aria-label="Send Bitcoin like a text.">
            <span className="sky-line" aria-hidden="true"><span>Send Bitcoin</span></span>
            <span className="sky-line" aria-hidden="true"><span>like a text.</span></span>
          </h1>
          <p className="pass-lede">
            One tap connects your Stacks wallet to the testnet.
          </p>

          <div
            className="pass-tilt"
            aria-hidden="true"
            onMouseMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              e.currentTarget.style.setProperty("--gx", `${(((e.clientX - r.left) / r.width) * 100).toFixed(1)}%`);
              e.currentTarget.style.setProperty("--gy", `${(((e.clientY - r.top) / r.height) * 100).toFixed(1)}%`);
            }}
            onPointerDown={(e) => {
              e.currentTarget.setPointerCapture(e.pointerId);
              const s = spin.current;
              s.dragging = true;
              s.target = null;
              s.vx = 0;
              s.sx = e.clientX;
              s.sy = e.clientY;
              s.ox = s.y;
              s.oy = s.x;
              s.ly = s.y;
              s.moved = 0;
              kickSpin();
            }}
            onPointerMove={(e) => {
              const s = spin.current;
              if (!s.dragging) return;
              const dx = e.clientX - s.sx;
              const dy = e.clientY - s.sy;
              s.moved = Math.max(s.moved, Math.abs(dx) + Math.abs(dy));
              const ny = s.ox + dx * 0.4;
              s.vx = ny - s.ly;
              s.ly = ny;
              s.y = ny;
              s.x = Math.max(-20, Math.min(20, s.oy - dy * 0.25));
            }}
            onPointerUp={() => {
              const s = spin.current;
              if (!s.dragging) return;
              s.dragging = false;
              if (s.moved < 8) {
                const back = Math.round((s.y - 180) / 360) * 360 + 180;
                const front = Math.round(s.y / 360) * 360;
                s.target = flipped ? front : back;
                setFlipped(!flipped);
              }
            }}
            onPointerCancel={() => {
              spin.current.dragging = false;
            }}
            onDragStart={(e) => e.preventDefault()}
          >
            <div className="pass-spin">
              <div className="pass-flip" ref={flipRef}>
                <div className="pass-face front">
                  <div className="pass-sheen" />
                  <div className="pass-row">
                    <span className="pass-micro">Testnet pass</span>
                    <span className="pass-status"><i />Not connected</span>
                  </div>
                  <div className="pass-chip" />
                  <div className="pass-row pass-bottom">
                    <span className="pass-holder">Guest</span>
                    <span className="pass-word">sato</span>
                  </div>
                </div>
                <div className="pass-face back">
                  <div className="pass-stripe" />
                  <p className="pass-back-note">Testnet · no real funds.<br />You approve every action.</p>
                  <span className="pass-word small">sato</span>
                </div>
              </div>
            </div>
          </div>
          <p className="pass-hint">
            {flipped ? "Nice — click to flip back" : "Drag to spin · click to flip"}
          </p>

          <button
            className="btn primary lg pass-connect"
            onClick={connectWallet}
            disabled={isConnecting}
          >
            {isConnecting ? (
              <>
                <RefreshCw size={18} className="spin" /> Connecting…
              </>
            ) : (
              <>
                <Wallet size={18} /> Connect wallet
              </>
            )}
          </button>
          <p className="pass-micro2">Testnet only · non-custodial</p>
        </main>

        <footer className="pass-foot">© 2026 Sato</footer>
      </div>
    );
  }

  const initials = (myName ?? address).slice(0, 2).toUpperCase();

  type NavItem = { id: View; label: string; icon: typeof LayoutGrid };
  // Grouped by intent so the growing feature set reads calmly. Gas is infra
  // (top up the sponsor pool), so it lives in the account footer, not here.
  const navGroups: { label: string; items: NavItem[] }[] = [
    {
      label: "Wallet",
      items: [
        { id: "overview", label: "Overview", icon: LayoutGrid },
        { id: "send", label: "Send", icon: Send },
        { id: "receive", label: "Receive", icon: QrCode },
      ],
    },
    {
      label: "Spend",
      items: [
        { id: "bills", label: "Pay bills", icon: Smartphone },
        { id: "cashout", label: "Cash out", icon: Landmark },
      ],
    },
    { label: "Grow", items: [{ id: "earn", label: "Earn", icon: TrendingUp }] },
  ];
  const gasItem: NavItem = { id: "gas", label: "Gas", icon: Fuel };
  // The mobile bottom bar has no footer, so it shows every destination flat.
  const tabItems: NavItem[] = [...navGroups.flatMap((g) => g.items), gasItem];
  // Five is the most a thumb bar can hold before labels start wrapping. Cash out
  // and Gas stay one tap away in the dock and the pool chip; Activity is the avatar.
  const mobileTabs = ["overview", "send", "receive", "bills", "earn"]
    .map((id) => tabItems.find((t) => t.id === id))
    .filter((t): t is NavItem => Boolean(t));

  return (
    <div className="sato-shell">
      <style>{shellStyles}</style>

      {/* The site's sky, carried into the app */}
      <div className="sky" aria-hidden="true">
        <span className="cloud c1" />
        <span className="cloud c2" />
        <span className="cloud c3" />
        <span className="cloud c4" />
        <span className="cloud c5" />
        <span className="sky-mist" />
      </div>

      {/* Floating pill nav — the same object as the site's header */}
      <header className="appnav" aria-label="Primary">
        <a className="appnav-brand" href="/" title="Sato home">
          <span className="appnav-mark">
            <img src="/assets/sato-logo.png" alt="" width={32} height={32} decoding="async" />
          </span>
          <strong>sato</strong>
        </a>

        <nav className="appnav-links">
          {tabItems.map(({ id, label }) => (
            <button
              key={id}
              type="button"
              className={view === id ? "appnav-link active" : "appnav-link"}
              onClick={() => setView(id)}
            >
              {label}
            </button>
          ))}
          <button
            type="button"
            className={view === "activity" ? "appnav-link active" : "appnav-link"}
            onClick={() => setView("activity")}
          >
            Activity
          </button>
        </nav>

        <div className="appnav-right">
          <button
            type="button"
            className="appnav-pool"
            onClick={() => setView("gas")}
            title="Gas pool — sponsored fees"
          >
            <Fuel size={13} />
            {fmt(sponsor.poolBalance)}
          </button>
          <button
            type="button"
            className="appnav-cta"
            onClick={onFaucet}
            disabled={busy === "faucet"}
          >
            <Plus size={15} />
            {busy === "faucet" ? "Funding" : "Faucet"}
          </button>
          <button
            type="button"
            className="appnav-icon"
            onClick={disconnectWallet}
            title="Disconnect wallet"
            aria-label="Disconnect wallet"
          >
            <LogOut size={15} />
          </button>
          <button
            type="button"
            className="appnav-user"
            onClick={() => setView("activity")}
            title={myName ? `@${myName} — activity` : "Activity"}
          >
            <span className="appnav-avatar">{initials}</span>
          </button>
        </div>
      </header>

      {/* Main column */}
      <main className="main">
        <div className="view" key={view}>
        <Suspense fallback={null}>
        {view === "overview" && (
          <Overview
            balance={balance}
            btcUsd={btcUsd}
            events={events}
            myName={myName}
            regInput={regInput}
            setRegInput={setRegInput}
            nameState={nameState}
            onRegister={onRegister}
            onFaucet={onFaucet}
            goSend={() => setView("send")}
            goReceive={() => setView("receive")}
            goActivity={() => setView("activity")}
            go={setView}
            busy={busy}
            address={address}
            txs={txs}
            txLoading={txLoading}
            hydrated={hydrated}
          />
        )}

        {view === "send" && (
          <SendView
            sendTo={sendTo}
            setSendTo={setSendTo}
            sendAmount={sendAmount}
            setSendAmount={setSendAmount}
            lookupState={lookupState}
            setLookupState={setLookupState}
            onResolveRecipient={onResolveRecipient}
            onSend={onSend}
            balance={balance}
            btcUsd={btcUsd}
            gasless={gasless}
            setGasless={setGasless}
            sponsorReady={sponsor.poolBalance > 0n}
            busy={busy}
          />
        )}

        {view === "receive" && (
          <ReceiveView
            address={address}
            myName={myName}
            goClaim={() => setView("overview")}
          />
        )}

        {view === "bills" && (
          <BillsView
            balance={balance}
            btcUsd={btcUsd}
            onPaid={() => address && refresh(address)}
          />
        )}

        {view === "cashout" && (
          <SendBankView
            balance={balance}
            btcUsd={btcUsd}
            onPaid={() => address && refresh(address)}
          />
        )}

        {view === "earn" && (
          <EarnView
            earn={earn}
            btcUsd={btcUsd}
            earnAmount={earnAmount}
            setEarnAmount={setEarnAmount}
            earnTerm={earnTerm}
            setEarnTerm={setEarnTerm}
            onLock={onLock}
            onClaim={onClaim}
            onFaucet={onEarnFaucet}
            busy={busy}
          />
        )}

        {view === "gas" && (
          <GasView
            sponsor={sponsor}
            stxUsd={stxUsd}
            topUpAmount={topUpAmount}
            setTopUpAmount={setTopUpAmount}
            onTopUp={onTopUp}
            busy={busy}
          />
        )}

        {view === "activity" && (
          <ActivityView
            address={address}
            txs={txs}
            loading={txLoading}
            reload={() => refresh(address)}
          />
        )}
        </Suspense>
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="tab-bar">
        {mobileTabs.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            className={view === id ? "tab active" : "tab"}
            onClick={() => setView(id)}
          >
            <Icon size={19} />
            <span>{label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}

// Provider wrapper so the route can mount <App /> directly.
export default function App() {
  usePageMeta("Your wallet · Sato", "Send, earn, and cash out sBTC from your Sato wallet.");
  return (
    <StacksProvider>
      <Toaster />
      <SatoApp />
    </StacksProvider>
  );
}
