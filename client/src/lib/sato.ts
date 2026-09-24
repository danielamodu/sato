// sato.ts — thin client for Sato's live testnet contracts.
//
// Wraps the four contracts a user touches in the demo flow:
//   - sato-names:    register-name, resolve-name, get-name, is-name-available
//   - sato-transfer: send, deposit (faucet), get-balance
//   - sato-yield:    deposit, withdraw, fund-sbtc, get-balance, get-yield
//   - sato-sponsor:  top-up, get-sponsor-balance, get-remaining-allowance
//
// Reads hit the testnet API directly (no wallet needed). Writes go through
// the connected wallet via @stacks/connect's `request("stx_callContract")`.

import {
  Cl,
  cvToValue,
  fetchCallReadOnlyFunction,
  type ClarityValue,
} from "@stacks/transactions";
import { request } from "@stacks/connect";

// Deployer of the live testnet contracts.
export const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
export const NETWORK = "testnet" as const;

export const CONTRACTS = {
  names: { address: DEPLOYER, name: "sato-names" },
  transfer: { address: DEPLOYER, name: "sato-transfer" },
  earn: { address: DEPLOYER, name: "sato-yield" },
  sponsor: { address: DEPLOYER, name: "sato-sponsor" },
} as const;

const API = "https://api.testnet.hiro.so";

// --- reads (no wallet) ---------------------------------------------------

async function readOnly(
  contract: { address: string; name: string },
  functionName: string,
  functionArgs: ClarityValue[],
  sender: string
) {
  return fetchCallReadOnlyFunction({
    contractAddress: contract.address,
    contractName: contract.name,
    functionName,
    functionArgs,
    senderAddress: sender,
    network: NETWORK,
  });
}

// cvToValue unwraps an `(optional T)`: `none` -> null, but `(some T)` ->
// a `{ type, value }` wrapper object (via cvToJSON), NOT the bare value.
// This pulls the string out of either shape and rejects anything else,
// so callers always get a clean `string | null` (never an object).
function optionalString(val: unknown): string | null {
  if (typeof val === "string") return val;
  if (val && typeof val === "object" && "value" in val) {
    const inner = (val as { value: unknown }).value;
    return typeof inner === "string" ? inner : null;
  }
  return null;
}

// cvToValue on a Clarity `uint` yields a decimal string (a bare `(ok uint)`
// or read-only `uint` in v7). Coerce whatever shape comes back to a bigint,
// defaulting to 0n for anything unexpected so a balance read never throws.
function toBigInt(val: unknown): bigint {
  try {
    if (typeof val === "bigint") return val;
    if (typeof val === "number") return BigInt(val);
    if (typeof val === "string" && val.trim() !== "") return BigInt(val);
  } catch {
    /* malformed number — fall through to the default */
  }
  return 0n;
}

// Resolve a @username to the principal that owns it (null if unregistered).
export async function resolveName(name: string): Promise<string | null> {
  const cv = await readOnly(
    CONTRACTS.names,
    "resolve-name",
    [Cl.stringAscii(name)],
    DEPLOYER
  );
  // returns (optional principal): some -> {type,value:principal}, none -> null
  return optionalString(cvToValue(cv));
}

// Look up the username a principal has registered (null if none).
export async function getName(owner: string): Promise<string | null> {
  const cv = await readOnly(
    CONTRACTS.names,
    "get-name",
    [Cl.principal(owner)],
    owner
  );
  // returns (optional (string-ascii)): some -> {type,value:name}, none -> null
  return optionalString(cvToValue(cv));
}

// Is a @username still unclaimed? Reads the registry live so the claim
// form can confirm a handle before the user spends a transaction on it.
export async function isNameAvailable(name: string): Promise<boolean> {
  const cv = await readOnly(
    CONTRACTS.names,
    "is-name-available",
    [Cl.stringAscii(name)],
    DEPLOYER
  );
  return cvToValue(cv) === true; // read-only returns a bare bool
}

// Get a principal's sBTC balance (in sats) from the transfer ledger.
export async function getBalance(who: string): Promise<bigint> {
  const cv = await readOnly(
    CONTRACTS.transfer,
    "get-balance",
    [Cl.principal(who)],
    who
  );
  return toBigInt(cvToValue(cv));
}

// A single on-chain action, normalized for the activity table.
export interface SatoTx {
  txId: string;
  label: string; // human-readable action ("Sent sBTC", "Claimed username"…)
  contract: string; // short contract name it touched
  status: "success" | "pending" | "failed" | "abort";
  time: number | null; // ms epoch, or null while pending
}

// Map a Sato contract-call to a friendly label.
function labelFor(fn: string | undefined, contract: string): string {
  if (contract === "sato-yield") {
    switch (fn) {
      case "deposit":
        return "Deposited to Earn";
      case "withdraw":
        return "Withdrew from Earn";
      case "fund-sbtc":
        return "Added test sBTC";
      case "add-yield":
        return "Yield distributed";
    }
  }
  if (contract === "sato-sponsor") {
    switch (fn) {
      case "top-up":
        return "Funded gas pool";
      case "sponsor-tx":
        return "Gas sponsored";
    }
  }
  switch (fn) {
    case "send":
      return "Sent sBTC";
    case "deposit":
      return "Added test sBTC";
    case "register-name":
      return "Claimed username";
    case "transfer-name":
      return "Transferred username";
    default:
      return fn ? fn.replace(/-/g, " ") : contract;
  }
}

// Pull the connected wallet's recent transactions straight from the Hiro
// testnet API — real on-chain history, no wallet needed to read it.
export async function getRecentTransactions(
  who: string,
  limit = 12
): Promise<SatoTx[]> {
  try {
    const res = await fetch(
      `${API}/extended/v1/address/${who}/transactions?limit=${limit}`
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
        return {
          txId: tx.tx_id,
          label: labelFor(tx.contract_call?.function_name, contract),
          contract,
          status,
          time: iso ? new Date(iso).getTime() : null,
        };
      });
  } catch {
    return [];
  }
}

// A signed change to the connected wallet's sBTC balance, at a point in time.
// Positive = credited (a faucet deposit or an incoming send), negative = debited
// (an outgoing send). The headline balance is sato-transfer's ledger, so only
// that contract's calls move it — Earn uses a separate ledger and is excluded.
export interface BalanceDelta {
  time: number; // ms epoch of the confirming block
  delta: bigint; // sats added (+) or removed (−)
}

// Reconstruct the real balance timeline: the connected wallet's own
// sato-transfer calls, each turned into a signed sats delta, straight from the
// chain. Anchored to the live balance by the caller, this yields a true
// balance-over-time chart — no invented curve. `complete` is false when the
// address has more history than we fetched (older steps may be missing).
//
// The address tx feed returns calls the wallet *made*, so `send` here is always
// outgoing (−). Incoming sends (someone paying this wallet) aren't in the feed;
// walking back from the exact current balance still lands today's point right,
// and any resulting undershoot is clamped at zero rather than faked.
export async function getBalanceHistory(
  who: string,
  limit = 50
): Promise<{ deltas: BalanceDelta[]; complete: boolean }> {
  try {
    const res = await fetch(
      `${API}/extended/v1/address/${who}/transactions?limit=${limit}`
    );
    if (!res.ok) return { deltas: [], complete: false };
    const data = await res.json();
    const rows: any[] = data?.results ?? [];
    const total: number = typeof data?.total === "number" ? data.total : rows.length;
    const uintArg = (a: any): bigint => {
      try {
        return BigInt(String(a?.repr ?? "").replace(/^u/, ""));
      } catch {
        return 0n;
      }
    };
    const principalArg = (a: any): string =>
      String(a?.repr ?? "").replace(/^'/, "");
    const deltas: BalanceDelta[] = [];
    for (const tx of rows) {
      if (tx?.tx_type !== "contract_call") continue;
      if (!String(tx?.tx_status ?? "").startsWith("success")) continue;
      const cid: string = tx.contract_call?.contract_id ?? "";
      if (!cid.endsWith(".sato-transfer")) continue; // headline ledger only
      const fn: string = tx.contract_call?.function_name ?? "";
      const args: any[] = tx.contract_call?.function_args ?? [];
      const iso = tx.burn_block_time_iso ?? tx.parent_burn_block_time_iso;
      const time = iso ? new Date(iso).getTime() : null;
      if (!time) continue; // skip unconfirmed — no timestamp to place it
      if (fn === "deposit") {
        deltas.push({ time, delta: uintArg(args[0]) });
      } else if (fn === "mint") {
        if (principalArg(args[0]) === who)
          deltas.push({ time, delta: uintArg(args[1]) });
      } else if (fn === "send") {
        const amount = uintArg(args[1]);
        if (tx.sender_address === who) deltas.push({ time, delta: -amount });
        else if (principalArg(args[0]) === who)
          deltas.push({ time, delta: amount });
      }
    }
    deltas.sort((a, b) => a.time - b.time);
    return { deltas, complete: rows.length >= total };
  } catch {
    return { deltas: [], complete: false };
  }
}

// --- writes (wallet) -----------------------------------------------------

async function callContract(
  contract: { address: string; name: string },
  functionName: string,
  functionArgs: ClarityValue[]
) {
  return request("stx_callContract", {
    contract: `${contract.address}.${contract.name}`,
    functionName,
    functionArgs,
    network: NETWORK,
  });
}

// Register a @username for the connected wallet.
export function registerName(name: string) {
  return callContract(CONTRACTS.names, "register-name", [
    Cl.stringAscii(name),
  ]);
}

// Send sBTC (in sats) to another principal.
export function sendSbtc(recipient: string, amount: bigint) {
  return callContract(CONTRACTS.transfer, "send", [
    Cl.principal(recipient),
    Cl.uint(amount),
  ]);
}

// --- gasless sends (sponsored-transaction protocol) ----------------------

// The co-signer endpoint (api/sponsor.ts): it holds a funded STX key, pays
// the miner fee, and broadcasts. Same-origin on Vercel.
const SPONSOR_ENDPOINT = "/api/sponsor";

// Raised when the connected wallet signed but didn't hand back a serialized
// tx — i.e. it ignored `sponsored:true` (older wallets). Callers can catch
// this and fall back to a normal, user-pays send.
export const NO_SPONSORED_TX = "WALLET_NO_SPONSORED_TX";

// Ask the wallet to SIGN (not broadcast) a `sponsored:true` contract call,
// then hand the serialized tx to the co-signer, which fills in the fee, signs
// as sponsor, and broadcasts. Returns the broadcast txId. The user pays no gas.
async function sponsoredCall(
  contract: { address: string; name: string },
  functionName: string,
  functionArgs: ClarityValue[]
): Promise<string> {
  const res = await request("stx_callContract", {
    contract: `${contract.address}.${contract.name}`,
    functionName,
    functionArgs,
    network: NETWORK,
    sponsored: true, // wallet signs but leaves fee/sponsor-nonce blank
  });
  // A sponsored call can't be broadcast by the wallet (no fee yet), so instead
  // of a txid it returns the serialized, origin-signed tx for us to co-sign.
  const txHex = (res as { transaction?: string }).transaction;
  if (!txHex) throw new Error(NO_SPONSORED_TX);

  const resp = await fetch(SPONSOR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHex }),
  });
  const data = (await resp.json().catch(() => ({}))) as {
    txId?: string;
    error?: string;
  };
  if (!resp.ok || !data.txId) {
    throw new Error(data.error || "Gas sponsor rejected the transaction.");
  }
  return data.txId;
}

// Send sBTC gaslessly: the gas pool covers the fee. Returns the txId.
export function sendSbtcSponsored(recipient: string, amount: bigint) {
  return sponsoredCall(CONTRACTS.transfer, "send", [
    Cl.principal(recipient),
    Cl.uint(amount),
  ]);
}

// Devnet/testnet faucet: credit the caller's own balance so they have
// something to send. Backed by sato-transfer's mint helper.
export function fundSelf(amount: bigint) {
  return callContract(CONTRACTS.transfer, "deposit", [Cl.uint(amount)]);
}

// --- earn (sato-yield pool) ---------------------------------------------

// A user's position in the yield pool, plus pool context. All sats.
export interface EarnStats {
  deposited: bigint; // principal the user has earning in the pool
  earned: bigint; // yield accrued to the user (harvested + pending)
  available: bigint; // the user's pool sBTC ledger, ready to deposit
  poolTotal: bigint; // total sBTC the pool holds (principal + yield)
}

// Read a user's full Earn position in one shot (four parallel reads).
export async function getEarnStats(who: string): Promise<EarnStats> {
  const [deposited, earned, available, poolTotal] = await Promise.all([
    readOnly(CONTRACTS.earn, "get-balance", [Cl.principal(who)], who),
    readOnly(CONTRACTS.earn, "get-yield", [Cl.principal(who)], who),
    readOnly(CONTRACTS.earn, "get-sbtc-balance", [Cl.principal(who)], who),
    readOnly(CONTRACTS.earn, "get-pool-total", [], who),
  ]);
  return {
    deposited: toBigInt(cvToValue(deposited)),
    earned: toBigInt(cvToValue(earned)),
    available: toBigInt(cvToValue(available)),
    poolTotal: toBigInt(cvToValue(poolTotal)),
  };
}

// Deposit sBTC (from the pool ledger) into the yield pool to start earning.
export function earnDeposit(amount: bigint) {
  return callContract(CONTRACTS.earn, "deposit", [Cl.uint(amount)]);
}

// Withdraw deposited principal. Always harvests and pays out earned yield too.
export function earnWithdraw(amount: bigint) {
  return callContract(CONTRACTS.earn, "withdraw", [Cl.uint(amount)]);
}

// Testnet helper: credit the caller's yield-pool sBTC ledger so they have
// sBTC available to deposit into the pool.
export function fundEarn(amount: bigint) {
  return callContract(CONTRACTS.earn, "fund-sbtc", [Cl.uint(amount)]);
}

// --- gas sponsorship (sato-sponsor pool) --------------------------------

// The live state of the shared gas pool, plus this user's coverage.
// All amounts are micro-STX (1 STX = 1,000,000 micro-STX).
export interface SponsorStats {
  poolBalance: bigint; // STX held in the pool, ready to reimburse fees
  remaining: bigint; // still sponsorable for this user in the current window
  cap: bigint; // per-user allowance per window
  sponsoredCount: bigint; // lifetime txs sponsored for this user
  windowLength: bigint; // length of a cap window, in blocks
}

// Read the whole sponsor picture for a user in one shot (five reads).
export async function getSponsorStats(who: string): Promise<SponsorStats> {
  const [poolBalance, remaining, cap, sponsoredCount, windowLength] =
    await Promise.all([
      readOnly(CONTRACTS.sponsor, "get-sponsor-balance", [], who),
      readOnly(
        CONTRACTS.sponsor,
        "get-remaining-allowance",
        [Cl.principal(who)],
        who
      ),
      readOnly(CONTRACTS.sponsor, "get-per-user-cap", [], who),
      readOnly(
        CONTRACTS.sponsor,
        "get-sponsored-count",
        [Cl.principal(who)],
        who
      ),
      readOnly(CONTRACTS.sponsor, "get-window-length", [], who),
    ]);
  return {
    poolBalance: toBigInt(cvToValue(poolBalance)),
    remaining: toBigInt(cvToValue(remaining)),
    cap: toBigInt(cvToValue(cap)),
    sponsoredCount: toBigInt(cvToValue(sponsoredCount)),
    windowLength: toBigInt(cvToValue(windowLength)),
  };
}

// Chip micro-STX into the shared gas pool. Permissionless — anyone can
// help cover everyone's transaction fees.
export function sponsorTopUp(amount: bigint) {
  return callContract(CONTRACTS.sponsor, "top-up", [Cl.uint(amount)]);
}
