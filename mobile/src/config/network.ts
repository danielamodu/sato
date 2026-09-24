// Single network seam for the whole app. Testnet today; mainnet is a flip of
// these values (plus swapping the testnet faucet out). Mirror of the web
// client's sato.ts so the two stay in step.
export const NETWORK = "testnet" as const;
export const DEPLOYER = "ST3Y94KSPM12SVR45DF7S9V4B0TGR7HCARM8SWYWV";

export type ContractRef = { address: string; name: string };

export const CONTRACTS = {
  names: { address: DEPLOYER, name: "sato-names" },
  transfer: { address: DEPLOYER, name: "sato-transfer" },
  earn: { address: DEPLOYER, name: "sato-yield-v2" },
  sponsor: { address: DEPLOYER, name: "sato-sponsor" },
} as const satisfies Record<string, ContractRef>;

// Read API (no wallet needed).
export const API = "https://api.testnet.hiro.so";

// The gasless co-signer lives on the Sato web app's origin (api/sponsor.ts).
// Point EXPO_PUBLIC_SPONSOR_ENDPOINT at your deployed web app. The placeholder
// is intentional: a misconfigured build fails loudly instead of silently
// POSTing a signed transaction to the wrong place.
export const SPONSOR_ENDPOINT =
  process.env.EXPO_PUBLIC_SPONSOR_ENDPOINT ??
  "https://YOUR-SATO-WEB-APP.example/api/sponsor";

// The Sato web app's public origin, used to build shareable pay links from the
// Receive tab (`${WEB_APP}/app?to=<@handle>&amount=<sats>`) — the same deep-link
// schema the app itself honors. Defaults to the co-signer's origin so a single
// EXPO_PUBLIC_SPONSOR_ENDPOINT is enough to get a working build.
export const WEB_APP =
  process.env.EXPO_PUBLIC_WEB_APP ?? SPONSOR_ENDPOINT.replace(/\/api\/sponsor\/?$/, "");
