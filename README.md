<p align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset=".github/sato-logo-dark.png" />
    <source media="(prefers-color-scheme: light)" srcset=".github/sato-logo.png" />
    <img alt="Sato" src=".github/sato-logo.png" width="140" />
  </picture>
</p>

<h1 align="center">Sato</h1>

<p align="center">
  <strong>Bitcoin payments for everyone. Built on Stacks. Powered by sBTC.</strong>
</p>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/clarity-Stacks-5546FF?logo=data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjQiIGhlaWdodD0iMjQiIHZpZXdCb3g9IjAgMCAyNCAyNCIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cGF0aCBkPSJNMTIgMkw0IDIwaDRsNC04IDQgOGg0TDEyIDJ6IiBmaWxsPSIjZmZmIi8+PC9zdmc+" alt="Clarity on Stacks" /></a>
  <a href="#"><img src="https://img.shields.io/badge/tests-99_passing-brightgreen" alt="Tests" /></a>
  <a href="#"><img src="https://img.shields.io/badge/network-testnet_live-orange" alt="Testnet" /></a>
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue" alt="License" /></a>
  <a href="https://satoxbt.com"><img src="https://img.shields.io/badge/satoxbt.com-F15A24?logo=bitcoin&logoColor=white" alt="Website" /></a>
</p>

<br />

<p align="center">
  <em>"Send sBTC to anyone by @username, earn yield on your balance, and cash out to your local currency — no wallet addresses, no gas complexity, no crypto knowledge required."</em>
</p>

---

## The Problem

Sending money across borders in Africa is slow, expensive, and buried in friction. Crypto wallets demand seed phrases, hex addresses, and gas tokens. For the average person, the UX is a dealbreaker — not the technology.

## The Fix

Sato makes Bitcoin useful as money. You send by **@username**, never see a gas fee, and cash out to **Naira** whenever you want. The wallet lives on your phone — no browser extension, no seed phrase, no signup form.

## How It Works

| Step | What happens |
|------|-------------|
| **Install** | Open the app → a wallet is created on-device, silently |
| **Register** | Pick an @username → it's yours, on-chain |
| **Receive** | Share your @username → anyone can send you sBTC |
| **Send** | Type @username + amount → gasless, instant |
| **Earn** | Your balance earns yield automatically, every block |
| **Cash out** | Withdraw to Naira → pay bills, buy airtime, send to bank |

## Architecture

```
┌──────────────┐    ┌──────────────┐
│  Mobile App  │    │   Web Dapp   │
│  Expo (RN)   │    │  Vite+React  │
│  Embedded    │    │  Stacks      │
│  Wallet      │    │  Connect     │
└──────┬───────┘    └──────┬───────┘
       │                   │
       └───────┬───────────┘
               ▼
       ┌───────────────┐
       │  Sponsor API  │  co-sign → broadcast
       │  (Vercel)     │  gasless for users
       └───────┬───────┘
               ▼
       ┌───────────────┐    ┌─────────────┐
       │    Stacks     │    │  VTPass /   │
       │   Testnet     │    │  Yellow Card│
       │  (Clarity)    │    │  (fiat)     │
       └───────────────┘    └─────────────┘
```

## Contracts

All contracts are deployed and verified on **Stacks testnet**.

| Contract | Purpose | Explorer |
|----------|---------|----------|
| `sato-yield-v3` | Yield-bearing sBTC ledger — send, earn, lock | [View →](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-yield-v3?chain=testnet) |
| `sato-names` | On-chain @username registry | [View →](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-names?chain=testnet) |
| `sato-sponsor` | Gasless tx pool with per-user rate limits | [View →](https://explorer.hiro.so/txid/0x61811b57d75caf56157266f436bb8e3ab79c81b14dc7ea50d2226d6992111052?chain=testnet) |
| `sato-vault` | Real sBTC custody via SIP-010 trait | [View →](https://explorer.hiro.so/txid/0xf1dac34c6530421362534089ca627996dc84b20483ac9b6462629930f6d14964?chain=testnet) |
| `sato-transfer` | Internal sBTC ledger (devnet) | [View →](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-transfer?chain=testnet) |

<details>
<summary>Deployer</summary>

`ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV`
</details>

## Tech Stack

- **Contracts** — Clarity on Stacks
- **Mobile** — React Native (Expo), on-device embedded wallet via `expo-secure-store`
- **Web** — Vite + React + Tailwind + shadcn/ui
- **Auth** — Stacks Connect (web) · embedded wallet (mobile)
- **Identity** — `sato-names` on-chain username registry
- **Gasless** — server co-signer + `sato-sponsor` on-chain rate limiting
- **Offramp** — Yellow Card API (planned) · VTPass (bills, airtime, data, electricity)
- **Backend** — Vercel serverless + Supabase + Upstash Redis

## Roadmap

**Phase 1 — On-chain foundation** &nbsp; ✅ shipped

- [x] `sato-transfer` — sBTC ledger (send, balances, events)
- [x] `sato-names` — username registry (register, resolve, transfer)
- [x] `sato-sponsor` — sponsored-tx pool with windowed per-user caps
- [x] Full test suite (99 tests) + deployed & verified on testnet

**Phase 2 — Product integration** &nbsp; ✅ shipped

- [x] Wallet connect + end-to-end dapp flow
- [x] Gasless sends via co-signer (users never touch gas)
- [x] Yield on balance via `sato-yield-v3` (per-block accrual, lock boost)
- [x] Cash out sBTC → Naira and pay Nigerian bills via VTPass

**Phase 3 — Mobile & fiat** &nbsp; 🔨 in progress

- [x] React Native (Expo) app with embedded wallet, gasless onboarding
- [ ] Swap to canonical sBTC SIP-010 on mainnet
- [ ] Yellow Card integration (Naira onramp/offramp) + KYC
- [ ] iOS and Android launch

## Development

```bash
pnpm install
pnpm test          # 99 Clarity tests via Clarinet + Vitest
pnpm dev           # web dapp on localhost
```

## License

MIT — see [LICENSE](LICENSE).

---

<p align="center">
  <strong>Building in public.</strong><br />
  <a href="https://satoxbt.com">satoxbt.com</a> · <a href="https://twitter.com/satofinance">@satofinance</a>
</p>
