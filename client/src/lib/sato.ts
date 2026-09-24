// sato.ts — thin client for Sato's live testnet contracts.
//
// Wraps the four contracts a user touches in the demo flow:
//   - sato-names:    register-name, resolve-name, get-name, is-name-available
//   - sato-transfer: send, deposit (faucet), get-balance
//   - sato-yield-v2: deposit, withdraw, fund-reserve, get-balance, get-yield
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
  earn: { address: DEPLOYER, name: "sato-yield-v2" },
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
  if (contract === "sato-yield" || contract === "sato-yield-v2") {
    switch (fn) {
      case "deposit":
        return "Deposited to Earn";
      case "withdraw":
        return "Withdrew from Earn";
      case "fund-sbtc":
        return "Added test sBTC";
      case "fund-reserve":
        return "Backed Earn reserve";
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

// One balance-affecting event on the connected wallet's sato-transfer ledger,
// reconstructed from the contract's on-chain `print` events. Positive delta =
// credited (a faucet top-up or an incoming payment), negative = debited (an
// outgoing send). With Earn v2, deposits and withdrawals move real wallet
// balance to/from the pool principal, so they show up here too (sent/received).
export interface BalanceEvent {
  time: number; // ms epoch of the confirming block
  delta: bigint; // sats added (+) or removed (−)
  kind: "deposit" | "received" | "sent";
  peer: string | null; // the other party, for sent/received
  txId: string;
}

// Reconstruct the wallet's real balance history — every credit AND debit, in
// both directions — straight from the chain. sato-transfer emits `print`
// events (not SIP-010 transfers), so an address's tx feed misses payments it
// only *received*; instead we read the contract's own event log, which records
// every `sbtc-mint`/`sbtc-transfer`, then join block times in one batch call.
// Anchored to the live balance by the caller, this is a true, honest timeline.
export async function getBalanceHistory(
  who: string,
  limit = 50
): Promise<{ events: BalanceEvent[]; complete: boolean }> {
  try {
    const contract = `${CONTRACTS.transfer.address}.${CONTRACTS.transfer.name}`;
    const res = await fetch(
      `${API}/extended/v1/contract/${contract}/events?limit=${limit}`
    );
    if (!res.ok) return { events: [], complete: false };
    const data = await res.json();
    const rows: any[] = data?.results ?? [];
    // Pull a field out of a Clarity print tuple repr, e.g.
    // (tuple (amount u1000000) (event "sbtc-transfer") (recipient 'ST..) (sender 'ST..))
    const field = (repr: string, re: RegExp): string =>
      (repr.match(re) ?? [])[1] ?? "";
    type Raw = { delta: bigint; kind: BalanceEvent["kind"]; peer: string | null; txId: string };
    const raw: Raw[] = [];
    for (const ev of rows) {
      if (ev?.event_type !== "smart_contract_log") continue;
      const repr: string = ev.contract_log?.value?.repr ?? "";
      const kind = field(repr, /\(event "([^"]+)"\)/);
      let amount = 0n;
      try { amount = BigInt(field(repr, /\(amount u(\d+)\)/) || "0"); } catch { /* skip */ }
      const recipient = field(repr, /\(recipient '([0-9A-Z]+)/);
      const sender = field(repr, /\(sender '([0-9A-Z]+)/);
      const txId: string = ev.tx_id;
      if (amount <= 0n) continue;
      if (kind === "sbtc-mint" && recipient === who)
        raw.push({ delta: amount, kind: "deposit", peer: null, txId });
      else if (kind === "sbtc-transfer" && recipient === who && sender !== who)
        raw.push({ delta: amount, kind: "received", peer: sender || null, txId });
      else if (kind === "sbtc-transfer" && sender === who)
        raw.push({ delta: -amount, kind: "sent", peer: recipient || null, txId });
    }
    // Join confirming block times in one batched call, dropping anything not
    // yet successfully mined, then order oldest→newest for the staircase.
    const ids = [...new Set(raw.map((r) => r.txId))];
    const tRes = await fetch(
      `${API}/extended/v1/tx/multiple?${ids.map((id) => `tx_id=${id}`).join("&")}`
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
  available: bigint; // the user's sBTC wallet balance, ready to deposit
  poolTotal: bigint; // total sBTC the pool holds (principal + yield)
}

// Read a user's full Earn position in one shot (four parallel reads). v2 has
// no internal "available" ledger — deposits pull straight from the user's
// sato-transfer wallet, so `available` reads that wallet balance. Each read
// degrades to 0n if sato-yield-v2 isn't reachable yet (e.g. pre-deploy), so
// the Earn tab still renders instead of throwing.
export async function getEarnStats(who: string): Promise<EarnStats> {
  const readUint = async (
    contract: { address: string; name: string },
    fn: string,
    args: ClarityValue[]
  ): Promise<bigint> => {
    try {
      return toBigInt(cvToValue(await readOnly(contract, fn, args, who)));
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

// Deposit sBTC (from the pool ledger) into the yield pool to start earning.
export function earnDeposit(amount: bigint) {
  return callContract(CONTRACTS.earn, "deposit", [Cl.uint(amount)]);
}

// Withdraw deposited principal. Always harvests and pays out earned yield too.
export function earnWithdraw(amount: bigint) {
  return callContract(CONTRACTS.earn, "withdraw", [Cl.uint(amount)]);
}

// Ops helper: top up the pool's sBTC reserve from the caller's wallet so
// accrued yield is payable. Permissionless — anyone can back the pool (on
// mainnet a strategy contract routes real returns through here).
export function fundReserve(amount: bigint) {
  return callContract(CONTRACTS.earn, "fund-reserve", [Cl.uint(amount)]);
}

// Testnet helper: credit the caller's sBTC wallet balance (sato-transfer
// faucet) so they have sBTC to deposit. v2 deposits pull from this wallet.
export function fundEarn(amount: bigint) {
  return callContract(CONTRACTS.transfer, "deposit", [Cl.uint(amount)]);
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
