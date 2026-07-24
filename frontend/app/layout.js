import "../app/globals.css";
import "../app/connector.css";
import "../app/living-ui.css";
import "../app/living-ui-tuning.css";
import "../app/professional-polish.css";
import "../app/studio-luxury.css";
import SessionBridge from "../components/SessionBridge";

const siteUrl = "https://signal-flow-studio.vercel.app";
const repositoryUrl = "https://github.com/Ankit6149/SignalFlow-Studio";

const faq = [
  {
    question: "What does SignalFlow Studio actually create?",
    answer:
      "It turns product notes, public links, repository context, and text files into editable drafts for social, community, video, newsletter, blog, and release-note channels.",
  },
  {
    question: "Does SignalFlow publish without approval?",
    answer:
      "No. Every draft stays reviewable. Direct publishing is only offered when an official connector is configured and the platform API confirms success.",
  },
  {
    question: "Which platforms can publish directly?",
    answer:
      "LinkedIn, X, and Reddit have official OAuth connector paths in the current release. Other destinations use a clear copy, export, and open-platform workflow.",
  },
  {
    question: "Where are campaigns and account tokens stored?",
    answer:
      "Saved campaigns remain in the current browser. Social OAuth tokens are encrypted in HTTP-only cookies and are not exposed to page JavaScript.",
  },
  {
    question: "Can I use my own AI model or no AI at all?",
    answer:
      "Yes. SignalFlow includes a deterministic local template route and supports Gemini, OpenAI, Claude, Groq, Ollama, LM Studio, and custom OpenAI-compatible endpoints.",
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
        "A review-first campaign workspace that turns product context into editable drafts for social, community, video, newsletter, blog, and release-note destinations.",
      publisher: { "@id": `${siteUrl}/#organization` },
      inLanguage: "en",
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": `${siteUrl}/#software`,
      name: "SignalFlow Studio",
      alternateName: "SignalFlow",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "Campaign creation and product marketing workflow",
      operatingSystem: "Web",
      browserRequirements: "Requires a modern browser with JavaScript enabled.",
      url: siteUrl,
      codeRepository: repositoryUrl,
      downloadUrl: repositoryUrl,
      isAccessibleForFree: true,
      license: `${repositoryUrl}/blob/master/LICENSE`,
      creator: { "@id": `${siteUrl}/#organization` },
      description:
        "SignalFlow Studio turns product notes, public links, GitHub repository context, and uploaded text files into editable channel-specific campaign drafts. It supports local templates, bring-your-own-model generation, browser-local campaign saving, Markdown and JSON exports, and confirmed-only publishing through configured official connectors.",
      keywords: [
        "campaign creation software",
        "product launch content generator",
        "social media draft generator",
        "developer marketing tool",
        "repository to campaign",
        "review before publish",
        "local-first creator tool",
        "bring your own AI model",
      ],
      featureList: [
        "Create editable drafts for twelve publishing destinations",
        "Extract context from public links and GitHub repositories",
        "Read uploaded text, Markdown, CSV, JSON, and code files in the browser",
        "Use deterministic local templates without an API key",
        "Use Gemini, OpenAI, Claude, Groq, Ollama, LM Studio, or custom compatible endpoints",
        "Save campaign packages in the current browser",
        "Export approved campaigns as Markdown and JSON",
        "Publish through configured LinkedIn, X, and Reddit official connectors after approval",
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
    default: "SignalFlow Studio — One Brief, Every Channel",
    template: "%s | SignalFlow Studio",
  },
  description:
    "Turn product notes, links, repository context, and text files into editable campaign drafts for twelve destinations—then review, export, or publish through confirmed official connectors.",
  keywords: [
    "campaign creation software",
    "product launch content generator",
    "social media draft generator",
    "developer marketing",
    "AI content workflow",
    "local-first creator tools",
    "review before publish",
    "GitHub repository content generator",
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
    title: "SignalFlow Studio — One Brief, Every Channel",
    description:
      "A review-first campaign workspace for turning product context into editable drafts across twelve destinations.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: "SignalFlow Studio campaign workspace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "SignalFlow Studio — One Brief, Every Channel",
    description:
      "Turn one source brief into editable, reviewable campaign drafts for social, community, video, newsletter, blog, and release-note destinations.",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f3efe5" },
    { media: "(prefers-color-scheme: dark)", color: "#11110f" },
  ],
  colorScheme: "light dark",
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
        <SessionBridge />
        {children}
      </body>
    </html>
  );
}
