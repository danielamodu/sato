import LegalPage from "./LegalPage";

export default function Privacy() {
  return <LegalPage eyebrow="Privacy" title="Your information stays yours." intro="A placeholder for what Sato collects, why it is needed, and the choices you have." updated="Coming before launch" sections={[{ heading: "What we plan to explain", body: "Before launch, this page will list the information Sato collects, how it is used, how long it is kept, and which service providers help us operate the product." }, { heading: "Your choices", body: "We’ll describe how to access, correct, export, or delete information, along with how to manage communications and regional privacy rights." }, { heading: "Plain-language updates", body: "If the product or our use of information changes, we’ll explain what changed and provide a clear way to review the latest policy." }]} />;
}
