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

// Resolve a @username to the principal that owns it (null if unregistered).
export async function resolveName(name: string): Promise<string | null> {
  const cv = await readOnly(
    CONTRACTS.names,
    "resolve-name",
    [Cl.stringAscii(name)],
    DEPLOYER
  );
  // returns (optional principal): some -> principal, none -> null
  const val = cvToValue(cv);
  return val ?? null;
}

// Look up the username a principal has registered (null if none).
export async function getName(owner: string): Promise<string | null> {
  const cv = await readOnly(
    CONTRACTS.names,
    "get-name",
    [Cl.principal(owner)],
    owner
  );
  const val = cvToValue(cv);
  return val ?? null;
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
