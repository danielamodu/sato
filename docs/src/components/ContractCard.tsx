import { useState } from "react";
import { ExternalLink, Play, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion } from "framer-motion";
import { ContractDef } from "../data/contracts";
import { queryTestnetContract } from "../data/stacks-client";

export function ContractCard({ contract }: { contract: ContractDef }) {
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [queryResult, setQueryResult] = useState<{ [fn: string]: { loading: boolean; data?: string; error?: string } }>({});

  const handleTestQuery = async (fnName: string) => {
    setActiveQuery(fnName);
    setQueryResult((prev) => ({
      ...prev,
      [fnName]: { loading: true },
    }));

    const res = await queryTestnetContract(contract.name, fnName);

    setQueryResult((prev) => ({
      ...prev,
      [fnName]: {
        loading: false,
        data: res.success ? res.result : undefined,
        error: !res.success ? res.error : undefined,
      },
    }));
  };

  return (
    <div className="my-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-5">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="font-mono text-xl font-bold tracking-tight text-foreground">{contract.name}</h3>
            <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-semibold text-primary">
              {contract.version}
            </span>
          </div>
          <p className="mt-1.5 text-sm text-muted-foreground">{contract.purpose}</p>
        </div>

        <a
          href={contract.explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-secondary/50 px-3 py-1.5 text-xs font-medium text-foreground transition-all hover:bg-secondary hover:text-primary"
        >
          <span>View on Explorer</span>
          <ExternalLink className="size-3.5" />
        </a>
      </div>

      {/* Contract principal address */}
      <div className="my-4 flex items-center justify-between rounded-lg bg-muted/50 px-3.5 py-2 text-xs">
        <span className="font-medium text-muted-foreground">Contract Principal:</span>
        <code className="font-mono text-foreground select-all">{contract.address}</code>
      </div>

      {/* Public Functions */}
      <div className="mt-6">
        <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Public & Read-Only Functions</h4>
        <div className="mt-3 space-y-3">
          {contract.functions.map((fn) => {
            const resultState = queryResult[fn.name];
            const canQuery = fn.type === "read-only" && fn.args.length === 0;

            return (
              <div
                key={fn.name}
                className="group rounded-xl border border-border/80 bg-background/50 p-4 transition-all hover:border-primary/40 hover:bg-background"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span
                      className={`rounded px-1.5 py-0.5 font-mono text-[11px] font-semibold uppercase ${
                        fn.type === "public"
                          ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                          : "bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      }`}
                    >
                      {fn.type}
                    </span>
                    <span className="font-mono text-sm font-semibold text-foreground">
                      ({fn.name} {fn.args.map((a) => `${a.name}`).join(" ")})
                    </span>
                  </div>

                  {canQuery && (
                    <motion.button
                      whileTap={{ scale: 0.94 }}
                      onClick={() => handleTestQuery(fn.name)}
                      disabled={resultState?.loading}
                      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary transition-all hover:bg-primary hover:text-white disabled:opacity-50"
                    >
                      {resultState?.loading ? (
                        <>
                          <Loader2 className="size-3 animate-spin" />
                          <span>Querying testnet...</span>
                        </>
                      ) : (
                        <>
                          <Play className="size-3 fill-current" />
                          <span>Run Read-Only Query</span>
                        </>
                      )}
                    </motion.button>
                  )}
                </div>

                <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{fn.description}</p>

                {/* Returns signature */}
                <div className="mt-2 flex items-center gap-1.5 font-mono text-xs text-muted-foreground">
                  <span>Returns:</span>
                  <code className="text-foreground">{fn.returns}</code>
                </div>

                {/* Query result output */}
                {resultState && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-3 rounded-lg border border-border bg-muted/60 p-3 font-mono text-xs"
                  >
                    {resultState.loading && <div className="text-muted-foreground">Connecting to Stacks node...</div>}
                    {resultState.data && (
                      <div className="flex items-start gap-2 text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs">Testnet Response:</div>
                          <code className="mt-1 block text-foreground break-all">{resultState.data}</code>
                        </div>
                      </div>
                    )}
                    {resultState.error && (
                      <div className="flex items-start gap-2 text-rose-500">
                        <AlertCircle className="size-4 shrink-0 mt-0.5" />
                        <div>
                          <div className="font-semibold text-xs">Query Failed:</div>
                          <span className="text-xs">{resultState.error}</span>
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Error Dictionary */}
      {contract.errorCodes.length > 0 && (
        <div className="mt-6 border-t border-border pt-5">
          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Error Codes</h4>
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {contract.errorCodes.map((err) => (
              <div key={err.code} className="flex items-start gap-2.5 rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                <span className="shrink-0 font-mono font-bold text-rose-500">{err.code}</span>
                <div>
                  <div className="font-mono font-semibold text-foreground">{err.name}</div>
                  <div className="text-muted-foreground">{err.meaning}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
