import OpportunityWorkspace from "../../../components/OpportunityWorkspace";

export const metadata = {
  title: "Evaluate Signal",
  description: "Judge whether a saved ContentSignal is worth communicating and select its narrative direction before any post is generated.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignalOpportunityPage() {
  return <OpportunityWorkspace />;
}
