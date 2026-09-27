// migrate-to-v3.mjs — one-time carry-over of legacy balances into sato-yield-v3.
//
// sato-transfer (wallet) and sato-yield-v2 (earn) are separate ledgers; the v3
// rewire pointed the app at a fresh ledger, so everyone read as zero. This
// reads each holder's authoritative balance across BOTH legacy contracts and
// generates a clarinet deployment plan that mints the shortfall into v3, so
// balances carry over. Idempotent: it only mints (legacy - current v3), so a
// re-run credits nothing once everyone is topped up.
//
//   node scripts/migrate-to-v3.mjs         # discover + write the plan
// then broadcast the generated plan with clarinet:
//   clarinet deployments apply -p deployments/migrate-v3.testnet-plan.yaml -d --no-dashboard

import { Cl, cvToValue, fetchCallReadOnlyFunction } from "@stacks/transactions";
import { writeFileSync } from "node:fs";

const API = "https://api.testnet.hiro.so";
const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";
const V3 = "sato-yield-v3";
const LEGACY = ["sato-transfer", "sato-yield-v2"];
const PLAN_PATH = "deployments/migrate-v3.testnet-plan.yaml";
const FEE = 100000; // uSTX per mint call — ample for a simple contract-call

const toBig = (v) => {
  try {
    return BigInt(typeof v === "object" && v && "value" in v ? v.value : v);
  } catch {
    return 0n;
  }
};
const fmt = (n) => n.toLocaleString("en-US");

async function readUint(name, fn, args) {
  try {
    const cv = await fetchCallReadOnlyFunction({
      contractAddress: DEPLOYER,
      contractName: name,
      functionName: fn,
      functionArgs: args,
      senderAddress: DEPLOYER,
      network: "testnet",
    });
    return toBig(cvToValue(cv));
  } catch {
    return 0n;
  }
}

// Every principal that ever appears in a contract's print events — the superset
// of holders. We read authoritative balances afterward, so extras are harmless.
async function holdersOf(name) {
  const set = new Set();
  const limit = 50;
  for (let offset = 0; offset < 2000; offset += limit) {
    const res = await fetch(
      `${API}/extended/v1/contract/${DEPLOYER}.${name}/events?limit=${limit}&offset=${offset}`
    );
    if (!res.ok) break;
    const rows = (await res.json())?.results ?? [];
    for (const ev of rows) {
      if (ev?.event_type !== "smart_contract_log") continue;
      const repr = ev.contract_log?.value?.repr ?? "";
      // Standard principals only ('S...); skip contract principals ('S....name).
      for (const m of repr.matchAll(/'(S[TP][0-9A-Z]{20,})(\.[a-z0-9-]+)?/g)) {
        if (!m[2]) set.add(m[1]);
      }
    }
    if (rows.length < limit) break;
  }
  return set;
}

async function main() {
  const holders = new Set();
  for (const c of LEGACY) (await holdersOf(c)).forEach((h) => holders.add(h));

  const rows = [];
  for (const p of holders) {
    let legacy = 0n;
    for (const c of LEGACY) legacy += await readUint(c, "get-balance", [Cl.principal(p)]);
    const v3 = await readUint(V3, "get-balance", [Cl.principal(p)]);
    rows.push({ p, legacy, v3, delta: legacy > v3 ? legacy - v3 : 0n });
  }
  rows.sort((a, b) => (b.delta > a.delta ? 1 : b.delta < a.delta ? -1 : 0));

  console.log(`\nFound ${rows.length} holder(s) across ${LEGACY.join(" + ")}:\n`);
  for (const r of rows) {
    console.log(
      `  ${r.p}\n    legacy ${fmt(r.legacy)}  ·  v3 now ${fmt(r.v3)}  ·  mint ${fmt(r.delta)} sats`
    );
  }

  const toMint = rows.filter((r) => r.delta > 0n);
  const total = toMint.reduce((s, r) => s + r.delta, 0n);
  console.log(`\n→ ${toMint.length} holder(s) to credit, ${fmt(total)} sats total.`);

  if (toMint.length === 0) {
    console.log("Nothing to migrate — everyone is already topped up. No plan written.");
    return;
  }

  const txs = toMint
    .map(
      (r) => `    - transaction-type: contract-call
      contract-id: ${DEPLOYER}.${V3}
      method: mint
      parameters:
        - "'${r.p}"
        - u${r.delta}
      expected-sender: ${DEPLOYER}
      cost: ${FEE}
      anchor-block-only: false`
    )
    .join("\n");

  const plan = `id: 0
name: Migrate legacy balances into sato-yield-v3
network: testnet
stacks-node: ${API}
bitcoin-node: http://blockstack:blockstacksystem@bitcoind.testnet.stacks.co:18332
plan:
  batches:
  - id: 0
    transactions:
${txs}
    epoch: '3.4'
`;
  writeFileSync(PLAN_PATH, plan);
  console.log(`\nWrote ${PLAN_PATH}. Review it, then broadcast with:`);
  console.log(`  clarinet deployments apply -p ${PLAN_PATH} -d --no-dashboard`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
