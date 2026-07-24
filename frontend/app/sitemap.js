const siteUrl = "https://signal-flow-studio.vercel.app";

export default function sitemap() {
  const lastModified = new Date("2026-07-24T00:00:00.000Z");
  return [
    {
      url: siteUrl,
      lastModified,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${siteUrl}/privacy`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.35,
    },
    {
      url: `${siteUrl}/terms`,
      lastModified,
      changeFrequency: "monthly",
      priority: 0.35,
    },
  ];
}
