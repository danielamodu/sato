// The embedded wallet: the app holds the key, so onboarding is instant — no
// external wallet app, no seed prompt up front. The mnemonic lives only in the
// OS keystore via expo-secure-store. This is the piece that replaces the web
// client's `request("stx_callContract")` popup.
//
// SECURITY: keys on-device mean secure storage + a biometric gate + a real
// backup/recovery flow are mandatory before this holds anything of value. The
// backup phrase is revealed once, behind a device-auth prompt, in the UI.

import * as SecureStore from "expo-secure-store";
import { generateSecretKey, generateWallet } from "@stacks/wallet-sdk";
import {
  makeContractCall,
  broadcastTransaction,
  serializeTransaction,
  getAddressFromPrivateKey,
  type ClarityValue,
} from "@stacks/transactions";
import { NETWORK, SPONSOR_ENDPOINT, type ContractRef } from "@/config/network";

const SEED_KEY = "sato.wallet.mnemonic";

type Loaded = { mnemonic: string; privateKey: string; address: string };
let cached: Loaded | null = null;

// Derive the account key + address from the stored mnemonic, creating a wallet
// on first launch. Deferred backup: we generate and store silently so the user
// lands in the app immediately; the UI nudges them to back up before they hold
// real value.
async function load(): Promise<Loaded> {
  if (cached) return cached;
  let mnemonic = await SecureStore.getItemAsync(SEED_KEY);
  if (!mnemonic) {
    mnemonic = generateSecretKey(128); // 12 words
    await SecureStore.setItemAsync(SEED_KEY, mnemonic, {
      keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
    });
  }
  const wallet = await generateWallet({ secretKey: mnemonic, password: "" });
  const privateKey = wallet.accounts[0].stxPrivateKey;
  const address = getAddressFromPrivateKey(privateKey, NETWORK);
  cached = { mnemonic, privateKey, address };
  return cached;
}

export async function hasWallet(): Promise<boolean> {
  return (await SecureStore.getItemAsync(SEED_KEY)) !== null;
}

export async function getAddress(): Promise<string> {
  return (await load()).address;
}

// Reveal the 12-word backup. Gate the CALLER behind expo-local-authentication.
export async function revealMnemonic(): Promise<string> {
  return (await load()).mnemonic;
}

// Destroy the on-device wallet: wipe the seed from the keystore and drop the
// in-memory cache. Irreversible without the backup phrase — the Account screen
// gates this behind an explicit confirm. The next load() mints a fresh wallet.
export async function wipeWallet(): Promise<void> {
  await SecureStore.deleteItemAsync(SEED_KEY);
  cached = null;
}

// Sign locally and broadcast; the user pays their own STX fee. Used only when
// gasless isn't applicable (the user holds STX and opts out of sponsorship).
export async function signAndBroadcast(
  contract: ContractRef,
  functionName: string,
  functionArgs: ClarityValue[],
): Promise<string> {
  const { privateKey } = await load();
  const transaction = await makeContractCall({
    contractAddress: contract.address,
    contractName: contract.name,
    functionName,
    functionArgs,
    senderKey: privateKey,
    network: NETWORK,
  });
  const res = (await broadcastTransaction({ transaction, network: NETWORK })) as {
    txid?: string;
    error?: string;
    reason?: string;
  };
  if (res.error) throw new Error(res.reason || res.error);
  return res.txid!;
}

// Gasless (the default for a zero-STX embedded wallet): sign a `sponsored:true`
// call locally, hand the serialized tx to the co-signer, which sets the fee,
// signs as sponsor, and broadcasts. Proven end to end in spike/sponsored-send.ts.
export async function signSponsored(
  contract: ContractRef,
  functionName: string,
  functionArgs: ClarityValue[],
): Promise<string> {
  const { privateKey } = await load();
  const transaction = await makeContractCall({
    contractAddress: contract.address,
    contractName: contract.name,
    functionName,
    functionArgs,
    senderKey: privateKey,
    network: NETWORK,
    sponsored: true,
    fee: 0,
  });
  const txHex = serializeTransaction(transaction);
  const resp = await fetch(SPONSOR_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ txHex }),
  });
  const data = (await resp.json().catch(() => ({}))) as { txId?: string; error?: string };
  if (!resp.ok || !data.txId) {
    throw new Error(data.error || "Gas sponsor rejected the transaction.");
  }
  return data.txId;
}
