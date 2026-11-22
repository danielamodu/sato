import { useState } from "react";
import { ArrowUpRight, RefreshCw, Search } from "lucide-react";
import type { SatoTx } from "@/lib/sato";
import { explorerAddr } from "./helpers";
import { TxTable } from "./components";

// --- Activity view (live on-chain history) -------------------------------
export function ActivityView(props: {
  address: string;
  txs: SatoTx[];
  loading: boolean;
  reload: () => void;
}) {
  const { address, txs, loading, reload } = props;
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<"all" | SatoTx["status"]>("all");
  const q = query.trim().toLowerCase();
  const filtered = txs.filter(
    (t) =>
      (status === "all" || t.status === status) &&
      (!q || `${t.label} ${t.contract} ${t.txId}`.toLowerCase().includes(q)),
  );
  const filtering = q.length > 0 || status !== "all";
  return (
    <>
      <header className="page-head">
        <div>
          <span className="page-kicker">History</span>
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
        <div className="tx-filter">
          <div className="text-field block">
            <Search size={16} className="field-lead" />
            <input
              className="field-input"
              placeholder="Search label, contract, or txid…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Search transactions"
            />
          </div>
          <div className="filter-chips" role="group" aria-label="Filter by status">
            {(["all", "success", "pending", "failed"] as const).map((s) => (
              <button
                key={s}
                type="button"
                className={`filter-chip${status === s ? " active" : ""}`}
                onClick={() => setStatus(s)}
              >
                {s === "all" ? "All" : s[0].toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
        </div>
        <div className="tx-head" aria-hidden="true">
          <span>Transaction</span>
          <span>Status · When</span>
        </div>
        <TxTable
          txs={filtered}
          loading={loading}
          address={address}
          emptyHint={filtering ? "Nothing matches this filter. Clear the search or pick another status." : undefined}
        />
        {filtering && filtered.length > 0 && (
          <p className="filter-count">
            Showing {filtered.length} of {txs.length}
          </p>
        )}
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
