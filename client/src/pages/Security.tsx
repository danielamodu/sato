import LegalPage from "./LegalPage";

export default function Security() {
  return <LegalPage eyebrow="Security" title="Security, explained plainly." intro="A placeholder for how Sato protects payments, accounts, and the systems around them." updated="Coming before launch" sections={[{ heading: "What we plan to publish", body: "Before launch, this page will describe Sato’s security architecture, operational safeguards, incident response process, and the responsibilities shared between Sato, network partners, and users." }, { heading: "Payment protection", body: "We’ll explain how payment details, recipient identity, confirmation states, and recovery flows are protected across the Sato experience." }, { heading: "Independent review", body: "Any relevant audits, assessments, or security documentation will be linked here once they are complete and appropriate to share publicly." }]} />;
}
