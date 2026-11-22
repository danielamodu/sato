import { Check, Receipt, RefreshCw, Search, Send, Zap } from "lucide-react";
import { fmt, fmtUsd, short } from "./helpers";

// --- Send view -----------------------------------------------------------
export function SendView(props: {
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
          <span className="page-kicker">Payments</span>
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
          <button
            type="button"
            className="field-max"
            onClick={() => setSendAmount(balance > 0n ? balance.toString() : "")}
            disabled={balance <= 0n}
            title="Use your full balance"
          >
            Max
          </button>
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
          {busy === "send" ? (
            <>
              <RefreshCw size={16} className="spin" /> Sending…
            </>
          ) : (
            <>
              <Send size={16} />
              {gasless ? "Send sBTC — no gas" : "Send sBTC"}
            </>
          )}
        </button>
        {busy !== "send" && (!sendTo || amountSats <= 0n) && (
          <span className="field-hint muted" style={{ marginTop: 10 }}>
            {!sendTo ? "Add a recipient above to continue" : "Enter an amount above to continue"}
          </span>
        )}
      </section>

      <aside className="panel send-aside">
        <span className="panel-eyebrow">Receipt preview</span>
        <div className="sum-rows">
          <div className="sum-row">
            <span>To</span>
            {sendTo ? (
              lookupState === "found" ? (
                <strong className="ok-inline">{sendTo} <Check size={13} /></strong>
              ) : (
                <strong>{sendTo}</strong>
              )
            ) : (
              <strong className="sum-empty">—</strong>
            )}
          </div>
          <div className="sum-row">
            <span>Amount</span>
            {amountSats > 0n ? (
              <strong>
                {fmt(amountSats)} <small>sats</small>
                {btcUsd != null ? ` · ${fmtUsd(amountSats, btcUsd)}` : ""}
              </strong>
            ) : (
              <strong className="sum-empty">—</strong>
            )}
          </div>
          <div className="sum-row">
            <span>Network fee</span>
            <strong>
              {gasless
                ? sponsorReady
                  ? "Covered by pool"
                  : "Pool empty — you may pay"
                : "You pay"}
            </strong>
          </div>
          <div className="sum-row total">
            <span>You spend</span>
            {amountSats > 0n && !overBalance ? (
              <strong>{fmt(amountSats)} <small>sats</small></strong>
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
