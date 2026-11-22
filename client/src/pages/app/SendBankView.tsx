import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertTriangle, Check, Hash, Landmark, RefreshCw, Send, Zap } from "lucide-react";
import {
  listBanks,
  quoteOfframp,
  resolveAccount as resolveBankAccount,
  sendToBank,
  type Bank,
  type OfframpQuote,
} from "@/lib/offramp";
import { fmt, fmtUsd } from "./helpers";

// --- Cash out (sBTC -> Naira in a bank) ----------------------------------

export function SendBankView(props: { balance: bigint; btcUsd: number | null; onPaid?: () => void }) {
  const { balance, btcUsd, onPaid } = props;

  const [banks, setBanks] = useState<Bank[]>([]);
  const [bankCode, setBankCode] = useState("");
  const [account, setAccount] = useState(""); // 10-digit NUBAN
  const [name, setName] = useState(""); // account holder (resolved or typed)
  const [resolved, setResolved] = useState(false); // name came from the provider
  const [resolving, setResolving] = useState(false);
  const [ngn, setNgn] = useState("");
  const [quote, setQuote] = useState<OfframpQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [stage, setStage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const acctOk = /^\d{10}$/.test(account.trim());
  const amount = Math.floor(Number(ngn));
  const amountOk = amount >= 1000;
  const sats = quote ? BigInt(quote.sats) : 0n;
  const over = sats > balance;
  const selectedBank = banks.find((b) => b.code === bankCode);

  // Load the bank list once. On testnet with no key this still works — the
  // list is static server-side.
  useEffect(() => {
    let alive = true;
    listBanks()
      .then((bs) => {
        if (!alive) return;
        setBanks(bs);
        if (bs.length && !bankCode) setBankCode(bs[0].code);
      })
      .catch(() => alive && setBanks([]));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // A resolved/typed name only applies to the exact bank + account it was for.
  useEffect(() => {
    setName("");
    setResolved(false);
  }, [bankCode, account]);

  // Debounced live quote once a valid naira amount is entered.
  useEffect(() => {
    setQuote(null);
    if (!amountOk) {
      setQuoting(false);
      return;
    }
    let alive = true;
    setQuoting(true);
    const t = setTimeout(async () => {
      try {
        const q = await quoteOfframp(amount);
        if (alive) setQuote(q);
      } catch {
        if (alive) setQuote(null);
      } finally {
        if (alive) setQuoting(false);
      }
    }, 450);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [amount, amountOk]);

  const onResolve = async () => {
    if (!acctOk || !bankCode || resolving) return;
    setResolving(true);
    try {
      const who = await resolveBankAccount(bankCode, account.trim());
      setName(who);
      setResolved(true);
      toast.success(`Account confirmed`, { description: who });
    } catch (e: any) {
      // No provider key on testnet → let the user type the name themselves.
      setResolved(false);
      toast.message("Enter the account name", { description: e?.message });
    } finally {
      setResolving(false);
    }
  };

  const payDisabled = busy || !quote || quoting || over || !acctOk || !name.trim();
  const onPay = async () => {
    if (payDisabled || !quote) return;
    setBusy(true);
    try {
      const r = await sendToBank(quote, bankCode, account.trim(), name.trim(), (st) =>
        setStage(st === "paying" ? "Approve the payment…" : "Confirming on-chain…")
      );
      // Payment broadcast — refresh the balance whatever the payout says next.
      setTimeout(() => onPaid?.(), 4000);
      const label = `₦${quote.amountNgn.toLocaleString()}`;
      if (r.status === "processing")
        toast.success(`${label} cash-out started`, {
          description: r.stubbed
            ? "Testnet scaffold — no real transfer was sent."
            : `To ${r.accountName || name} · ${r.bank || selectedBank?.name || ""}`,
        });
      else if (r.status === "pending")
        toast.message("Payment still confirming", {
          description: r.detail || "The payout starts once it's mined.",
        });
      else toast.error("Couldn't complete this cash-out", { description: r.error || r.detail });
      if (r.status === "processing") {
        setNgn("");
        setQuote(null);
      }
    } catch (e: any) {
      toast.error("Payment cancelled", { description: e?.message });
    } finally {
      setBusy(false);
      setStage(null);
    }
  };

  const payText = busy
    ? stage || "Paying…"
    : quote
      ? `Cash out ₦${quote.amountNgn.toLocaleString()}`
      : "Cash out";

  return (
    <>
      <header className="page-head">
        <div>
          <span className="page-kicker">Off-ramp</span>
          <h1>Cash out</h1>
          <p>Send sBTC straight to a Nigerian bank account, priced live.</p>
        </div>
      </header>

      <div className="send-grid">
        <section className="panel send-panel">
          <div className="scaffold-note">
            <AlertTriangle size={16} />
            <span>
              <b>Testnet preview.</b> Payments settle on-chain for real, but the
              bank payout is a scaffold — no live transfer is sent yet. A live
              cash-out needs identity checks and a funded payout account.
            </span>
          </div>
          <label className="field-label">Bank</label>
          <div className="text-field block">
            <Landmark size={16} className="field-lead" />
            <select
              className="field-select"
              value={bankCode}
              onChange={(e) => setBankCode(e.target.value)}
              disabled={!banks.length}
            >
              {!banks.length && <option value="">Loading banks…</option>}
              {banks.map((b) => (
                <option key={b.code} value={b.code}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>
          <label className="field-label">Account number</label>
          <div className="text-field block">
            <Hash size={16} className="field-lead" />
            <input
              className="field-input"
              inputMode="numeric"
              placeholder="10-digit account number"
              value={account}
              maxLength={10}
              onChange={(e) => setAccount(e.target.value.replace(/\D/g, "").slice(0, 10))}
            />
            <button
              type="button"
              className="field-verify"
              onClick={onResolve}
              disabled={!acctOk || resolving}
            >
              {resolving ? "Checking…" : "Resolve"}
            </button>
          </div>
          <label className="field-label">Account name</label>
          <div className="text-field block">
            <input
              className="field-input"
              placeholder="Account holder's name"
              value={name}
              readOnly={resolved}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          {resolved ? (
            <span className="field-hint ok">
              <Check size={13} /> Confirmed with {selectedBank?.name || "the bank"}
            </span>
          ) : (
            <span className="field-hint muted">
              Resolve to confirm the name, or type it in if the check isn't available.
            </span>
          )}
          <label className="field-label">Amount</label>
          <div className="text-field block">
            <span className="field-at">₦</span>
            <input
              className="field-input"
              type="number"
              min="1000"
              placeholder="5000"
              value={ngn}
              onChange={(e) => setNgn(e.target.value)}
            />
            <span className="field-trail">NGN</span>
          </div>
          {ngn.trim() && !amountOk && (
            <span className="field-hint miss">Minimum cash-out is ₦1,000</span>
          )}
          {quote ? (
            <>
              <span className="field-usd">
                ≈ {fmt(sats)} sats
                {btcUsd != null ? ` · ${fmtUsd(sats, btcUsd)}` : ""}
              </span>
              <span className={`field-hint ${over ? "miss" : "muted"}`}>
                {over
                  ? `Costs more than your balance of ${fmt(balance)} sats`
                  : `You send ${fmt(sats)} sats · get ₦${quote.amountNgn.toLocaleString()} · rate ₦${Math.round(quote.rate).toLocaleString()}/BTC`}
              </span>
            </>
          ) : (
            <span className="field-hint muted">
              {quoting
                ? "Pricing at the live rate…"
                : amount > 0
                  ? "Couldn't price this — try again in a moment"
                  : "Enter an amount to see the sBTC cost"}
            </span>
          )}
          <button className="btn primary full" onClick={onPay} disabled={payDisabled}>
            {busy ? <RefreshCw size={16} className="spin" /> : <Landmark size={16} />}
            {payText}
          </button>
          <span className="field-hint muted" style={{ marginTop: 10 }}>
            {busy ? (
              <>
                <RefreshCw size={13} className="spin" /> {stage || "Working…"}
              </>
            ) : (
              <>
                <Zap size={13} /> Gas covered by the Sato pool — you just approve
                the payment.
              </>
            )}
          </span>
        </section>
        <aside className="panel send-aside">
          <span className="panel-eyebrow">Payout summary</span>
          <div className="sum-rows">
            <div className="sum-row">
              <span>Bank</span>
              {selectedBank ? (
                <strong>{selectedBank.name}</strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row">
              <span>Account</span>
              {account.trim() ? (
                resolved ? (
                  <strong className="ok-inline">····{account.trim().slice(-4)} <Check size={13} /></strong>
                ) : (
                  <strong>····{account.trim().slice(-4)}</strong>
                )
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row">
              <span>Recipient</span>
              {name.trim() ? (
                <strong>{name.trim()}</strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row">
              <span>They get</span>
              {quote ? (
                <strong>₦{quote.amountNgn.toLocaleString()}</strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row total">
              <span>You send</span>
              {quote && !over ? (
                <strong>{fmt(sats)} <small>sats</small></strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
          </div>
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
