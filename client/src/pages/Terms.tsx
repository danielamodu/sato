import LegalPage from "./LegalPage";

export default function Terms() {
  return <LegalPage eyebrow="Terms" title="The rules, before the launch." intro="A placeholder for the terms that will govern access to Sato and the services around it." updated="Coming before launch" sections={[{ heading: "What we plan to cover", body: "Before launch, this page will explain eligibility, account responsibilities, supported use, payments, cash-out flows, service limits, and how changes are communicated." }, { heading: "Regional availability", body: "Access may vary by country, currency, partner, and applicable requirements. The final terms will identify where Sato is available and any region-specific conditions." }, { heading: "Questions and support", body: "The final document will include a clear support path for questions, payment issues, account access, and complaints." }]} />;
}
