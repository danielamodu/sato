import { useState } from "react";
import { ArrowRight, Check, Key, ShieldCheck, Zap, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const STEPS = [
  {
    id: 1,
    title: "1. Client Construction & Origin Sign",
    actor: "Mobile / Web Client",
    desc: "The client prepares a contract call transaction with AuthType.Sponsored. The user signs with their private key, but leaves fee = 0 and sponsor nonce blank.",
    code: `const tx = await makeContractCall({
  contractAddress: "ST3Y94K...",
  contractName: "sato-yield-v3",
  functionName: "send",
  functionArgs: [recipientCV, amountCV],
  sponsored: true, // Wallet signs without broadcasting
  fee: 0n,
});
const rawHex = tx.serialize();
await fetch("/api/sponsor", { method: "POST", body: { txHex: rawHex } });`,
  },
  {
    id: 2,
    title: "2. Serverless Verification & Rate Limit",
    actor: "Vercel API (/api/sponsor)",
    desc: "The server deserializes the transaction, verifies that the target contract is on the Sato allowlist, extracts the origin principal, and enforces the sliding window rate limit via Redis.",
    code: `// Verify allowlist & contract target
const tx = deserializeTransaction(txHex);
if (!ALLOWED_CONTRACTS.includes(targetContract)) {
  return res.status(403).json({ error: "Unauthorized target contract" });
}

// Atomic Redis rate limit: 200 sponsored txs / 24h
const usage = await redis.incr(\`sponsor:\${originPrincipal}\`);
if (usage > 200) {
  return res.status(429).json({ error: "Sponsorship quota exceeded" });
}`,
  },
  {
    id: 3,
    title: "3. Sponsor Co-Signing",
    actor: "Sponsor Wallet",
    desc: "The server attaches a fixed gas fee of 50,000 µSTX (0.05 STX) and co-signs using the server's SPONSOR_KEY. The client can never manipulate the gas fee.",
    code: `// Co-sign with server-held sponsor key
const sponsorKey = process.env.SPONSOR_KEY;
const sponsoredTx = await sponsorTransaction({
  transaction: tx,
  sponsorPrivateKey: sponsorKey,
  fee: 50000n, // Fixed 0.05 STX
});`,
  },
  {
    id: 4,
    title: "4. Stacks Node Broadcast & State Update",
    actor: "Stacks Testnet Node",
    desc: "The fully signed transaction is broadcast to the Stacks testnet mempool. Once confirmed in a block, the on-chain sato-sponsor contract records the gas usage.",
    code: `const broadcastResponse = await broadcastTransaction(sponsoredTx);
// Returns txid to client:
// 0x61811b57d75caf56157266f436bb8e3ab79c81b...
return res.json({ txid: broadcastResponse.txid });`,
  },
];

export function SponsorDiagram() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <div className="my-8 rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
        <div>
          <h3 className="text-base font-bold text-foreground">Interactive Two-Phase Gasless Co-Signing</h3>
          <p className="text-xs text-muted-foreground">Click through the protocol stages to see how users send transactions with zero STX.</p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="size-3.5" />
          <span>Zero-Gas Protocol</span>
        </span>
      </div>

      {/* Step Buttons */}
      <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
        {STEPS.map((step, idx) => {
          const isActive = activeStep === idx;
          return (
            <button
              key={step.id}
              onClick={() => setActiveStep(idx)}
              className={`flex flex-col items-start rounded-xl border p-3 text-left transition-all ${
                isActive
                  ? "border-primary bg-primary/5 shadow-xs"
                  : "border-border/70 bg-background/50 hover:border-border hover:bg-background"
              }`}
            >
              <span className={`text-[11px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}>
                Step {step.id}
              </span>
              <span className="mt-1 text-xs font-semibold text-foreground line-clamp-1">{step.actor}</span>
            </button>
          );
        })}
      </div>

      {/* Active Step Details */}
      <div className="mt-5 rounded-xl border border-border/80 bg-background/80 p-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeStep}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-primary px-2 py-0.5 text-[11px] font-bold text-white">
                {STEPS[activeStep].actor}
              </span>
              <h4 className="font-semibold text-foreground text-sm">{STEPS[activeStep].title}</h4>
            </div>

            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{STEPS[activeStep].desc}</p>

            <div className="mt-4 overflow-hidden rounded-lg border border-border bg-[#0d1117] p-3 font-mono text-xs text-zinc-200">
              <pre className="overflow-x-auto m-0">
                <code>{STEPS[activeStep].code}</code>
              </pre>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
