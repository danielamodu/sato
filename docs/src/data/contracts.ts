export interface ContractFunction {
  name: string;
  type: "public" | "read-only";
  args: { name: string; type: string }[];
  returns: string;
  description: string;
  sampleArgs?: string[];
}

export interface ContractDef {
  id: string;
  name: string;
  address: string;
  version: string;
  purpose: string;
  explorerUrl: string;
  functions: ContractFunction[];
  errorCodes: { code: string; name: string; meaning: string }[];
  dataVars: { name: string; type: string; description: string }[];
}

export const DEPLOYER_ADDRESS = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";

export const CONTRACTS: ContractDef[] = [
  {
    id: "sato-yield-v3",
    name: "sato-yield-v3",
    address: `${DEPLOYER_ADDRESS}.sato-yield-v3`,
    version: "v3.0.0",
    purpose: "Yield-bearing sBTC ledger with automatic per-block base accrual and optional boost lockups.",
    explorerUrl: `https://explorer.hiro.so/txid/${DEPLOYER_ADDRESS}.sato-yield-v3?chain=testnet`,
    dataVars: [
      { name: "base-rate-bps", type: "uint", description: "Annualized base yield rate in basis points (default: 2000000 = 200% on testnet)." },
      { name: "boost-rate-bps", type: "uint", description: "Annualized lock boost rate in basis points (default: 4000000 = 400% on testnet)." },
      { name: "total-supply", type: "uint", description: "Total realized sBTC satoshis across all liquid balances." },
      { name: "total-yield-paid", type: "uint", description: "Cumulative lifetime yield satoshis minted to accounts." },
    ],
    functions: [
      {
        name: "send",
        type: "public",
        args: [
          { name: "recipient", type: "principal" },
          { name: "amount", type: "uint" },
        ],
        returns: "(response bool uint)",
        description: "Settles base yield for both sender and receiver, then moves realized satoshis. Emits an sbtc-transfer print event.",
      },
      {
        name: "lock",
        type: "public",
        args: [
          { name: "amount", type: "uint" },
          { name: "term-blocks", type: "uint" },
        ],
        returns: "(response bool uint)",
        description: "Commits liquid sats into a locked position earning the boost rate until unlock block height.",
      },
      {
        name: "claim-lock",
        type: "public",
        args: [],
        returns: "(response bool uint)",
        description: "After unlock height elapses, returns locked principal + boost yield back to liquid balance and clears the lock.",
      },
      {
        name: "deposit",
        type: "public",
        args: [{ name: "amount", type: "uint" }],
        returns: "(response bool uint)",
        description: "Faucets/credits liquid sBTC for tx-sender (testnet helper). Settles yield checkpoint.",
      },
      {
        name: "get-balance",
        type: "read-only",
        args: [{ name: "who", type: "principal" }],
        returns: "uint",
        description: "Returns the real-time live balance (stored realized balance + pending base yield calculated up to the current block).",
        sampleArgs: [DEPLOYER_ADDRESS],
      },
      {
        name: "get-base-rate",
        type: "read-only",
        args: [],
        returns: "uint",
        description: "Returns the current base yield APR in basis points.",
      },
      {
        name: "get-boost-rate",
        type: "read-only",
        args: [],
        returns: "uint",
        description: "Returns the boost APR in basis points applied to locked positions.",
      },
      {
        name: "get-total-supply",
        type: "read-only",
        args: [],
        returns: "uint",
        description: "Returns total realized circulating sBTC sats in the ledger.",
      },
    ],
    errorCodes: [
      { code: "u500", name: "ERR_INSUFFICIENT_BALANCE", meaning: "Attempted to send or lock more sats than available." },
      { code: "u501", name: "ERR_INVALID_AMOUNT", meaning: "Amount or lock term was zero." },
      { code: "u502", name: "ERR_SELF_TRANSFER", meaning: "Cannot transfer funds to yourself." },
      { code: "u503", name: "ERR_UNAUTHORIZED", meaning: "Caller is not contract deployer (for rate updates)." },
      { code: "u504", name: "ERR_LOCK_NOT_MATURE", meaning: "Block height has not yet reached lock unlock height." },
      { code: "u505", name: "ERR_LOCK_EXISTS", meaning: "Account already has an active lock (one lock per account)." },
      { code: "u506", name: "ERR_NO_LOCK", meaning: "No lock exists to claim." },
    ],
  },
  {
    id: "sato-names",
    name: "sato-names",
    address: `${DEPLOYER_ADDRESS}.sato-names`,
    version: "v1.0.0",
    purpose: "On-chain username registry mapping human-readable @handles (<=32 chars) bijectively to Stacks principals.",
    explorerUrl: `https://explorer.hiro.so/txid/${DEPLOYER_ADDRESS}.sato-names?chain=testnet`,
    dataVars: [],
    functions: [
      {
        name: "register-name",
        type: "public",
        args: [{ name: "name", type: "string-ascii 32" }],
        returns: "(response bool uint)",
        description: "Registers an unclaimed @username for tx-sender. Rejects empty names, existing names, or callers who already hold a name.",
      },
      {
        name: "transfer-name",
        type: "public",
        args: [
          { name: "name", type: "string-ascii 32" },
          { name: "recipient", type: "principal" },
        ],
        returns: "(response bool uint)",
        description: "Transfers ownership of a name to another principal who does not already own a name.",
      },
      {
        name: "resolve-name",
        type: "read-only",
        args: [{ name: "name", type: "string-ascii 32" }],
        returns: "(optional principal)",
        description: "Forward lookup: resolves an @username to its owning Stacks principal.",
        sampleArgs: ["amani"],
      },
      {
        name: "get-name",
        type: "read-only",
        args: [{ name: "owner", type: "principal" }],
        returns: "(optional (string-ascii 32))",
        description: "Reverse lookup: gets the registered username belonging to a Stacks principal.",
        sampleArgs: [DEPLOYER_ADDRESS],
      },
      {
        name: "is-name-available",
        type: "read-only",
        args: [{ name: "name", type: "string-ascii 32" }],
        returns: "bool",
        description: "Checks whether a given name is free to register.",
        sampleArgs: ["sato"],
      },
    ],
    errorCodes: [
      { code: "u200", name: "ERR_NAME_TAKEN", meaning: "Name already registered or caller already holds a name." },
      { code: "u201", name: "ERR_NOT_FOUND", meaning: "Name does not exist in registry." },
      { code: "u202", name: "ERR_UNAUTHORIZED", meaning: "Caller is not the current owner of the name." },
      { code: "u203", name: "ERR_INVALID_NAME", meaning: "Name is empty or exceeds 32 ASCII characters." },
    ],
  },
  {
    id: "sato-sponsor",
    name: "sato-sponsor",
    address: `${DEPLOYER_ADDRESS}.sato-sponsor`,
    version: "v1.0.0",
    purpose: "Gasless transaction pool with windowed per-user rate limits (144 blocks ≈ 1 day, 10 STX cap).",
    explorerUrl: `https://explorer.hiro.so/txid/0x61811b57d75caf56157266f436bb8e3ab79c81b14dc7ea50d2226d6992111052?chain=testnet`,
    dataVars: [
      { name: "sponsor-balance", type: "uint", description: "Total micro-STX funded into the gas sponsorship pool." },
      { name: "per-user-cap", type: "uint", description: "Maximum micro-STX a single user can consume per window (default 10 STX)." },
      { name: "window-length", type: "uint", description: "Sliding window duration in Stacks blocks (default 144 ≈ 24h)." },
    ],
    functions: [
      {
        name: "top-up",
        type: "public",
        args: [{ name: "amount", type: "uint" }],
        returns: "(response bool uint)",
        description: "Permissionless: transfers real STX from caller into contract to fund the gas pool.",
      },
      {
        name: "sponsor-tx",
        type: "public",
        args: [
          { name: "user", type: "principal" },
          { name: "fee", type: "uint" },
        ],
        returns: "(response bool uint)",
        description: "Sponsor-only: records gas reimbursement, asserts fee <= pool balance, and updates user sliding window counter.",
      },
      {
        name: "get-sponsor-balance",
        type: "read-only",
        args: [],
        returns: "uint",
        description: "Returns total micro-STX currently available in the sponsor pool.",
      },
      {
        name: "get-remaining-allowance",
        type: "read-only",
        args: [{ name: "user", type: "principal" }],
        returns: "uint",
        description: "Returns the remaining micro-STX gas allowance for a user in the current 144-block window.",
        sampleArgs: [DEPLOYER_ADDRESS],
      },
    ],
    errorCodes: [
      { code: "u300", name: "ERR_INSUFFICIENT_POOL", meaning: "Sponsor pool does not have enough STX to cover the fee." },
      { code: "u301", name: "ERR_UNAUTHORIZED", meaning: "Caller is not the authorized sponsor co-signer." },
      { code: "u302", name: "ERR_INVALID_AMOUNT", meaning: "Fee or top-up amount was zero." },
      { code: "u303", name: "ERR_CAP_EXCEEDED", meaning: "User has exceeded the 10 STX limit for the current 144-block window." },
    ],
  },
  {
    id: "sato-vault",
    name: "sato-vault",
    address: `${DEPLOYER_ADDRESS}.sato-vault`,
    version: "v1.0.0",
    purpose: "Real sBTC custody vault moving canonical SIP-010 tokens via contract-call? with token pinning.",
    explorerUrl: `https://explorer.hiro.so/txid/0xf1dac34c6530421362534089ca627996dc84b20483ac9b6462629930f6d14964?chain=testnet`,
    dataVars: [
      { name: "sbtc-token-contract", type: "principal", description: "Pinned canonical sBTC token principal. Cannot be swapped by untrusted callers." },
      { name: "total-deposited", type: "uint", description: "Total canonical sBTC satoshis custodied in the vault contract." },
    ],
    functions: [
      {
        name: "deposit",
        type: "public",
        args: [
          { name: "token", type: "<sip-010-transfer>" },
          { name: "amount", type: "uint" },
        ],
        returns: "(response bool uint)",
        description: "Asserts token matches pinned contract, pulls sBTC from caller into contract custody, and credits user balance.",
      },
      {
        name: "withdraw",
        type: "public",
        args: [
          { name: "token", type: "<sip-010-transfer>" },
          { name: "amount", type: "uint" },
        ],
        returns: "(response bool uint)",
        description: "Checks balance, updates state (checks-effects-interactions), and sends canonical sBTC back via as-contract.",
      },
      {
        name: "get-balance",
        type: "read-only",
        args: [{ name: "user", type: "principal" }],
        returns: "uint",
        description: "Returns vault custodied balance for a given principal.",
        sampleArgs: [DEPLOYER_ADDRESS],
      },
      {
        name: "get-total-deposited",
        type: "read-only",
        args: [],
        returns: "uint",
        description: "Returns total sBTC satoshis held in vault custody.",
      },
    ],
    errorCodes: [
      { code: "u500", name: "ERR_INVALID_AMOUNT", meaning: "Deposit or withdrawal amount is zero." },
      { code: "u501", name: "ERR_INSUFFICIENT_BALANCE", meaning: "Requested withdrawal exceeds user's deposited vault balance." },
      { code: "u502", name: "ERR_UNAUTHORIZED", meaning: "Caller is not contract deployer (for token contract updates)." },
      { code: "u503", name: "ERR_WRONG_TOKEN", meaning: "Passed token trait does not match the pinned canonical sBTC principal." },
    ],
  },
];
