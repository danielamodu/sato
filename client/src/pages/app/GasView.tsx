import { ExternalLink, Fuel, Hash, Zap } from "lucide-react";
import type { SponsorStats } from "@/lib/sato";
import { fmtStx, fmtUsdNum } from "./helpers";
import { StatTile } from "./components";

// --- Gas view (sato-sponsor pool) ----------------------------------------
export function GasView(props: {
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
          <span className="page-kicker">Network</span>
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
