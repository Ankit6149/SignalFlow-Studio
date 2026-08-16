import SignalsWorkspace from "../../components/SignalsWorkspace";

export const metadata = {
  title: "Signals",
  description:
    "Capture durable manual ContentSignals before they become campaigns, opportunities, or generated content.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignalsPage() {
  return <SignalsWorkspace />;
}
