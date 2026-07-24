import "../app/globals.css";
import "../app/connector.css";

const schema = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "Organization",
      "@id": "https://github.com/Ankit6149/SignalFlow-Studio#organization",
      name: "SignalFlow Studio",
      url: "https://github.com/Ankit6149/SignalFlow-Studio",
    },
    {
      "@type": ["SoftwareApplication", "WebApplication"],
      "@id": "https://github.com/Ankit6149/SignalFlow-Studio#software",
      name: "SignalFlow Studio",
      applicationCategory: "BusinessApplication",
      applicationSubCategory: "AI-assisted content campaign studio",
      operatingSystem: "Web",
      url: "https://signal-flow-studio.vercel.app/",
      codeRepository: "https://github.com/Ankit6149/SignalFlow-Studio",
      isAccessibleForFree: true,
      license: "https://github.com/Ankit6149/SignalFlow-Studio/blob/master/LICENSE",
      creator: {
        "@id": "https://github.com/Ankit6149/SignalFlow-Studio#organization",
      },
      description:
        "SignalFlow Studio turns a product brief, public links, repository context, and text source files into editable channel-specific campaign drafts with review, export, and confirmed-only publishing paths.",
      keywords: [
        "AI content campaign studio",
        "social media post generator",
        "developer marketing",
        "product launch content",
        "repository to social post",
        "review before publish",
        "creator tools",
        "local-first",
      ],
      featureList: [
        "Extract context from public links and GitHub repositories",
        "Read uploaded text, Markdown, CSV, JSON, and code files in the browser",
        "Generate editable channel-specific campaign drafts",
        "Create Markdown and JSON campaign exports",
        "Publish only through configured official connectors after user approval",
        "Keep OAuth sessions encrypted in HTTP-only browser cookies",
      ],
      offers: {
        "@type": "Offer",
        price: "0",
        priceCurrency: "USD",
      },
    },
    {
      "@type": "FAQPage",
      "@id": "https://github.com/Ankit6149/SignalFlow-Studio#faq",
      mainEntity: [
        {
          "@type": "Question",
          name: "What is SignalFlow Studio?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "SignalFlow Studio is an open-source campaign workspace that turns a product brief, links, repository context, and text source files into editable drafts for selected channels.",
          },
        },
        {
          "@type": "Question",
          name: "Does SignalFlow Studio need a separate backend?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "No. The hosted Next.js app contains the user interface, context extraction routes, generation adapters, exports, OAuth callbacks, and publishing routes.",
          },
        },
        {
          "@type": "Question",
          name: "What can SignalFlow Studio generate?",
          acceptedAnswer: {
            "@type": "Answer",
            text: "It generates editable platform-specific drafts, media directions, Markdown exports, JSON summaries, and reviewable publishing handoff metadata.",
          },
        },
      ],
    },
  ],
};

export const metadata = {
  title: "SignalFlow Studio — One Brief, Every Channel",
  description: "Turn product context into editable, reviewable channel-specific campaign drafts.",
  alternates: {
    types: {
      "application/ld+json": "/schema.jsonld",
      "text/plain": "/llms.txt",
    },
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="alternate" type="text/plain" href="/llms.txt" title="LLMs context" />
        <link rel="author" type="text/plain" href="/robots.txt" title="Crawler policy" />
        <link rel="alternate" type="application/ld+json" href="/schema.jsonld" title="Structured data" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schema) }}
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
