import {
  ArrowDownLeft,
  ArrowUpRight,
  Coins,
  Plus,
  RefreshCw,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { YIELD_BLOCKS_PER_YEAR, type EarnStats } from "@/lib/sato";
import { fmt, fmtUsd } from "./helpers";
import { EarnHero, StatTile, useLiveAmount } from "./components";

export function EarnView(props: {
  earn: EarnStats;
  btcUsd: number | null;
  earnAmount: string;
  setEarnAmount: (v: string) => void;
  earnTerm: string;
  setEarnTerm: (v: string) => void;
  onLock: () => void;
  onClaim: () => void;
  onFaucet: () => void;
  busy: string | null;
}) {
  const {
    earn,
    btcUsd,
    earnAmount,
    setEarnAmount,
    earnTerm,
    setEarnTerm,
    onLock,
    onClaim,
    onFaucet,
    busy,
  } = props;
  const hasLock = earn.locked > 0n;
  const baseApr = Number(earn.baseRateBps) / 100;
  const boostApr = Number(earn.boostRateBps) / 100;

  let amountSats = 0n;
  try { amountSats = BigInt(earnAmount || "0"); } catch { amountSats = 0n; }
  let termBlocks = 0n;
  try { termBlocks = BigInt(earnTerm || "0"); } catch { termBlocks = 0n; }

  const over = amountSats > earn.liquid;
  // Projected boost yield at maturity — the contract's exact integer formula:
  // amount * boost-bps * term / (blocks-per-year * 10000).
  const projYield =
    amountSats > 0n && termBlocks > 0n
      ? (amountSats * earn.boostRateBps * termBlocks) /
        (BigInt(YIELD_BLOCKS_PER_YEAR) * 10000n)
      : 0n;
  const lockDisabled =
    busy === "earn-lock" || amountSats <= 0n || termBlocks <= 0n || over;

  // Live value of an active lock, streaming at the boost rate between reads.
  const liveLock = useLiveAmount(earn.lockValue, earn.locked, earn.boostRateBps);
  const blocksLeft =
    earn.lockUnlock > earn.height ? earn.lockUnlock - earn.height : 0n;
  const matured = hasLock && earn.height > 0n && blocksLeft === 0n;

  const TERMS = ["25", "100", "250"];
  return (
    <>
      <header className="page-head">
        <div>
          <span className="page-kicker">Grow</span>
          <h1>Earn</h1>
          <p>Your balance earns automatically. Lock sats for a higher rate.</p>
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
          label="Earning now"
          icon={Wallet}
          countTo={Number(earn.liquid)}
          unit="sats"
          sub={`Auto-earns ${baseApr.toLocaleString()}% APR`}
        />
        <StatTile
          label="Locked"
          icon={TrendingUp}
          countTo={Number(hasLock ? liveLock : 0)}
          unit="sats"
          sub={hasLock ? `Boost ${boostApr.toLocaleString()}% APR` : "Nothing locked yet"}
        />
        <StatTile
          label="Total value"
          icon={Coins}
          countTo={Number(earn.liquid + earn.lockValue)}
          unit="sats"
          sub="Liquid + locked"
        />
      </div>
      <div className="send-grid">
        <section className="panel send-panel">
          {hasLock ? (
            <>
              <span className="panel-eyebrow">Your lock</span>
              <div className="lock-card">
                <div className="lock-row">
                  <span>Locked principal</span>
                  <strong>{fmt(earn.locked)} <small>sats</small></strong>
                </div>
                <div className="lock-row">
                  <span>Value now</span>
                  <strong>{Math.floor(liveLock).toLocaleString()} <small>sats</small></strong>
                </div>
                <div className="lock-row">
                  <span>Boost yield</span>
                  <strong className="lock-yield">
                    +{fmt(earn.lockValue > earn.locked ? earn.lockValue - earn.locked : 0n)}{" "}
                    <small>sats</small>
                  </strong>
                </div>
                <div className={`lock-status${matured ? " matured" : ""}`}>
                  {matured
                    ? "Matured — claim your principal + boost yield"
                    : `Unlocks in ${fmt(blocksLeft)} blocks`}
                </div>
                {!matured && (
                  <span className="lock-progress" aria-hidden="true"><i /></span>
                )}
              </div>
              <div className="earn-actions">
                <button
                  className="btn primary"
                  onClick={onClaim}
                  disabled={busy === "earn-claim" || !matured}
                >
                  {busy === "earn-claim" ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Claiming…
                    </>
                  ) : (
                    <>
                      <ArrowUpRight size={16} />
                      {matured
                        ? "Claim principal + yield"
                        : `Locked for ${fmt(blocksLeft)} more blocks`}
                    </>
                  )}
                </button>
              </div>
            </>
          ) : (
            <>
              <span className="panel-eyebrow">Lock for the boost rate</span>
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
                  onClick={() => setEarnAmount(earn.liquid > 0n ? earn.liquid.toString() : "")}
                  disabled={earn.liquid <= 0n}
                >
                  Max
                </button>
                <span className="field-trail">sats</span>
              </div>
              {amountSats > 0n && btcUsd != null && (
                <span className="field-usd">≈ {fmtUsd(amountSats, btcUsd)}</span>
              )}
              <span className="field-hint muted">
                Available to lock {fmt(earn.liquid)} sats
              </span>
              {earnAmount && over && (
                <span className="field-hint warn">
                  More than your available balance
                </span>
              )}
              <label className="field-label" style={{ marginTop: 16 }}>Term</label>
              <div className="term-presets" role="group" aria-label="Lock term">
                {TERMS.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={`term-preset${earnTerm === t ? " active" : ""}`}
                    onClick={() => setEarnTerm(t)}
                  >
                    {t} blocks
                  </button>
                ))}
              </div>
              <div className="text-field block term-custom">
                <input
                  className="field-input"
                  inputMode="numeric"
                  placeholder="Or type custom blocks"
                  value={TERMS.includes(earnTerm) ? "" : earnTerm}
                  onChange={(e) => setEarnTerm(e.target.value.replace(/[^0-9]/g, ""))}
                  aria-label="Custom lock term in blocks"
                />
                <span className="field-trail">blocks</span>
              </div>
              <span className="field-hint muted">
                Presets, or any positive number of blocks — ~a few seconds per block on testnet.
              </span>

              {projYield > 0n && (
                <div className="earn-receive">
                  <span className="earn-receive-label">
                    <span>Boost yield at maturity</span>
                    <small>on {fmt(amountSats)} sats over {fmt(termBlocks)} blocks</small>
                  </span>
                  <span className="earn-receive-total">
                    +{fmt(projYield)} <small>sats</small>
                  </span>
                </div>
              )}

              <div className="earn-actions">
                <button
                  className="btn primary"
                  onClick={onLock}
                  disabled={lockDisabled}
                >
                  {busy === "earn-lock" ? (
                    <>
                      <RefreshCw size={16} className="spin" /> Locking…
                    </>
                  ) : (
                    <>
                      <ArrowDownLeft size={16} /> Lock for boost
                    </>
                  )}
                </button>
              </div>
              {busy !== "earn-lock" && lockDisabled && (
                <span className="field-hint muted" style={{ marginTop: 10 }}>
                  {amountSats <= 0n
                    ? "Enter an amount above to continue"
                    : termBlocks <= 0n
                      ? "Pick a term or type a custom one"
                      : over
                        ? "Lower the amount to fit your available balance"
                        : ""}
                </span>
              )}
            </>
          )}
        </section>

        <aside className="panel send-aside">
          <span className="panel-eyebrow">Lock preview</span>
          <div className="sum-rows">
            <div className="sum-row">
              <span>Amount</span>
              {amountSats > 0n ? (
                <strong>{fmt(amountSats)} <small>sats</small></strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row">
              <span>Term</span>
              {termBlocks > 0n ? (
                <strong>{fmt(termBlocks)} <small>blocks</small></strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
            <div className="sum-row total">
              <span>Boost at maturity</span>
              {projYield > 0n ? (
                <strong className="ok-inline">+{fmt(projYield)} <small>sats</small></strong>
              ) : (
                <strong className="sum-empty">—</strong>
              )}
            </div>
          </div>
          <div className="aside-balance">
            <span>Total in Sato</span>
            <strong>
              {fmt(earn.totalSupply)} <small>sats</small>
            </strong>
          </div>
        </aside>
      </div>
    </>
  );
}
