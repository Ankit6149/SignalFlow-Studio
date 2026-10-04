export const OFFICIAL_CONNECTORS = new Set(["linkedin", "x", "reddit"]);

export const CHANNELS = [
  {
    id: "linkedin",
    label: "LinkedIn",
    tone: "Founder story and professional narrative",
    type: "Social",
    limit: 3000,
    openUrl: "https://www.linkedin.com/feed/",
    featured: true,
  },
  {
    id: "x",
    label: "X",
    tone: "Concise launch post or builder thread",
    type: "Social",
    limit: 280,
    openUrl: "https://x.com/compose/post",
    featured: true,
  },
  {
    id: "instagram",
    label: "Instagram",
    tone: "Caption, hashtags, and visual direction",
    type: "Social",
    limit: 2200,
    openUrl: "https://www.instagram.com/",
    featured: true,
  },
  {
    id: "reddit",
    label: "Reddit",
    tone: "Useful, community-first discussion",
    type: "Community",
    limit: 40000,
    openUrl: "https://www.reddit.com/submit",
    featured: true,
  },
  {
    id: "facebook",
    label: "Facebook",
    tone: "Accessible update for pages and groups",
    type: "Social",
    limit: 63206,
    openUrl: "https://www.facebook.com/",
  },
  {
    id: "threads",
    label: "Threads",
    tone: "Conversational short-form launch note",
    type: "Social",
    limit: 500,
    openUrl: "https://www.threads.net/",
  },
  {
    id: "youtube",
    label: "YouTube",
    tone: "Video title, description, and CTA",
    type: "Video",
    limit: 5000,
    openUrl: "https://studio.youtube.com/",
  },
  {
    id: "tiktok",
    label: "TikTok",
    tone: "Hook, caption, and short-video direction",
    type: "Video",
    limit: 2200,
    openUrl: "https://www.tiktok.com/upload",
  },
  {
    id: "hackernews",
    label: "Hacker News",
    tone: "Objective Show HN launch copy",
    type: "Community",
    limit: 5000,
    openUrl: "https://news.ycombinator.com/submit",
  },
  {
    id: "newsletter",
    label: "Newsletter",
    tone: "Subject, preview, and long-form update",
    type: "Owned",
    limit: null,
    openUrl: "",
  },
  {
    id: "blog",
    label: "Blog",
    tone: "Structured editorial launch article",
    type: "Owned",
    limit: null,
    openUrl: "",
  },
  {
    id: "release_notes",
    label: "Release notes",
    tone: "Clear product changelog and rollout notes",
    type: "Owned",
    limit: null,
    openUrl: "",
  },
];

export const CORE_CHANNELS = ["linkedin", "x", "instagram", "reddit"];
export const DEFAULT_CHANNELS = ["linkedin", "x", "instagram", "reddit", "newsletter"];

export const CHANNEL_GROUPS = [
  {
    id: "social",
    label: "Social",
    description: "Daily feeds and professional networks",
    channels: ["linkedin", "x", "instagram", "facebook", "threads"],
  },
  {
    id: "community",
    label: "Community",
    description: "Conversation-led technical communities",
    channels: ["reddit", "hackernews"],
  },
  {
    id: "video",
    label: "Video",
    description: "Titles, hooks, descriptions, and direction",
    channels: ["youtube", "tiktok"],
  },
  {
    id: "owned",
    label: "Owned",
    description: "Long-form channels you control",
    channels: ["newsletter", "blog", "release_notes"],
  },
];

export const PROVIDERS = [
  { id: "gemini", label: "Gemini", hint: "Use a temporary Google AI Studio key or the securely configured server route." },
  { id: "openai", label: "OpenAI", hint: "Use a temporary OpenAI key or the securely configured server route." },
  { id: "claude", label: "Claude", hint: "Use a temporary Anthropic key or the securely configured server route." },
  { id: "openrouter", label: "OpenRouter", hint: "Route generation through a model available in your OpenRouter account." },
  { id: "groq", label: "Groq", hint: "Use a Groq key for fast hosted generation." },
  { id: "custom", label: "Custom gateway", hint: "Use an OpenAI-compatible endpoint and model." },
  { id: "ollama", label: "Ollama", hint: "Use a reachable Ollama endpoint in local or trusted self-hosted deployments." },
  { id: "lmstudio", label: "LM Studio", hint: "Use a reachable LM Studio endpoint in local or trusted self-hosted deployments." },
];

export function channelMeta(id) {
  return CHANNELS.find((channel) => channel.id === id) || {
    id,
    label: id,
    tone: "Campaign draft",
    type: "Channel",
    limit: null,
    openUrl: "",
  };
}
