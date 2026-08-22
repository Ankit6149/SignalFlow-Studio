import "./globals.css";
import WorkspaceAccessibility from "../components/WorkspaceAccessibility";

const siteUrl = "https://signal-flow-studio.vercel.app";

const schema = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "SignalFlow Studio",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: siteUrl,
  description:
    "SignalFlow Studio is a content operating system that turns real work and source context into reviewable, evidence-bound narratives.",
  offers: {
    "@type": "Offer",
    price: "0",
    priceCurrency: "USD",
  },
};

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "SignalFlow Studio — Content Operating System",
    template: "%s | SignalFlow Studio",
  },
  description:
    "Turn real work into content worth publishing. SignalFlow captures source context, finds the story, shapes the narrative, and brings exact revisions to you for judgment.",
  applicationName: "SignalFlow Studio",
  keywords: [
    "content operating system",
    "content workflow",
    "content intelligence",
    "content review",
    "narrative strategy",
    "GitHub content automation",
  ],
  authors: [{ name: "SignalFlow Studio" }],
  creator: "SignalFlow Studio",
  publisher: "SignalFlow Studio",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "SignalFlow Studio — Content Operating System",
    description:
      "The system between your work and the internet: capture what happened, find the story, shape the content, and approve the exact revision.",
    url: siteUrl,
    siteName: "SignalFlow Studio",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: "SignalFlow Studio — Content Operating System",
    description:
      "Turn real work into evidence-bound content without turning content into another job.",
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
  themeColor: "#f5f2eb",
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
