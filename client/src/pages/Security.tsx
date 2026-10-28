import LegalPage from "./LegalPage";

export default function Security() {
  return (
    <LegalPage
      eyebrow="Security Architecture"
      title="Security, verified by cryptography."
      intro="Sato is architected around defense-in-depth principles: zero server-side key custody, hardware enclave isolation on-device, and mathematically rigorous Clarity smart contracts."
      updated="October 2026"
      statusBadge="Verified"
      asideTitle="Zero-Custody Architecture"
      asideText="Your cryptographic keys never touch our servers. Transactions are authorized strictly on your device using hardware-isolated encryption."
      sections={[
        {
          heading: "1. On-Device Hardware Key Isolation",
          body: [
            "In Sato, your private keys never leave your phone. Key generation uses @stacks/wallet-sdk to derive a 12-word BIP-39 mnemonic directly in memory on first launch.",
            "The key is stored in hardware-backed device keychains (iOS Secure Enclave and Android Keystore) via expo-secure-store with WHEN_UNLOCKED_THIS_DEVICE_ONLY accessibility flags.",
            "Even if an attacker gains root filesystem access or steals a device backup, the private key cannot be extracted without the hardware security module of the physical phone.",
          ],
        },
        {
          heading: "2. Smart Contract Rigor (99 Automated Test Suites)",
          body: [
            "All core logic in Sato is written in Clarity — Stacks' decidable, non-Turing-complete smart contract language. Clarity prevents entire classes of exploits (such as re-entrancy and unexpected loops) by design.",
            "Our contracts are accompanied by 99 automated integration tests executed against the official Stacks Clarinet SDK. Tests verify mathematical accuracy, continuous yield accumulation, sliding-window rate limit resets, and strict access controls across multi-user scenarios.",
          ],
        },
        {
          heading: "3. Checks-Effects-Interactions & Token Pinning",
          body: [
            "Our custody contracts (such as sato-vault.clar) strictly enforce the checks-effects-interactions pattern to ensure balances are settled before external transfers are initiated.",
            "To prevent trait spoofing (a common vector where an attacker passes a fake token contract), sato-vault pins the accepted token to the canonical sBTC SIP-010 token address. Calls using unauthorized tokens revert immediately on-chain.",
          ],
        },
        {
          heading: "4. Gasless Relay Defenses (/api/sponsor)",
          body: [
            "Sato's co-signing relay is protected against gas pool draining and mempool spam:",
            "• Strict Allowlist: The relay deserializes incoming raw transactions and verifies they only target authorized Sato contracts (sato-yield-v3, sato-names, sato-sponsor). Requests calling arbitrary contracts are rejected.",
            "• Fixed Fee Enforcement: The server attaches a hardcoded fee of 50,000 µSTX (0.05 STX). Clients cannot manipulate gas fees or cause fee burning.",
            "• Atomic Rate Limits: Upstash Redis enforces an atomic 200 transaction per 24-hour window per origin address.",
          ],
        },
        {
          heading: "5. Cryptographic Quote Verification (HMAC-SHA256)",
          body: [
            "When executing utility bill payments or Naira offramps, live exchange rates are locked into an HMAC-SHA256 signed quote with a 20-minute time-to-live (TTL).",
            "The verification server uses constant-time string comparisons (timingSafeEqual) to prevent timing attacks, and checks the Stacks blockchain independently before initiating any fiat payout.",
          ],
        },
        {
          heading: "6. Responsible Vulnerability Disclosure",
          body: [
            "We welcome security researchers and community auditors to review our code. If you discover a vulnerability in our smart contracts, mobile client, or API relays, please disclose it responsibly:",
            "Please email team.satofinance@gmail.com with detailed reproduction steps. We commit to acknowledging reports within 24 hours and providing remediation updates.",
          ],
        },
      ]}
    />
  );
}
