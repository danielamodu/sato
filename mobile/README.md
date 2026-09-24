# Sato Mobile

Native (React Native + Expo Router) client for Sato — the sBTC wallet with
`@usernames`, gasless sends, and Earn. Built around an **embedded wallet**: the
app holds the key, so sign-up is instant and every onboarding action is gasless.

## Why embedded, not "connect Xverse"

As of this writing there is no native path for a mobile app to hand a
transaction to Xverse (or another Stacks wallet app) for signing the way
`@stacks/connect` does in a browser. The realistic options are:

1. **In-app browser + sats-connect** over Xverse's universal link — bounces the
   user out to a web view to approve each action. Clunky for a wallet.
2. **WalletConnect** — community bridges only; unreliable for Stacks today.
3. **Embedded wallet** — the app generates and stores the key itself. This is
   the officially documented React Native path and the only one that gives a
   true native feel with frictionless onboarding, which is the whole goal here.

We chose (3). The tradeoff is real self-custody on-device (see **Security**).

## Status

- ✅ Expo config + polyfills (Node shims wired through Metro)
- ✅ Embedded-wallet core — `src/lib/wallet.ts` (derive, reveal, wipe, sign)
- ✅ Gasless contract actions + full read parity — `src/lib/sato.ts`
- ✅ Node spike — `spike/sponsored-send.ts` proves sign → serialize →
  co-signer validator accepts → origin principal recovers (runs GREEN)
- ✅ Full app — six-tab port of the web `/app`:
  - **Home** — balance staircase (interactive), gasless testnet faucet, quick
    actions, Earn snapshot, recent activity
  - **Send** — pay by `@username` or address, honors `?to=&amount=` pay links,
    on-chain name resolution, over-balance guard, gasless
  - **Receive** — QR + shareable pay link, copy address/link, gasless
    `@username` claim with live availability
  - **Earn** — deposit / withdraw against `sato-yield-v2`, live yield, gasless
  - **Gas** — real sponsor-pool reads + STX top-up (the one STX-requiring action)
  - **Activity** — full on-chain history, tap to open on the explorer
  - **Account** (modal) — address, reveal recovery phrase behind a biometric
    gate, remove-wallet
- ⬜ On-device QA (needs `npm install` + a simulator — deferred)

## Architecture

| File | Role |
| --- | --- |
| `index.js`, `polyfill.js` | Load Node/WebCrypto polyfills in order, then the router |
| `metro.config.js` | Map `stream`→`readable-stream`, `crypto`→`crypto-browserify` |
| `src/config/network.ts` | Network seam: deployer, contract refs, read API, sponsor + web-app URLs |
| `src/lib/wallet.ts` | Embedded key in `expo-secure-store`; `signSponsored` / `signAndBroadcast` / `wipeWallet` |
| `src/lib/sato.ts` | Reads (balance, name, earn, sponsor, history, txs) + gasless writes |
| `src/lib/format.ts` | Formatters, explorer links, CoinGecko prices (nulls on failure) |
| `src/theme.ts` | Brand palette + spacing tokens (mirrors the web `:root`) |
| `src/state/wallet-store.tsx` | Shared context: derives address, refreshes all state, gasless `submit` + toast |
| `src/components/ui.tsx` | Screen / Panel / Btn / Field / StatTile / Pill / Tips / PageHead |
| `src/components/chart.tsx` | `BalanceChart` + `buildBalanceSeries` (react-native-svg staircase) |
| `src/components/tx.tsx` | Activity row + list (icons, status pills, skeletons, empty state) |
| `app/_layout.tsx` | Providers (SafeArea + WalletProvider) + `account` modal route |
| `app/(tabs)/*` | The six tab screens + custom tab bar |
| `app/account.tsx` | Self-custody surface: address, seed reveal, wipe |
| `spike/sponsored-send.ts` | Node proof of the sign→sponsor→broadcast core (no secrets) |

## Run it

```bash
cd mobile
npm install          # or pnpm / yarn / bun — .npmrc pins a hoisted layout
npx expo install --fix   # align RN/Expo package versions to the installed SDK
export EXPO_PUBLIC_SPONSOR_ENDPOINT="https://<your-sato-web-app>/api/sponsor"
# optional — only if your pay links should point somewhere other than the
# sponsor's origin (defaults to stripping /api/sponsor off the endpoint above):
# export EXPO_PUBLIC_WEB_APP="https://<your-sato-web-app>"
npx expo start       # press i (iOS sim), a (Android), or scan with Expo Go
```

The Node spike needs no device or secrets and reads live testnet state:

```bash
npm run spike
```

## The gasless dependency (IMPORTANT)

Writes are sponsored: the app signs a `sponsored:true` call and POSTs the
serialized tx to the web app's `api/sponsor.ts`, which pays the fee and
broadcasts. For the mobile flows to work, that co-signer must be **deployed with
the updated allow-list** — this scaffold added `sato-transfer.deposit` (the
testnet faucet, so a zero-STX wallet can onboard) and switched `sato-yield` →
`sato-yield-v2`. Deploy the web app before pointing a device at it, or every
write returns "Gas sponsor rejected the transaction." The co-signer stays bounded
by its fixed fee + per-principal rate limit; `SPONSOR_KEY` is a server-only env.

## Security notes

- **Embedded = the app holds the key.** The mnemonic is stored only in the OS
  keystore (`expo-secure-store`, `WHEN_UNLOCKED_THIS_DEVICE_ONLY`), never synced.
- Before this holds real value: gate `revealMnemonic()` behind
  `expo-local-authentication` (biometric), ship a back-up-your-phrase flow, and
  add a recovery/import path. Onboarding defers backup so first-run is instant.
- The **faucet is testnet-only** — never expose `fundSelf`/`deposit` on a
  mainnet build.
- No secrets live in this app. Signing is local; only a serialized, already
  signed sponsored tx leaves the device, and only to your configured endpoint.

## Testnet → mainnet

Flip `NETWORK`/`DEPLOYER`/`CONTRACTS` in `src/config/network.ts`, drop the
faucet, and repoint `EXPO_PUBLIC_SPONSOR_ENDPOINT` at the production co-signer.
Keep `src/config/network.ts` in step with the web client's `sato.ts`.
