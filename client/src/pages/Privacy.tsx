import LegalPage from "./LegalPage";

export default function Privacy() {
  return (
    <LegalPage
      eyebrow="Privacy Policy"
      title="Your privacy, preserved by design."
      intro="Sato is built on a principle of cryptographic data minimization. We do not want your personal keys, and we only collect the bare minimum information needed to process payments and utility bills."
      updated="October 2026"
      statusBadge="Effective"
      asideTitle="Data Minimization"
      asideText="We never hold your private keys, seed phrases, or wallet PINs. All signing happens on your device's hardware Secure Enclave."
      sections={[
        {
          heading: "1. Introduction & Our Privacy Philosophy",
          body: [
            "This Privacy Policy explains how Sato ('we', 'us', or 'our') collects, uses, discloses, and safeguards your information when you use the Sato mobile application, web dapp, and related services (collectively, the 'Services').",
            "Sato is designed to bridge Bitcoin (sBTC) payments with local everyday utilities (such as Nigerian electricity, data, and airtime). Because Sato utilizes non-custodial smart contracts on the Stacks blockchain, our architecture is fundamentally built to minimize the collection of personally identifiable information (PII).",
          ],
        },
        {
          heading: "2. The Information We Collect",
          body: [
            "We collect information in three ways: information you provide directly, technical information generated automatically, and data recorded publicly on the blockchain.",
            "A. Information You Provide Directly: When you join our early access waitlist or contact support, we collect your email address. When you register an on-chain identity, you provide a public @username handle. When you pay utility bills or purchase airtime, you provide the required destination identifiers (such as a meter number, phone number, or smartcard account).",
            "B. Public Blockchain Data: When you execute transactions on Stacks (including sBTC sends, name registrations, or vault deposits), your public Stacks address, transaction signatures, timestamp, and token amounts are permanently recorded on the public Stacks blockchain. This is an inherent property of distributed ledger technology and cannot be altered or deleted by Sato.",
            "C. Technical & Diagnostic Information: To prevent denial-of-service attacks and enforce rate limits on our sponsored gas pool, our serverless relays log your IP address, device operating system, browser user agent, and request timestamps in transient logs.",
          ],
        },
        {
          heading: "3. Information We NEVER Collect or Store",
          body: [
            "Non-custodial security is the foundation of Sato. We explicitly do NOT collect, transmit, or store:",
            "• Your private keys, mnemonic seed phrases, or wallet passwords.",
            "• Your biometric data (fingerprints or FaceID data stay strictly on your phone's hardware Secure Enclave and are never accessible to our application code).",
            "• Unencrypted bank account credentials or debit/credit card PINs.",
          ],
        },
        {
          heading: "4. How We Use Your Information",
          body: [
            "We use the collected information strictly for operational and security purposes:",
            "• To co-sign and sponsor network gas fees via our /api/sponsor relay so you do not have to hold or pay STX fees.",
            "• To fulfill and verify utility payments (such as issuing prepaid electricity meter tokens or crediting cellular data bundles via VTPass).",
            "• To enforce anti-abuse rate limits (such as our 200 sponsored transactions per 24-hour window) and protect our shared gas pool.",
            "• To deliver essential transaction receipts and waitlist announcements via email (you may unsubscribe at any time).",
          ],
        },
        {
          heading: "5. Third-Party Service Providers",
          body: [
            "Sato partners with trusted third-party service providers to deliver specialized functionality. We only share information necessary for them to perform their services:",
            "• Blockchain Infrastructure: We query decentralized Stacks RPC nodes (operated by the Hiro Systems PBC and Stacks Foundation) to verify on-chain balances and transaction states.",
            "• Utility & Bill Partners: When paying utility bills, your meter number, phone number, and transaction amount are passed to our licensed utility aggregation partner (VTPass) to generate tokens and fulfill local bill payments.",
            "• Infrastructure & Anti-Abuse: Our API relays are hosted on Vercel, rate-limiting state is cached on Upstash Redis, and waitlist data is securely stored on Supabase using encrypted tables.",
            "• Email Services: We use Resend to deliver transactional confirmations and waitlist updates. We will never sell, rent, or trade your email address to advertisers or data brokers.",
          ],
        },
        {
          heading: "6. Data Retention & Cryptographic Safeguards",
          body: [
            "Technical diagnostic logs (such as IP addresses associated with sponsored transactions) are automatically purged within 30 days. Email addresses submitted for the waitlist or receipt delivery are retained until you request their deletion.",
            "All network traffic between the mobile application, web client, and our API relays is encrypted in transit using industry-standard TLS 1.3. Payment quotes are cryptographically signed using SHA-256 HMAC tokens with 20-minute expiration windows to prevent tampering.",
          ],
        },
        {
          heading: "7. Your Rights & Data Choices",
          body: [
            "Depending on your jurisdiction (including rights under the Nigerian Data Protection Regulation / NDPR and international privacy frameworks), you have the right to:",
            "• Access the personal information we hold about you (such as your waitlist submission).",
            "• Request the correction or complete deletion of your off-chain contact details.",
            "• Opt out of any non-essential email communications at any time by clicking the unsubscribe link.",
            "Note that public blockchain transactions are immutable and decentralized; we do not have the technical ability to erase or modify records that have been confirmed by Stacks miners.",
          ],
        },
        {
          heading: "8. Policy Updates & Contact",
          body: [
            "As we expand our fiat onramp/offramp capabilities and launch mainnet features, we may update this Privacy Policy. Any material changes will be reflected on this page with an updated effective date.",
            "For any questions, data subject requests, or privacy concerns, please contact our team at team.satofinance@gmail.com.",
          ],
        },
      ]}
    />
  );
}
