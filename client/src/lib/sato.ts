// sato.ts — thin client for Sato's live testnet contracts.
//
// Wraps the two contracts a user touches in the demo flow:
//   - sato-names:    register-name, resolve-name, get-name
//   - sato-transfer: send, deposit (faucet), get-balance
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

// Get a principal's sBTC balance (in sats) from the transfer ledger.
export async function getBalance(who: string): Promise<bigint> {
  const cv = await readOnly(
    CONTRACTS.transfer,
    "get-balance",
    [Cl.principal(who)],
    who
  );
  return BigInt(cvToValue(cv));
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

// Devnet/testnet faucet: credit the caller's own balance so they have
// something to send. Backed by sato-transfer's mint helper.
export function fundSelf(amount: bigint) {
  return callContract(CONTRACTS.transfer, "deposit", [Cl.uint(amount)]);
}
