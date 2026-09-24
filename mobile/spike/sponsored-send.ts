// mobile/spike/sponsored-send.ts
//
// Spike: prove the Sato mobile app's EMBEDDED-WALLET gasless-send path end to
// end, minus the sponsor's secret key. This is the RN-agnostic core — the
// fiddly part: locally signing a `sponsored:true` contract call, serializing
// it to hex, and producing a tx the real co-signer will accept.
//
// Run from the repo root:  npx tsx mobile/spike/sponsored-send.ts
//
// It does NOT touch mainnet, spend real value, or handle any secret. It signs
// with a throwaway in-memory key and validates the serialized tx against the
// EXACT validator api/sponsor.ts runs before it ever signs as sponsor.

import {
  Cl,
  makeContractCall,
  deserializeTransaction,
  getAddressFromPrivateKey,
  randomPrivateKey,
  serializeTransaction,
  fetchCallReadOnlyFunction,
  cvToValue,
} from "@stacks/transactions";
import { validateSponsoredTx, originPrincipal } from "../../api/sponsor.ts";

const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
const NETWORK = "testnet" as const;

let pass = 0;
let fail = 0;
const check = (label: string, cond: boolean, detail = "") => {
  console.log(`${cond ? "PASS" : "FAIL"}  ${label}${detail ? ` — ${detail}` : ""}`);
  cond ? pass++ : fail++;
};

async function main() {
  // 1. Embedded wallet: a fresh key the app generates on-device (here, in RAM).
  const key = randomPrivateKey();
  const address = getAddressFromPrivateKey(key, NETWORK);
  check("derive a testnet address from a fresh key", address.startsWith("ST"), address);

  // 2. Build the gasless send exactly as the RN app will: a `sponsored:true`
  //    contract call to sato-transfer.send, signed by the user (origin) only.
  const tx = await makeContractCall({
    contractAddress: DEPLOYER,
    contractName: "sato-transfer",
    functionName: "send",
    functionArgs: [Cl.principal(DEPLOYER), Cl.uint(1000)],
    senderKey: key,
    network: NETWORK,
    sponsored: true,
    fee: 0,
    nonce: 0,
  });

  // 3. Serialize to the hex the co-signer endpoint expects (POST { txHex }).
  const txHex = serializeTransaction(tx);
  check(
    "serialize the signed sponsored tx to hex",
    typeof txHex === "string" && txHex.length > 0,
    `${txHex.length} hex chars`
  );

  // 4. Round-trip through the co-signer's own deserialize + validator. If this
  //    passes, /api/sponsor will accept the tx and only need to add its fee.
  const decoded = deserializeTransaction(txHex);
  const verdict = validateSponsoredTx(decoded);
  check(
    "real co-signer validator accepts the tx",
    verdict.ok === true,
    verdict.ok ? `${verdict.contract}.${verdict.fn}` : verdict.error
  );

  // 5. The co-signer recovers the SAME origin principal it will rate-limit.
  const who = originPrincipal(decoded);
  check("origin principal round-trips to the signer", who === address, who);

  // 6. Prove real testnet connectivity (reads need no wallet, no gas).
  try {
    const cv = await fetchCallReadOnlyFunction({
      contractAddress: DEPLOYER,
      contractName: "sato-transfer",
      functionName: "get-balance",
      functionArgs: [Cl.principal(DEPLOYER)],
      senderAddress: DEPLOYER,
      network: NETWORK,
    });
    const bal = cvToValue(cv);
    check("read live testnet state (deployer sBTC balance)", bal !== undefined, `${bal} sats`);
  } catch (e) {
    check("read live testnet state (deployer sBTC balance)", false, String(e));
  }

  console.log(`\n${fail === 0 ? "ALL GREEN" : "FAILURES"}: ${pass} passed, ${fail} failed`);
  // Set the code and let the event loop drain — calling process.exit() while
  // the fetch socket is still closing trips a libuv assertion on Windows.
  process.exitCode = fail === 0 ? 0 : 1;
}

main().catch((e) => {
  console.error("spike crashed:", e);
  process.exitCode = 1;
});
