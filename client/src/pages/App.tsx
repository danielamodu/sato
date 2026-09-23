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

import { useEffect, useState, type ReactNode } from "react";
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
} from "lucide-react";
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
  getEarnStats,
  earnDeposit,
  earnWithdraw,
  fundEarn,
  getSponsorStats,
  sponsorTopUp,
  isNameAvailable,
  type SatoTx,
  type EarnStats,
  type SponsorStats,
} from "@/lib/sato";

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;
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
// Live BTC spot from CoinGecko (no key, CORS-open). Returns null on any failure
// so the balance card can fall back to BTC rather than show a fake number.
async function fetchBtcUsd(): Promise<number | null> {
  try {
    const r = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd"
    );
    if (!r.ok) return null;
    const d = (await r.json()) as { bitcoin?: { usd?: number } };
    const p = d.bitcoin?.usd;
    return typeof p === "number" && p > 0 ? p : null;
  } catch {
    return null;
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

type View = "overview" | "send" | "earn" | "gas" | "activity";

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

  // Refresh the connected user's name + balance + earn position, then activity.
  const refresh = async (addr: string) => {
    try {
      const [n, b, e, s] = await Promise.all([
        getName(addr),
        getBalance(addr),
        getEarnStats(addr),
        getSponsorStats(addr),
      ]);
      setMyName(n);
      setBalance(b);
      setEarn(e);
      setSponsor(s);
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
      setEarn({ deposited: 0n, earned: 0n, available: 0n, poolTotal: 0n });
      setSponsor({
        poolBalance: 0n,
        remaining: 0n,
        cap: 0n,
        sponsoredCount: 0n,
        windowLength: 0n,
      });
    }
  }, [address]);

  // Live BTC price for the balance card's USD figure. Refreshes on a slow
  // interval; a failed fetch leaves it null and the card falls back to BTC.
  useEffect(() => {
    let alive = true;
    const load = () => fetchBtcUsd().then((p) => alive && setBtcUsd(p));
    load();
    const id = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
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
            myName={myName}
            regInput={regInput}
            setRegInput={setRegInput}
            nameState={nameState}
            onRegister={onRegister}
            onFaucet={onFaucet}
            goSend={() => setView("send")}
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
            gasless={gasless}
            setGasless={setGasless}
            sponsorReady={sponsor.poolBalance > 0n}
            busy={busy}
          />
        )}

        {view === "earn" && (
          <EarnView
            earn={earn}
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

// A glanceable metric tile for the overview header row.
function StatTile(props: {
  label: string;
  icon: typeof Coins;
  value: ReactNode;
  sub?: string;
  big?: boolean;
}) {
  const { label, icon: Icon, value, sub, big } = props;
  return (
    <div className={big ? "stat-tile big" : "stat-tile"}>
      <div className="stat-head">
        <span className="stat-label">{label}</span>
        <span className="stat-ico">
          <Icon size={15} />
        </span>
      </div>
      <div className="stat-value">{value}</div>
      {sub && <span className="stat-sub">{sub}</span>}
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

// --- Overview view -------------------------------------------------------
function Overview(props: {
  balance: bigint;
  btcUsd: number | null;
  myName: string | null;
  regInput: string;
  setRegInput: (v: string) => void;
  nameState: "idle" | "checking" | "available" | "taken";
  onRegister: () => void;
  onFaucet: () => void;
  goSend: () => void;
  goActivity: () => void;
  busy: string | null;
  address: string;
  txs: SatoTx[];
  txLoading: boolean;
}) {
  const {
    balance,
    btcUsd,
    myName,
    regInput,
    setRegInput,
    nameState,
    onRegister,
    onFaucet,
    goSend,
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

      <div className="stat-row">
        <StatTile
          label="Available balance"
          icon={Coins}
          big
          value={
            btcUsd != null ? (
              <>≈ {fmtUsd(balance, btcUsd)}</>
            ) : (
              <>
                {fmtBtc(balance)} <small>BTC</small>
              </>
            )
          }
          sub={
            btcUsd != null
              ? `${fmtBtc(balance)} BTC · ${fmt(balance)} sats · testnet`
              : `${fmt(balance)} sats · testnet`
          }
        />
        <StatTile
          label="Transactions"
          icon={Hash}
          value={txLoading ? "—" : String(txs.length)}
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
              <button className="btn primary full" onClick={goSend}>
                <Send size={16} /> Send sBTC
              </button>
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
        {overBalance ? (
          <span className="field-hint miss">
            Amount exceeds your balance of {fmt(balance)} sats
          </span>
        ) : (
          <span className="field-hint muted">Balance: {fmt(balance)} sats</span>
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

// --- Earn view (sato-yield pool) -----------------------------------------
function EarnView(props: {
  earn: EarnStats;
  earnAmount: string;
  setEarnAmount: (v: string) => void;
  onDeposit: () => void;
  onWithdraw: () => void;
  onFaucet: () => void;
  busy: string | null;
}) {
  const {
    earn,
    earnAmount,
    setEarnAmount,
    onDeposit,
    onWithdraw,
    onFaucet,
    busy,
  } = props;

  // Compare the entered amount to the live on-chain balances.
  let amountSats = 0n;
  try {
    amountSats = BigInt(earnAmount || "0");
  } catch {
    amountSats = 0n;
  }
  const overAvailable = amountSats > earn.available;
  const overDeposited = amountSats > earn.deposited;

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

      <div className="stat-row">
        <StatTile
          label="Deposited"
          icon={TrendingUp}
          big
          value={
            <>
              {fmt(earn.deposited)} <small>sats</small>
            </>
          }
          sub="Earning in the pool"
        />
        <StatTile
          label="Yield earned"
          icon={Coins}
          value={
            <>
              {fmt(earn.earned)} <small>sats</small>
            </>
          }
          sub="Grows as the pool earns"
        />
        <StatTile
          label="Available"
          icon={Wallet}
          value={
            <>
              {fmt(earn.available)} <small>sats</small>
            </>
          }
          sub="Ready to deposit"
        />
      </div>

      <div className="send-grid">
        <section className="panel send-panel">
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
            <span className="field-trail">sats</span>
          </div>
          <span className="field-hint muted">
            Available {fmt(earn.available)} · Deposited {fmt(earn.deposited)}{" "}
            sats
          </span>
          {earnAmount && overAvailable && overDeposited && (
            <span className="field-hint warn">
              More than you can deposit or withdraw right now
            </span>
          )}
          <div className="earn-actions">
            <button
              className="btn primary"
              onClick={onDeposit}
              disabled={busy === "earn-deposit" || !earnAmount || overAvailable}
            >
              <ArrowDownLeft size={16} />
              {busy === "earn-deposit" ? "Depositing…" : "Deposit"}
            </button>
            <button
              className="btn soft"
              onClick={onWithdraw}
              disabled={
                busy === "earn-withdraw" || !earnAmount || overDeposited
              }
            >
              <ArrowUpRight size={16} />
              {busy === "earn-withdraw" ? "Withdrawing…" : "Withdraw"}
            </button>
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
  topUpAmount: string;
  setTopUpAmount: (v: string) => void;
  onTopUp: () => void;
  busy: string | null;
}) {
  const { sponsor, topUpAmount, setTopUpAmount, onTopUp, busy } = props;

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
          value={
            <>
              {fmtStx(sponsor.poolBalance)} <small>STX</small>
            </>
          }
          sub="Available to cover fees"
        />
        <StatTile
          label="Your allowance"
          icon={Zap}
          value={
            <>
              {fmtStx(sponsor.remaining)} <small>STX</small>
            </>
          }
          sub="Left in this window"
        />
        <StatTile
          label="Sponsored"
          icon={Hash}
          value={String(sponsor.sponsoredCount)}
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
.account-avatar{width:34px;height:34px;border-radius:10px;background:#e9f0ff;color:#4f74ba;display:grid;place-items:center;font-size:12px;font-weight:700;}
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

.claimed-row{display:flex;align-items:center;gap:14px;flex-wrap:wrap;}
.claimed-badge{display:inline-flex;align-items:center;gap:6px;background:#f0f7f3;color:#2f7d54;border:1px solid #cfe8db;padding:8px 14px;border-radius:999px;font-weight:700;font-size:15px;}
.claimed-note{color:var(--text-muted);font-size:13.5px;}

.inline-form{display:flex;gap:10px;}
.text-field{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:0 14px;background:var(--paper);flex:1;transition:border-color .14s,box-shadow .14s;}
.text-field:focus-within{border-color:var(--ink);box-shadow:0 0 0 3px #0d111714;}
.text-field.block{width:100%;margin-bottom:4px;}
.field-at{color:var(--text-muted);font-weight:700;}
.field-lead{color:var(--muted);flex-shrink:0;}
.field-trail{color:var(--text-muted);font-size:13px;font-weight:600;}
.field-input{flex:1;border:0;background:transparent;padding:13px 2px;font-size:15px;color:var(--ink);outline:none;font-family:var(--sans);min-width:0;}
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

/* Empty state */
.empty-panel{text-align:center;padding:48px 32px;}
.empty-icon{width:56px;height:56px;border-radius:16px;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;color:var(--text-muted);margin:0 auto 18px;}
.empty-panel h2{font-size:18px;letter-spacing:-.02em;margin:0 0 8px;}
.empty-panel p{color:var(--text-muted);font-size:14px;line-height:1.6;max-width:340px;margin:0 auto 22px;}

/* Stat tiles */
.stat-row{display:grid;grid-template-columns:repeat(3,1fr);gap:14px;margin-bottom:16px;}
.stat-tile{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:16px 18px;display:flex;flex-direction:column;gap:9px;transition:transform .18s var(--ease),box-shadow .18s,border-color .18s;}
.stat-head{display:flex;align-items:center;justify-content:space-between;gap:8px;}
.stat-label{font-size:11.5px;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--muted);}
.stat-ico{width:28px;height:28px;border-radius:8px;background:var(--paper);border:1px solid var(--line);display:grid;place-items:center;color:var(--text-muted);flex-shrink:0;}
.stat-value{font-size:22px;font-weight:700;letter-spacing:-.03em;line-height:1.1;overflow:hidden;text-overflow:ellipsis;}
.stat-value small{font-size:13px;font-weight:600;color:var(--text-muted);}
.stat-tile.big .stat-value{font-size:30px;}
.stat-sub{font-size:12px;color:var(--text-muted);}

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
  .stat-row{grid-template-columns:1fr;}
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
}
@media(prefers-reduced-motion:reduce){
  .view>*,.tx-list .tx-row,.auth-body>*,.brandside-card,.spin{animation:none !important;}
  *{transition-duration:.01ms !important;}
}
`;

// Provider wrapper so the route can mount <App /> directly.
export default function App() {
  return (
    <StacksProvider>
      <SatoApp />
    </StacksProvider>
  );
}
