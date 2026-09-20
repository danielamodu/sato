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

## Status

🔨 Active development — not yet live.

- [x] Landing page — satofinance.vercel.app
- [x] Clarity smart contract for sBTC transfers
- [ ] Username registration via Stacks Name Service
- [ ] Sponsored transaction infrastructure
- [ ] React Native mobile app
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

## Live Contracts (Stacks Testnet)

| Contract | Explorer |
|----------|---------|
| `sato-transfer` | [View on Explorer](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-transfer?chain=testnet) |
| `sato-names` | [View on Explorer](https://explorer.hiro.so/txid/ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV.sato-names?chain=testnet) |

Deployer: `ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV`

## Get early access

satofinance.vercel.app

---

Building in public. Follow along: @satofinance
