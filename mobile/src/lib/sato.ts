// Thin client for Sato's testnet contracts, mobile edition.
//
// Reads and types are shared with web via `@shared/sato-core` so the two
// clients stay in step. Writes go through the on-device embedded wallet
// (`wallet.ts`) — gasless by default, because a fresh embedded wallet holds
// no STX for fees.

import { Cl } from "@stacks/transactions";
import { API, CONTRACTS, DEPLOYER, NETWORK } from "@/config/network";
import { signSponsored } from "@/lib/wallet";
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

const reader = createSatoReader({
  deployer: DEPLOYER,
  network: NETWORK,
  apiUrl: API,
  contracts: CONTRACTS,
});

// --- reads (no wallet needed) --------------------------------------------

export const resolveName = reader.resolveName;
export const getName = reader.getName;
export const isNameAvailable = reader.isNameAvailable;
export const getBalance = reader.getBalance;
export const getEarnStats = reader.getEarnStats;
export const getSponsorStats = reader.getSponsorStats;
export const getTxStatus = reader.getTxStatus;
export const getBalanceHistory = reader.getBalanceHistory;

export function getRecentTransactions(who: string, limit = 25): Promise<SatoTx[]> {
  return reader.getRecentTransactions(who, limit);
}

// --- writes (all gasless — signed on-device, fee paid by the co-signer) ---

// Testnet faucet: credit the caller's own ledger balance with test sBTC — and
// that balance immediately starts earning the base rate. Testnet-only.
export function fundSelf(amount: bigint) {
  return signSponsored(CONTRACTS.ledger, "deposit", [Cl.uint(amount)]);
}

// Send sBTC to a principal or an @username (resolved on-chain first).
export async function send(recipientOrName: string, amount: bigint) {
  const raw = recipientOrName.trim().replace(/^@/, "");
  const recipient = raw.startsWith("S") ? raw : await resolveName(raw);
  if (!recipient) throw new Error("That @username isn't registered.");
  return signSponsored(CONTRACTS.ledger, "send", [Cl.principal(recipient), Cl.uint(amount)]);
}

export function registerName(name: string) {
  return signSponsored(CONTRACTS.names, "register-name", [Cl.stringAscii(name)]);
}

// Lock sats from the liquid balance into the boost tier for `termBlocks`. The
// locked sats leave the liquid balance (they stop earning the base rate and
// start earning the higher boost rate) until the term elapses. One lock at a
// time — claim the current one before opening another.
export function earnLock(amount: bigint, termBlocks: bigint) {
  return signSponsored(CONTRACTS.ledger, "lock", [Cl.uint(amount), Cl.uint(termBlocks)]);
}

// Claim a matured lock: returns the locked principal + accrued boost yield to
// the liquid balance. Reverts on-chain until the unlock height.
export function earnClaim() {
  return signSponsored(CONTRACTS.ledger, "claim-lock", []);
}

// Testnet helper: credit the caller's ledger balance (the faucet) so they have
// sBTC to lock. Same call as fundSelf; kept distinct for the Earn-tab toast.
export function fundEarn(amount: bigint) {
  return signSponsored(CONTRACTS.ledger, "deposit", [Cl.uint(amount)]);
}

// Contribute µSTX to the shared gas pool. The co-signer still covers the FEE,
// but the top-up amount itself is STX debited from this wallet — so unlike the
// other actions this one needs testnet STX on hand (the Gas tab says where to
// get it). Routed gasless anyway so the fee is never the blocker.
export function sponsorTopUp(microStx: bigint) {
  return signSponsored(CONTRACTS.sponsor, "top-up", [Cl.uint(microStx)]);
}
