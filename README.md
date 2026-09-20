# Sato — Bitcoin Payment App (sBTC transfers)

Sato is a Clarity smart contract for sending sBTC between Stacks principals.

## Structure

```text
sato/
├── contracts/
│   └── sato-transfer.clar
├── tests/
│   └── sato-transfer.test.ts
├── settings/
│   └── Devnet.toml
├── Clarinet.toml
├── package.json
├── vitest.config.ts
├── tsconfig.json
└── README.md
```

## Contract: `sato-transfer`

### Errors

| Constant | Code | Meaning |
|---|---|---|
| `ERR_INSUFFICIENT_BALANCE` | `(err u100)` | Sender balance < amount |
| `ERR_INVALID_AMOUNT` | `(err u101)` | Amount is zero |
| `ERR_SELF_TRANSFER` | `(err u102)` | Sender == recipient |

### Functions

- `(send (recipient principal) (amount uint))` — validate amount > 0, sender != recipient, and sufficient balance; move balances; emit `{event: "sbtc-transfer", sender, recipient, amount}` via `print`; returns `(ok true)`.
- `(mint (recipient principal) (amount uint))` — test/devnet helper to fund an account.
- `(deposit (amount uint))` — credit the caller's own balance (simulates wrapping sBTC).
- `(get-balance (who principal))` — read-only sBTC balance.
- `(get-total-supply)` — read-only total custodied.

### Mainnet note

This contract tracks sBTC in its own ledger for local testing. For mainnet,
replace `mint`/`deposit` with a SIP-010 `contract-call?` into the canonical
sBTC contract (`SM3VDXK3WZZSA84XXFKAFAF15NNZX32CTSG82JFQ4.sbtc-token`).

## Development

Requires [Clarinet](https://docs.hiro.so/clarinet/introduction).

```bash
clarinet check
clarinet test
```

JS tests use the Clarinet simnet (`simnet.callPublicFn` / `simnet.callReadOnlyFn`)
with `vitest`. Install dev dependencies first if `package.json` is present:

```bash
npm install
npm test
```
