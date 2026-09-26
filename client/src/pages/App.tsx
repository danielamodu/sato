// App.tsx — the Sato dapp, wired to live testnet contracts.
//
// A calm app-shell dashboard: left sidebar for navigation + account, a
// main column with one view at a time (Overview, Send, Activity). The
// goal is comfort — one clear number, plain language, generous space,
// black-and-white first with orange kept to small accents. This web
// layout sets the visual precedent for the mobile app (sidebar
// collapses to a bottom tab bar).
//
// Reads (balance, name lookups) hit the testnet API directly. Writes
// (register, send, faucet) go through the connected wallet and surface
// an explorer link on submit.

import { useEffect, useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  Wallet,
  Send,
  Search,
  LayoutGrid,
  Receipt,
  ArrowUpRight,
  ArrowDownLeft,
  Plus,
  Check,
  LogOut,
  Copy,
  RefreshCw,
  ExternalLink,
  AtSign,
  Coins,
  Hash,
  TrendingUp,
  Fuel,
  Zap,
  QrCode,
  Download,
} from "lucide-react";
import { QRCodeSVG, QRCodeCanvas } from "qrcode.react";
import { usePageMeta } from "@/hooks/usePageMeta";
import { StacksProvider, useStacks } from "@/contexts/StacksContext";
import {
  registerName,
  resolveName,
  getName,
  getBalance,
  sendSbtc,
  sendSbtcSponsored,
  NO_SPONSORED_TX,
  fundSelf,
  getRecentTransactions,
  getBalanceHistory,
  getEarnStats,
  earnDeposit,
  earnWithdraw,
  fundEarn,
  getSponsorStats,
  sponsorTopUp,
  isNameAvailable,
  type SatoTx,
  type BalanceEvent,
  type EarnStats,
  type SponsorStats,
} from "@/lib/sato";

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;

// Load an <img> and resolve once it's ready, for drawing onto a canvas.
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

// Path a rounded rectangle (broader support than ctx.roundRect).
function roundRect(
  g: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
) {
  const rr = Math.min(r, w / 2, h / 2);
  g.beginPath();
  g.moveTo(x + rr, y);
  g.arcTo(x + w, y, x + w, y + h, rr);
  g.arcTo(x + w, y + h, x, y + h, rr);
  g.arcTo(x, y + h, x, y, rr);
  g.arcTo(x, y, x + w, y, rr);
  g.closePath();
}
const fmt = (n: bigint) => n.toLocaleString();
// micro-STX (1e6 = 1 STX) → a friendly STX string for the gas pool.
const fmtStx = (micro: bigint) =>
  (Number(micro) / 1_000_000).toLocaleString(undefined, {
    maximumFractionDigits: 6,
  });
// sats (1e8 = 1 BTC) → a trimmed BTC string, e.g. 2_000_000n → "0.02".
const fmtBtc = (sats: bigint) =>
  (Number(sats) / 1e8).toLocaleString(undefined, { maximumFractionDigits: 8 });
// sats × live BTC/USD spot → "$1,340.00". Only shown when a real price is
// loaded — we never invent one.
const fmtUsd = (sats: bigint, btcUsd: number) =>
  ((Number(sats) / 1e8) * btcUsd).toLocaleString(undefined, {
    style: "currency",
    currency: "USD",
  });
// A plain USD amount → "$12.34". For the live "as you type" echo under an
// amount field, where the figure is already in dollars.
const fmtUsdNum = (usd: number) =>
  usd.toLocaleString(undefined, { style: "currency", currency: "USD" });
// Live BTC + STX spot from CoinGecko (no key, CORS-open). Returns nulls on any
// failure so amounts fall back to their native unit rather than a fake number.
async function fetchPrices(): Promise<{
  btc: number | null;
  stx: number | null;
}> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,blockstack&vs_currencies=usd"
    );
    if (!r.ok) return { btc: null, stx: null };
    const d = (await r.json()) as {
      bitcoin?: { usd?: number };
      blockstack?: { usd?: number };
    };
    const pick = (v?: number) => (typeof v === "number" && v > 0 ? v : null);
    return { btc: pick(d.bitcoin?.usd), stx: pick(d.blockstack?.usd) };
  } catch {
    return { btc: null, stx: null };
  }
}

const explorerTx = (txid: string) =>
  `https://explorer.hiro.so/txid/${txid}?chain=testnet`;
const explorerAddr = (a: string) =>
  `https://explorer.hiro.so/address/${a}?chain=testnet`;

// Compact "3m ago" / "2h ago" / "Apr 3" relative time for the activity feed.
function timeAgo(ms: number | null): string {
  if (!ms) return "Pending";
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "Just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day}d ago`;
  return new Date(ms).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

// Pick an icon for a transaction by its function label.
function txIcon(label: string) {
  if (label.startsWith("Sent")) return ArrowUpRight;
  if (label.includes("Earn")) return TrendingUp;
  if (label.includes("gas") || label.includes("Gas")) return Fuel;
  if (label.startsWith("Added")) return ArrowDownLeft;
  if (label.includes("username")) return AtSign;
  return Receipt;
}

// Pull a txid out of the varied shapes @stacks/connect can return.
function txidOf(res: any): string | undefined {
  return res?.txid ?? res?.txId ?? res?.result?.txid;
}

type View = "overview" | "send" | "receive" | "earn" | "gas" | "activity";

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
  const [earn, setEarn] = useState<EarnStats>({
    deposited: 0n,
    earned: 0n,
    available: 0n,
    poolTotal: 0n,
    poolPrincipal: 0n,
    rateBps: 0n,
  });
  const [earnAmount, setEarnAmount] = useState("");
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

  // Refresh the connected user's name + balance + earn position, then activity.
  const refresh = async (addr: string) => {
    try {
      const [n, b, e, s, hist] = await Promise.all([
        getName(addr),
        getBalance(addr),
        getEarnStats(addr),
        getSponsorStats(addr),
        getBalanceHistory(addr),
      ]);
      setMyName(n);
      setBalance(b);
      setEarn(e);
      setSponsor(s);
      setEvents(hist.events);
    } catch (e) {
      console.error("refresh failed", e);
    }
    setTxLoading(true);
    try {
      setTxs(await getRecentTransactions(addr, 25));
    } finally {
      setTxLoading(false);
    }
  };

  useEffect(() => {
    if (address) refresh(address);
    else {
      setMyName(null);
      setBalance(0n);
      setTxs([]);
      setEvents([]);
      setEarn({
        deposited: 0n,
        earned: 0n,
        available: 0n,
        poolTotal: 0n,
        poolPrincipal: 0n,
        rateBps: 0n,
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

  // Live BTC + STX prices for the USD figures across the app. Refreshes on a
  // slow interval; a failed fetch leaves them null so amounts fall back to
  // their native unit rather than show a fake number.
  useEffect(() => {
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
  }, []);

  // While the Earn tab is open, re-read the pool position on a short interval
  // so the live-yield ticker re-syncs to the chain and the pool figures stay
  // current. Yield on sato-yield-v2 accrues every block, so this keeps the
  // numbers honestly moving without a full page refresh.
  useEffect(() => {
    if (view !== "earn" || !address) return;
    let alive = true;
    const id = setInterval(() => {
      getEarnStats(address)
        .then((e) => {
          // The public testnet node rate-limits; getEarnStats degrades failed
          // reads to 0n. yield-rate-bps is a nonzero contract constant, so
          // rateBps===0 means this poll partially failed — skip it rather than
          // flash the live figures to zero and snap back on the next tick.
          if (alive && e.rateBps > 0n) setEarn(e);
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
      const txid = txidOf(res);
      toast.success(`Registering @${name}`, {
        description: txid ? "Submitted to testnet" : undefined,
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      setRegInput("");
      if (address) setTimeout(() => refresh(address), 4000);
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
          toast.success(`Sent ${fmt(amount)} sats — gas covered`, {
            description: `to ${short(sendTo)}`,
            action: {
              label: "View",
              onClick: () => window.open(explorerTx(txId)),
            },
          });
          setSendAmount("");
          if (address) setTimeout(() => refresh(address), 4000);
          return;
        } catch (e: any) {
          if (e?.message !== NO_SPONSORED_TX) throw e; // real failure/cancel
          toast.message("Wallet can't do gasless — sending normally", {
            description: "You'll pay this network fee.",
          });
        }
      }
      const res = await sendSbtc(sendTo, amount);
      const txid = txidOf(res);
      toast.success(`Sending ${fmt(amount)} sats`, {
        description: `to ${short(sendTo)}`,
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      setSendAmount("");
      if (address) setTimeout(() => refresh(address), 4000);
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
      const txid = txidOf(res);
      toast.success("Funding 1,000,000 sats", {
        description: "testnet faucet",
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      if (address) setTimeout(() => refresh(address), 4000);
    } catch (e: any) {
      toast.error("Faucet cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onEarnDeposit = async () => {
    const amount = BigInt(earnAmount || "0");
    if (amount <= 0n) return;
    setBusy("earn-deposit");
    try {
      const res = await earnDeposit(amount);
      const txid = txidOf(res);
      toast.success(`Depositing ${fmt(amount)} sats`, {
        description: "into the Earn pool",
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      setEarnAmount("");
      if (address) setTimeout(() => refresh(address), 4000);
    } catch (e: any) {
      toast.error("Deposit cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onEarnWithdraw = async () => {
    const amount = BigInt(earnAmount || "0");
    if (amount <= 0n) return;
    setBusy("earn-withdraw");
    try {
      const res = await earnWithdraw(amount);
      const txid = txidOf(res);
      toast.success(`Withdrawing ${fmt(amount)} sats`, {
        description: "principal + earned yield",
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      setEarnAmount("");
      if (address) setTimeout(() => refresh(address), 4000);
    } catch (e: any) {
      toast.error("Withdrawal cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onEarnFaucet = async () => {
    setBusy("earn-fund");
    try {
      const res = await fundEarn(1_000_000n);
      const txid = txidOf(res);
      toast.success("Funding 1,000,000 sats", {
        description: "to your Earn balance",
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      if (address) setTimeout(() => refresh(address), 4000);
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
      const txid = txidOf(res);
      toast.success(`Adding ${topUpAmount} STX to the gas pool`, {
        description: "covers transaction fees for everyone",
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
      setTopUpAmount("");
      if (address) setTimeout(() => refresh(address), 4000);
    } catch (e: any) {
      toast.error("Top-up cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  // --- disconnected: split sign-in, warm brand panel echoing the app ----
  if (!address) {
    return (
      <div className="sato-shell auth">
        <style>{shellStyles}</style>

        {/* Left: connect */}
        <div className="auth-panel">
          <div className="auth-top">
            <span className="auth-brand">
              <span className="brand-mark">
              <img src="/assets/sato-logo.png" alt="Sato" />
            </span>
              <span className="brand-name">sato</span>
              <span className="brand-badge">testnet</span>
            </span>
            <a className="auth-back" href="/">
              Back to site
            </a>
          </div>

          <div className="auth-body">
            <span className="auth-eyebrow">Testnet preview</span>
            <h1 className="auth-title">
              Send Bitcoin
              <br />
              like a text.
            </h1>
            <p className="auth-lede">
              Connect a Stacks wallet to try Sato on testnet — claim a
              @username, look someone up, and send sBTC against live on-chain
              contracts.
            </p>

            <button
              className="btn primary lg full"
              onClick={connectWallet}
              disabled={isConnecting}
            >
              <Wallet size={18} />
              {isConnecting ? "Connecting…" : "Connect wallet"}
            </button>

            <ul className="auth-points">
              <li>
                <Check size={15} /> Testnet only · no real funds at risk
              </li>
              <li>
                <Check size={15} /> Non-custodial · you approve every action
              </li>
            </ul>
          </div>

          <span className="auth-foot">© 2026 Sato · Built on Bitcoin</span>
        </div>

        {/* Right: brand panel — a product card mirroring the dashboard */}
        <div className="auth-brandside" aria-hidden="true">
          <div className="brandside-glow" />
          <div className="brandside-card">
            <span className="bs-eyebrow">Available balance</span>
            <div className="bs-balance">
              <b>1,000,000</b> <span>sats</span>
            </div>
            <div className="bs-send">
              <span className="bs-avatar">SZ</span>
              <span className="bs-meta">
                <small>Sending to</small>
                <strong>@szr</strong>
              </span>
              <Check size={16} />
            </div>
            <div className="bs-btn">Send sBTC</div>
          </div>
          <p className="brandside-tag">Bitcoin payments that feel human.</p>
        </div>
      </div>
    );
  }

  const initials = (myName ?? address).slice(0, 2).toUpperCase();

  const nav: { id: View; label: string; icon: typeof LayoutGrid }[] = [
    { id: "overview", label: "Overview", icon: LayoutGrid },
    { id: "send", label: "Send", icon: Send },
    { id: "receive", label: "Receive", icon: QrCode },
    { id: "earn", label: "Earn", icon: TrendingUp },
    { id: "gas", label: "Gas", icon: Fuel },
    { id: "activity", label: "Activity", icon: Receipt },
  ];

  return (
    <div className="sato-shell">
      <style>{shellStyles}</style>

      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-brand">
          <span className="brand-mark">
              <img src="/assets/sato-logo.png" alt="Sato" />
            </span>
          <span className="brand-name">Sato</span>
          <span className="brand-badge">testnet</span>
        </div>

        <div className="sidebar-scroll">
          <span className="nav-group-label">Wallet</span>
          <nav className="sidebar-nav">
            {nav.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                className={view === id ? "nav-item active" : "nav-item"}
                onClick={() => setView(id)}
              >
                <Icon size={18} />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="sidebar-promo">
          <strong>Testnet preview</strong>
          <p>Funds aren't real here. Grab some test sBTC to try a send.</p>
          <button
            className="btn soft sm full"
            onClick={onFaucet}
            disabled={busy === "faucet"}
          >
            <Plus size={15} />
            {busy === "faucet" ? "Funding…" : "Get test sBTC"}
          </button>
        </div>

        <div className="sidebar-account">
          <div className="account-row">
            <span className="account-avatar">{initials}</span>
            <span className="account-meta">
              <strong>{myName ? `@${myName}` : "Unnamed"}</strong>
              <span className="account-addr">
                <small>{short(address)}</small>
                <CopyButton value={address} />
                <a
                  className="account-explorer"
                  href={explorerAddr(address)}
                  target="_blank"
                  rel="noreferrer"
                  title="View on explorer"
                >
                  <ExternalLink size={12} />
                </a>
              </span>
            </span>
          </div>
          <button className="account-signout" onClick={disconnectWallet}>
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main column */}
      <main className="main">
        <div className="view" key={view}>
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
            busy={busy}
            address={address}
            txs={txs}
            txLoading={txLoading}
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

        {view === "earn" && (
          <EarnView
            earn={earn}
            btcUsd={btcUsd}
            earnAmount={earnAmount}
            setEarnAmount={setEarnAmount}
            onDeposit={onEarnDeposit}
            onWithdraw={onEarnWithdraw}
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
        </div>
      </main>

      {/* Mobile bottom tabs */}
      <nav className="tab-bar">
        {nav.map(({ id, label, icon: Icon }) => (
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

// --- shared dashboard pieces ---------------------------------------------

// Small copy-to-clipboard button used on the account card.
function CopyButton({ value }: { value: string }) {
  return (
    <button
      className="icon-btn"
      title="Copy address"
      onClick={() => {
        navigator.clipboard?.writeText(value);
        toast.success("Address copied");
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
function usePrefersReducedMotion(): boolean {
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
function useCountUp(value: number, duration = 650): number {
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
function AnimatedNumber({
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

// Stream the user's accrued yield between on-chain reads. sato-yield-v2 accrues
// every block, so instead of sitting still between refreshes we extend the last
// two real readings at their observed velocity (with the annualised rate as a
// floor), then snap back to truth on the next read. Never ticks downward (a
// withdrawal resets the base), and stays static under reduced motion.
function useLiveYield(
  earned: bigint,
  deposited: bigint,
  rateBps: bigint
): number {
  const reduced = usePrefersReducedMotion();
  const target = Number(earned);
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
    const floor = (Number(deposited) * (Number(rateBps) / 10000)) / 31_557_600;
    // Damp the observed rate so we systematically under-project between reads;
    // each re-sync then nudges the figure *up* to the true value rather than
    // ever snapping it down. Withdrawals still drop cleanly (target falls).
    velRef.current = deposited > 0n ? Math.max(0, observed * 0.6, floor) : 0;
    sampleRef.current = { value: target, at: now };
    shownRef.current = Math.floor(target);
    setLive(target);
  }, [target, deposited, rateBps]);

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
  }, [reduced, target, deposited, rateBps]);

  return reduced ? target : live;
}

// A glanceable metric tile for the overview header row.
function StatTile(props: {
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
function StatusPill({ status }: { status: SatoTx["status"] }) {
  return <span className={`pill ${status}`}>{status}</span>;
}

// One transaction row — links out to the explorer.
function TxRow({ tx }: { tx: SatoTx }) {
  const Icon = txIcon(tx.label);
  return (
    <a
      className="tx-row"
      href={explorerTx(tx.txId)}
      target="_blank"
      rel="noreferrer"
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
        <ExternalLink className="tx-ext" size={14} />
      </span>
    </a>
  );
}

// Activity feed: skeletons while loading, an honest empty state, else rows.
function TxTable(props: {
  txs: SatoTx[];
  loading: boolean;
  address: string;
  limit?: number;
}) {
  const { txs, loading, address, limit } = props;
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
        <p>No on-chain activity yet. Your sends and claims will show up here.</p>
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
interface ChartNode {
  sats: number;
  event: BalanceEvent | null; // the change that produced this level (null = baseline)
}

function buildBalanceSeries(balance: bigint, events: BalanceEvent[]): ChartNode[] {
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
function BalanceHero({
  balance,
  btcUsd,
  events,
}: {
  balance: bigint;
  btcUsd: number | null;
  events: BalanceEvent[];
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
    <section className="balance-hero">
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
            {btcUsd != null
              ? `${fmtBtc(balance)} BTC · ${fmt(balance)} sats · testnet`
              : `${fmt(balance)} sats · testnet`}
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
      ) : (
        <div className="bh-empty">
          {balance > 0n
            ? "Your balance history will appear as you add, send, and receive."
            : "Add test sBTC to start your balance history."}
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
function BalanceSparkline({
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
function Overview(props: {
  balance: bigint;
  btcUsd: number | null;
  events: BalanceEvent[];
  myName: string | null;
  regInput: string;
  setRegInput: (v: string) => void;
  nameState: "idle" | "checking" | "available" | "taken";
  onRegister: () => void;
  onFaucet: () => void;
  goSend: () => void;
  goReceive: () => void;
  goActivity: () => void;
  busy: string | null;
  address: string;
  txs: SatoTx[];
  txLoading: boolean;
}) {
  const {
    balance,
    btcUsd,
    events,
    myName,
    regInput,
    setRegInput,
    nameState,
    onRegister,
    onFaucet,
    goSend,
    goReceive,
    goActivity,
    busy,
    address,
    txs,
    txLoading,
  } = props;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Overview</h1>
          <p>Your Sato wallet on testnet.</p>
        </div>
        <button
          className="btn soft"
          onClick={onFaucet}
          disabled={busy === "faucet"}
        >
          <Plus size={16} />
          {busy === "faucet" ? "Funding…" : "Get test sBTC"}
        </button>
      </header>

      <BalanceHero balance={balance} btcUsd={btcUsd} events={events} />

      <div className="stat-row two">
        <StatTile
          label="Transactions"
          icon={Hash}
          value={txLoading ? "—" : undefined}
          countTo={txLoading ? undefined : txs.length}
          sub="Recent contract calls"
        />
        <StatTile
          label="Username"
          icon={AtSign}
          value={myName ? `@${myName}` : "Unclaimed"}
          sub={myName ? "Your Sato handle" : "Claim one below"}
        />
      </div>
      <div className="ov-grid">
        <section className="panel">
          <div className="panel-head">
            <h2>Recent activity</h2>
            <button className="panel-link" onClick={goActivity}>
              View all <ArrowUpRight size={13} />
            </button>
          </div>
          <TxTable txs={txs} loading={txLoading} address={address} limit={5} />
        </section>

        <div className="col-stack">
          <section className="panel">
            <span className="panel-eyebrow">Quick actions</span>
            <div className="stack-actions">
              <div className="action-pair">
                <button className="btn primary" onClick={goSend}>
                  <Send size={16} /> Send
                </button>
                <button className="btn soft" onClick={goReceive}>
                  <ArrowDownLeft size={16} /> Receive
                </button>
              </div>
              <button
                className="btn soft full"
                onClick={onFaucet}
                disabled={busy === "faucet"}
              >
                <Plus size={16} />
                {busy === "faucet" ? "Funding…" : "Get test sBTC"}
              </button>
            </div>
          </section>
          <section className="panel">
            <span className="panel-eyebrow">Your username</span>
            {myName ? (
              <div className="claimed-row">
                <span className="claimed-badge">
                  <Check size={15} /> @{myName}
                </span>
                <span className="claimed-note">
                  People can send to you by this name.
                </span>
              </div>
            ) : (
              <>
                <p className="panel-lede">
                  Claim a username so people can pay you without an address.
                </p>
                <div className="inline-form">
                  <div className="text-field">
                    <span className="field-at">@</span>
                    <input
                      className="field-input"
                      placeholder="yourname"
                      value={regInput}
                      maxLength={32}
                      onChange={(e) =>
                        setRegInput(
                          e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, "")
                        )
                      }
                    />
                  </div>
                  <button
                    className="btn primary"
                    onClick={onRegister}
                    disabled={
                      busy === "register" ||
                      !regInput.trim() ||
                      nameState === "checking" ||
                      nameState === "taken"
                    }
                  >
                    {busy === "register" ? "Claiming…" : "Claim"}
                  </button>
                </div>
                {regInput.trim() && nameState === "checking" && (
                  <span className="field-hint muted">
                    Checking the registry…
                  </span>
                )}
                {nameState === "available" && (
                  <span className="field-hint ok">
                    <Check size={13} /> @{regInput.trim()} is available
                  </span>
                )}
                {nameState === "taken" && (
                  <span className="field-hint miss">
                    @{regInput.trim()} is already taken
                  </span>
                )}
              </>
            )}
          </section>
        </div>
      </div>
    </>
  );
}

// --- Send view -----------------------------------------------------------
function SendView(props: {
  sendTo: string;
  setSendTo: (v: string) => void;
  sendAmount: string;
  setSendAmount: (v: string) => void;
  lookupState: "idle" | "pending" | "found" | "missing";
  setLookupState: (v: "idle" | "pending" | "found" | "missing") => void;
  onResolveRecipient: () => void;
  onSend: () => void;
  balance: bigint;
  btcUsd: number | null;
  gasless: boolean;
  setGasless: (v: boolean) => void;
  sponsorReady: boolean;
  busy: string | null;
}) {
  const {
    sendTo,
    setSendTo,
    sendAmount,
    setSendAmount,
    lookupState,
    setLookupState,
    onResolveRecipient,
    onSend,
    balance,
    btcUsd,
    gasless,
    setGasless,
    sponsorReady,
    busy,
  } = props;

  // Validate the amount against the live on-chain balance.
  let amountSats = 0n;
  try {
    amountSats = BigInt(sendAmount || "0");
  } catch {
    amountSats = 0n;
  }
  const overBalance = amountSats > balance;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Send sBTC</h1>
          <p>Pay a @username or a Stacks address.</p>
        </div>
      </header>

      <div className="send-grid">
      <section className="panel send-panel">
        <label className="field-label">Recipient</label>
        <div className="text-field block">
          <Search size={16} className="field-lead" />
          <input
            className="field-input"
            placeholder="@username or ST…"
            value={sendTo}
            onChange={(e) => {
              setSendTo(e.target.value);
              setLookupState("idle");
            }}
            onBlur={onResolveRecipient}
            onKeyDown={(e) => e.key === "Enter" && onResolveRecipient()}
          />
        </div>
        {lookupState === "pending" && (
          <span className="field-hint muted">Looking up…</span>
        )}
        {lookupState === "found" && (
          <span className="field-hint ok">
            <Check size={13} /> Resolved to {short(sendTo)}
          </span>
        )}
        {lookupState === "missing" && (
          <span className="field-hint miss">That username isn't registered</span>
        )}

        <label className="field-label">Amount</label>
        <div className="text-field block">
          <input
            className="field-input"
            type="number"
            min="1"
            placeholder="100000"
            value={sendAmount}
            onChange={(e) => setSendAmount(e.target.value)}
          />
          <span className="field-trail">sats</span>
        </div>
        {amountSats > 0n && btcUsd != null && (
          <span className="field-usd">≈ {fmtUsd(amountSats, btcUsd)}</span>
        )}
        {overBalance ? (
          <span className="field-hint miss">
            Amount exceeds your balance of {fmt(balance)} sats
          </span>
        ) : (
          <span className="field-hint muted">
            Balance: {fmt(balance)} sats
            {btcUsd != null ? ` · ${fmtUsd(balance, btcUsd)}` : ""}
          </span>
        )}

        <button
          type="button"
          className={`gas-toggle${gasless ? " on" : ""}`}
          onClick={() => setGasless(!gasless)}
          aria-pressed={gasless}
        >
          <span className="gas-toggle-track">
            <span className="gas-toggle-knob" />
          </span>
          <span className="gas-toggle-label">
            <span className="gas-toggle-title">
              <Zap size={13} /> Gasless
            </span>
            <span className="gas-toggle-sub">
              {gasless
                ? sponsorReady
                  ? "The pool covers this fee"
                  : "Pool empty — may fall back to you"
                : "You pay the network fee"}
            </span>
          </span>
        </button>

        <button
          className="btn primary full"
          onClick={onSend}
          disabled={busy === "send" || !sendTo || !sendAmount || overBalance}
        >
          <Send size={16} />
          {busy === "send"
            ? "Sending…"
            : gasless
              ? "Send sBTC — no gas"
              : "Send sBTC"}
        </button>
      </section>

      <aside className="panel send-aside">
        <span className="panel-eyebrow">How sending works</span>
        <ul className="tips">
          <li>
            <span className="tip-dot" /> Pay a <b>@username</b> or a raw{" "}
            <b>ST…</b> address.
          </li>
          <li>
            <span className="tip-dot" /> Usernames resolve to an address before
            the transfer.
          </li>
          <li>
            <span className="tip-dot" /> With <b>Gasless</b> on, the sponsor
            pool pays the network fee — you sign, they cover it.
          </li>
          <li>
            <span className="tip-dot" /> You approve every transfer in your
            wallet — nothing moves without you.
          </li>
        </ul>
        <div className="aside-balance">
          <span>Available</span>
          <strong>
            {fmt(balance)} <small>sats</small>
          </strong>
        </div>
      </aside>
      </div>
    </>
  );
}

// --- Receive view --------------------------------------------------------
// Completes the payments loop: your @username / address as a scannable code
// and a shareable link (…/app?to=<handle>) that drops the payer on a prefilled
// Send screen. Everything is derived from the connected wallet — no invented
// data. Falls back to the raw principal when no name is claimed.
function ReceiveView(props: {
  address: string;
  myName: string | null;
  goClaim: () => void;
}) {
  const { address, myName, goClaim } = props;

  const origin = typeof window !== "undefined" ? window.location.origin : "";
  // Prefer the @username in the link — cleaner, and it outlives any one wallet.
  const handle = myName ?? address;
  const payLink = `${origin}/app?to=${encodeURIComponent(handle)}`;

  const copy = (text: string, label: string) => {
    navigator.clipboard?.writeText(text);
    toast.success(`${label} copied`);
  };

  const qrWrapRef = useRef<HTMLDivElement>(null);
  const [saving, setSaving] = useState(false);

  // Rasterize a shareable "pay me" card to PNG and download it. Pure canvas —
  // no extra dependency, and nothing taints the export (logo + QR are
  // same-origin). Dark card keeps black primary; orange stays a tiny accent.
  const downloadCard = async () => {
    const src = qrWrapRef.current?.querySelector("canvas");
    if (!src) return;
    setSaving(true);
    try {
      try {
        await Promise.all([
          document.fonts.load("800 88px Manrope"),
          document.fonts.load("600 34px Manrope"),
          document.fonts.load("500 28px Manrope"),
        ]);
        await document.fonts.ready;
      } catch {
        /* fall back to sans-serif — still legible */
      }
      const logo = await loadImage("/assets/sato-logo.png").catch(() => null);
      const W = 1080;
      const H = 1350;
      const c = document.createElement("canvas");
      c.width = W;
      c.height = H;
      const g = c.getContext("2d");
      if (!g) return;
      const cx = W / 2;
      // Paper backdrop + inset rounded ink card with a soft drop shadow.
      g.fillStyle = "#f5f4ef";
      g.fillRect(0, 0, W, H);
      const m = 48;
      g.save();
      g.shadowColor = "rgba(13,17,23,0.22)";
      g.shadowBlur = 48;
      g.shadowOffsetY = 22;
      roundRect(g, m, m, W - 2 * m, H - 2 * m, 56);
      g.fillStyle = "#0d1117";
      g.fill();
      g.restore();
      roundRect(g, m, m, W - 2 * m, H - 2 * m, 56);
      g.strokeStyle = "rgba(255,255,255,0.06)";
      g.lineWidth = 2;
      g.stroke();

      // Logo mark near the top.
      if (logo) {
        const lh = 82;
        const lw = (logo.naturalWidth / logo.naturalHeight) * lh || lh;
        g.drawImage(logo, cx - lw / 2, 118, lw, lh);
      }

      // White QR tile with the QR centered inside.
      const tile = 560;
      const tileY = 248;
      g.save();
      g.shadowColor = "rgba(0,0,0,0.30)";
      g.shadowBlur = 40;
      g.shadowOffsetY = 16;
      roundRect(g, cx - tile / 2, tileY, tile, tile, 44);
      g.fillStyle = "#ffffff";
      g.fill();
      g.restore();
      const q = 452;
      g.drawImage(src, cx - q / 2, tileY + (tile - q) / 2, q, q);
      // Handle (@username or short address), auto-fit to width.
      const handleText = myName ? `@${myName}` : short(address);
      let hs = 88;
      g.textAlign = "center";
      const maxW = W - 260;
      do {
        g.font = `800 ${hs}px Manrope, sans-serif`;
        if (g.measureText(handleText).width <= maxW) break;
        hs -= 4;
      } while (hs > 40);
      g.fillStyle = "#ffffff";
      g.fillText(handleText, cx, 946);

      // Subtitle.
      g.font = "600 34px Manrope, sans-serif";
      g.fillStyle = "#8791a0";
      g.fillText("Scan to pay me on Sato", cx, 1000);

      // Address — shown only when a @username already headlines the card.
      if (myName) {
        g.font = "500 28px Manrope, sans-serif";
        g.fillStyle = "#6e7784";
        g.fillText(short(address), cx, 1086);
      }

      // Small orange accent rule (brand: orange only on little things).
      roundRect(g, cx - 34, 1128, 68, 5, 3);
      g.fillStyle = "#f15a24";
      g.fill();

      // Footer tagline.
      g.font = "600 27px Manrope, sans-serif";
      g.fillStyle = "#8791a0";
      g.fillText("sato · send bitcoin like a text", cx, 1188);
      const blob = await new Promise<Blob | null>((res) =>
        c.toBlob(res, "image/png"),
      );
      if (!blob) throw new Error("no blob");
      const fname =
        (myName ?? "wallet").replace(/[^a-z0-9_-]/gi, "") || "wallet";
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `sato-${fname}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success("Card saved to your downloads");
    } catch {
      toast.error("Couldn't create the card");
    } finally {
      setSaving(false);
    }
  };

  return (
    <>
      {/* Offscreen high-res QR, rasterized into the downloadable card. */}
      <div
        ref={qrWrapRef}
        aria-hidden
        style={{
          position: "absolute",
          left: -99999,
          top: 0,
          pointerEvents: "none",
        }}
      >
        <QRCodeCanvas
          value={payLink}
          size={520}
          level="H"
          bgColor="#ffffff"
          fgColor="#0d1117"
          marginSize={0}
          imageSettings={{
            src: "/assets/sato-logo.png",
            height: 104,
            width: 104,
            excavate: true,
          }}
        />
      </div>
      <header className="page-head">
        <div>
          <h1>Receive sBTC</h1>
          <p>Share your code or link to get paid.</p>
        </div>
      </header>

      <div className="send-grid">
        <section className="panel receive-panel">
          <div className="qr-frame">
            <QRCodeSVG
              value={payLink}
              size={188}
              level="H"
              bgColor="#ffffff"
              fgColor="#0d1117"
              marginSize={0}
              imageSettings={{
                src: "/assets/sato-logo.png",
                height: 38,
                width: 38,
                excavate: true,
              }}
            />
          </div>

          <div className="receive-handle">
            {myName ? (
              <>
                <span className="receive-at">@</span>
                <span className="receive-name">{myName}</span>
              </>
            ) : (
              <span className="receive-name unnamed">{short(address)}</span>
            )}
          </div>
          {myName ? (
            <p className="receive-note">
              Scan the code or open the link — anyone can pay you at{" "}
              <b>@{myName}</b>.
            </p>
          ) : (
            <p className="receive-note">
              You can still receive to your address. Claim a{" "}
              <button className="link-btn" onClick={goClaim}>
                @username
              </button>{" "}
              for a cleaner code and link.
            </p>
          )}

          <div className="receive-actions">
            <button
              className="btn primary full"
              onClick={downloadCard}
              disabled={saving}
            >
              <Download size={16} /> {saving ? "Creating…" : "Download card"}
            </button>
            <button
              className="btn soft full"
              onClick={() => copy(payLink, "Payment link")}
            >
              <Copy size={15} /> Copy link
            </button>
          </div>
        </section>
        <aside className="panel send-aside">
          <span className="panel-eyebrow">Your address</span>
          <div className="receive-addr">
            <span className="mono receive-addr-val">{address}</span>
            <div className="receive-addr-row">
              <button
                className="btn soft sm"
                onClick={() => copy(address, "Address")}
              >
                <Copy size={14} /> Copy
              </button>
              <a
                className="btn soft sm"
                href={explorerAddr(address)}
                target="_blank"
                rel="noreferrer"
              >
                <ExternalLink size={14} /> Explorer
              </a>
            </div>
          </div>
          <ul className="tips">
            <li>
              <span className="tip-dot" /> Anyone can pay you by scanning your{" "}
              <b>code</b> or opening your <b>link</b> — it prefills their Send.
            </li>
            <li>
              <span className="tip-dot" /> A <b>@username</b> is easier to share
              than a raw address, and it never changes.
            </li>
            <li>
              <span className="tip-dot" /> Payments settle on-chain straight to
              your wallet — nothing is custodial.
            </li>
          </ul>
        </aside>
      </div>
    </>
  );
}

// --- Earn view (sato-yield pool) -----------------------------------------
// A radial gauge for a 0..1 fraction — a faint ink track under an orange arc
// that draws in from empty on mount (and eases to any new value). Center slot
// holds a label. Static offset under reduced motion.
function Ring({
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

// The Earn headline: a live, streaming "yield earned" figure paired with a
// radial gauge of the user's share of the pool. Both are real on-chain values —
// the ticker just extends the last reading at the rate the chain is paying, and
// re-syncs on every poll. Adapts to a not-yet-deposited state.
function EarnHero({
  earn,
  btcUsd,
}: {
  earn: EarnStats;
  btcUsd: number | null;
}) {
  const liveYield = useLiveYield(earn.earned, earn.deposited, earn.rateBps);
  const active = earn.deposited > 0n;
  const apr = Number(earn.rateBps) / 100; // bps -> %
  const share =
    earn.poolPrincipal > 0n
      ? Number(earn.deposited) / Number(earn.poolPrincipal)
      : 0;
  // Honest per-day projection from the annual rate.
  const perDay = (Number(earn.deposited) * (Number(earn.rateBps) / 10000)) / 365;
  const shownYield = Math.floor(liveYield);
  const sharePctText =
    share > 0 && share < 0.001
      ? "<0.1"
      : (share * 100).toLocaleString(undefined, {
          maximumFractionDigits: share < 0.1 ? 1 : 0,
        });

  return (
    <section className="earn-hero">
      <div className="eh-main">
        <div className="eh-head">
          <span className="eh-eyebrow">Yield earned</span>
          {active && (
            <span className="eh-live" title="Updating live from the pool rate">
              <span className="eh-live-dot" /> Live
            </span>
          )}
        </div>
        <div className="eh-value">
          <span className="eh-num">{shownYield.toLocaleString()}</span>
          <span className="eh-unit">sats</span>
        </div>
        <div className="eh-meta">
          {apr > 0 && (
            <span className="eh-apr">{apr.toLocaleString()}% APR</span>
          )}
          {active ? (
            <span className="eh-note">
              ≈ {Math.round(perDay).toLocaleString()} sats/day
              {btcUsd != null
                ? ` · ${fmtUsd(BigInt(shownYield), btcUsd)} earned`
                : ""}
            </span>
          ) : (
            <span className="eh-note">Deposit sBTC below to start earning</span>
          )}
        </div>
      </div>
      <div className="eh-ring">
        <Ring fraction={share}>
          <span className="ring-pct">{sharePctText}%</span>
          <span className="ring-cap">pool share</span>
        </Ring>
        <span className="eh-ring-sub">
          {fmt(earn.deposited)} of {fmt(earn.poolPrincipal)} sats
        </span>
      </div>
    </section>
  );
}

function EarnView(props: {
  earn: EarnStats;
  btcUsd: number | null;
  earnAmount: string;
  setEarnAmount: (v: string) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onFaucet: () => void;
  busy: string | null;
}) {
  const {
    earn,
    btcUsd,
    earnAmount,
    setEarnAmount,
    onDeposit,
    onWithdraw,
    onFaucet,
    busy,
  } = props;

  // Deposit and withdraw are opposite actions with different ceilings — deposit
  // is capped by your wallet balance, withdraw by your deposited principal — so
  // one amount field feeding both buttons read as ambiguous ("how do I get my
  // yield out?"). Split them into an explicit mode toggle, each with the right
  // max, hint, and payout.
  const [mode, setMode] = useState<"deposit" | "withdraw">("deposit");

  let amountSats = 0n;
  try {
    amountSats = BigInt(earnAmount || "0");
  } catch {
    amountSats = 0n;
  }
  const max = mode === "deposit" ? earn.available : earn.deposited;
  const over = amountSats > max;
  // Any withdrawal harvests ALL accrued yield on top of the principal pulled,
  // so the real payout is what you type plus everything you've earned.
  const willReceive = amountSats + earn.earned;
  const busyKey = mode === "deposit" ? "earn-deposit" : "earn-withdraw";
  const actionDisabled =
    busy === busyKey ||
    amountSats <= 0n ||
    over ||
    (mode === "withdraw" && earn.deposited === 0n);

  const switchMode = (m: "deposit" | "withdraw") => {
    setMode(m);
    setEarnAmount("");
  };

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Earn</h1>
          <p>Put idle sBTC to work and earn yield on your balance.</p>
        </div>
        <button
          className="btn soft"
          onClick={onFaucet}
          disabled={busy === "earn-fund"}
        >
          <Plus size={16} />
          {busy === "earn-fund" ? "Funding…" : "Get test sBTC"}
        </button>
      </header>

      <EarnHero earn={earn} btcUsd={btcUsd} />

      <div className="stat-row">
        <StatTile
          label="Deposited"
          icon={TrendingUp}
          countTo={Number(earn.deposited)}
          unit="sats"
          sub="Principal earning in the pool"
        />
        <StatTile
          label="Position value"
          icon={Coins}
          countTo={Number(earn.deposited + earn.earned)}
          unit="sats"
          sub="Principal + earned yield"
        />
        <StatTile
          label="Available"
          icon={Wallet}
          countTo={Number(earn.available)}
          unit="sats"
          sub="Ready to deposit"
        />
      </div>

      <div className="send-grid">
        <section className="panel send-panel">
          <div className="earn-modes" role="tablist" aria-label="Deposit or withdraw">
            <button
              role="tab"
              aria-selected={mode === "deposit"}
              className={`earn-mode${mode === "deposit" ? " active" : ""}`}
              onClick={() => switchMode("deposit")}
            >
              <ArrowDownLeft size={15} /> Deposit
            </button>
            <button
              role="tab"
              aria-selected={mode === "withdraw"}
              className={`earn-mode${mode === "withdraw" ? " active" : ""}`}
              onClick={() => switchMode("withdraw")}
            >
              <ArrowUpRight size={15} /> Withdraw
            </button>
          </div>

          <label className="field-label">Amount</label>
          <div className="text-field block">
            <input
              className="field-input"
              type="number"
              min="1"
              placeholder="100000"
              value={earnAmount}
              onChange={(e) => setEarnAmount(e.target.value)}
            />
            <button
              type="button"
              className="field-max"
              onClick={() => setEarnAmount(max > 0n ? max.toString() : "")}
              disabled={max <= 0n}
            >
              {mode === "withdraw" ? "All" : "Max"}
            </button>
            <span className="field-trail">sats</span>
          </div>
          {amountSats > 0n && btcUsd != null && (
            <span className="field-usd">≈ {fmtUsd(amountSats, btcUsd)}</span>
          )}
          <span className="field-hint muted">
            {mode === "deposit"
              ? `Available to deposit ${fmt(earn.available)} sats`
              : `Deposited principal ${fmt(earn.deposited)} sats`}
          </span>
          {earnAmount && over && (
            <span className="field-hint warn">
              {mode === "deposit"
                ? "More than your available balance"
                : "More than your deposited principal"}
            </span>
          )}
          {mode === "withdraw" && amountSats <= 0n && earn.earned > 0n && (
            <span className="field-hint ok">
              Any withdrawal also claims {fmt(earn.earned)} sats of yield
            </span>
          )}
          {mode === "withdraw" && amountSats > 0n && (
            <div className="earn-receive">
              <span className="earn-receive-label">
                <span>You'll receive</span>
                <small>
                  {fmt(amountSats)} principal
                  {earn.earned > 0n ? ` + ${fmt(earn.earned)} yield` : ""}
                </small>
              </span>
              <span className="earn-receive-total">
                {fmt(willReceive)} <small>sats</small>
              </span>
            </div>
          )}

          <div className="earn-actions">
            {mode === "deposit" ? (
              <button
                className="btn primary"
                onClick={onDeposit}
                disabled={actionDisabled}
              >
                <ArrowDownLeft size={16} />
                {busy === "earn-deposit" ? "Depositing…" : "Deposit"}
              </button>
            ) : (
              <button
                className="btn primary"
                onClick={onWithdraw}
                disabled={actionDisabled}
              >
                <ArrowUpRight size={16} />
                {busy === "earn-withdraw"
                  ? "Withdrawing…"
                  : earn.earned > 0n
                    ? "Withdraw + claim yield"
                    : "Withdraw"}
              </button>
            )}
          </div>
        </section>

        <aside className="panel send-aside">
          <span className="panel-eyebrow">How earning works</span>
          <ul className="tips">
            <li>
              <span className="tip-dot" /> Deposited sBTC earns a{" "}
              <b>pro-rata share</b> of pool yield.
            </li>
            <li>
              <span className="tip-dot" /> No lockup — withdraw your principal
              anytime.
            </li>
            <li>
              <span className="tip-dot" /> Any withdrawal <b>pays out all earned
              yield</b> too.
            </li>
          </ul>
          <div className="aside-balance">
            <span>Pool size</span>
            <strong>
              {fmt(earn.poolTotal)} <small>sats</small>
            </strong>
          </div>
        </aside>
      </div>
    </>
  );
}

// --- Gas view (sato-sponsor pool) ----------------------------------------
function GasView(props: {
  sponsor: SponsorStats;
  stxUsd: number | null;
  topUpAmount: string;
  setTopUpAmount: (v: string) => void;
  onTopUp: () => void;
  busy: string | null;
}) {
  const { sponsor, stxUsd, topUpAmount, setTopUpAmount, onTopUp, busy } = props;

  return (
    <>
      <header className="page-head">
        <div>
          <h1>Gas</h1>
          <p>Sato covers network fees from a shared STX pool.</p>
        </div>
        <a
          className="btn soft"
          href="https://platform.hiro.so/faucet"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} /> Get testnet STX
        </a>
      </header>

      <div className="stat-row">
        <StatTile
          label="Pool balance"
          icon={Fuel}
          big
          countTo={Number(sponsor.poolBalance) / 1_000_000}
          countFormat={(n) =>
            n.toLocaleString(undefined, { maximumFractionDigits: 6 })
          }
          unit="STX"
          sub="Available to cover fees"
        />
        <StatTile
          label="Your allowance"
          icon={Zap}
          countTo={Number(sponsor.remaining) / 1_000_000}
          countFormat={(n) =>
            n.toLocaleString(undefined, { maximumFractionDigits: 6 })
          }
          unit="STX"
          sub="Left in this window"
          gauge={
            sponsor.cap > 0n
              ? Number(sponsor.remaining) / Number(sponsor.cap)
              : undefined
          }
        />
        <StatTile
          label="Sponsored"
          icon={Hash}
          countTo={Number(sponsor.sponsoredCount)}
          sub="Txs covered for you"
        />
      </div>

      <div className="send-grid">
        <section className="panel send-panel">
          <label className="field-label">Contribute to the pool</label>
          <div className="text-field block">
            <input
              className="field-input"
              type="number"
              min="0"
              step="0.1"
              placeholder="1.0"
              value={topUpAmount}
              onChange={(e) => setTopUpAmount(e.target.value)}
            />
            <span className="field-trail">STX</span>
          </div>
          {Number(topUpAmount) > 0 && stxUsd != null && (
            <span className="field-usd">
              ≈ {fmtUsdNum(Number(topUpAmount) * stxUsd)}
            </span>
          )}
          <span className="field-hint muted">
            Pool holds {fmtStx(sponsor.poolBalance)} STX · cap{" "}
            {fmtStx(sponsor.cap)} STX per user each window
          </span>
          <button
            className="btn primary full"
            onClick={onTopUp}
            disabled={busy === "topup" || !topUpAmount}
          >
            <Fuel size={16} />
            {busy === "topup" ? "Adding…" : "Add to pool"}
          </button>
        </section>
        <aside className="panel send-aside">
          <span className="panel-eyebrow">How gas works</span>
          <ul className="tips">
            <li>
              <span className="tip-dot" /> A shared STX pool{" "}
              <b>reimburses network fees</b> so users needn't hold STX for gas.
            </li>
            <li>
              <span className="tip-dot" /> Each account can be covered up to{" "}
              <b>{fmtStx(sponsor.cap)} STX</b> per{" "}
              {sponsor.windowLength.toString()}-block window.
            </li>
            <li>
              <span className="tip-dot" /> Top-ups are <b>permissionless</b> —
              anyone can keep the pool funded.
            </li>
          </ul>
          <div className="aside-balance">
            <span>Pool balance</span>
            <strong>
              {fmtStx(sponsor.poolBalance)} <small>STX</small>
            </strong>
          </div>
        </aside>
      </div>
    </>
  );
}

// --- Activity view (live on-chain history) -------------------------------
function ActivityView(props: {
  address: string;
  txs: SatoTx[];
  loading: boolean;
  reload: () => void;
}) {
  const { address, txs, loading, reload } = props;
  return (
    <>
      <header className="page-head">
        <div>
          <h1>Activity</h1>
          <p>Your testnet transactions, straight from the chain.</p>
        </div>
        <button
          className="btn soft"
          onClick={reload}
          disabled={loading}
        >
          <RefreshCw size={15} className={loading ? "spin" : undefined} />
          {loading ? "Refreshing…" : "Refresh"}
        </button>
      </header>

      <section className="panel">
        <TxTable txs={txs} loading={loading} address={address} />
      </section>

      <a
        className="explorer-cta"
        href={explorerAddr(address)}
        target="_blank"
        rel="noreferrer"
      >
        Open full history on the Stacks explorer <ArrowUpRight size={15} />
      </a>
    </>
  );
}

// Scoped styles using Sato's palette (defined in index.css :root).
const shellStyles = `
.sato-shell{min-height:100vh;background:var(--paper);color:var(--ink);font-family:var(--sans);display:grid;grid-template-columns:256px 1fr;}
.sato-shell *{box-sizing:border-box;}

/* Auth (disconnected) — split sign-in */
.sato-shell.auth{grid-template-columns:1fr 1fr;min-height:100vh;}
.auth-panel{display:flex;flex-direction:column;padding:36px clamp(28px,5vw,64px);}
.auth-top{display:flex;align-items:center;justify-content:space-between;}
.auth-brand{display:flex;align-items:center;gap:9px;}
.auth-brand .brand-name{font-weight:800;font-size:18px;letter-spacing:-.03em;}
.auth-back{font-size:13px;font-weight:600;color:var(--text-muted);transition:color .15s;}
.auth-back:hover{color:var(--ink);}
.auth-body{flex:1;display:flex;flex-direction:column;justify-content:center;max-width:420px;}
.auth-eyebrow{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--orange);margin-bottom:18px;}
.auth-title{font-size:clamp(38px,5vw,52px);line-height:1.02;letter-spacing:-.055em;font-weight:700;margin:0 0 20px;}
.auth-lede{color:var(--text-muted);font-size:15.5px;line-height:1.65;margin:0 0 30px;}
.auth-points{list-style:none;padding:0;margin:22px 0 0;display:flex;flex-direction:column;gap:11px;}
.auth-points li{display:flex;align-items:center;gap:9px;font-size:13.5px;color:var(--text-muted);}
.auth-points svg{color:#2f7d54;flex-shrink:0;}
.auth-foot{font-size:12px;color:var(--muted);}

/* Brand panel */
.auth-brandside{position:relative;background:linear-gradient(155deg,#0d1117 0%,#141d2b 55%,#0d1117 100%);display:flex;flex-direction:column;align-items:center;justify-content:center;padding:48px;overflow:hidden;}
.brandside-glow{position:absolute;width:560px;height:560px;border-radius:50%;background:radial-gradient(circle,#f15a2426,transparent 62%);top:-120px;right:-160px;}
.brandside-card{position:relative;z-index:1;width:min(100%,340px);background:var(--white);border-radius:20px;padding:24px;box-shadow:0 26px 60px #00000059;transform:rotate(-1.5deg);}
.bs-eyebrow{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:10px;}
.bs-balance{display:flex;align-items:baseline;gap:7px;}
.bs-balance b{font-size:36px;font-weight:700;letter-spacing:-.03em;}
.bs-balance span{color:var(--text-muted);font-size:14px;font-weight:600;}
.bs-send{display:flex;align-items:center;gap:10px;margin:20px 0 16px;padding:14px;background:var(--paper);border-radius:13px;}
.bs-avatar{width:34px;height:34px;border-radius:10px;background:#e9e8e2;color:var(--ink);display:grid;place-items:center;font-size:12px;font-weight:700;}
.bs-meta{display:flex;flex-direction:column;flex:1;}
.bs-meta small{font-size:11px;color:var(--muted);}
.bs-meta strong{font-size:14px;}
.bs-send>svg{color:#2f7d54;}
.bs-btn{background:var(--ink);color:#fff;border-radius:11px;padding:12px;text-align:center;font-size:14px;font-weight:600;}
.brandside-tag{position:relative;z-index:1;color:#fff;font-size:16px;font-weight:600;letter-spacing:-.02em;margin:34px 0 0;text-align:center;text-shadow:0 1px 8px #00000040;}

/* Sidebar */
.sidebar{border-right:1px solid var(--line);padding:24px 16px;display:flex;flex-direction:column;position:sticky;top:0;height:100vh;background:var(--paper);}
.sidebar-brand{display:flex;align-items:center;gap:9px;padding:4px 10px 24px;}
.brand-mark{width:30px;height:30px;border-radius:9px;overflow:hidden;background:#000;display:grid;place-items:center;flex-shrink:0;}
.brand-mark img{width:100%;height:100%;object-fit:cover;display:block;}
.brand-name{font-weight:700;font-size:17px;letter-spacing:-.02em;}
.brand-badge{font-size:10px;text-transform:uppercase;letter-spacing:.06em;background:var(--mint);color:var(--navy);padding:2px 7px;border-radius:999px;font-weight:700;}
.sidebar-scroll{flex:1;display:flex;flex-direction:column;min-height:0;}
.nav-group-label{display:block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:var(--muted);padding:0 12px 8px;}
.sidebar-nav{display:flex;flex-direction:column;gap:2px;}
.sidebar-promo{border:1px solid var(--line);background:var(--white);border-radius:14px;padding:14px;margin:12px 0;}
.sidebar-promo strong{display:block;font-size:13px;letter-spacing:-.01em;margin-bottom:4px;}
.sidebar-promo p{font-size:12px;color:var(--text-muted);line-height:1.5;margin:0 0 11px;}
.nav-item{display:flex;align-items:center;gap:11px;width:100%;border:0;background:transparent;color:var(--text-muted);padding:11px 12px;border-radius:11px;font-size:14.5px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:background .14s,color .14s;text-align:left;}
.nav-item:hover{background:#ecebe5;color:var(--ink);}
.nav-item.active{background:var(--white);color:var(--ink);box-shadow:0 1px 2px #1620280f,0 0 0 1px var(--line);}
.nav-item.active svg{color:var(--ink);}
.nav-item.active::after{content:"";width:6px;height:6px;border-radius:50%;background:var(--orange);margin-left:auto;flex-shrink:0;}
.sidebar-account{border-top:1px solid var(--line);padding-top:14px;margin-top:14px;}
.account-row{display:flex;align-items:center;gap:10px;padding:4px 6px;}
.account-avatar{width:34px;height:34px;border-radius:10px;background:#e9f0ff;color:#446aa8;display:grid;place-items:center;font-size:12px;font-weight:700;}
.account-meta{display:flex;flex-direction:column;min-width:0;}
.account-meta strong{font-size:13.5px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.account-meta small{font-size:11.5px;color:var(--muted);font-family:var(--mono);}
.account-addr{display:flex;align-items:center;gap:5px;}
.account-explorer{display:inline-flex;color:var(--muted);padding:1px;border-radius:6px;transition:color .14s;}
.account-explorer:hover{color:var(--ink);}
.account-signout{display:flex;align-items:center;gap:7px;width:100%;border:0;background:transparent;color:var(--text-muted);padding:9px 6px;margin-top:6px;border-radius:9px;font-size:12.5px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:color .14s,background .14s;}
.account-signout:hover{color:var(--ink);background:#ecebe5;}

/* Main */
.main{padding:40px clamp(24px,5vw,56px);max-width:1120px;width:100%;}
.page-head{margin-bottom:24px;display:flex;align-items:flex-start;justify-content:space-between;gap:16px;}
.page-head h1{font-size:26px;letter-spacing:-.03em;margin:0 0 4px;}
.page-head p{color:var(--text-muted);font-size:14.5px;margin:0;}

/* Panels */
.panel{background:var(--white);border:1px solid var(--line);border-radius:18px;padding:26px;margin-bottom:16px;}
.panel-eyebrow{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);margin-bottom:14px;}
.panel-lede{color:var(--text-muted);font-size:14.5px;line-height:1.6;margin:0 0 16px;}

.balance-line{display:flex;align-items:baseline;gap:8px;}
.balance-num{font-size:46px;font-weight:700;letter-spacing:-.03em;line-height:1;}
.balance-unit{font-size:17px;color:var(--text-muted);font-weight:600;}
.panel-actions{display:flex;gap:10px;margin-top:24px;}

/* Balance hero + live value chart (Overview) */
.balance-hero{background:var(--white);border:1px solid var(--line);border-radius:18px;padding:24px 26px 10px;margin-bottom:16px;overflow:hidden;}
.bh-top{display:flex;align-items:flex-start;justify-content:space-between;gap:14px;}
.bh-eyebrow{display:block;font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.bh-value{display:flex;align-items:baseline;gap:8px;margin:9px 0 3px;}
.bh-num{font-size:40px;font-weight:700;letter-spacing:-.03em;line-height:1;}
.bh-num small{font-size:16px;color:var(--text-muted);font-weight:600;}
.bh-sub{font-size:13px;color:var(--text-muted);}
.bh-trend{display:inline-flex;align-items:center;font-size:12.5px;font-weight:700;padding:5px 11px;border-radius:999px;white-space:nowrap;flex-shrink:0;}
.bh-trend.up{background:#eef6f1;color:#2f7d54;}
.bh-trend.down{background:#fbeae7;color:#b4341f;}
.bh-empty{margin:16px 0 14px;padding:16px;border:1px dashed var(--line);border-radius:12px;font-size:13px;color:var(--text-muted);text-align:center;}
.bchart{position:relative;width:100%;margin-top:14px;touch-action:pan-y;cursor:crosshair;}
.bchart-svg{display:block;width:100%;height:116px;}
.bchart-area,.bchart-line{pointer-events:none;}
.bchart-svg circle{transition:r .12s var(--ease);}
.bchart-tip{position:absolute;top:-6px;transform:translateX(-50%);background:var(--ink);color:#fff;border-radius:11px;padding:8px 11px;pointer-events:none;display:flex;flex-direction:column;gap:3px;box-shadow:0 10px 26px #16202833;white-space:nowrap;z-index:3;min-width:118px;}
.bct-kind{display:inline-flex;align-items:center;gap:5px;font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#c3ccd6;}
.bct-kind.in{color:#7fd6a3;}
.bct-kind.out{color:#f3a08c;}
.bchart-tip strong{font-size:15px;font-weight:800;letter-spacing:-.01em;line-height:1.1;}
.bchart-tip strong span{font-size:9px;font-weight:600;color:#aeb8c4;text-transform:uppercase;letter-spacing:.05em;margin-left:2px;}
.bct-usd{font-size:11px;font-weight:600;color:#e7ecf1;}
.bct-peer{font-size:10.5px;color:#aeb8c4;}
.bct-meta{font-size:9.5px;color:#8f9aa7;text-transform:uppercase;letter-spacing:.05em;margin-top:1px;}
.bchart-foot{display:flex;align-items:center;justify-content:space-between;margin-top:8px;font-size:11px;color:var(--text-muted);font-variant-numeric:tabular-nums;}
.bchart-foot span:first-child{font-weight:600;color:var(--ink);}
@media(prefers-reduced-motion:no-preference){
  .bchart-line{stroke-dasharray:1;stroke-dashoffset:1;animation:bdraw 1.05s var(--ease) .05s forwards;}
}
@keyframes bdraw{to{stroke-dashoffset:0;}}

.claimed-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.claimed-badge{display:inline-flex;align-items:center;gap:6px;background:#f0f7f3;color:#2f7d54;border:1px solid #cfe8db;padding:8px 14px;border-radius:999px;font-weight:700;font-size:15px;}
.claimed-note{color:var(--text-muted);font-size:13.5px;}

.inline-form{display:flex;gap:10px;}
.text-field{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:0 14px;background:var(--white);flex:1;transition:border-color .14s,box-shadow .14s;}
.text-field:focus-within{border-color:var(--ink);box-shadow:0 0 0 3px #0d111714;}
.text-field.block{width:100%;margin-bottom:4px;}
.field-at{color:var(--text-muted);font-weight:700;}
.field-lead{color:var(--muted);flex-shrink:0;}
.field-trail{color:var(--text-muted);font-size:13px;font-weight:600;}
.field-input{flex:1;border:0;background:transparent;padding:13px 2px;font-size:15px;color:var(--ink);outline:none;font-family:var(--sans);min-width:0;}
.field-input:focus,.field-input:focus-visible{outline:none;}
.field-input::-webkit-outer-spin-button,
.field-input::-webkit-inner-spin-button{-webkit-appearance:none;margin:0;}
.field-input[type=number]{-moz-appearance:textfield;appearance:textfield;}
.field-usd{display:block;font-size:14px;font-weight:700;color:var(--ink);letter-spacing:-.01em;margin:8px 0 2px;}
.field-label{display:block;font-size:13px;font-weight:600;color:var(--ink);margin:16px 0 7px;}
.field-label:first-child{margin-top:0;}
.field-hint{display:inline-flex;align-items:center;gap:5px;font-size:12.5px;margin-top:2px;}
.field-hint.muted{color:var(--muted);}
.field-hint.ok{color:#2f7d54;}
.field-hint.miss{color:#b4341f;}
.field-hint.warn{color:#b56a1f;}

.gas-toggle{display:flex;align-items:center;gap:12px;width:100%;margin-top:18px;padding:12px 14px;background:#fafaf8;border:1px solid var(--line);border-radius:12px;cursor:pointer;text-align:left;transition:border-color .2s var(--ease),background .2s var(--ease);}
.gas-toggle:hover{border-color:#d7d3c9;}
.gas-toggle.on{background:#fff;border-color:var(--ink);}
.gas-toggle-track{position:relative;flex-shrink:0;width:38px;height:22px;border-radius:999px;background:#d7d3c9;transition:background .2s var(--ease);}
.gas-toggle.on .gas-toggle-track{background:var(--ink);}
.gas-toggle-knob{position:absolute;top:2px;left:2px;width:18px;height:18px;border-radius:50%;background:#fff;transition:transform .2s var(--ease);}
.gas-toggle.on .gas-toggle-knob{transform:translateX(16px);}
.gas-toggle-label{display:flex;flex-direction:column;gap:3px;}
.gas-toggle-title{display:flex;align-items:center;gap:6px;font-size:13px;font-weight:700;color:var(--ink);}
.gas-toggle.on .gas-toggle-title svg{color:var(--orange);}
.gas-toggle-title svg{color:#9a958a;}
.gas-toggle-sub{font-size:11px;font-weight:500;color:var(--muted);}

.send-panel .btn.full{margin-top:22px;}
.earn-actions{display:flex;gap:10px;margin-top:22px;}
.earn-actions .btn{flex:1;}
.earn-modes{display:flex;gap:4px;padding:4px;background:var(--paper);border:1px solid var(--line);border-radius:12px;margin-bottom:18px;}
.earn-mode{flex:1;display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;background:transparent;color:var(--text-muted);padding:10px 16px;border-radius:9px;font-size:13.5px;font-weight:700;cursor:pointer;font-family:var(--sans);transition:background .15s,color .15s,box-shadow .15s;}
.earn-mode:hover{color:var(--ink);}
.earn-mode.active{background:var(--white);color:var(--ink);box-shadow:0 1px 2px #1620280f,0 0 0 1px var(--line);}
.earn-mode.active svg{color:var(--orange);}
.field-max{flex-shrink:0;border:1px solid var(--line);background:var(--white);color:var(--ink);font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.04em;padding:5px 9px;border-radius:7px;cursor:pointer;font-family:var(--sans);transition:background .14s,border-color .14s;}
.field-max:hover:not(:disabled){background:#ecebe5;border-color:#d7d3c9;}
.field-max:disabled{opacity:.4;cursor:not-allowed;}
.earn-receive{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-top:16px;padding:14px 16px;background:#fafaf8;border:1px solid var(--line);border-radius:12px;}
.earn-receive-label{display:flex;flex-direction:column;gap:3px;min-width:0;}
.earn-receive-label span{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.earn-receive-label small{font-size:12.5px;color:var(--text-muted);}
.earn-receive-total{font-size:20px;font-weight:700;letter-spacing:-.02em;white-space:nowrap;}
.earn-receive-total small{font-size:12px;color:var(--text-muted);font-weight:600;}

/* Earn hero — live yield figure + pool-share ring */
.earn-hero{display:grid;grid-template-columns:1fr auto;gap:24px;align-items:center;background:var(--white);border:1px solid var(--line);border-radius:18px;padding:22px 26px;margin-bottom:16px;position:relative;overflow:hidden;}
.earn-hero::before{content:"";position:absolute;top:-45%;right:-8%;width:320px;height:320px;background:radial-gradient(circle,#f15a2412,transparent 62%);pointer-events:none;}
.eh-main{min-width:0;position:relative;z-index:1;}
.eh-head{display:flex;align-items:center;gap:10px;}
.eh-eyebrow{font-size:12px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.eh-live{display:inline-flex;align-items:center;gap:5px;font-size:10.5px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#2f7d54;background:#eef6f1;padding:3px 8px;border-radius:999px;}
.eh-live-dot{width:6px;height:6px;border-radius:50%;background:#2f9c63;}
.eh-value{display:flex;align-items:baseline;gap:8px;margin:10px 0 2px;}
.eh-num{font-size:44px;font-weight:800;letter-spacing:-.03em;line-height:1;font-variant-numeric:tabular-nums;}
.eh-unit{font-size:16px;color:var(--text-muted);font-weight:600;}
.eh-meta{display:flex;align-items:center;gap:10px;flex-wrap:wrap;margin-top:8px;}
.eh-apr{display:inline-flex;align-items:center;font-size:12px;font-weight:700;color:var(--orange);background:#f15a2414;border:1px solid #f15a2433;padding:3px 9px;border-radius:999px;white-space:nowrap;}
.eh-note{font-size:13px;color:var(--text-muted);}
.eh-ring{display:flex;flex-direction:column;align-items:center;gap:9px;position:relative;z-index:1;}
.eh-ring-sub{font-size:11.5px;color:var(--text-muted);font-variant-numeric:tabular-nums;}

/* Radial gauge — the wrapper class is ring-wrap, not ring, because a bare
   .ring collides with Tailwind's ring utility (a 1px currentColor box-shadow)
   present in this build, which drew a black square around the donut. */
.ring-wrap{position:relative;display:grid;place-items:center;}
.ring-track{stroke:var(--line);}
.ring-arc{stroke:var(--orange);transition:stroke-dashoffset 1.1s var(--ease);}
.ring-center{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;}
.ring-pct{font-size:23px;font-weight:800;letter-spacing:-.02em;line-height:1;font-variant-numeric:tabular-nums;}
.ring-cap{font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
@media(max-width:560px){
  .earn-hero{grid-template-columns:1fr;justify-items:start;gap:18px;}
  .eh-num{font-size:38px;}
  .eh-ring{align-self:center;width:100%;}
}

/* Empty state */
.empty-panel{text-align:center;padding:48px 32px;}
.empty-icon{width:56px;height:56px;border-radius:16px;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;color:var(--text-muted);margin:0 auto 18px;}
.empty-panel h2{font-size:18px;letter-spacing:-.02em;margin:0 0 8px;}
.empty-panel p{color:var(--text-muted);font-size:14px;line-height:1.6;max-width:340px;margin:0 auto 22px;}

/* Stat tiles */
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px;}
.stat-row.two{grid-template-columns:repeat(2,1fr);}
.stat-tile{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:9px;transition:transform .18s var(--ease),box-shadow .18s,border-color .18s;}
.stat-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.stat-label{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.stat-ico{width:28px;height:28px;border-radius:8px;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;color:var(--text-muted);flex-shrink:0;}
.stat-value{font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;}
.stat-value small{font-size:13px;font-weight:600;color:var(--text-muted);}
.stat-tile.big .stat-value{font-size:30px;}
.stat-sub{font-size:12px;color:var(--text-muted);}
.stat-gauge{margin-top:11px;height:5px;border-radius:999px;background:var(--paper);overflow:hidden;}
.stat-gauge-fill{display:block;height:100%;border-radius:999px;background:var(--orange);transition:width 1s var(--ease);}

/* Overview grid */
.ov-grid{display:grid;grid-template-columns:1.7fr 1fr;gap:16px;align-items:start;}
.col-stack{display:flex;flex-direction:column;gap:16px;}
.panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:6px;}
.panel-head h2{font-size:15px;font-weight:700;letter-spacing:-.01em;margin:0;}
.panel-link{display:inline-flex;align-items:center;gap:4px;font-size:12.5px;font-weight:600;color:var(--text-muted);background:transparent;border:0;cursor:pointer;font-family:var(--sans);transition:color .14s;}
.panel-link:hover{color:var(--ink);}
.stack-actions{display:flex;flex-direction:column;gap:10px;}

/* Transaction list */
.tx-list{display:flex;flex-direction:column;}
.tx-row{display:flex;align-items:center;gap:12px;padding:11px 8px;margin:0 -8px;border-top:1px solid var(--line);text-decoration:none;color:inherit;border-radius:10px;transition:background .12s;}
.tx-row:first-child{border-top:0;}
.tx-row:hover{background:var(--paper);}
.tx-ico{width:36px;height:36px;border-radius:11px;display:grid;place-items:center;flex-shrink:0;background:var(--paper);border:1px solid var(--line);color:var(--ink);}
.tx-main{display:flex;flex-direction:column;min-width:0;flex:1;gap:2px;}
.tx-label{font-size:14px;font-weight:600;letter-spacing:-.01em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
.tx-sub{font-size:12px;color:var(--muted);font-family:var(--mono);}
.tx-right{display:flex;align-items:center;gap:12px;flex-shrink:0;}
.tx-time{font-size:12px;color:var(--text-muted);white-space:nowrap;min-width:56px;text-align:right;}
.tx-ext{color:var(--muted);opacity:0;transition:opacity .12s;}
.tx-row:hover .tx-ext{opacity:1;}
.pill{display:inline-flex;align-items:center;font-size:11px;font-weight:700;padding:3px 9px;border-radius:999px;text-transform:capitalize;}
.pill.success{background:#eef6f1;color:#2f7d54;}
.pill.pending{background:#fdf0e4;color:#b56a1f;}
.pill.failed,.pill.abort{background:#fbeae7;color:#b4341f;}

/* Transaction loading + empty */
.tx-loading{display:flex;flex-direction:column;gap:8px;}
.tx-skel{height:58px;border-radius:11px;background:linear-gradient(90deg,#efeee8,#f7f6f1,#efeee8);background-size:200% 100%;animation:sk 1.2s ease-in-out infinite;}
@keyframes sk{0%{background-position:200% 0}100%{background-position:-200% 0}}
.tx-empty{text-align:center;padding:26px 12px;display:flex;flex-direction:column;align-items:center;}
.tx-empty p{color:var(--text-muted);font-size:13.5px;line-height:1.6;max-width:320px;margin:0 0 12px;}
.tx-empty .empty-icon{margin-bottom:14px;}
.tx-empty-link{display:inline-flex;align-items:center;gap:5px;font-size:13px;font-weight:600;color:var(--ink);}

/* Copy button + mono address */
.mono{font-family:var(--mono);font-size:13px;color:var(--ink);}
.icon-btn{display:grid;place-items:center;width:26px;height:26px;border-radius:7px;border:1px solid var(--line);background:var(--paper);color:var(--text-muted);cursor:pointer;transition:color .14s,background .14s;}
.icon-btn:hover{color:var(--ink);background:#ecebe5;}

/* Send view */
.send-grid{display:grid;grid-template-columns:1.5fr 1fr;gap:16px;align-items:start;}
.send-aside{align-self:stretch;}
.tips{list-style:none;padding:0;margin:0 0 20px;display:flex;flex-direction:column;gap:13px;}
.tips li{position:relative;padding-left:20px;font-size:13.5px;line-height:1.55;color:var(--text-muted);}
.tips b{color:var(--ink);font-weight:600;}
.tip-dot{position:absolute;left:0;top:7px;width:7px;height:7px;border-radius:50%;background:var(--orange);}
.aside-balance{display:flex;align-items:center;justify-content:space-between;padding-top:16px;border-top:1px solid var(--line);}
.aside-balance span{font-size:13px;color:var(--text-muted);}
.aside-balance strong{font-size:17px;font-weight:700;letter-spacing:-.02em;}
.aside-balance small{font-size:12px;color:var(--text-muted);font-weight:600;}
.explorer-cta{display:inline-flex;align-items:center;gap:6px;margin-top:4px;font-size:13px;font-weight:600;color:var(--text-muted);transition:color .14s;}
.explorer-cta:hover{color:var(--ink);}

/* Quick-action pair (Overview) */
.action-pair{display:flex;gap:10px;}
.action-pair .btn{flex:1;}

/* Receive view */
.receive-panel{display:flex;flex-direction:column;align-items:center;text-align:center;}
.qr-frame{padding:16px;background:#fff;border:1px solid var(--line);border-radius:18px;box-shadow:0 1px 2px #16202814;line-height:0;}
.receive-handle{display:flex;align-items:baseline;gap:1px;margin:20px 0 0;}
.receive-at{font-size:22px;font-weight:700;color:var(--text-muted);}
.receive-name{font-size:26px;font-weight:700;letter-spacing:-.03em;color:var(--ink);}
.receive-name.unnamed{font-size:18px;font-family:var(--mono);letter-spacing:0;}
.receive-note{color:var(--text-muted);font-size:13.5px;line-height:1.6;max-width:320px;margin:10px 0 0;}
.receive-note b{color:var(--ink);font-weight:700;}
.link-btn{border:0;background:transparent;color:var(--orange);font-weight:700;cursor:pointer;font-family:var(--sans);font-size:inherit;padding:0;text-decoration:underline;text-underline-offset:2px;}
.receive-actions{display:flex;flex-direction:column;gap:10px;margin-top:22px;width:100%;}
.receive-addr{margin-bottom:20px;}
.receive-addr-val{display:block;word-break:break-all;font-size:12.5px;line-height:1.5;color:var(--ink);background:var(--paper);border:1px solid var(--line);border-radius:10px;padding:10px 12px;margin-bottom:10px;}
.receive-addr-row{display:flex;gap:8px;}
.receive-addr-row .btn{flex:1;}

/* Small button + spinner */
.btn.sm{padding:8px 12px;font-size:12.5px;border-radius:9px;}
.spin{animation:spin 1s linear infinite;}
@keyframes spin{to{transform:rotate(360deg);}}

/* --- Motion ------------------------------------------------------------ */
@keyframes fade-up{from{opacity:0;transform:translateY(10px);}to{opacity:1;transform:translateY(0);}}
@keyframes fade-in{from{opacity:0;}to{opacity:1;}}
@keyframes float-card{0%,100%{transform:rotate(-1.5deg) translateY(0);}50%{transform:rotate(-1.5deg) translateY(-9px);}}

/* View entrance — staggered; re-runs on tab switch via key={view} */
.view>*{animation:fade-up .5s var(--ease) both;}
.view>*:nth-child(2){animation-delay:.07s;}
.view>*:nth-child(3){animation-delay:.14s;}
.view>*:nth-child(4){animation-delay:.21s;}
.view>*:nth-child(5){animation-delay:.28s;}
.view>*:nth-child(6){animation-delay:.35s;}

/* Transaction rows drift in on load */
.tx-list .tx-row{animation:fade-up .45s var(--ease) both;}
.tx-list .tx-row:nth-child(2){animation-delay:.05s;}
.tx-list .tx-row:nth-child(3){animation-delay:.1s;}
.tx-list .tx-row:nth-child(4){animation-delay:.15s;}
.tx-list .tx-row:nth-child(n+5){animation-delay:.2s;}

/* Sign-in entrance + floating preview card */
.auth-body>*{animation:fade-up .55s var(--ease) both;}
.auth-body>*:nth-child(2){animation-delay:.06s;}
.auth-body>*:nth-child(3){animation-delay:.12s;}
.auth-body>*:nth-child(4){animation-delay:.18s;}
.auth-body>*:nth-child(5){animation-delay:.24s;}
.brandside-card{animation:fade-in .6s var(--ease) both,float-card 7s ease-in-out 1.4s infinite;}

/* Hover micro-interactions */
.stat-tile:hover{transform:translateY(-2px);border-color:#cdd0ca;box-shadow:0 8px 22px #1620281a;}

/* Buttons */
.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;border:0;border-radius:12px;padding:11px 18px;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:transform .1s var(--ease),opacity .15s,background .15s;text-decoration:none;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn:not(:disabled):hover{transform:translateY(-1px);}
.btn:not(:disabled):active{transform:translateY(1px);}
.btn.primary{background:var(--ink);color:#fff;}
.btn.primary:not(:disabled):hover{background:#20293a;}
.btn.soft{background:var(--paper);border:1px solid var(--line);color:var(--ink);}
.btn.soft:hover{background:#ecebe5;}
.btn.full{width:100%;}
.btn.lg{padding:14px 24px;font-size:15px;}

/* Mobile bottom tabs (hidden on desktop) */
.tab-bar{display:none;}

@media(max-width:1040px){
  .ov-grid,.send-grid{grid-template-columns:1fr;}
}
@media(max-width:640px){
  .stat-row,.stat-row.two{grid-template-columns:1fr;}
}
@media(max-width:800px){
  .sato-shell{grid-template-columns:1fr;}
  .sato-shell.auth{grid-template-columns:1fr;}
  .auth-brandside{display:none;}
  .auth-body{max-width:100%;}
  .sidebar{display:none;}
  .main{padding:28px 20px 96px;max-width:100%;}
  .page-head{flex-wrap:wrap;}
  .tab-bar{display:flex;position:fixed;bottom:0;left:0;right:0;background:var(--white);border-top:1px solid var(--line);padding:6px 8px calc(6px + env(safe-area-inset-bottom));z-index:20;box-shadow:0 -6px 20px #16202810;}
  .tab{position:relative;flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;border:0;background:transparent;color:var(--text-muted);padding:9px 6px;min-height:52px;font-size:11px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:color .18s;-webkit-tap-highlight-color:transparent;}
  .tab svg{transition:transform .22s var(--ease);}
  .tab.active{color:var(--ink);}
  .tab.active svg{transform:translateY(-1px) scale(1.06);}
  .tab::before{content:"";position:absolute;top:0;left:50%;width:26px;height:2.5px;border-radius:0 0 4px 4px;background:var(--orange);transform:translateX(-50%) scaleX(0);transform-origin:center;transition:transform .28s var(--ease);}
  .tab.active::before{transform:translateX(-50%) scaleX(1);}
  .balance-num{font-size:40px;}
}
@media(max-width:480px){
  .main{padding:22px 16px 94px;}
  .panel{padding:20px;border-radius:16px;}
  .page-head .btn{width:100%;}
  .auth-panel{padding:24px 20px;}
  .auth-points{gap:9px;}
  .balance-num{font-size:36px;}
  .stat-tile.big .stat-value{font-size:26px;}
  .bh-num{font-size:32px;}
}
@media(prefers-reduced-motion:reduce){
  .view>*,.tx-list .tx-row,.auth-body>*,.brandside-card,.spin{animation:none !important;}
  *{transition-duration:.01ms !important;}
}
`;

// Provider wrapper so the route can mount <App /> directly.
export default function App() {
  usePageMeta("Your wallet · Sato", "Send, earn, and cash out sBTC from your Sato wallet.");
  return (
    <StacksProvider>
      <SatoApp />
    </StacksProvider>
  );
}
