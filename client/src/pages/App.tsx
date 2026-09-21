// App.tsx — the Sato dapp demo, wired to live testnet contracts.
//
// End-to-end flow a reviewer can click:
//   connect wallet -> register @username -> look someone up -> send sBTC
//   -> watch the balance change.
//
// Reads (balance, name lookups) hit the testnet API directly. Writes
// (register, send, faucet) go through the connected wallet and open the
// explorer on submit. Styled with Sato's own palette so it matches the
// landing page (the shadcn primitives aren't themed in this project).

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AtSign, Wallet, Send, Search, Coins, ExternalLink } from "lucide-react";
import { StacksProvider, useStacks } from "@/contexts/StacksContext";
import {
  registerName,
  resolveName,
  getName,
  getBalance,
  sendSbtc,
  fundSelf,
} from "@/lib/sato";

const short = (a: string) => `${a.slice(0, 5)}…${a.slice(-4)}`;
const sats = (n: bigint) => `${n.toLocaleString()} sats`;
const explorerTx = (txid: string) =>
  `https://explorer.hiro.so/txid/${txid}?chain=testnet`;

// Pull a txid out of the varied shapes @stacks/connect can return.
function txidOf(res: any): string | undefined {
  return res?.txid ?? res?.txId ?? res?.result?.txid;
}

function SatoApp() {
  const { address, isConnecting, connectWallet, disconnectWallet } = useStacks();

  const [myName, setMyName] = useState<string | null>(null);
  const [balance, setBalance] = useState<bigint>(0n);
  const [regInput, setRegInput] = useState("");
  const [lookupInput, setLookupInput] = useState("");
  const [lookupResult, setLookupResult] = useState<string | null | "pending">(
    null
  );
  const [sendTo, setSendTo] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  // Refresh the connected user's name + balance.
  const refresh = async (addr: string) => {
    try {
      const [n, b] = await Promise.all([getName(addr), getBalance(addr)]);
      setMyName(n);
      setBalance(b);
    } catch (e) {
      console.error("refresh failed", e);
    }
  };

  useEffect(() => {
    if (address) refresh(address);
    else {
      setMyName(null);
      setBalance(0n);
    }
  }, [address]);

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
    } catch (e: any) {
      toast.error("Registration cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  const onLookup = async () => {
    const name = lookupInput.trim();
    if (!name) return;
    setLookupResult("pending");
    try {
      const owner = await resolveName(name);
      setLookupResult(owner);
      if (owner) setSendTo(owner);
    } catch {
      setLookupResult(null);
    }
  };

  const onSend = async () => {
    const amount = BigInt(sendAmount || "0");
    if (!sendTo || amount <= 0n) return;
    setBusy("send");
    try {
      const res = await sendSbtc(sendTo, amount);
      const txid = txidOf(res);
      toast.success(`Sending ${sats(amount)}`, {
        description: `to ${short(sendTo)}`,
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
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
      const txid = txidOf(res);
      toast.success("Funding 1,000,000 sats", {
        description: "testnet faucet",
        action: txid
          ? { label: "View", onClick: () => window.open(explorerTx(txid)) }
          : undefined,
      });
    } catch (e: any) {
      toast.error("Faucet cancelled", { description: e?.message });
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="sato-app">
      <style>{appStyles}</style>

      <header className="app-bar">
        <div className="app-brand">
          <span className="app-mark">₿</span>
          <span className="app-name">Sato</span>
          <span className="app-badge">testnet</span>
        </div>
        {address ? (
          <div className="app-account">
            {myName && <span className="app-handle">@{myName}</span>}
            <button className="btn ghost" onClick={disconnectWallet}>
              {short(address)}
            </button>
          </div>
        ) : (
          <button className="btn primary" onClick={connectWallet} disabled={isConnecting}>
            <Wallet size={16} />
            {isConnecting ? "Connecting…" : "Connect wallet"}
          </button>
        )}
      </header>

      {!address ? (
        <div className="app-hero">
          <h1>Send Bitcoin by @username</h1>
          <p>
            Connect a Stacks wallet to try Sato on testnet — register a
            username, look someone up, and send sBTC. All against live
            on-chain contracts.
          </p>
          <button className="btn primary lg" onClick={connectWallet} disabled={isConnecting}>
            <Wallet size={18} />
            {isConnecting ? "Connecting…" : "Connect wallet to start"}
          </button>
        </div>
      ) : (
        <main className="app-grid">
          {/* Balance + faucet */}
          <section className="card balance-card">
            <div className="card-label">
              <Coins size={15} /> Your balance
            </div>
            <div className="balance-value">{sats(balance)}</div>
            <div className="card-actions">
              <button className="btn subtle" onClick={() => refresh(address)}>
                Refresh
              </button>
              <button
                className="btn subtle"
                onClick={onFaucet}
                disabled={busy === "faucet"}
              >
                {busy === "faucet" ? "Funding…" : "Get test sBTC"}
              </button>
            </div>
          </section>

          {/* Register username */}
          <section className="card">
            <div className="card-label">
              <AtSign size={15} /> Your username
            </div>
            {myName ? (
              <div className="claimed">
                Registered as <strong>@{myName}</strong>
              </div>
            ) : (
              <>
                <div className="field">
                  <span className="at">@</span>
                  <input
                    className="input"
                    placeholder="yourname"
                    value={regInput}
                    maxLength={32}
                    onChange={(e) =>
                      setRegInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                    }
                  />
                </div>
                <button
                  className="btn primary full"
                  onClick={onRegister}
                  disabled={busy === "register" || !regInput.trim()}
                >
                  {busy === "register" ? "Registering…" : "Claim username"}
                </button>
              </>
            )}
          </section>

          {/* Lookup */}
          <section className="card">
            <div className="card-label">
              <Search size={15} /> Look up a username
            </div>
            <div className="field">
              <span className="at">@</span>
              <input
                className="input"
                placeholder="someone"
                value={lookupInput}
                onChange={(e) =>
                  setLookupInput(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))
                }
                onKeyDown={(e) => e.key === "Enter" && onLookup()}
              />
              <button className="btn subtle" onClick={onLookup}>
                Resolve
              </button>
            </div>
            {lookupResult === "pending" && (
              <div className="lookup muted">Looking up…</div>
            )}
            {lookupResult && lookupResult !== "pending" && (
              <div className="lookup ok">
                @{lookupInput} → <code>{short(lookupResult)}</code>
              </div>
            )}
            {lookupResult === null && lookupInput && (
              <div className="lookup miss">@{lookupInput} isn't registered</div>
            )}
          </section>

          {/* Send */}
          <section className="card send-card">
            <div className="card-label">
              <Send size={15} /> Send sBTC
            </div>
            <label className="mini-label">Recipient (principal)</label>
            <input
              className="input block"
              placeholder="ST… or resolve a @username above"
              value={sendTo}
              onChange={(e) => setSendTo(e.target.value)}
            />
            <label className="mini-label">Amount (sats)</label>
            <input
              className="input block"
              type="number"
              min="1"
              placeholder="100000"
              value={sendAmount}
              onChange={(e) => setSendAmount(e.target.value)}
            />
            <button
              className="btn primary full"
              onClick={onSend}
              disabled={busy === "send" || !sendTo || !sendAmount}
            >
              <Send size={16} />
              {busy === "send" ? "Sending…" : "Send"}
            </button>
          </section>

          <footer className="app-foot">
            <a
              href="https://explorer.hiro.so/address/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV?chain=testnet"
              target="_blank"
              rel="noreferrer"
            >
              Live contracts on Stacks testnet <ExternalLink size={12} />
            </a>
          </footer>
        </main>
      )}
    </div>
  );
}

// Scoped styles using Sato's palette (defined in index.css :root).
const appStyles = `
.sato-app{min-height:100vh;background:var(--paper);color:var(--ink);font-family:var(--sans);}
.app-bar{display:flex;align-items:center;justify-content:space-between;padding:18px 24px;border-bottom:1px solid var(--line);}
.app-brand{display:flex;align-items:center;gap:8px;}
.app-mark{width:28px;height:28px;border-radius:8px;background:var(--orange);color:#fff;display:grid;place-items:center;font-weight:700;}
.app-name{font-weight:700;font-size:18px;}
.app-badge{font-size:11px;text-transform:uppercase;letter-spacing:.05em;background:var(--mint);color:var(--navy);padding:2px 8px;border-radius:999px;font-weight:600;}
.app-account{display:flex;align-items:center;gap:10px;}
.app-handle{font-weight:600;color:var(--orange);}
.app-hero{max-width:560px;margin:12vh auto 0;text-align:center;padding:0 24px;}
.app-hero h1{font-size:40px;line-height:1.1;margin:0 0 16px;letter-spacing:-.02em;}
.app-hero p{color:var(--text-muted);font-size:17px;line-height:1.6;margin:0 0 28px;}
.app-grid{max-width:920px;margin:32px auto;padding:0 24px;display:grid;grid-template-columns:1fr 1fr;gap:16px;}
.card{background:var(--white);border:1px solid var(--line);border-radius:16px;padding:20px;}
.balance-card{grid-column:1/-1;}
.send-card{grid-column:1/-1;}
.card-label{display:flex;align-items:center;gap:7px;font-size:13px;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:14px;}
.balance-value{font-size:34px;font-weight:700;letter-spacing:-.02em;}
.card-actions{display:flex;gap:10px;margin-top:16px;}
.claimed{font-size:16px;}
.claimed strong{color:var(--orange);}
.field{display:flex;align-items:center;gap:8px;border:1px solid var(--line);border-radius:12px;padding:0 12px;background:var(--paper);}
.field .at{color:var(--text-muted);font-weight:600;}
.input{flex:1;border:0;background:transparent;padding:12px 4px;font-size:15px;color:var(--ink);outline:none;font-family:var(--sans);}
.input.block{width:100%;border:1px solid var(--line);border-radius:12px;padding:12px 14px;background:var(--paper);margin-bottom:6px;box-sizing:border-box;}
.mini-label{display:block;font-size:12px;color:var(--text-muted);margin:10px 0 5px;font-weight:600;}
.lookup{margin-top:12px;font-size:14px;}
.lookup.ok code{background:var(--paper);padding:2px 6px;border-radius:6px;}
.lookup.miss{color:#b4341f;}
.lookup.muted,.muted{color:var(--text-muted);}
.btn{display:inline-flex;align-items:center;justify-content:center;gap:7px;border:0;border-radius:12px;padding:10px 16px;font-size:14px;font-weight:600;cursor:pointer;font-family:var(--sans);transition:transform .1s var(--ease),opacity .15s;}
.btn:disabled{opacity:.5;cursor:not-allowed;}
.btn:not(:disabled):active{transform:translateY(1px);}
.btn.primary{background:var(--orange);color:#fff;}
.btn.ghost{background:transparent;border:1px solid var(--line);color:var(--ink);}
.btn.subtle{background:var(--paper);border:1px solid var(--line);color:var(--ink);}
.btn.full{width:100%;margin-top:14px;}
.btn.lg{padding:14px 24px;font-size:16px;}
.app-foot{grid-column:1/-1;text-align:center;margin-top:8px;}
.app-foot a{color:var(--text-muted);font-size:13px;text-decoration:none;display:inline-flex;align-items:center;gap:5px;}
.app-foot a:hover{color:var(--orange);}
@media(max-width:640px){.app-grid{grid-template-columns:1fr;}.app-hero h1{font-size:32px;}}
`;

// Provider wrapper so the route can mount <App /> directly.
export default function App() {
  return (
    <StacksProvider>
      <SatoApp />
    </StacksProvider>
  );
}
