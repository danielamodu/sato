import { useState } from "react";
import {
  ExternalLink,
  Shield,
  Zap,
  Coins,
  CheckCircle,
  Smartphone,
  CreditCard,
  Layers,
  ArrowRight,
  Sparkles,
  MousePointerClick,
  Sliders,
  ToggleLeft,
  LayoutTemplate,
} from "lucide-react";
import { CONTRACTS, DEPLOYER_ADDRESS } from "../data/contracts";
import { ContractCard } from "./ContractCard";
import { CodeBlock } from "./CodeBlock";
import { SponsorDiagram } from "./SponsorDiagram";

// Interactive Playgrounds
import { ComponentPreview } from "./playground/ComponentPreview";
import { InteractiveButtons, BUTTONS_CODE } from "./playground/InteractiveButtons";
import { InteractiveToggles, TOGGLE_CODE } from "./playground/InteractiveToggles";
import { InteractivePaymentCard, PAYMENT_CODE } from "./playground/InteractivePaymentCard";
import { InteractiveMorphTabs, TABS_CODE } from "./playground/InteractiveMorphTabs";
import { InteractiveDialogShowcase, DIALOG_CODE } from "./playground/InteractiveDialogShowcase";

export function DocContent({
  activeSection,
  onNavigate,
}: {
  activeSection: string;
  onNavigate?: (id: string) => void;
}) {
  const yieldContract = CONTRACTS.find((c) => c.id === "sato-yield-v3")!;
  const namesContract = CONTRACTS.find((c) => c.id === "sato-names")!;
  const sponsorContract = CONTRACTS.find((c) => c.id === "sato-sponsor")!;
  const vaultContract = CONTRACTS.find((c) => c.id === "sato-vault")!;

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 md:px-8 md:py-12">
      {/* 1. OVERVIEW & LIVING PLAYGROUND */}
      {activeSection === "overview" && (
        <section id="overview" className="space-y-10 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              <span>Interactive Component Lab & Documentation</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Sato Interactive Design System & Architecture
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Every component on this page is a <strong>living, interactive primitive</strong> built with tactile spring physics,
              shadcn design tokens, and real Stacks blockchain logic. Click, toggle, and test them live.
            </p>
          </div>

          {/* Quick jump pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground mr-1">Jump to:</span>
            {[
              { id: "contracts-yield-v3", label: "Smart Contracts" },
              { id: "gasless", label: "Gasless Protocol" },
              { id: "wallet", label: "Mobile Wallet" },
              { id: "bills", label: "Bill Rails" },
            ].map((pill) => (
              <button
                key={pill.id}
                onClick={() => onNavigate?.(pill.id)}
                className="rounded-lg border border-border bg-card px-2.5 py-1 text-foreground hover:border-primary/50 hover:bg-muted transition-all"
              >
                {pill.label} →
              </button>
            ))}
          </div>

          {/* PLAYGROUND 1: Interactive Payment Simulator */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <MousePointerClick className="size-4 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Interactive Payment Terminal</h2>
            </div>
            <ComponentPreview
              title="Gasless Send Terminal"
              description="Type an @username, slide the sBTC amount, and test the 2-phase co-signing flow live."
              code={PAYMENT_CODE}
            >
              <InteractivePaymentCard />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 2: Tactile Evil Buttons */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Zap className="size-4 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Tactile Spring Buttons (EvilButtons style)</h2>
            </div>
            <ComponentPreview
              title="Spring Resistance & Async State Buttons"
              description="Buttons with physical spring stiffness (450), particle burst haptics, and async loading states."
              code={BUTTONS_CODE}
            >
              <InteractiveButtons />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 3: Tactile Toggles */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <ToggleLeft className="size-4 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Physical Switches (Toggle.supply style)</h2>
            </div>
            <ComponentPreview
              title="Spring Switches & Haptic Toggles"
              description="Physics-based spring switches with layout morphing and hardware enclave toggles."
              code={TOGGLE_CODE}
            >
              <InteractiveToggles />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 4: Morphing Layout Tabs */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <LayoutTemplate className="size-4 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Morphing Layout Tabs (Tween-UI / Morphin)</h2>
            </div>
            <ComponentPreview
              title="Gliding Pill Navigation"
              description="Framer Motion layoutId tabs with spring velocity transitions."
              code={TABS_CODE}
            >
              <InteractiveMorphTabs />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 5: Interactive Dialog Modal */}
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Shield className="size-4 text-primary" />
              <h2 className="text-lg font-bold text-foreground">Hardware Enclave Key Vault Modal</h2>
            </div>
            <ComponentPreview
              title="Spring Modal & Backdrop Blur"
              description="Accessible dialog primitive with smooth spring entry/exit and keychain details."
              code={DIALOG_CODE}
            >
              <InteractiveDialogShowcase />
            </ComponentPreview>
          </div>

          {/* Core Pillars */}
          <div className="border-t border-border pt-8">
            <h2 className="text-lg font-bold text-foreground">Core Product Pillars</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Zap className="size-4" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-foreground">Zero Gas Friction</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  All transactions are co-signed via Sato's sponsored gas pool. Users never touch or hold STX.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                <div className="flex size-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                  <Coins className="size-4" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-foreground">Continuous Yield</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Holding sBTC in Sato automatically earns yield calculated on every Stacks block without deposit locks.
                </p>
              </div>

              <div className="rounded-2xl border border-border bg-card p-5 shadow-xs">
                <div className="flex size-9 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-500">
                  <CreditCard className="size-4" />
                </div>
                <h3 className="mt-3 text-sm font-bold text-foreground">Real-World Utility</h3>
                <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                  Integrated with VTPass to pay Nigerian utility bills, buy airtime, and withdraw directly to bank rails.
                </p>
              </div>
            </div>
          </div>
        </section>
      )}

      {/* 2. ARCHITECTURE */}
      {activeSection === "architecture" && (
        <section id="architecture" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Layers className="size-3.5" />
              <span>System Design</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              System Architecture
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sato operates across three primary layers: an on-device embedded mobile client, a gasless Vercel
              serverless co-signer, and Clarity smart contracts on Stacks.
            </p>
          </div>

          {/* ASCII / Monospace Flow Diagram */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-[#0d1117] p-5 font-mono text-xs text-zinc-300 shadow-md">
            <pre className="m-0 leading-relaxed">
{`┌───────────────────────────┐    ┌───────────────────────────┐
│     Mobile App (Expo)     │    │      Web Dapp (Vite)      │
│  • On-Device Secure Store │    │  • Stacks Connect v8      │
│  • Gasless by Default     │    │  • Hiro / Leather Wallet  │
└─────────────┬─────────────┘    └─────────────┬─────────────┘
              │                                │
              └───────────────┬────────────────┘
                              ▼
        ┌───────────────────────────────────────────┐
        │       Vercel Serverless Relay (/api)      │
        │  • /api/sponsor (co-sign with SPONSOR_KEY)│
        │  • /api/pay     (VTPass utility proxy)    │
        │  • /api/offramp (sBTC -> NGN orders)      │
        └─────────────────────┬─────────────────────┘
                              ▼
        ┌───────────────────────────────────────────┐
        │            Stacks Testnet Node            │
        │  • sato-yield-v3 (sBTC yield ledger)      │
        │  • sato-names    (@username registry)     │
        │  • sato-sponsor  (gas pool allowance)     │
        │  • sato-vault    (SIP-010 sBTC custody)   │
        └───────────────────────────────────────────┘`}
            </pre>
          </div>

          {/* Deployed Contracts Table */}
          <div>
            <h3 className="text-base font-bold text-foreground">Verified Testnet Deployments</h3>
            <div className="mt-3 overflow-hidden rounded-xl border border-border">
              <table className="w-full text-left text-xs">
                <thead className="border-b border-border bg-muted/50 font-semibold text-muted-foreground">
                  <tr>
                    <th className="p-3">Contract</th>
                    <th className="p-3">Version</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Explorer</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {CONTRACTS.map((c) => (
                    <tr key={c.id} className="hover:bg-muted/30 transition-colors">
                      <td className="p-3 font-mono font-bold text-foreground">{c.name}</td>
                      <td className="p-3 font-mono text-muted-foreground">{c.version}</td>
                      <td className="p-3 text-muted-foreground">{c.purpose}</td>
                      <td className="p-3">
                        <a
                          href={c.explorerUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-medium text-primary hover:underline"
                        >
                          <span>View</span>
                          <ExternalLink className="size-3" />
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* 3. QUICKSTART */}
      {activeSection === "quickstart" && (
        <section id="quickstart" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Zap className="size-3.5" />
              <span>Development</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Local Development & Testing
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Clone the repository and run the full 99-test Clarity test suite via Clarinet SDK and Vitest.
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground">1. Install Dependencies</h3>
            <CodeBlock
              language="bash"
              code={`# Clone the repository
git clone https://github.com/danielamodu/sato.git
cd sato

# Install packages using pnpm
pnpm install`}
            />

            <h3 className="pt-4 text-sm font-bold text-foreground">2. Run the Clarity Test Suite</h3>
            <CodeBlock
              language="bash"
              code={`# Run all 99 Vitest Clarity test suites
pnpm test

# Output preview:
# ✓ tests/sato-names.test.ts (11 tests)
# ✓ tests/sato-sponsor.test.ts (15 tests)
# ✓ tests/sato-vault.test.ts (10 tests)
# ✓ tests/sato-yield-v3.test.ts (10 tests)
# ✓ tests/sato-yield-v2.test.ts (14 tests)`}
            />

            <h3 className="pt-4 text-sm font-bold text-foreground">3. Launch the Local Dev Server</h3>
            <CodeBlock
              language="bash"
              code={`# Start the Vite development app on port 3000
pnpm dev

# Start the documentation server on port 3001
pnpm docs:dev`}
            />
          </div>
        </section>
      )}

      {/* 4. SMART CONTRACTS */}
      {activeSection === "contracts-yield-v3" && (
        <section id="contracts-yield-v3" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Core Contracts</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-yield-v3
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Yield-bearing sBTC ledger where liquid balances continuously accrue base interest every block, and users can
              lock funds for boosted yield terms.
            </p>
          </div>

          <ContractCard contract={yieldContract} />

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground">TypeScript SDK Example</h3>
            <CodeBlock
              language="typescript"
              code={`import { sendSbtc, depositYield, getEarnStats } from "@/lib/sato";

// 1. Fetch real-time live yield stats
const stats = await getEarnStats(userAddress);
console.log("Live Balance:", stats.balance);
console.log("Base Rate APR:", stats.baseRateBps / 100, "%");

// 2. Transfer sBTC (automatically settles yield for both parties)
await sendSbtc(recipientAddress, 50000n);`}
            />
          </div>
        </section>
      )}

      {activeSection === "contracts-names" && (
        <section id="contracts-names" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Identity</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-names
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Bijective on-chain registry mapping `@usernames` to Stacks principals for instant human-readable addressing.
            </p>
          </div>

          <ContractCard contract={namesContract} />

          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-bold text-foreground">TypeScript SDK Example</h3>
            <CodeBlock
              language="typescript"
              code={`import { registerName, resolveUsername, lookupName } from "@/lib/sato";

// Register an @username
await registerName("alice");

// Forward lookup: @alice -> ST3Y94K...
const owner = await resolveUsername("alice");

// Reverse lookup: ST3Y94K... -> alice
const myName = await lookupName(userAddress);`}
            />
          </div>
        </section>
      )}

      {activeSection === "contracts-sponsor" && (
        <section id="contracts-sponsor" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Gasless Infra</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-sponsor
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Sponsored-transaction gas pool with sliding 144-block rate limiting (10 STX maximum allowance per user per window).
            </p>
          </div>

          <ContractCard contract={sponsorContract} />
        </section>
      )}

      {activeSection === "contracts-vault" && (
        <section id="contracts-vault" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Real sBTC Custody</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-vault
            </h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Custody vault moving canonical SIP-010 sBTC tokens with token pinning to prevent arbitrary trait substitution.
            </p>
          </div>

          <ContractCard contract={vaultContract} />
        </section>
      )}

      {/* 5. GASLESS INFRASTRUCTURE */}
      {activeSection === "gasless" && (
        <section id="gasless" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Zap className="size-3.5" />
              <span>Two-Phase Protocol</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Gasless Co-Signing Architecture
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              How Sato delivers transactions to users without requiring them to purchase, hold, or calculate STX gas fees.
            </p>
          </div>

          <SponsorDiagram />

          <div className="space-y-4">
            <h3 className="text-base font-bold text-foreground">Security Controls in /api/sponsor</h3>
            <ul className="space-y-2.5 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>
                  <strong>Strict Target Allowlist:</strong> Only pre-approved Sato contracts (`sato-yield-v3`, `sato-names`,
                  `sato-sponsor`) can be called. Attacks attempting to drain unrelated contracts are rejected.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>
                  <strong>Fixed Server Fee:</strong> The server hardcodes `fee: 50,000 µSTX` (0.05 STX). The client cannot
                  specify an arbitrary gas fee.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle className="size-4 shrink-0 text-emerald-500 mt-0.5" />
                <span>
                  <strong>Atomic Redis Rate Limit:</strong> Atomic INCR on `sponsor:{principal}` enforces a 200 transaction per
                  24h cap, preventing mempool spam.
                </span>
              </li>
            </ul>
          </div>
        </section>
      )}

      {/* 6. MOBILE EMBEDDED WALLET */}
      {activeSection === "wallet" && (
        <section id="wallet" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Smartphone className="size-3.5" />
              <span>Mobile Client</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Mobile Embedded Wallet
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              A zero-friction React Native embedded wallet built with Expo, generating and securing keypairs on-device
              with hardware enclave backing.
            </p>
          </div>

          <ComponentPreview
            title="Interactive Keychain Vault Modal"
            description="Test the hardware enclave key storage modal."
            code={DIALOG_CODE}
          >
            <InteractiveDialogShowcase />
          </ComponentPreview>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">Zero Seed-Phrase Onboarding</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                On first launch, `@stacks/wallet-sdk` generates a 12-word mnemonic silently in milliseconds. The user enters
                an `@username` and starts transacting immediately.
              </p>
            </div>
            <div className="rounded-xl border border-border bg-card p-5">
              <h3 className="text-sm font-bold text-foreground">Hardware Enclave Storage</h3>
              <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                Secured via `expo-secure-store` with `WHEN_UNLOCKED_THIS_DEVICE_ONLY` accessibility flags, ensuring the seed
                never leaves the device unencrypted.
              </p>
            </div>
          </div>
        </section>
      )}

      {/* 7. BILLS & OFFRAMP */}
      {(activeSection === "bills" || activeSection === "offramp" || activeSection === "api-reference") && (
        <section className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <CreditCard className="size-3.5" />
              <span>Local Fiat Rails</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {activeSection === "bills" ? "Nigerian Utility Bills (VTPass)" : "Naira Offramp & APIs"}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              How Sato bridges sBTC directly into Nigerian local currency and daily utility services.
            </p>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="text-sm font-bold text-foreground">Quote & Verification Architecture</h3>
            <div className="mt-3 space-y-2 text-xs text-muted-foreground">
              <p>
                <strong>1. HMAC-Signed Quotes:</strong> Server queries live CoinGecko BTC/NGN rates, adds a spread (150 bps
                bills, 200 bps offramp), and signs the payload with SHA-256 HMAC (20-minute expiry).
              </p>
              <p>
                <strong>2. Independent Verification:</strong> Before fulfilling any bill or payout, the server queries the
                Hiro API to verify the on-chain transfer arrived at the treasury.
              </p>
              <p>
                <strong>3. Idempotency Guard:</strong> Redis `SET NX EX` prevents duplicate processing of the same transaction
                hash.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground">API Endpoints</h3>
            <div className="mt-3 space-y-3 font-mono text-xs">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-emerald-500">POST</span> <span className="text-foreground">/api/sponsor</span> — Relay & co-sign partially-signed transactions
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-blue-500">POST</span> <span className="text-foreground">/api/pay</span> — Bill payment fulfillment via VTPass
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-amber-500">POST</span> <span className="text-foreground">/api/offramp</span> — Quote & confirm sBTC to Naira payouts
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-purple-500">POST</span> <span className="text-foreground">/api/waitlist</span> — Rate-limited email waitlist with honeypot validation
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
