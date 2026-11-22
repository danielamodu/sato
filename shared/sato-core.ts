// shared/sato-core.ts — shared Stacks read-only client, types, and parsing
// used by both the web dapp (`client/src/lib/sato.ts`) and the Expo mobile
// wallet (`mobile/src/lib/sato.ts`). Keeping all contract reads and event
// parsing in one place prevents the two clients from drifting.

import {
  Cl,
  cvToValue,
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from "@stacks/transactions";

export type ContractRef = { address: string; name: string };

export interface SatoConfig {
  deployer: string;
  network: "testnet" | "mainnet";
  apiUrl: string;
  contracts: {
    names: ContractRef;
    ledger: ContractRef;
    sponsor: ContractRef;
  };
}

export interface SatoTx {
  txId: string;
  label: string;
  kind: "sent" | "added" | "earn" | "gas" | "username" | "other";
  contract: string;
  status: "success" | "pending" | "failed" | "abort";
  time: number | null;
}

export type TxState = "pending" | "success" | "failed" | "unknown";

export interface BalanceEvent {
  time: number;
  delta: bigint;
  kind: "deposit" | "received" | "sent";
  peer: string | null;
  txId: string;
}

export interface EarnStats {
  liquid: bigint;
  locked: bigint;
  lockValue: bigint;
  lockUnlock: bigint;
  height: bigint;
  baseRateBps: bigint;
  boostRateBps: bigint;
  totalSupply: bigint;
}

export interface SponsorStats {
  poolBalance: bigint;
  remaining: bigint;
  cap: bigint;
  sponsoredCount: bigint;
  windowLength: bigint;
}

// Blocks `sato-yield-v3` annualizes rates over.
export const YIELD_BLOCKS_PER_YEAR = 52560;

// cvToValue may hand `(some T)` or `(ok uint)` back as `{ type, value }` or
// bare primitive depending on the Stacks.js version / clarity response shape.
export function optionalString(val: unknown): string | null {
  const inner =
    val && typeof val === "object" && "value" in val
      ? (val as { value: unknown }).value
      : val;
  return typeof inner === "string" ? inner : null;
}

export function toBigInt(val: unknown): bigint {
  const inner =
    val && typeof val === "object" && "value" in val
      ? (val as { value: unknown }).value
      : val;
  try {
    if (typeof inner === "bigint") return inner;
    if (typeof inner === "number") return BigInt(inner);
    if (typeof inner === "string" && inner.trim() !== "") return BigInt(inner);
  } catch {
    /* malformed number — fall through to default */
  }
  return 0n;
}

export function classifySatoCall(
  fn: string | undefined,
  contract: string
): { label: string; kind: SatoTx["kind"] } {
  if (contract === "sato-yield-v3") {
    if (fn === "lock") return { label: "Locked for boost", kind: "earn" };
    if (fn === "claim-lock") return { label: "Claimed lock", kind: "earn" };
  }
  if (contract === "sato-yield" || contract === "sato-yield-v2") {
    if (fn === "deposit") return { label: "Deposited to Earn", kind: "earn" };
    if (fn === "withdraw") return { label: "Withdrew from Earn", kind: "earn" };
    if (fn === "fund-sbtc") return { label: "Added test sBTC", kind: "added" };
    if (fn === "fund-reserve") return { label: "Backed Earn reserve", kind: "earn" };
    if (fn === "add-yield") return { label: "Yield distributed", kind: "earn" };
  }
  if (contract === "sato-sponsor") {
    if (fn === "top-up") return { label: "Funded gas pool", kind: "gas" };
    if (fn === "sponsor-tx") return { label: "Gas sponsored", kind: "gas" };
  }
  switch (fn) {
    case "send":
      return { label: "Sent sBTC", kind: "sent" };
    case "deposit":
      return { label: "Added test sBTC", kind: "added" };
    case "register-name":
      return { label: "Claimed username", kind: "username" };
    case "transfer-name":
      return { label: "Transferred username", kind: "username" };
    default:
      return { label: fn ? fn.replace(/-/g, " ") : contract, kind: "other" };
  }
}

export function createSatoReader(config: SatoConfig) {
  const { deployer, network, apiUrl, contracts } = config;

  async function readOnly(
    contract: ContractRef,
    functionName: string,
    functionArgs: ClarityValue[],
    senderAddress: string
  ) {
    return fetchCallReadOnlyFunction({
      contractAddress: contract.address,
      contractName: contract.name,
      functionName,
      functionArgs,
      senderAddress,
      network,
    });
  }

  async function resolveName(name: string): Promise<string | null> {
    const cv = await readOnly(
      contracts.names,
      "resolve-name",
      [Cl.stringAscii(name)],
      deployer
    );
    return optionalString(cvToValue(cv));
  }

  async function getName(owner: string): Promise<string | null> {
    const cv = await readOnly(
      contracts.names,
      "get-name",
      [Cl.principal(owner)],
      owner
    );
    return optionalString(cvToValue(cv));
  }

  async function isNameAvailable(name: string): Promise<boolean> {
    const cv = await readOnly(
      contracts.names,
      "is-name-available",
      [Cl.stringAscii(name)],
      deployer
    );
    return cvToValue(cv) === true;
  }

  async function getBalance(who: string): Promise<bigint> {
    const cv = await readOnly(
      contracts.ledger,
      "get-balance",
      [Cl.principal(who)],
      who
    );
    return toBigInt(cvToValue(cv));
  }

  async function getRecentTransactions(
    who: string,
    limit = 12
  ): Promise<SatoTx[]> {
    try {
      const res = await fetch(
        `${apiUrl}/extended/v1/address/${who}/transactions?limit=${limit}`
      );
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
          const { label, kind } = classifySatoCall(
            tx.contract_call?.function_name,
            contract
          );
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

  async function getTxStatus(
    txid: string
  ): Promise<{ state: TxState; anchored: boolean; reason?: string }> {
    const id = txid.startsWith("0x") ? txid : `0x${txid}`;
    try {
      const res = await fetch(`${apiUrl}/extended/v1/tx/${id}`);
      if (res.status === 404) return { state: "pending", anchored: false };
      if (!res.ok) return { state: "unknown", anchored: false };
      const tx = await res.json();
      const raw: string = tx?.tx_status ?? "";
      const anchored = tx?.is_unanchored !== true;
      if (raw.startsWith("success")) return { state: "success", anchored };
      if (raw === "pending") return { state: "pending", anchored: false };
      if (raw.includes("abort")) {
        return {
          state: "failed",
          anchored: false,
          reason:
            raw === "abort_by_post_condition"
              ? "Blocked by a post-condition"
              : "Reverted on-chain",
        };
      }
      return { state: "unknown", anchored: false };
    } catch {
      return { state: "unknown", anchored: false };
    }
  }

  async function getBalanceHistory(
    who: string,
    limit = 50
  ): Promise<{ events: BalanceEvent[]; complete: boolean }> {
    try {
      const contract = `${contracts.ledger.address}.${contracts.ledger.name}`;
      const res = await fetch(
        `${apiUrl}/extended/v1/contract/${contract}/events?limit=${limit}`
      );
      if (!res.ok) return { events: [], complete: false };
      const data = await res.json();
      const rows: any[] = data?.results ?? [];
      const field = (repr: string, re: RegExp): string =>
        (repr.match(re) ?? [])[1] ?? "";
      type Raw = {
        delta: bigint;
        kind: BalanceEvent["kind"];
        peer: string | null;
        txId: string;
      };
      const raw: Raw[] = [];
      for (const ev of rows) {
        if (ev?.event_type !== "smart_contract_log") continue;
        const repr: string = ev.contract_log?.value?.repr ?? "";
        const kind = field(repr, /\(event "([^"]+)"\)/);
        let amount = 0n;
        try {
          amount = BigInt(field(repr, /\(amount u(\d+)\)/) || "0");
        } catch {
          /* skip malformed amount */
        }
        const recipient = field(repr, /\(recipient '([0-9A-Z]+)/);
        const sender = field(repr, /\(sender '([0-9A-Z]+)/);
        const txId: string = ev.tx_id;
        if (amount <= 0n) continue;
        if (kind === "sbtc-mint" && recipient === who) {
          raw.push({ delta: amount, kind: "deposit", peer: null, txId });
        } else if (
          kind === "sbtc-transfer" &&
          recipient === who &&
          sender !== who
        ) {
          raw.push({
            delta: amount,
            kind: "received",
            peer: sender || null,
            txId,
          });
        } else if (kind === "sbtc-transfer" && sender === who) {
          raw.push({
            delta: -amount,
            kind: "sent",
            peer: recipient || null,
            txId,
          });
        }
      }

      const ids = [...new Set(raw.map((r) => r.txId))];
      if (ids.length === 0) {
        return { events: [], complete: rows.length < limit };
      }

      const tRes = await fetch(
        `${apiUrl}/extended/v1/tx/multiple?${ids.map((id) => `tx_id=${id}`).join("&")}`
      );
      const tData: any = tRes.ok ? await tRes.json() : {};
      const events: BalanceEvent[] = [];
      for (const r of raw) {
        const tx = tData?.[r.txId]?.result;
        if (!tx || !String(tx.tx_status ?? "").startsWith("success")) continue;
        const iso = tx.burn_block_time_iso ?? tx.parent_burn_block_time_iso;
        const time = iso ? new Date(iso).getTime() : null;
        if (!time) continue;
        events.push({
          time,
          delta: r.delta,
          kind: r.kind,
          peer: r.peer,
          txId: r.txId,
        });
      }
      events.sort((a, b) => a.time - b.time);
      return { events, complete: rows.length < limit };
    } catch {
      return { events: [], complete: false };
    }
  }

  async function getEarnStats(who: string): Promise<EarnStats> {
    const readUint = async (fn: string, args: ClarityValue[]): Promise<bigint> => {
      try {
        return toBigInt(cvToValue(await readOnly(contracts.ledger, fn, args, who)));
      } catch {
        return 0n;
      }
    };
    const field = (t: unknown, k: string): bigint => {
      const f = (t as Record<string, unknown>)?.[k];
      return toBigInt(
        f && typeof f === "object" && "value" in f
          ? (f as { value: unknown }).value
          : f
      );
    };
    const readLock = async (): Promise<{ amount: bigint; unlock: bigint }> => {
      try {
        const t = cvToValue(
          await readOnly(contracts.ledger, "get-lock", [Cl.principal(who)], who)
        );
        return { amount: field(t, "amount"), unlock: field(t, "unlock") };
      } catch {
        return { amount: 0n, unlock: 0n };
      }
    };
    const chainHeight = async (): Promise<bigint> => {
      try {
        const r = await fetch(`${apiUrl}/v2/info`);
        return r.ok ? toBigInt((await r.json())?.stacks_tip_height) : 0n;
      } catch {
        return 0n;
      }
    };
    const [liquid, lockValue, baseRateBps, boostRateBps, totalSupply, lock, height] =
      await Promise.all([
        readUint("get-balance", [Cl.principal(who)]),
        readUint("get-lock-value", [Cl.principal(who)]),
        readUint("get-base-rate", []),
        readUint("get-boost-rate", []),
        readUint("get-total-supply", []),
        readLock(),
        chainHeight(),
      ]);
    return {
      liquid,
      locked: lock.amount,
      lockValue,
      lockUnlock: lock.unlock,
      height,
      baseRateBps,
      boostRateBps,
      totalSupply,
    };
  }

  async function getSponsorStats(who: string): Promise<SponsorStats> {
    const [poolBalance, remaining, cap, sponsoredCount, windowLength] =
      await Promise.all([
        readOnly(contracts.sponsor, "get-sponsor-balance", [], who),
        readOnly(
          contracts.sponsor,
          "get-remaining-allowance",
          [Cl.principal(who)],
          who
        ),
        readOnly(contracts.sponsor, "get-per-user-cap", [], who),
        readOnly(
          contracts.sponsor,
          "get-sponsored-count",
          [Cl.principal(who)],
          who
        ),
        readOnly(contracts.sponsor, "get-window-length", [], who),
      ]);
    return {
      poolBalance: toBigInt(cvToValue(poolBalance)),
      remaining: toBigInt(cvToValue(remaining)),
      cap: toBigInt(cvToValue(cap)),
      sponsoredCount: toBigInt(cvToValue(sponsoredCount)),
      windowLength: toBigInt(cvToValue(windowLength)),
    };
  }

  return {
    readOnly,
    resolveName,
    getName,
    isNameAvailable,
    getBalance,
    getRecentTransactions,
    getTxStatus,
    getBalanceHistory,
    getEarnStats,
    getSponsorStats,
  };
}
