import "../app/globals.css";
import "../app/public-surfaces.css";
import "../app/connector.css";
import "../app/ui-containment.css";
import "../app/app-workspace.css";
import "../app/studio-product.css";
import "../app/campaign-freshness.css";
import "../app/campaign-versioning.css";
import "../app/responsive-studio.css";
import WorkspaceAccessibility from "../components/WorkspaceAccessibility";

const siteUrl = "https://signal-flow-studio.vercel.app";
const repositoryUrl = "https://github.com/Ankit6149/SignalFlow-Studio";

const faq = [
  {
    question: "What can I use SignalFlow Studio for today?",
    answer:
      "The current Studio turns manual source context such as notes, supported links, repository context, and supported text files into editable destination drafts through a real model route. Drafts stay reviewable, recoverable in the current browser, and exportable.",
  },
  {
    question: "What is SignalFlow becoming?",
    answer:
      "SignalFlow is being built as an approval-first content operating system: a layer that can turn meaningful work and source evidence into worthwhile content opportunities, production plans, reviewable content, durable publication, and narrative memory as those capabilities are implemented.",
  },
  {
    question: "Does SignalFlow publish without approval?",
    answer:
      "No. Every current draft stays reviewable. Direct publishing is only offered when an official connector is configured and the platform API confirms success.",
  },
  {
    question: "Where are campaigns and account tokens stored?",
    answer:
      "Saved campaigns remain in the current browser. Social OAuth tokens are encrypted in HTTP-only cookies and are not exposed to page JavaScript.",
  },
  {
    question: "Can I bring my own model provider?",
    answer:
      "Yes. SignalFlow supports configured Gemini, OpenAI, Claude, OpenRouter, Groq, Ollama, LM Studio, and compatible custom endpoints where the active deployment and session can reach them. Campaign generation requires a real model route.",
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
        "An approval-first content operating system in progress, built to reduce the operational work between meaningful work and audience communication while keeping judgment with the user.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": `${siteUrl}/#software`,
      name: "SignalFlow Studio",
      alternateName: "SignalFlow",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Content operations and approval-first publishing workflow",
      operatingSystem: "Web",
      browserRequirements: "Requires a modern browser with JavaScript enabled.",
      url: siteUrl,
      codeRepository: repositoryUrl,
      downloadUrl: repositoryUrl,
      isAccessibleForFree: true,
      license: `${repositoryUrl}/blob/master/LICENSE`,
      creator: { "@id": `${siteUrl}/#organization` },
      description:
        "The current SignalFlow Studio turns manual source context into editable destination drafts through real model-provider routes, with edit-safe browser-local campaign recovery, portable archive and export, MCP access, and confirmed-only publishing through configured official connectors. The broader content operating system direction adds signal detection, editorial opportunity ranking, media production, scheduling, and narrative memory as those capabilities are implemented.",
      keywords: [
        "content operating system",
        "content operations",
        "approval-first publishing",
        "AI content workflow",
        "developer communication",
        "review before publish",
        "local-first creator tools",
        "bring your own AI model",
      ],
      featureList: [
        "Turn manual source context into editable destination drafts",
        "Extract context from supported public links and GitHub repositories within current capability limits",
        "Read supported text, Markdown, CSV, JSON, and code files in the browser",
        "Use real configured hosted, bring-your-own, local, or compatible custom model routes",
        "Create campaigns directly through supported SignalFlow MCP operations",
        "Preserve edit-safe campaign revisions and browser-local recovery",
        "Prepare and validate portable SignalFlow campaign archives with explicit import conflict and rollback controls",
        "Export authoritative current drafts as Markdown and JSON",
        "Publish through configured LinkedIn, X, and Reddit official connector paths after approval and confirmed success",
        "Keep social OAuth sessions encrypted in HTTP-only cookies",
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
    "An approval-first content operating system in progress. Use the current Studio to turn real source context into reviewable drafts while broader automation is built transparently.",
  keywords: [
    "content operating system",
    "content operations",
    "approval-first publishing",
    "AI content workflow",
    "developer communication",
    "review before publish",
    "local-first creator tools",
    "GitHub content workflow",
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
      "Keep doing the work. SignalFlow is being built to handle the content operations around it while keeping judgment and approval with you.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalFlow Studio content operating system — built around evidence, judgment, and approval",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalFlow Studio — Content Operating System",
    description:
      "An approval-first content operating system in progress, with a usable manual Studio today and broader signal, production, publishing, and memory automation as the product direction.",
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
  themeColor: "#f5f5f2",
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
