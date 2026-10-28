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
  Info,
  HelpCircle,
  Lock,
  ArrowLeftRight,
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
      {/* =========================================================================
          1. OVERVIEW & VISION
      ========================================================================= */}
      {activeSection === "overview" && (
        <section id="overview" className="space-y-10 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Sparkles className="size-3.5" />
              <span>Introduction</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              What is Sato?
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Sato is a Bitcoin mobile payment app built on Stacks. It lets regular people send sBTC to anyone by{" "}
              <strong className="text-foreground">@username</strong>, automatically earn interest on their balance every block,
              and cash out to their local currency (Naira) to pay electricity bills, buy airtime, or send to a bank account.
            </p>
          </div>

          {/* Plain English Problem & Solution */}
          <div className="rounded-2xl border border-border bg-card p-6 shadow-xs space-y-4">
            <h2 className="text-base font-bold text-foreground">The Real-World Problem in Plain English</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Sending money across borders in Africa is notoriously slow and expensive (often eating 7% to 15% in fees). 
              Crypto fixes the rails, but the user experience is broken for normal people:
            </p>
            <ul className="space-y-2 text-xs text-muted-foreground list-disc list-inside">
              <li>Nobody wants to copy-paste a 42-character hex address like <code className="text-foreground font-mono">SP3Y94KSPM...</code>. One wrong character and your money is gone.</li>
              <li>Nobody wants to buy STX or ETH just to pay "gas fees" before they can send a $10 payment to their friend.</li>
              <li>Nobody wants to write down a 12-word seed phrase on paper just to try out an app.</li>
            </ul>
            <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 mt-3">
              <h3 className="text-xs font-bold text-primary uppercase tracking-wider">How Sato Solves This:</h3>
              <p className="mt-1 text-xs text-foreground leading-relaxed">
                You download the app. In less than 2 seconds, a secure wallet is created silently on your device. You pick an 
                <strong> @username</strong>. To pay someone, you just type their name, enter an amount, and tap send. 
                You never see a gas fee, and you never touch a hex address.
              </p>
            </div>
          </div>

          {/* Quick jump pills */}
          <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
            <span className="text-muted-foreground mr-1">Deep dives:</span>
            {[
              { id: "contracts-yield-v3", label: "Smart Contracts" },
              { id: "gasless", label: "How Gasless Works" },
              { id: "wallet", label: "Mobile Wallet Security" },
              { id: "bills", label: "Paying Bills with sBTC" },
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

          {/* Interactive Playgrounds Header */}
          <div className="border-t border-border pt-8 space-y-3">
            <h2 className="text-xl font-bold text-foreground">Interactive Component Lab</h2>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Below are the live UI building blocks used across Sato. Every component below has real state and micro-interactions.
              You can play with them live and switch to the <strong>Code</strong> tab to see the exact code.
            </p>
          </div>

          {/* PLAYGROUND 1: Payment Simulator */}
          <div>
            <ComponentPreview
              title="1. Interactive Payment Terminal"
              description="Test how the user experience looks: type an @username, slide the amount, and tap Send to see the gasless flow."
              code={PAYMENT_CODE}
            >
              <InteractivePaymentCard />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 2: Tactile Evil Buttons */}
          <div>
            <ComponentPreview
              title="2. Spring-Weighted Buttons (EvilButtons Style)"
              description="Buttons built with physical resistance physics (stiffness 450). Tap to feel the spring bounce, particle bursts, and loading spinners."
              code={BUTTONS_CODE}
            >
              <InteractiveButtons />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 3: Tactile Toggles */}
          <div>
            <ComponentPreview
              title="3. Tactile Spring Switches (Toggle.supply Style)"
              description="Physical toggles for settings like Auto-Yield and Gas Sponsorship with smooth spring animation."
              code={TOGGLE_CODE}
            >
              <InteractiveToggles />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 4: Morphing Layout Tabs */}
          <div>
            <ComponentPreview
              title="4. Morphing Navigation Tabs (Tween-UI / Morphin Style)"
              description="Click between environments to watch the selection pill glide smoothly with spring inertia."
              code={TABS_CODE}
            >
              <InteractiveMorphTabs />
            </ComponentPreview>
          </div>

          {/* PLAYGROUND 5: Dialog Modal */}
          <div>
            <ComponentPreview
              title="5. Hardware Enclave Key Vault Modal"
              description="Click to open the hardware security modal with blurred backdrop and spring entry."
              code={DIALOG_CODE}
            >
              <InteractiveDialogShowcase />
            </ComponentPreview>
          </div>
        </section>
      )}

      {/* =========================================================================
          2. ARCHITECTURE
      ========================================================================= */}
      {activeSection === "architecture" && (
        <section id="architecture" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Layers className="size-3.5" />
              <span>System Design</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              System Architecture Explained
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              How the mobile app, the serverless co-signer, and the Stacks blockchain work together to make transactions instant and free for the user.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">The 3 Moving Parts</h2>
            
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <div className="rounded-xl border border-border/70 p-4 bg-muted/20">
                <strong className="text-foreground text-sm block">1. The Client (React Native Mobile + Web Dapp)</strong>
                <p className="mt-1">
                  The user holds their own Bitcoin keypair. On mobile, this key is generated on the phone and locked inside
                  the device's hardware Secure Enclave. When you tap "Send", the phone signs the transfer details with your key.
                  Crucially, it leaves the <em>gas fee</em> empty.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 p-4 bg-muted/20">
                <strong className="text-foreground text-sm block">2. The Sponsor API (/api/sponsor)</strong>
                <p className="mt-1">
                  Your phone doesn't broadcast directly to the blockchain (because it has zero STX to pay miners). Instead, it sends the 
                  partially-signed transaction to Sato's serverless sponsor relay. The relay checks that you are not spamming, 
                  adds a fixed 0.05 STX fee from Sato's gas pool, signs as the sponsor, and broadcasts it to the Stacks network.
                </p>
              </div>

              <div className="rounded-xl border border-border/70 p-4 bg-muted/20">
                <strong className="text-foreground text-sm block">3. Clarity Smart Contracts (on Stacks)</strong>
                <p className="mt-1">
                  The Stacks blockchain miners see a valid sponsored transaction. Miners take the gas fee from Sato's sponsor pool, 
                  while the <code className="text-foreground font-mono">sato-yield-v3</code> contract updates your balance and transfers 
                  the sBTC to the recipient.
                </p>
              </div>
            </div>
          </div>

          {/* ASCII Diagram */}
          <div className="overflow-x-auto rounded-2xl border border-border bg-[#0d1117] p-5 font-mono text-xs text-zinc-300 shadow-md">
            <pre className="m-0 leading-relaxed">
{`[ USER TAP: SEND 0.01 sBTC TO @AMANI ]
                      │
                      ▼
 1. MOBILE PHONE: Signs intent with on-device key (fee = 0)
                      │
                      ▼ (POST /api/sponsor)
 2. SATO SPONSOR RELAY:
    • Verifies target is Sato contract (anti-drain guard)
    • Checks user hasn't exceeded 200 txs/day (Redis check)
    • Attaches 0.05 STX fee & co-signs with SPONSOR_KEY
                      │
                      ▼ (broadcast)
 3. STACKS BLOCKCHAIN (Testnet / Mainnet):
    • Miners collect 0.05 STX gas fee from Sato
    • sato-names resolves @amani -> ST123...
    • sato-yield-v3 settles interest & moves sBTC to Amani
                      │
                      ▼
[ RESULT: AMANI RECEIVES sBTC INSTANTLY — SENDER PAID 0 GAS ]`}
            </pre>
          </div>
        </section>
      )}

      {/* =========================================================================
          3. LOCAL DEV & TESTING
      ========================================================================= */}
      {activeSection === "quickstart" && (
        <section id="quickstart" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Zap className="size-3.5" />
              <span>Development</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Running Tests & Development
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              How to run the 99 Clarity contract tests and spin up both the web app and docs locally.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">Why 99 Tests Matter</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Smart contracts are immutable once deployed. A single math error in continuous yield accrual or a missing guard on 
              a withdrawal function can drain user funds. Sato has <strong>99 automated tests</strong> running in Vitest using the 
              official Stacks Clarinet Simnet. Every single edge case (self-transfers, zero deposits, rate changes, window resets) 
              is verified.
            </p>

            <CodeBlock
              language="bash"
              title="Terminal"
              code={`# 1. Run all 99 Clarity smart contract tests
pnpm test

# Output:
# ✓ tests/sato-names.test.ts (11 tests)
# ✓ tests/sato-sponsor.test.ts (15 tests)
# ✓ tests/sato-vault.test.ts (10 tests)
# ✓ tests/sato-yield-v3.test.ts (10 tests)
# ✓ tests/sato-yield-v2.test.ts (14 tests)
# Tests: 99 passed`}
            />

            <h3 className="text-sm font-bold text-foreground pt-4">Running Applications Locally</h3>
            <CodeBlock
              language="bash"
              title="Terminal"
              code={`# Run the main web application on localhost:3000
pnpm dev

# Run this interactive documentation site on localhost:3001
pnpm docs:dev`}
            />
          </div>
        </section>
      )}

      {/* =========================================================================
          4. SMART CONTRACTS EXPLAINED
      ========================================================================= */}
      {activeSection === "contracts-yield-v3" && (
        <section id="contracts-yield-v3" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Smart Contract 1 of 4</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-yield-v3 (The Yield Engine)
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              The core ledger of Sato. In most crypto apps, if you want yield, you have to lock your tokens in a staking pool or lending protocol.
              In Sato, <strong>your wallet IS the yield product</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">How Does Yield Accrue Without Locking?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Every time a block is mined on Stacks (roughly every 5 seconds), your balance increases based on the base rate.
              When you transfer sBTC to a friend, the contract automatically "settles" your accrued interest first, banks the new 
              balance, and then transfers the sats. You earn money just by holding a balance.
            </p>
            <div className="rounded-xl bg-muted/40 p-4 font-mono text-xs">
              <strong>Formula:</strong> yield = balance × base_rate × blocks_elapsed ÷ (52,560 × 10,000)
            </div>
          </div>

          <ContractCard contract={yieldContract} />
        </section>
      )}

      {activeSection === "contracts-names" && (
        <section id="contracts-names" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Smart Contract 2 of 4</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-names (The Username Registry)
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              Bitcoin addresses look like <code className="text-foreground font-mono">SP3Y94KSPM...</code>. Sato replaces them with 
              human usernames like <strong className="text-foreground">@alice</strong>.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Why an On-Chain Registry?</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              If Sato stored usernames in a regular private database, Sato could be hacked, censored, or shut down, and your name would vanish.
              Instead, <code className="text-foreground font-mono">sato-names.clar</code> is an on-chain smart contract. 
              Once you register <strong className="text-primary">@yourname</strong>, nobody — not even the Sato founders — can confiscate it from you.
            </p>
            <ul className="text-xs text-muted-foreground space-y-1.5 list-disc list-inside">
              <li><strong>Bijective mapping:</strong> One address owns exactly one username, and one username belongs to exactly one address.</li>
              <li><strong>Zero fees on testnet:</strong> Free to claim so testers can onboard with zero friction.</li>
            </ul>
          </div>

          <ContractCard contract={namesContract} />
        </section>
      )}

      {activeSection === "contracts-sponsor" && (
        <section id="contracts-sponsor" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Smart Contract 3 of 4</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-sponsor (The Gas Pool)
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              The on-chain smart contract that holds STX gas funds and enforces rate limits so no single user can abuse the sponsor pool.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">How Rate Limiting Works</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              To prevent a malicious bot from spamming millions of free transactions, the contract splits time into 
              <strong> 144-block sliding windows</strong> (roughly 24 hours). Each user is allowed up to 10 STX worth of subsidized gas 
              per window. When the window advances, the quota automatically resets.
            </p>
          </div>

          <ContractCard contract={sponsorContract} />
        </section>
      )}

      {activeSection === "contracts-vault" && (
        <section id="contracts-vault" className="space-y-6 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <span>Smart Contract 4 of 4</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              sato-vault (Real sBTC Custody)
            </h1>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              The bridge from testnet ledgers to real canonical sBTC SIP-010 tokens on mainnet.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-3">
            <h3 className="text-sm font-bold text-foreground">Token Pinning Security</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              In Clarity, passing a token trait can be vulnerable if an attacker passes a fake malicious token contract. 
              <code className="text-foreground font-mono">sato-vault</code> uses <strong>Token Pinning</strong>: it asserts that the 
              token passed in matches the exact canonical sBTC address (<code className="text-foreground font-mono">SM3VDXK3W...sbtc-token</code>). 
              Any fake token is instantly rejected with error <code className="text-rose-500 font-mono">u503 (ERR_WRONG_TOKEN)</code>.
            </p>
          </div>

          <ContractCard contract={vaultContract} />
        </section>
      )}

      {/* =========================================================================
          5. GASLESS TWO-PHASE PROTOCOL
      ========================================================================= */}
      {activeSection === "gasless" && (
        <section id="gasless" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Zap className="size-3.5" />
              <span>Gasless Architecture</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              How Gasless Co-Signing Actually Works
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              Most blockchains require users to hold the native gas token (like ETH or STX) before they can send anything. 
              Here is how Sato completely eliminates that requirement.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">The Two-Phase Secret</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Stacks supports native protocol-level <strong>Sponsored Transactions</strong> (<code className="text-foreground font-mono">AuthType.Sponsored</code>). 
              A transaction can have TWO different signers:
            </p>
            <div className="grid gap-3 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                <strong className="text-primary block text-sm">Signer 1: The User (Origin)</strong>
                <p className="mt-1 text-muted-foreground">Signs: <em>"I authorize sending 0.01 sBTC from my balance to @amani."</em> (Fee is left blank = 0).</p>
              </div>
              <div className="rounded-xl border border-border/80 bg-muted/30 p-4">
                <strong className="text-emerald-500 block text-sm">Signer 2: The Sponsor (Sato)</strong>
                <p className="mt-1 text-muted-foreground">Signs: <em>"I will pay the 0.05 STX gas fee so miners process Signer 1's request."</em></p>
              </div>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed pt-2">
              Because the user's signature only authorizes moving their sBTC, the server co-signer cannot modify the recipient, 
              change the amount, or steal funds. It can only attach the gas fee and broadcast it.
            </p>
          </div>

          <SponsorDiagram />
        </section>
      )}

      {/* =========================================================================
          6. MOBILE EMBEDDED WALLET
      ========================================================================= */}
      {activeSection === "wallet" && (
        <section id="wallet" className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <Smartphone className="size-3.5" />
              <span>Mobile Client</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              Mobile Embedded Wallet Security
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              How the mobile app secures user funds on-device without scaring them with 12-word seed phrases during onboarding.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">Zero-Seed Friction vs. Real Security</h2>
            <p className="text-xs leading-relaxed text-muted-foreground">
              In developing markets like Nigeria, asking a first-time user to write 12 words on a piece of paper causes 80% of users to drop off immediately. 
              Sato uses a <strong>deferred security model</strong>:
            </p>
            <div className="space-y-3 text-xs text-muted-foreground">
              <div className="flex items-start gap-3 rounded-xl border border-border/80 p-3.5 bg-muted/20">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">1</span>
                <div>
                  <strong className="text-foreground">Instant Silent Generation:</strong> When the app is opened for the first time, 
                  <code className="text-foreground font-mono">@stacks/wallet-sdk</code> creates a cryptographic keypair locally in memory.
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-border/80 p-3.5 bg-muted/20">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">2</span>
                <div>
                  <strong className="text-foreground">Hardware Keychain Encryption:</strong> The key is written directly to 
                  <code className="text-foreground font-mono">expo-secure-store</code> using the iOS Secure Enclave and Android Keystore. 
                  It is flagged as <code className="text-foreground font-mono">WHEN_UNLOCKED_THIS_DEVICE_ONLY</code>. Even if someone extracts the raw phone storage, the key is unreadable without the device's hardware chip.
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-xl border border-border/80 p-3.5 bg-muted/20">
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold">3</span>
                <div>
                  <strong className="text-foreground">Deferred Backup:</strong> The user can view and back up their phrase anytime in 
                  Settings under biometric authentication (FaceID or Fingerprint), but it never blocks them from getting started.
                </div>
              </div>
            </div>
          </div>

          <ComponentPreview
            title="Interactive Hardware Enclave Key Modal"
            description="Test the hardware enclave key storage modal."
            code={DIALOG_CODE}
          >
            <InteractiveDialogShowcase />
          </ComponentPreview>
        </section>
      )}

      {/* =========================================================================
          7. BILLS & OFFRAMP
      ========================================================================= */}
      {(activeSection === "bills" || activeSection === "offramp" || activeSection === "api-reference") && (
        <section className="space-y-8 animate-in fade-in duration-300">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-primary">
              <CreditCard className="size-3.5" />
              <span>Local Fiat Rails</span>
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight text-foreground sm:text-4xl">
              {activeSection === "bills" ? "Paying Nigerian Bills with sBTC" : "Naira Offramp & API Architecture"}
            </h1>
            <p className="mt-3 text-base leading-relaxed text-muted-foreground">
              How Sato turns synthetic Bitcoin into real electricity tokens, mobile data, and Naira bank deposits.
            </p>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-base font-bold text-foreground">How an Electricity or Airtime Payment Works</h2>
            <div className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p>
                <strong>Step 1: Live Quote:</strong> When you enter your meter number or phone number, the server calls CoinGecko 
                for live BTC/NGN rates and generates a quote (e.g. ₦5,000 electricity = 7,500 satoshis). The server signs this quote with 
                an HMAC SHA-256 signature and a 20-minute countdown so nobody can tamper with the exchange rate.
              </p>
              <p>
                <strong>Step 2: On-Chain Payment:</strong> Your wallet sends the 7,500 satoshis to Sato's treasury address using a gasless transfer.
              </p>
              <p>
                <strong>Step 3: Verification & Payout:</strong> The server inspects the Stacks blockchain, verifies that the 7,500 satoshis 
                actually landed in the treasury, checks Redis to make sure this transaction wasn't already used (idempotency), and calls the 
                <strong> VTPass API</strong> to instantly credit your electricity meter or phone airtime.
              </p>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold text-foreground">API Endpoints</h3>
            <div className="mt-3 space-y-3 font-mono text-xs">
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-emerald-500">POST</span> <span className="text-foreground">/api/sponsor</span> — Relays and co-signs gasless transactions
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-blue-500">POST</span> <span className="text-foreground">/api/pay</span> — Verifies on-chain sBTC transfer and pays bills via VTPass
              </div>
              <div className="rounded-lg border border-border bg-muted/40 p-3">
                <span className="font-bold text-amber-500">POST</span> <span className="text-foreground">/api/offramp</span> — Generates HMAC-signed sBTC → Naira bank quotes
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}
