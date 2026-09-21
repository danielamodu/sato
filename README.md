# Sato

Bitcoin payments for everyone.

Sato is a Bitcoin-native mobile payment app built on Stacks. 
Send sBTC to anyone by @username, earn yield on your balance, 
and cash out to your local currency — no wallet addresses, 
no gas complexity, no crypto knowledge required.

## What we're building

- **Send by @username** — no wallet addresses, just @username and done
- **Earn on your balance** — idle sBTC earns yield automatically via sBTC/PoX integration
- **Cash out anytime** — withdraw to local currency via Yellow Card API
- **Sponsored transactions** — users never touch gas fees
- **Social login** — sign in with Google or X, wallet created in the background

Built on Stacks. Powered by sBTC.

## Status & Roadmap

🔨 Active development — building in public.

**Phase 1 — On-chain foundation (shipped, live on testnet)**
- [x] Landing page — satofinance.vercel.app
- [x] `sato-transfer` — sBTC transfer contract (send, balances, events)
- [x] `sato-names` — username registry (register, resolve, reverse lookup, transfer)
- [x] `sato-sponsor` — sponsored-tx pool with windowed per-user caps
- [x] Full test suite (38 tests) + deployed & verified on Stacks testnet

**Phase 2 — Product integration (next / grant-funded)**
- [ ] Wallet connect + end-to-end dapp flow (register → resolve → send)
- [ ] Swap `sato-transfer` ledger for the canonical sBTC SIP-010 contract
- [ ] Yield on balance via sBTC/PoX integration
- [ ] Social login with embedded wallets (Privy)

**Phase 3 — Mobile & fiat (later)**
- [ ] React Native mobile app (iOS + Android)
- [ ] Yellow Card API integration (Naira onramp/offramp)
- [ ] iOS and Android launch

## Tech stack

- **Contracts** — Clarity on Stacks
- **Mobile** — React Native (iOS + Android)
- **Auth** — Privy (embedded wallets + social login)
- **Identity** — Stacks Name Service (SNS)
- **Onramp/Offramp** — Yellow Card API
- **Backend** — Node.js + Supabase

## Contracts

`contracts/sato-transfer.clar` — Core sBTC transfer contract.
Handles send, balance tracking, and transfer events.
Production version will integrate with the canonical sBTC token contract:
`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`

`contracts/sato-vault.clar` — Real sBTC custody vault. Deposits and
withdrawals move the **canonical sBTC SIP-010 token** into and out of the
contract's own custody via `contract-call?` transfers — no internal ledger
stand-in. The accepted token is passed as a trait argument and pinned to a
stored principal (defaults to the testnet sBTC token, owner-updatable so
mainnet points at `SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`
without a code change). This is the first piece of the Phase 2 move off the
`sato-transfer` ledger onto real sBTC.

## Live Contracts (Stacks Testnet)

| Contract | Explorer |
|----------|---------|
| `sato-transfer` | [View on Explorer](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-transfer?chain=testnet) |
| `sato-names` | [View on Explorer](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-names?chain=testnet) |
| `sato-sponsor` | [View on Explorer](https://explorer.hiro.so/txid/0x61811b57d75caf56157266f436bb8e3ab79c81b14dc7ea50d2226d6992111052?chain=testnet) |
| `sato-yield` | [View on Explorer](https://explorer.hiro.so/txid/0x8e5e712fb5bb9ff42b80cd40c3d122d1f3ae26f8b0340320e8361e70eaa73b52?chain=testnet) |
| `sato-vault` | [View on Explorer](https://explorer.hiro.so/txid/0xf1dac34c6530421362534089ca627996dc84b20483ac9b6462629930f6d14964?chain=testnet) |

Deployer: `ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV`

## Development

```bash
npm install
npm test        # runs the Clarity test suite (69 tests) via Clarinet + Vitest
```

## License

MIT — see [LICENSE](LICENSE). Sato is open source.

## Get early access

satofinance.vercel.app

---

Building in public. Follow along: @satofinance
