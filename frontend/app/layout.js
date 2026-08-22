import "../app/globals.css";
import "../app/public-surfaces.css";
import "../app/connector.css";
import "../app/ui-containment.css";
import "../app/app-workspace.css";
import "../app/studio-product.css";
import "../app/campaign-freshness.css";
import "../app/campaign-versioning.css";
import "../app/responsive-studio.css";
import "../app/studio-decision-flow.css";
import WorkspaceAccessibility from "../components/WorkspaceAccessibility";

const siteUrl = "https://signal-flow-studio.vercel.app";
const repositoryUrl = "https://github.com/Ankit6149/SignalFlow-Studio";

const faq = [
  {
    question: "What can I use SignalFlow for today?",
    answer:
      "SignalFlow can capture manual ContentSignals, connect verified GitHub repository context into hosted Signals and Opportunities, continue connected Opportunities into durable Voice and NarrativeStrategy planning, and run the accepted exact-review path for LinkedIn and X. The legacy campaign builder remains compatibility-only while canonical Direct Create is rebuilt on the same Content OS records.",
  },
  {
    question: "What is SignalFlow?",
    answer:
      "SignalFlow is an approval-first content operating system. It is designed to reduce the operational work between meaningful work and audience communication while keeping judgment, explicit boundaries, and exact approval with the user.",
  },
  {
    question: "Does SignalFlow publish without approval?",
    answer:
      "No. Approval is bound to an exact visible revision. A changed or regenerated draft requires judgment again, and publication is kept separate from preparation until the external outcome is confirmed.",
  },
  {
    question: "Where is current state stored?",
    answer:
      "The accepted personal owner path still uses browser-local recovery for some records, while GitHub source connections, ProjectContext, Signals, Opportunities, Identity, NarrativeStrategy, and ContentPiece continuity are being moved into the hosted relational path. SignalFlow does not describe prepared content as publicly published until an external publication is confirmed.",
  },
  {
    question: "Can I bring my own model provider?",
    answer:
      "SignalFlow has a provider-neutral inference boundary and supports configured hosted, bring-your-own, local, and compatible custom routes where the active deployment can reach them. Privacy policy is part of routing and protected context must fail closed instead of silently falling back to a weaker route.",
  },
];

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": `${siteUrl}/#organization`,
      name: "SignalFlow Studio",
      url: siteUrl,
      logo: `${siteUrl}/icon.svg`,
      sameAs: [repositoryUrl],
    },
    {
      "@type": "WebSite",
      "@id": `${siteUrl}/#website`,
      url: siteUrl,
      name: "SignalFlow Studio",
      alternateName: "SignalFlow",
      description:
        "An approval-first content operating system built around Signals, narrative judgment, evidence, exact revision approval, and durable connected-source context.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": `${siteUrl}/#software`,
      name: "SignalFlow Studio",
      alternateName: "SignalFlow",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Content operating system and approval-first communication workflow",
      operatingSystem: "Web",
      browserRequirements: "Requires a modern browser with JavaScript enabled.",
      url: siteUrl,
      codeRepository: repositoryUrl,
      downloadUrl: repositoryUrl,
      isAccessibleForFree: true,
      license: `${repositoryUrl}/blob/master/LICENSE`,
      creator: { "@id": `${siteUrl}/#organization` },
      description:
        "SignalFlow captures meaningful work as Signals, evaluates whether it is worth communicating, resolves narrative direction with Voice and evidence, and returns exact review decisions to the user. Manual owner workflows and a durable GitHub-connected source and planning spine are implemented today; media production, generalized destination-by-form planning, durable publication, and confirmed-public memory continue behind the same canonical records.",
      keywords: [
        "content operating system",
        "content operations",
        "approval-first publishing",
        "content signals",
        "GitHub content workflow",
        "narrative planning",
        "exact revision approval",
        "bring your own AI model",
      ],
      featureList: [
        "Capture manual ContentSignals without requiring an AI call",
        "Connect verified GitHub repositories with bounded exact-revision context",
        "Create durable hosted ProjectContext, Signals, and Opportunities from connected repository work",
        "Continue connected Opportunities into durable Voice, NarrativeStrategy, and ContentPiece planning",
        "Review LinkedIn and X through immutable revisions with evidence and authenticity checks",
        "Approve one exact visible revision and invalidate approval after later edits or regeneration",
        "Preserve browser-local NarrativeMemory and explainable StyleMemory in the accepted owner path",
        "Route inference through provider-neutral tasks with explicit privacy constraints",
        "Keep silence and deliberate destination omission as valid outcomes",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
        availability: "https://schema.org/OnlineOnly",
      },
    },
    {
      "@type": "FAQPage",
      "@id": `${siteUrl}/#faq`,
      mainEntity: faq.map((item) => ({
        "@type": "Question",
        name: item.question,
        acceptedAnswer: {
          "@type": "Answer",
          text: item.answer,
        },
      })),
    },
  ],
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  applicationName: "SignalFlow Studio",
  title: {
    default: "SignalFlow Studio — Content Operating System",
    template: "%s | SignalFlow Studio",
  },
  description:
    "An approval-first content operating system that turns meaningful work into Signals, narrative opportunities, exact review decisions, and durable connected-source context while keeping judgment with you.",
  keywords: [
    "content operating system",
    "content operations",
    "content signals",
    "approval-first publishing",
    "AI content workflow",
    "GitHub content workflow",
    "narrative planning",
    "review before publish",
  ],
  authors: [{ name: "SignalFlow Studio", url: repositoryUrl }],
  creator: "SignalFlow Studio",
  publisher: "SignalFlow Studio",
  category: "software",
  alternates: {
    canonical: "/",
    types: {
      "application/ld+json": "/schema.jsonld",
      "text/plain": "/llms.txt",
    },
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "SignalFlow Studio",
    title: "SignalFlow Studio — Content Operating System",
    description:
      "Stay in the work. SignalFlow handles the useful middle between what happened and the judgment only you should make.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalFlow Studio content operating system — built around Signals, evidence, judgment, and exact approval",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalFlow Studio — Content Operating System",
    description:
      "Signals, connected work, narrative planning, and exact review — with judgment kept in your hands.",
    images: ["/opengraph-image"],
  },
  robots: {
    index: true,
    follow: true,
    nocache: false,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  icons: {
    icon: [{ url: "/icon.svg", type: "image/svg+xml" }],
    shortcut: "/icon.svg",
    apple: "/icon.svg",
  },
  manifest: "/manifest.webmanifest",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f7f8fb",
  colorScheme: "light",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="Concise AI context" />
        <link rel="alternate" type="text/plain" href="/llms-full.txt" title="Full AI context" />
        <link rel="alternate" type="application/ld+json" href="/schema.jsonld" title="Structured product data" />
        <link rel="author" type="text/plain" href="/humans.txt" title="Project authorship" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body>
        <WorkspaceAccessibility />
        {children}
      </body>
    </html>
  );
}
