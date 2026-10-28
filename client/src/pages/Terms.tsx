import LegalPage from "./LegalPage";

export default function Terms() {
  return (
    <LegalPage
      eyebrow="Terms of Service"
      title="Clear rules for modern money."
      intro="Please read these Terms of Service carefully before using Sato. They govern your access to our mobile app, smart contracts, sponsored transaction network, and utility payment rails."
      updated="October 2026"
      statusBadge="Effective"
      asideTitle="Non-Custodial Agreement"
      asideText="Sato is a decentralized, non-custodial interface. You retain sole cryptographic ownership and control of your Bitcoin assets at all times."
      sections={[
        {
          heading: "1. Agreement to Terms & Eligibility",
          body: [
            "By accessing or using the Sato application, web interface, APIs, or smart contracts (collectively, the 'Services'), you agree to be bound by these Terms of Service ('Terms'). If you do not agree to these Terms, you must immediately cease all access and use of the Services.",
            "Eligibility: You must be at least 18 years old and legally competent to enter into these Terms under applicable law. You represent and warrant that you are not located in, resident of, or organized under the laws of any jurisdiction subject to comprehensive international sanctions or trade embargoes.",
          ],
        },
        {
          heading: "2. Non-Custodial Architecture & Key Ownership",
          body: [
            "Sato provides non-custodial software interfaces to public smart contracts deployed on the Stacks blockchain. When you create a wallet via the Sato mobile application, a cryptographic keypair is generated directly on your device. The private key is secured within your device's hardware Secure Enclave.",
            "Sole Responsibility: You maintain exclusive control over your private keys. Sato does NOT have access to, custody of, or the ability to reset your private key or recovery phrase. If you lose access to your device without maintaining an external backup, Sato has no technical means to recover your funds. You are solely responsible for all transactions originating from your wallet.",
          ],
        },
        {
          heading: "3. On-Chain Username Identity (@usernames)",
          body: [
            "Sato provides an interface to the sato-names smart contract, which records a public mapping between human-readable @usernames and Stacks principals.",
            "• Ownership: Once registered, your @username is recorded on the decentralized blockchain. Sato cannot revoke, modify, or seize a registered username.",
            "• Permitted Transfers: You may transfer your username to another Stacks address using the built-in transfer function.",
            "• Fair Use: You agree not to register trademarks, impersonate government agencies or existing businesses, or engage in malicious name squatting. Sato reserves the right to hide or delist offending handles from the application's search index.",
          ],
        },
        {
          heading: "4. Sponsored Transactions & Gas Subsidies",
          body: [
            "Sato provides a sponsored co-signing relay (/api/sponsor) that subsidizes the network gas fees (in STX) required to settle your sBTC transactions.",
            "• Courtesy Service: Gas sponsorship is a courtesy provided by Sato and is subject to fair-use rate limits (currently 200 transactions per 24-hour window per user).",
            "• Discretionary Enforcement: Sato reserves the right to reject, rate-limit, or restrict co-signing requests from automated bots, spam vectors, or addresses attempting to drain the gas pool.",
            "• Direct Broadcast Fallback: In the event of a sponsorship relay outage, users always retain the cryptographic capability to sign and broadcast transactions directly using their own STX gas.",
          ],
        },
        {
          heading: "5. Yield Accrual Mechanics & Risks",
          body: [
            "The sato-yield-v3 smart contract enables continuous per-block yield accrual on liquid sBTC balances and optional time-locked boost positions.",
            "• Variable APRs: Annual percentage rates (APRs) are dynamic and subject to protocol adjustment. Stated rates are annualized approximations and not guarantees of future returns.",
            "• Testnet Phase: On the Stacks testnet, sBTC tokens and yield rewards have zero commercial or cash value and are solely intended for software testing and interface verification.",
            "• Smart Contract Risks: While our contracts have undergone extensive automated testing (99 test suites), all blockchain software carries inherent risks of network halts, chain reorganizations, or unanticipated bugs.",
          ],
        },
        {
          heading: "6. Utility Bill Payments & Local Currency Offramp",
          body: [
            "Sato allows users to pay utility bills (such as electricity, airtime, cellular data, and cable TV) and execute local currency (Naira) cashouts.",
            "• Pricing Quotes: Bitcoin-to-Naira conversion rates are sourced from live market aggregators and locked via HMAC-signed quotes with a 20-minute expiration window.",
            "• Finality & Irreversibility: Once an on-chain sBTC transfer is confirmed and the bill fulfillment request is submitted to our utility partner (VTPass), the transaction is final and irreversible.",
            "• Destination Accuracy: You are solely responsible for ensuring the accuracy of meter numbers, phone numbers, and bank account details. Sato is not liable for tokens sent to incorrect meters or phone numbers entered by the user.",
          ],
        },
        {
          heading: "7. Prohibited Activities",
          body: [
            "You agree not to use Sato to engage in, facilitate, or promote:",
            "• Money laundering, terrorist financing, or proliferation financing.",
            "• Fraud, identity theft, unauthorized access, or distribution of malware.",
            "• Exploitation of smart contracts, denial-of-service attacks, or bypassing rate limits.",
            "• Purchasing or selling illicit goods, weapons, or illegal substances.",
          ],
        },
        {
          heading: "8. Disclaimers of Warranties",
          body: [
            "THE SERVICES ARE PROVIDED ON AN 'AS IS' AND 'AS AVAILABLE' BASIS WITHOUT WARRANTIES OF ANY KIND, WHETHER EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, OR FREEDOM FROM PROGRAM ERRORS.",
            "SATO DOES NOT WARRANT THAT THE SERVICES WILL BE UNINTERRUPTED, TIMELY, SECURE, OR ERROR-FREE, OR THAT NETWORK CONFIRMATIONS WILL OCCUR WITHIN A SPECIFIC TIMEFRAME.",
          ],
        },
        {
          heading: "9. Limitation of Liability",
          body: [
            "TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL SATO, ITS FOUNDERS, CONTRIBUTORS, OR AFFILIATES BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES (INCLUDING LOSS OF PROFITS, DATA, CRYPTOGRAPHIC ASSETS, OR GOODWILL) ARISING OUT OF OR IN CONNECTION WITH YOUR USE OR INABILITY TO USE THE SERVICES.",
            "IN JURISDICTIONS THAT DO NOT ALLOW THE EXCLUSION OF CERTAIN WARRANTIES OR LIABILITIES, SATO'S TOTAL AGGREGATE LIABILITY SHALL NOT EXCEED THE TOTAL FEES PAID BY YOU TO SATO IN THE THREE (3) MONTHS PRECEDING THE CLAIM, OR ONE HUNDRED US DOLLARS ($100), WHICHEVER IS LESS.",
          ],
        },
        {
          heading: "10. Governing Law & Dispute Resolution",
          body: [
            "These Terms shall be governed by and construed in accordance with applicable laws, without regard to conflict of law principles.",
            "Informal Resolution: Before initiating any formal legal dispute, you agree to contact us at team.satofinance@gmail.com to attempt an informal, good-faith resolution.",
            "Binding Arbitration: Any dispute, controversy, or claim arising out of or relating to these Terms or the breach thereof that cannot be resolved informally shall be settled by binding individual arbitration.",
          ],
        },
      ]}
    />
  );
}
