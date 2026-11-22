import { ArrowUpRight, Check, Send } from "lucide-react";
import type { BalanceEvent, SatoTx } from "@/lib/sato";
import { type View } from "./helpers";
import { BalanceHero, Dock, TxTable, WelcomeGuide } from "./components";

export function Overview(props: {
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
  go: (v: View) => void;
  busy: string | null;
  address: string;
  txs: SatoTx[];
  txLoading: boolean;
  hydrated: boolean;
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
    go,
    busy,
    address,
    txs,
    txLoading,
    hydrated,
  } = props;

  // Site-style greeting: the hour does the talking, the username makes it theirs.
  const hour = new Date().getHours();
  const daypart = hour < 12 ? "Morning" : hour < 18 ? "Afternoon" : "Evening";

  return (
    <div className="ov-stack">
      <header className="page-head ov-head">
        <div>
          <span className="page-kicker">Testnet</span>
          <h1>{myName ? `${daypart}, @${myName}.` : "Welcome to Sato."}</h1>
          <p>Send by name, earn while you hold, cash out to your bank.</p>
        </div>
      </header>

      <BalanceHero
        balance={balance}
        btcUsd={btcUsd}
        events={events}
        onFaucet={onFaucet}
        busy={busy}
      />

      <Dock
        goSend={goSend}
        goReceive={goReceive}
        goBills={() => go("bills")}
        goCashout={() => go("cashout")}
        goEarn={() => go("earn")}
        onFaucet={onFaucet}
        busy={busy}
      />

      <WelcomeGuide
        balance={balance}
        myName={myName}
        txCount={txs.length}
        busy={busy}
        onFaucet={onFaucet}
        go={go}
        hydrated={hydrated}
      />

      <div className="ov-split">
        <section className="panel">
          <div className="panel-head">
            <h2>Recent activity</h2>
            <button className="panel-link" onClick={goActivity}>
              View all <ArrowUpRight size={13} />
            </button>
          </div>
          <TxTable txs={txs} loading={txLoading} address={address} limit={5} />
        </section>

        <section className="panel" id="claim-username">
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
  );
}
