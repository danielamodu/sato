// sato.ts — thin client for Sato's live testnet contracts.
//
// Reads and types are shared with mobile via `@shared/sato-core` so the two
// clients cannot drift. Writes go through the connected web wallet via
// @stacks/connect's `request("stx_callContract")`.

import { Cl, type ClarityValue } from "@stacks/transactions";
import { request } from "@stacks/connect";
import {
  createSatoReader,
  YIELD_BLOCKS_PER_YEAR,
  type SatoTx,
  type BalanceEvent,
  type EarnStats,
  type SponsorStats,
  type TxState,
} from "@shared/sato-core";

export {
  YIELD_BLOCKS_PER_YEAR,
  type SatoTx,
  type BalanceEvent,
  type EarnStats,
  type SponsorStats,
  type TxState,
};

// Deployer of the live testnet contracts.
export const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
export const NETWORK = "testnet" as const;

export const CONTRACTS = {
  names: { address: DEPLOYER, name: "sato-names" },
  // The yield-bearing ledger. It IS the wallet: balances live here, and simply
  // holding sBTC earns the base rate. Supersedes sato-transfer + sato-yield-v2.
  ledger: { address: DEPLOYER, name: "sato-yield-v3" },
  sponsor: { address: DEPLOYER, name: "sato-sponsor" },
} as const;

// Where "Pay bills" payments land. A bill is a normal ledger `send` of sBTC to
// this principal; api/pay.ts then verifies that payment on-chain and fulfills
// the bill via VTPass. Keep in step with the server's SATO_TREASURY_ADDRESS
// (defaults to the deployer for the demo).
export const TREASURY = DEPLOYER;

const API = "https://api.testnet.hiro.so";

const reader = createSatoReader({
  deployer: DEPLOYER,
  network: NETWORK,
  apiUrl: API,
  contracts: CONTRACTS,
});

// --- reads (no wallet) ---------------------------------------------------

export const resolveName = reader.resolveName;
export const getName = reader.getName;
export const isNameAvailable = reader.isNameAvailable;
export const getBalance = reader.getBalance;
export const getRecentTransactions = reader.getRecentTransactions;
export const getTxStatus = reader.getTxStatus;
export const getBalanceHistory = reader.getBalanceHistory;
export const getEarnStats = reader.getEarnStats;
export const getSponsorStats = reader.getSponsorStats;

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
  return callContract(CONTRACTS.ledger, "send", [
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
  return sponsoredCall(CONTRACTS.ledger, "send", [
    Cl.principal(recipient),
    Cl.uint(amount),
  ]);
}

// Ask the connected wallet to sign a plain-text authorization message (used to
// prove ownership of a treasury payment before bill/offramp fulfillment).
export async function signAuthMessage(message: string): Promise<string> {
  const res = await request("stx_signMessage", { message });
  const sig = (res as { signature?: string })?.signature;
  if (!sig) throw new Error("Wallet did not return a signature.");
  return sig;
}

// Devnet/testnet faucet: credit the caller's own balance so they have
// something to send. Backed by the ledger's mint helper — and that balance
// immediately starts earning the base rate.
export function fundSelf(amount: bigint) {
  return callContract(CONTRACTS.ledger, "deposit", [Cl.uint(amount)]);
}

// --- earn (sato-yield-v3: auto-earning ledger + optional lock tier) -------

// Lock sats from the liquid balance into the boost tier for `termBlocks`. The
// locked sats leave the liquid balance (they stop earning the base rate and
// start earning the higher boost rate) until the term elapses. One lock at a
// time — claim the current one before opening another.
export function earnLock(amount: bigint, termBlocks: bigint) {
  return callContract(CONTRACTS.ledger, "lock", [
    Cl.uint(amount),
    Cl.uint(termBlocks),
  ]);
}

// Claim a matured lock: returns the locked principal + accrued boost yield to
// the liquid balance. Reverts on-chain until the unlock height.
export function earnClaim() {
  return callContract(CONTRACTS.ledger, "claim-lock", []);
}

// Testnet helper: credit the caller's ledger balance (the faucet) so they have
// sBTC to lock. Same call as fundSelf; kept distinct for the Earn-tab toast.
export function fundEarn(amount: bigint) {
  return callContract(CONTRACTS.ledger, "deposit", [Cl.uint(amount)]);
}

// Chip micro-STX into the shared gas pool. Permissionless — anyone can
// help cover everyone's transaction fees.
export function sponsorTopUp(microStx: bigint) {
  return callContract(CONTRACTS.sponsor, "top-up", [Cl.uint(microStx)]);
}
