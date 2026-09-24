// Thin client for Sato's testnet contracts, mobile edition. Reads hit the Hiro
// API directly (same as the web client). Writes go through the on-device
// embedded wallet (wallet.ts) — gasless by default, because a fresh embedded
// wallet holds no STX for fees. Ported to match client/src/lib/sato.ts so the
// two stay in step (same contracts, same function names, same return shapes).

import {
  Cl,
  cvToValue,
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from "@stacks/transactions";
import { API, CONTRACTS, DEPLOYER, NETWORK, type ContractRef } from "@/config/network";
import { signSponsored } from "@/lib/wallet";

async function readOnly(
  contract: ContractRef,
  functionName: string,
  functionArgs: ClarityValue[],
  senderAddress: string,
) {
  return fetchCallReadOnlyFunction({
    contractAddress: contract.address,
    contractName: contract.name,
    functionName,
    functionArgs,
    senderAddress,
    network: NETWORK,
  });
}

// cvToValue wraps (some ...)/(ok ...) as { type, value } objects, so unwrap
// defensively before coercing (see the cvtovalue-wraps-optionals note).
function toBigInt(val: unknown): bigint {
  const inner = val && typeof val === "object" && "value" in val ? (val as any).value : val;
  try {
    if (typeof inner === "bigint") return inner;
    if (typeof inner === "number") return BigInt(inner);
    if (typeof inner === "string" && inner.trim() !== "") return BigInt(inner);
  } catch {
    /* malformed number — fall through to the default */
  }
  return 0n;
}

function optionalString(val: unknown): string | null {
  const inner = val && typeof val === "object" && "value" in val ? (val as any).value : val;
  return typeof inner === "string" ? inner : null;
}

// --- reads (no wallet needed) --------------------------------------------

// @name → owning principal, or null if the name is unregistered.
export async function resolveName(name: string): Promise<string | null> {
  return optionalString(
    cvToValue(await readOnly(CONTRACTS.names, "resolve-name", [Cl.stringAscii(name)], DEPLOYER)),
  );
}

// principal → its @name, or null if it never claimed one.
export async function getName(owner: string): Promise<string | null> {
  return optionalString(
    cvToValue(await readOnly(CONTRACTS.names, "get-name", [Cl.principal(owner)], owner)),
  );
}

export async function isNameAvailable(name: string): Promise<boolean> {
  return (
    cvToValue(
      await readOnly(CONTRACTS.names, "is-name-available", [Cl.stringAscii(name)], DEPLOYER),
    ) === true
  );
}

export async function getBalance(who: string): Promise<bigint> {
  return toBigInt(
    cvToValue(await readOnly(CONTRACTS.transfer, "get-balance", [Cl.principal(who)], who)),
  );
}

export interface EarnStats {
  deposited: bigint; // principal in the yield pool
  earned: bigint; // accrued yield, withdrawable
  available: bigint; // spendable wallet balance (what you could deposit)
  poolTotal: bigint; // whole-pool size, for context
}

export async function getEarnStats(who: string): Promise<EarnStats> {
  const readUint = async (c: ContractRef, fn: string, args: ClarityValue[]) => {
    try {
      return toBigInt(cvToValue(await readOnly(c, fn, args, who)));
    } catch {
      return 0n;
    }
  };
  const [deposited, earned, available, poolTotal] = await Promise.all([
    readUint(CONTRACTS.earn, "get-balance", [Cl.principal(who)]),
    readUint(CONTRACTS.earn, "get-yield", [Cl.principal(who)]),
    readUint(CONTRACTS.transfer, "get-balance", [Cl.principal(who)]),
    readUint(CONTRACTS.earn, "get-pool-total", []),
  ]);
  return { deposited, earned, available, poolTotal };
}

export interface SponsorStats {
  poolBalance: bigint; // µSTX the co-signer can still spend on fees
  remaining: bigint; // this wallet's remaining sponsored allowance
  cap: bigint; // per-user cap per window
  sponsoredCount: bigint; // sponsored txs this wallet has used this window
  windowLength: bigint; // window size, in blocks
}

export async function getSponsorStats(who: string): Promise<SponsorStats> {
  const read = (fn: string, args: ClarityValue[]) => readOnly(CONTRACTS.sponsor, fn, args, who);
  const [poolBalance, remaining, cap, sponsoredCount, windowLength] = await Promise.all([
    read("get-sponsor-balance", []),
    read("get-remaining-allowance", [Cl.principal(who)]),
    read("get-per-user-cap", []),
    read("get-sponsored-count", [Cl.principal(who)]),
    read("get-window-length", []),
  ]);
  return {
    poolBalance: toBigInt(cvToValue(poolBalance)),
    remaining: toBigInt(cvToValue(remaining)),
    cap: toBigInt(cvToValue(cap)),
    sponsoredCount: toBigInt(cvToValue(sponsoredCount)),
    windowLength: toBigInt(cvToValue(windowLength)),
  };
}

// One on-chain contract call, normalized for the activity feed.
export interface SatoTx {
  txId: string;
  label: string;
  kind: "sent" | "added" | "earn" | "gas" | "username" | "other";
  contract: string;
  status: "success" | "pending" | "failed" | "abort";
  time: number | null; // ms epoch, or null while still pending
}

function classify(
  fn: string | undefined,
  contract: string,
): { label: string; kind: SatoTx["kind"] } {
  if (contract === "sato-yield" || contract === "sato-yield-v2") {
    if (fn === "deposit") return { label: "Deposited to Earn", kind: "earn" };
    if (fn === "withdraw") return { label: "Withdrew from Earn", kind: "earn" };
    if (fn === "fund-reserve") return { label: "Backed Earn reserve", kind: "earn" };
  }
  if (contract === "sato-sponsor" && fn === "top-up") {
    return { label: "Funded gas pool", kind: "gas" };
  }
  switch (fn) {
    case "send": return { label: "Sent sBTC", kind: "sent" };
    case "deposit": return { label: "Added test sBTC", kind: "added" };
    case "register-name": return { label: "Claimed username", kind: "username" };
    case "transfer-name": return { label: "Transferred username", kind: "username" };
    default: return { label: fn ? fn.replace(/-/g, " ") : contract, kind: "other" };
  }
}

export async function getRecentTransactions(who: string, limit = 25): Promise<SatoTx[]> {
  try {
    const res = await fetch(`${API}/extended/v1/address/${who}/transactions?limit=${limit}`);
    if (!res.ok) return [];
    const data = await res.json();
    const rows: any[] = data?.results ?? [];
    return rows
      .filter((tx) => tx?.tx_type === "contract_call")
      .map((tx) => {
        const contractId: string = tx.contract_call?.contract_id ?? "";
        const contract = contractId.split(".")[1] ?? contractId;
        const statusRaw: string = tx.tx_status ?? "";
        const status: SatoTx["status"] = statusRaw.startsWith("success")
          ? "success"
          : statusRaw === "pending"
            ? "pending"
            : statusRaw.includes("abort")
              ? "abort"
              : "failed";
        const iso = tx.burn_block_time_iso ?? tx.parent_burn_block_time_iso;
        const { label, kind } = classify(tx.contract_call?.function_name, contract);
        return {
          txId: tx.tx_id,
          label,
          kind,
          contract,
          status,
          time: iso ? new Date(iso).getTime() : null,
        };
      });
  } catch {
    return [];
  }
}

// A single balance-changing event, mined from sato-transfer's print logs. Feeds
// the interactive balance staircase on the dashboard.
export interface BalanceEvent {
  time: number;
  delta: bigint; // signed: + received/deposited, − sent
  kind: "deposit" | "received" | "sent";
  peer: string | null;
  txId: string;
}

export async function getBalanceHistory(
  who: string,
  limit = 50,
): Promise<{ events: BalanceEvent[]; complete: boolean }> {
  try {
    const contract = `${CONTRACTS.transfer.address}.${CONTRACTS.transfer.name}`;
    const res = await fetch(`${API}/extended/v1/contract/${contract}/events?limit=${limit}`);
    if (!res.ok) return { events: [], complete: false };
    const data = await res.json();
    const rows: any[] = data?.results ?? [];
    const field = (repr: string, re: RegExp): string => (repr.match(re) ?? [])[1] ?? "";
    type Raw = { delta: bigint; kind: BalanceEvent["kind"]; peer: string | null; txId: string };
    const raw: Raw[] = [];
    for (const ev of rows) {
      if (ev?.event_type !== "smart_contract_log") continue;
      const repr: string = ev.contract_log?.value?.repr ?? "";
      const kind = field(repr, /\(event "([^"]+)"\)/);
      let amount = 0n;
      try {
        amount = BigInt(field(repr, /\(amount u(\d+)\)/) || "0");
      } catch {
        /* skip unparseable amount */
      }
      const recipient = field(repr, /\(recipient '([0-9A-Z]+)/);
      const sender = field(repr, /\(sender '([0-9A-Z]+)/);
      const txId: string = ev.tx_id;
      if (amount <= 0n) continue;
      if (kind === "sbtc-mint" && recipient === who) {
        raw.push({ delta: amount, kind: "deposit", peer: null, txId });
      } else if (kind === "sbtc-transfer" && recipient === who && sender !== who) {
        raw.push({ delta: amount, kind: "received", peer: sender || null, txId });
      } else if (kind === "sbtc-transfer" && sender === who) {
        raw.push({ delta: -amount, kind: "sent", peer: recipient || null, txId });
      }
    }
    // Join block times (and drop non-successful txs) via the batch tx endpoint.
    const ids = [...new Set(raw.map((r) => r.txId))];
    if (ids.length === 0) return { events: [], complete: rows.length < limit };
    const tRes = await fetch(
      `${API}/extended/v1/tx/multiple?${ids.map((id) => `tx_id=${id}`).join("&")}`,
    );
    const tData: any = tRes.ok ? await tRes.json() : {};
    const events: BalanceEvent[] = [];
    for (const r of raw) {
      const tx = tData?.[r.txId]?.result;
      if (!tx || !String(tx.tx_status ?? "").startsWith("success")) continue;
      const iso = tx.burn_block_time_iso ?? tx.parent_burn_block_time_iso;
      const time = iso ? new Date(iso).getTime() : null;
      if (!time) continue;
      events.push({ time, delta: r.delta, kind: r.kind, peer: r.peer, txId: r.txId });
    }
    events.sort((a, b) => a.time - b.time);
    return { events, complete: rows.length < limit };
  } catch {
    return { events: [], complete: false };
  }
}

// --- writes (all gasless — signed on-device, fee paid by the co-signer) ---

// Testnet faucet: mint test sBTC straight into this wallet. Testnet-only.
export function fundSelf(amount: bigint) {
  return signSponsored(CONTRACTS.transfer, "deposit", [Cl.uint(amount)]);
}

// Send sBTC to a principal or an @username (resolved on-chain first).
export async function send(recipientOrName: string, amount: bigint) {
  const raw = recipientOrName.trim().replace(/^@/, "");
  const recipient = raw.startsWith("S") ? raw : await resolveName(raw);
  if (!recipient) throw new Error("That @username isn't registered.");
  return signSponsored(CONTRACTS.transfer, "send", [Cl.principal(recipient), Cl.uint(amount)]);
}

export function registerName(name: string) {
  return signSponsored(CONTRACTS.names, "register-name", [Cl.stringAscii(name)]);
}

export function earnDeposit(amount: bigint) {
  return signSponsored(CONTRACTS.earn, "deposit", [Cl.uint(amount)]);
}

export function earnWithdraw(amount: bigint) {
  return signSponsored(CONTRACTS.earn, "withdraw", [Cl.uint(amount)]);
}

// Contribute µSTX to the shared gas pool. The co-signer still covers the FEE,
// but the top-up amount itself is STX debited from this wallet — so unlike the
// other actions this one needs testnet STX on hand (the Gas tab says where to
// get it). Routed gasless anyway so the fee is never the blocker.
export function sponsorTopUp(microStx: bigint) {
  return signSponsored(CONTRACTS.sponsor, "top-up", [Cl.uint(microStx)]);
}
