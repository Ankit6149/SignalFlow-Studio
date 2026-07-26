"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import PlatformIcon from "../components/PlatformIcon";

const ACCESS_TOKEN_KEY = "signalflow_owner_token";
const LIBRARY_KEY = "signalflow_recovery_library";
const OFFICIAL_CONNECTORS = new Set(["linkedin", "x", "reddit"]);

const CHANNELS = [
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

const CORE_CHANNELS = ["linkedin", "x", "instagram", "reddit"];
const DEFAULT_CHANNELS = ["linkedin", "x", "instagram", "reddit", "newsletter"];

const CHANNEL_GROUPS = [
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

const PROVIDERS = [
  { id: "template", label: "Local template", hint: "Works instantly. No key required." },
  { id: "gemini", label: "Gemini", hint: "Paste your Gemini API key or use the server configuration." },
  { id: "openai", label: "OpenAI", hint: "Paste your OpenAI key or use the server configuration." },
  { id: "claude", label: "Claude", hint: "Paste your Anthropic key or use the server configuration." },
  { id: "groq", label: "Groq", hint: "Fast hosted generation with your own key." },
  { id: "ollama", label: "Ollama", hint: "Runs against your local Ollama endpoint." },
  { id: "lmstudio", label: "LM Studio", hint: "Runs against your local LM Studio endpoint." },
  { id: "custom", label: "Custom provider", hint: "Use an OpenAI-compatible endpoint and model." },
];

const FAQS = [
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

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function downloadText(filename, value, type = "text/plain") {
  const blob = new Blob([value], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function channelMeta(id) {
  return CHANNELS.find((channel) => channel.id === id) || {
    id,
    label: id,
    tone: "Campaign draft",
    type: "Channel",
    limit: null,
    openUrl: "",
  };
}

function BrandMark({ compact = false, dark = false }) {
  return (
    <span
      className={`brand-mark ${compact ? "brand-mark--compact" : ""} ${dark ? "brand-mark--dark" : ""}`}
      aria-label="SignalFlow Studio"
    >
      <span className="brand-mark__glyph" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-mark__copy">
        <strong>SignalFlow</strong>
        {!compact && <small>STUDIO</small>}
      </span>
    </span>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M4 10h11M11 5l5 5-5 5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.7"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 2.8c.8 4.7 3.5 7.4 8.2 8.2-4.7.8-7.4 3.5-8.2 8.2-.8-4.7-3.5-7.4-8.2-8.2 4.7-.8 7.4-3.5 8.2-8.2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
      />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="6.5" y="6.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 12.5h-.2a1.8 1.8 0 0 1-1.8-1.8V4.3a1.8 1.8 0 0 1 1.8-1.8h6.4a1.8 1.8 0 0 1 1.8 1.8v.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LandingPage({ onEnter }) {
  return (
    <main className="landing-shell">
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>

      <header className="landing-nav">
        <a href="/" aria-label="SignalFlow Studio home">
          <BrandMark />
        </a>
        <nav className="landing-nav__links" aria-label="Landing navigation">
          <a href="#workflow">Workflow</a>
          <a href="#channels">Channels</a>
          <a href="#faq">FAQ</a>
        </nav>
        <div className="landing-nav__actions">
          <a href="https://github.com/Ankit6149/SignalFlow-Studio" target="_blank" rel="noreferrer">
            GitHub
          </a>
          <button className="button button--light button--small" onClick={onEnter}>
            Open studio <ArrowIcon />
          </button>
        </div>
      </header>

      <section className="landing-hero" id="main-content">
        <div className="landing-hero__copy">
          <div className="landing-announcement">
            <span>New</span>
            Twelve publishing destinations, one review-first campaign.
          </div>
          <p className="eyebrow">
            <span /> One idea. Every channel. Still your voice.
          </p>
          <h1>Turn what you built into content people actually stop for.</h1>
          <p className="landing-hero__lede">
            SignalFlow turns product notes, links, repositories, and source files into a complete,
            editable campaign—without forcing you through a maze of dashboards or pretending a post
            succeeded when it did not.
          </p>
          <div className="landing-hero__actions">
            <button className="button button--champagne button--premium" onClick={onEnter}>
              Create your first campaign <ArrowIcon />
            </button>
            <span>Local-first · Bring your own model · Review before publish</span>
          </div>
          <div className="landing-proof">
            <div>
              <strong>12</strong>
              <span>Output destinations</span>
            </div>
            <div>
              <strong>3</strong>
              <span>Official connectors</span>
            </div>
            <div>
              <strong>0</strong>
              <span>Fake publish states</span>
            </div>
          </div>
        </div>

        <div className="landing-hero__visual" aria-label="SignalFlow campaign preview">
          <div className="visual-glow" />
          <div className="visual-photo">
            <img src="/creator-working.png" alt="Creator preparing a campaign at a refined workspace" />
            <span>Raw material</span>
          </div>
          <article className="floating-card floating-card--main">
            <header>
              <div className="mini-brand">
                <span className="mini-brand__dot" /> SignalFlow campaign
              </div>
              <span className="status-pill">Ready to review</span>
            </header>
            <div className="floating-card__headline">A launch story, shaped for every room it enters.</div>
            <div className="floating-card__channels">
              {CORE_CHANNELS.map((platform) => (
                <span key={platform}>
                  <PlatformIcon platform={platform} size={16} />
                </span>
              ))}
            </div>
            <div className="floating-card__bars">
              <i />
              <i />
              <i />
            </div>
          </article>
          <article className="floating-card floating-card--note">
            <small>VOICE DIRECTION</small>
            <strong>Confident, human, precise.</strong>
          </article>
          <article className="floating-card floating-card--metric">
            <small>FROM ONE BRIEF</small>
            <strong>12 editable outputs</strong>
          </article>
        </div>
      </section>

      <section className="landing-strip" aria-label="SignalFlow workflow summary">
        <span>Describe once</span>
        <i />
        <span>Extract the signal</span>
        <i />
        <span>Preview natively</span>
        <i />
        <span>Publish only after approval</span>
      </section>

      <section className="landing-editorial" id="workflow">
        <div className="landing-editorial__intro">
          <p className="eyebrow eyebrow--dark">
            <span /> Built around the real job
          </p>
          <h2>Not another content dashboard. A clear path from proof to post.</h2>
          <p>
            SignalFlow keeps context, generation, review, platform routing, and export in one understandable
            flow. Every important action remains visible.
          </p>
        </div>
        <div className="editorial-grid">
          <article>
            <span className="editorial-index">A</span>
            <h3>Bring the evidence</h3>
            <p>
              Paste a product brief, launch URL, repository context, research links, or text files. The
              campaign begins with facts instead of generic prompts.
            </p>
          </article>
          <article>
            <span className="editorial-index">B</span>
            <h3>Shape each output</h3>
            <p>
              Edit channel-specific copy beside a focused preview, see character guidance, and keep every
              destination attached to the same campaign.
            </p>
          </article>
          <article>
            <span className="editorial-index">C</span>
            <h3>Route it honestly</h3>
            <p>
              Direct publishing appears only for configured official connectors. Every other destination gets
              a deliberate copy, export, and open-platform path.
            </p>
          </article>
        </div>
      </section>

      <section className="channel-showcase" id="channels">
        <div className="channel-showcase__copy">
          <p className="eyebrow eyebrow--dark">
            <span /> One system, the right format
          </p>
          <h2>Your campaign should travel without losing its voice.</h2>
          <p>
            Generate for professional networks, social feeds, communities, video platforms, newsletters,
            blogs, and product updates from the same source of truth.
          </p>
          <button className="button button--dark" onClick={onEnter}>
            Build a multi-channel campaign <ArrowIcon />
          </button>
        </div>
        <div className="channel-showcase__grid">
          {CHANNELS.map((channel) => (
            <article key={channel.id} className="channel-showcase__card">
              <span className="channel-showcase__icon">
                <PlatformIcon platform={channel.id} size={22} branded />
              </span>
              <div>
                <strong>{channel.label}</strong>
                <small>{OFFICIAL_CONNECTORS.has(channel.id) ? "Official connector available" : "Review and export path"}</small>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-faq" id="faq">
        <div className="landing-faq__heading">
          <p className="eyebrow eyebrow--dark">
            <span /> Clear answers
          </p>
          <h2>What teams need to know before trusting the flow.</h2>
        </div>
        <div className="landing-faq__list">
          {FAQS.map((item, index) => (
            <details key={item.question} open={index === 0}>
              <summary>{item.question}</summary>
              <p>{item.answer}</p>
            </details>
          ))}
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="eyebrow">
            <span /> Your work already has a story
          </p>
          <h2>Give it a publishing system worthy of it.</h2>
        </div>
        <button className="button button--champagne button--premium" onClick={onEnter}>
          Enter SignalFlow <ArrowIcon />
        </button>
      </section>

      <footer className="site-footer">
        <div>
          <BrandMark />
          <p>Review-first campaign creation for builders, founders, and small teams.</p>
        </div>
        <nav aria-label="Footer navigation">
          <a href="/privacy">Privacy</a>
          <a href="/terms">Terms</a>
          <a href="/llms.txt">llms.txt</a>
          <a href="/llms-full.txt">AI context</a>
          <a href="https://github.com/Ankit6149/SignalFlow-Studio" target="_blank" rel="noreferrer">
            GitHub
          </a>
        </nav>
      </footer>
    </main>
  );
}

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [section, setSection] = useState("studio");
  const [stage, setStage] = useState("source");
  const [form, setForm] = useState({
    projectName: "",
    notes: "",
    audience: "Founders, builders, and early users",
    links: "",
    repo: "",
    provider: "template",
    apiKey: "",
    model: "",
    baseUrl: "",
  });
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [files, setFiles] = useState([]);
  const [documentText, setDocumentText] = useState([]);
  const [result, setResult] = useState(null);
  const [posts, setPosts] = useState({});
  const [activeChannel, setActiveChannel] = useState("linkedin");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [library, setLibrary] = useState([]);
  const [connections, setConnections] = useState({});
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [accessToken, setAccessToken] = useState("");
  const [ownerKey, setOwnerKey] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [publishOptions, setPublishOptions] = useState({
    reddit: { subreddit: "", title: "" },
  });
  const fileInputRef = useRef(null);

  const provider = useMemo(
    () => PROVIDERS.find((item) => item.id === form.provider) || PROVIDERS[0],
    [form.provider],
  );
  const activeMeta = channelMeta(activeChannel);
  const currentPost = posts[activeChannel] || "";
  const currentConnection = connections[activeChannel] || null;
  const canPublishCurrent = Boolean(
    currentConnection?.connected && !currentConnection?.expired && !currentConnection?.manualOnly,
  );
  const xThreadParts = activeChannel === "x"
    ? currentPost.split(/\n\n+/).map((part) => part.trim()).filter(Boolean)
    : [];
  const xThreadMode = activeChannel === "x" && currentPost.length > activeMeta.limit && xThreadParts.length > 1;
  const xLongestPart = xThreadParts.reduce((longest, part) => Math.max(longest, part.length), 0);
  const characterValue = xThreadMode ? xLongestPart : currentPost.length;
  const characterPercent = activeMeta.limit
    ? Math.min(100, Math.round((characterValue / activeMeta.limit) * 100))
    : 0;
  const isOverLimit = Boolean(
    activeMeta.limit && (
      xThreadMode
        ? xThreadParts.length > 25 || xThreadParts.some((part) => part.length > activeMeta.limit)
        : currentPost.length > activeMeta.limit
    )
  );
  const sourceSignals = [
    form.notes.trim(),
    form.links.trim(),
    form.repo.trim(),
    ...documentText,
  ].filter(Boolean).length;
  const composeReady = sourceSignals > 0 && channels.length > 0;
  const connectedOfficialCount = Array.from(OFFICIAL_CONNECTORS).filter(
    (id) => connections[id]?.connected && !connections[id]?.expired,
  ).length;
  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAccessToken(window.localStorage.getItem(ACCESS_TOKEN_KEY) || "");
    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));

    const params = new URLSearchParams(window.location.search);
    const socialStatus = params.get("social_status");
    const socialMessage = params.get("social_message");
    if (socialStatus) {
      setEntered(true);
      setSection("connections");
      setMessage({
        type: socialStatus === "success" ? "success" : "error",
        text: socialMessage || "Connector flow completed.",
      });
      window.history.replaceState({}, "", window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!entered) return;
    refreshConnections();
  }, [entered, accessToken]);

  useEffect(() => {
    if (!channels.includes(activeChannel) && channels.length) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [entered, section]);

  function authHeaders(extra = {}) {
    return {
      ...extra,
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    };
  }

  function enterStudio() {
    setEntered(true);
    setSection("studio");
    setStage("source");
  }

  function navigateSection(nextSection) {
    setSection(nextSection);
  }

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function updatePublishOption(platform, key, value) {
    setPublishOptions((previous) => ({
      ...previous,
      [platform]: { ...(previous[platform] || {}), [key]: value },
    }));
  }

  function navigateStudioFlow(targetStage) {
    setStage(targetStage);
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
    });
  }

  function toggleChannel(channelId) {
    setChannels((previous) => {
      if (previous.includes(channelId)) {
        return previous.length === 1 ? previous : previous.filter((item) => item !== channelId);
      }
      return [...previous, channelId];
    });
  }

  function useCoreChannels() {
    setChannels(CORE_CHANNELS);
    setActiveChannel(CORE_CHANNELS[0]);
  }

  function selectAllChannels() {
    setChannels(CHANNELS.map((channel) => channel.id));
  }

  function moveReviewChannel(direction) {
    if (!channels.length) return;
    const nextIndex = (reviewIndex + direction + channels.length) % channels.length;
    setActiveChannel(channels[nextIndex]);
  }

  async function handleFiles(event) {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    const nextFiles = [];
    const nextText = [];
    for (const file of picked) {
      const isText =
        file.type.startsWith("text/") ||
        /\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);
      let extracted = false;
      if (isText && file.size <= 500000) {
        try {
          const text = await file.text();
          nextText.push(`FILE: ${file.name}\n${text.slice(0, 12000)}`);
          extracted = true;
        } catch {
          nextText.push(`FILE: ${file.name} (browser extraction failed)`);
        }
      }
      nextFiles.push({
        name: file.name,
        type: file.type || "file",
        size: file.size,
        extracted,
        description: extracted
          ? "Text content extracted in the browser."
          : "Asset metadata supplied as a creative reference; visual analysis is not enabled in this route.",
      });
    }

    setFiles((previous) => [...previous, ...nextFiles].slice(0, 12));
    setDocumentText((previous) => [...previous, ...nextText].slice(0, 12));
    event.target.value = "";
  }

  function removeFile(index) {
    const target = files[index];
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    if (target?.extracted) {
      const extractedIndex = files.slice(0, index).filter((file) => file.extracted).length;
      setDocumentText((previous) => previous.filter((_, itemIndex) => itemIndex !== extractedIndex));
    }
  }

  async function generateCampaign() {
    if (!form.notes.trim() && !form.links.trim() && !form.repo.trim() && documentText.length === 0) {
      setMessage({
        type: "error",
        text: "Add a brief, link, repository, or extractable text file before generating.",
      });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/launch_kit", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          project_name: form.projectName.trim() || "Untitled campaign",
          notes: form.notes.trim(),
          audience: form.audience.trim(),
          docs_url: form.links.trim(),
          repo: form.repo.trim(),
          channels,
          output_types: ["posts", "media_plan", "markdown", "json"],
          generator: form.provider,
          providerApiKey: form.apiKey.trim(),
          providerModelName: form.model.trim(),
          providerBaseUrl: form.baseUrl.trim(),
          document_text: documentText,
          media_items: files.map(({ name, type, size, description }) => ({
            name,
            type,
            size,
            description,
          })),
        }),
      });

      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || "SignalFlow could not generate this campaign.");
      }

      const generatedPosts = data.posts || {};
      setResult(data);
      setPosts(generatedPosts);
      setActiveChannel(channels.find((channel) => generatedPosts[channel]) || channels[0]);
      setStage("review");
      setMessage({
        type: data.fallbackUsed ? "warning" : "success",
        text: data.fallbackUsed
          ? "Campaign created with a fallback route. Review the generation note before publishing."
          : `Campaign generated with ${data.providerUsed || provider.label}.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function saveCampaign() {
    if (!result) return;
    const now = new Date().toISOString();
    const item = {
      id: `campaign-${Date.now()}`,
      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",
      createdAt: now,
      updatedAt: now,
      channels: [...channels],
      posts: { ...posts },
      providerUsed: result.providerUsed,
      fallbackUsed: Boolean(result.fallbackUsed),
      warnings: result.warnings || [],
      markdown: result.markdown || "",
      result,
      brief: { ...form, apiKey: "" },
      publishOptions,
    };
    const next = [item, ...library.filter((entry) => entry.title !== item.title)].slice(0, 30);
    setLibrary(next);
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
    setMessage({ type: "success", text: "Campaign saved to your local library." });
  }

  function openCampaign(item) {
    setForm((previous) => ({ ...previous, ...(item.brief || {}), apiKey: "" }));
    setChannels(item.channels || ["linkedin"]);
    setPosts(item.posts || {});
    setResult(item.result || { markdown: item.markdown, warnings: item.warnings || [] });
    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });
    setActiveChannel((item.channels || ["linkedin"])[0]);
    setStage("review");
    navigateSection("studio");
  }

  function deleteCampaign(id) {
    const next = library.filter((item) => item.id !== id);
    setLibrary(next);
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  }

  async function copyCurrentPost(showMessage = true) {
    if (!currentPost) return false;
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(currentPost);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = currentPost;
        textarea.setAttribute("readonly", "");
        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        textarea.remove();
      }
    } catch {
      setMessage({ type: "error", text: "The browser blocked clipboard access. Select the draft and copy it manually." });
      return false;
    }
    if (showMessage) {
      setMessage({ type: "success", text: `${activeMeta.label} draft copied.` });
    }
    return true;
  }

  async function copyAndOpenCurrent() {
    const copied = await copyCurrentPost(false);
    if (!copied) return;

    if (activeMeta.openUrl) {
      window.open(activeMeta.openUrl, "_blank", "noopener,noreferrer");
      setMessage({
        type: "success",
        text: `${activeMeta.label} draft copied. The platform was opened in a new tab.`,
      });
      return;
    }

    setMessage({
      type: "success",
      text: `${activeMeta.label} draft copied. Paste it into your publishing tool.`,
    });
  }

  function exportMarkdown() {
    const name = (form.projectName || "signalflow-campaign")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const approvedDrafts = channels
      .map((channel) => `## ${channelMeta(channel).label}\n\n${posts[channel] || "No draft generated."}`)
      .join("\n\n---\n\n");
    const strategy = result?.markdown ? `${result.markdown}\n\n---\n\n# Approved channel drafts\n\n` : "";
    downloadText(
      `${name || "signalflow-campaign"}.md`,
      `${strategy}${approvedDrafts}`,
      "text/markdown",
    );
  }

  function exportJson() {
    const name = (form.projectName || "signalflow-campaign")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    downloadText(
      `${name || "signalflow-campaign"}.json`,
      JSON.stringify({ campaign: form.projectName, channels, posts, publishOptions, result }, null, 2),
      "application/json",
    );
  }

  async function publishCurrentPost() {
    if (!currentPost) return;
    if (!canPublishCurrent) {
      if (OFFICIAL_CONNECTORS.has(activeChannel)) {
        navigateSection("connections");
        setMessage({
          type: "warning",
          text: currentConnection?.expired
            ? "This connector session expired. Reconnect the account before publishing."
            : currentConnection?.reason ||
              `${activeMeta.label} is not connected yet. Configure the official connector or use the copy-and-open route.`,
        });
      } else {
        await copyAndOpenCurrent();
      }
      return;
    }

    if (isOverLimit) {
      setMessage({
        type: "error",
        text: activeChannel === "x" && xThreadMode
          ? "Every X thread post must stay within 280 characters and a thread may contain at most 25 posts."
          : `This ${activeMeta.label} draft is over the ${activeMeta.limit.toLocaleString()} character guide.`,
      });
      return;
    }

    let options = {};
    if (activeChannel === "reddit") {
      const subreddit = String(publishOptions.reddit?.subreddit || "")
        .trim()
        .replace(/^r\//i, "");
      const title = String(publishOptions.reddit?.title || form.projectName || "").trim();
      if (!/^[A-Za-z0-9_]{2,21}$/.test(subreddit)) {
        setMessage({ type: "error", text: "Enter a valid subreddit name before publishing. Do not include spaces or the r/ prefix." });
        return;
      }
      if (!title) {
        setMessage({ type: "error", text: "Add a Reddit post title before publishing." });
        return;
      }
      options = { subreddit, title };
    }

    if (!window.confirm(`Publish this approved draft to ${activeMeta.label}?`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          platform: activeChannel,
          content: currentPost,
          projectName: form.projectName,
          options,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "The platform did not confirm publication.");
      setMessage({
        type: "success",
        text: data.message || `Published to ${activeMeta.label}.`,
      });
      await refreshConnections();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function refreshConnections() {
    setConnectionsLoading(true);
    try {
      const response = await fetch("/api/social/status", { headers: authHeaders() });
      if (!response.ok) throw new Error("Owner access is required to inspect official connectors.");
      const data = await response.json();
      setConnections(data.platforms || {});
    } catch {
      setConnections({});
    } finally {
      setConnectionsLoading(false);
    }
  }

  function connectPlatform(platform) {
    if (!accessToken) {
      navigateSection("settings");
      setMessage({
        type: "warning",
        text: "Unlock the owner session before connecting an official account.",
      });
      return;
    }
    window.location.assign(`/api/social/connect?platform=${encodeURIComponent(platform)}`);
  }

  async function disconnectPlatform(platform) {
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/social/disconnect", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ platform }),
      });
      const data = await response.json();
      if (!response.ok || !data.ok) {
        throw new Error(data.error || "Could not disconnect this account.");
      }
      setMessage({ type: "success", text: data.message });
      await refreshConnections();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function unlockOwnerSession() {
    if (!ownerKey.trim()) return;
    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ access_key: ownerKey.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "The owner key was not accepted.");
      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.token || "");
      setAccessToken(data.token || "");
      setOwnerKey("");
      setMessage({
        type: "success",
        text: data.locked === false
          ? "Access lock is disabled for this deployment."
          : "Owner session unlocked.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function lockOwnerSession() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => null);
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken("");
    setConnections({});
    setMessage({ type: "success", text: "Owner session closed." });
  }

  if (!entered) return <LandingPage onEnter={enterStudio} />;

  const selectedDirectCount = channels.filter((id) => OFFICIAL_CONNECTORS.has(id)).length;

  return (
    <div className="app-shell">
      <a className="skip-link" href="#workspace-content">
        Skip to workspace
      </a>

      <header className="app-header">
        <button className="brand-button" onClick={() => setEntered(false)} aria-label="Return to SignalFlow home">
          <BrandMark compact />
        </button>
        <nav className="app-nav" aria-label="Primary navigation">
          {[
            ["studio", "Studio"],
            ["library", "Library"],
            ["connections", "Connections"],
            ["settings", "Settings"],
          ].map(([id, label]) => (
            <button
              key={id}
              className={section === id ? "is-active" : ""}
              onClick={() => navigateSection(id)}
              aria-current={section === id ? "page" : undefined}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="app-header__status">
          <span className={`connection-light ${accessToken ? "connection-light--on" : ""}`} />
          <span>{accessToken ? "Owner session" : "Local mode"}</span>
        </div>
      </header>

      {message && (
        <div className={`toast toast--${message.type}`} role="status" aria-live="polite">
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}

      {section === "studio" && (
        <main className="studio-page" id="workspace-content" data-stage={stage}>
          <header className="studio-heading">
            <div>
              <p className="eyebrow eyebrow--dark">
                <span /> Campaign studio
              </p>
              <h1>
                {stage === "source"
                  ? "What are we telling the world?"
                  : stage === "destinations"
                    ? "Where should this story travel?"
                    : "Shape every draft before it leaves."}
              </h1>
              <p>
                {stage === "source"
                  ? "Bring the facts, proof, links, repository, and files. Keep this first step focused on product truth."
                  : stage === "destinations"
                    ? "Choose only the formats you need, then select the model route that will shape them."
                    : "Edit the words, watch platform guidance, then publish or export deliberately."}
              </p>
            </div>
            {stage === "review" && (
              <button className="button button--outline" onClick={() => setStage("source")}>
                Edit campaign brief
              </button>
            )}
          </header>

          <nav className="studio-flow" aria-label="Campaign creation steps">
            <button
              type="button"
              className={stage === "source" ? "is-active" : sourceSignals > 0 ? "is-complete" : ""}
              onClick={() => navigateStudioFlow("source")}
              aria-current={stage === "source" ? "step" : undefined}
            >
              <span className="studio-flow__index">01</span>
              <span><strong>Source</strong><small>Bring the facts and proof</small></span>
            </button>
            <button
              type="button"
              className={stage === "destinations" ? "is-active" : stage === "review" ? "is-complete" : ""}
              onClick={() => navigateStudioFlow("destinations")}
              disabled={sourceSignals === 0}
              aria-current={stage === "destinations" ? "step" : undefined}
            >
              <span className="studio-flow__index">02</span>
              <span><strong>Destinations & model</strong><small>Choose formats and generation route</small></span>
            </button>
            <button
              type="button"
              className={stage === "review" ? "is-active" : ""}
              onClick={() => result && navigateStudioFlow("review")}
              disabled={!result}
              aria-current={stage === "review" ? "step" : undefined}
            >
              <span className="studio-flow__index">03</span>
              <span><strong>Review</strong><small>Shape and route every draft</small></span>
            </button>
          </nav>

          <div className={`studio-grid ${stage === "review" ? "studio-grid--review" : ""}`}>
            <section className={`panel composer-panel ${stage !== "source" ? "is-step-hidden" : ""}`} id="campaign-source">
              <div className="panel-kicker">
                <span>01</span> Campaign brief
              </div>

              <label className="field">
                <span>Campaign name</span>
                <input
                  value={form.projectName}
                  onChange={(event) => updateForm("projectName", event.target.value)}
                  placeholder="e.g. SignalFlow public beta"
                />
              </label>

              <label className="field field--large">
                <span>What happened, and why should anyone care?</span>
                <textarea
                  value={form.notes}
                  onChange={(event) => updateForm("notes", event.target.value)}
                  placeholder="Paste the messy version: what you built, the problem, proof, launch details, quotes, numbers, and the action you want people to take."
                />
                <small>{form.notes.length.toLocaleString()} characters</small>
              </label>

              <div className="source-grid">
                <label className="field">
                  <span>Links to extract</span>
                  <textarea
                    className="compact-textarea"
                    value={form.links}
                    onChange={(event) => updateForm("links", event.target.value)}
                    placeholder="Docs, landing page, research links…"
                  />
                </label>
                <label className="field">
                  <span>GitHub repository</span>
                  <input
                    value={form.repo}
                    onChange={(event) => updateForm("repo", event.target.value)}
                    placeholder="https://github.com/owner/repo"
                  />
                </label>
              </div>

              <div
                className="upload-zone"
                onClick={() => fileInputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    fileInputRef.current?.click();
                  }
                }}
              >
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFiles} />
                <div className="upload-zone__icon">＋</div>
                <div>
                  <strong>Add source files</strong>
                  <span>Text and code are extracted; images stay honest asset references.</span>
                </div>
                <span className="text-button" aria-hidden="true">
                  Browse
                </span>
              </div>

              {files.length > 0 && (
                <div className="file-list">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="file-chip">
                      <span>{file.name}</span>
                      <small>
                        {file.extracted ? "Extracted" : `${Math.max(1, Math.round(file.size / 1024))} KB`}
                      </small>
                      <button
                        aria-label={`Remove ${file.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </section>

            <section className={`panel output-panel ${stage === "source" ? "is-step-hidden" : ""}`} id="campaign-destinations">
              <div className="panel-kicker panel-kicker--with-actions">
                <span>02</span>
                <b>Channels and output</b>
                <div>
                  <button onClick={useCoreChannels}>Core</button>
                  <button onClick={selectAllChannels}>All</button>
                </div>
              </div>

              <div className="channel-groups">
                {CHANNEL_GROUPS.map((group) => {
                  const groupChannels = group.channels.map(channelMeta);
                  const selectedCount = groupChannels.filter((channel) => channels.includes(channel.id)).length;
                  return (
                    <section className="channel-group" key={group.id} aria-labelledby={`channel-group-${group.id}`}>
                      <header className="channel-group__header">
                        <div>
                          <strong id={`channel-group-${group.id}`}>{group.label}</strong>
                          <small>{group.description}</small>
                        </div>
                        <span>{selectedCount}/{groupChannels.length} selected</span>
                      </header>
                      <div className="channel-picker">
                        {groupChannels.map((channel) => {
                          const selected = channels.includes(channel.id);
                          return (
                            <button
                              key={channel.id}
                              className={selected ? "channel-option is-selected" : "channel-option"}
                              onClick={() => toggleChannel(channel.id)}
                              aria-pressed={selected}
                            >
                              <span className="channel-option__mark">
                                <PlatformIcon platform={channel.id} size={18} branded={!selected} />
                              </span>
                              <span>
                                <strong>{channel.label}</strong>
                                <small>{channel.tone}</small>
                              </span>
                              <i>{selected ? "✓" : "+"}</i>
                            </button>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>


              <button
                className="advanced-toggle"
                onClick={() => setShowAdvanced((value) => !value)}
                aria-expanded={showAdvanced}
              >
                <span>Voice and model route</span>
                <span>{showAdvanced ? "−" : "+"}</span>
              </button>

              {showAdvanced && (
                <div className="advanced-panel">
                  <label className="field">
                    <span>Audience</span>
                    <input
                      value={form.audience}
                      onChange={(event) => updateForm("audience", event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Generation route</span>
                    <select
                      value={form.provider}
                      onChange={(event) => updateForm("provider", event.target.value)}
                    >
                      {PROVIDERS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                    <small>{provider.hint}</small>
                  </label>
                  {form.provider !== "template" &&
                    !["ollama", "lmstudio"].includes(form.provider) && (
                      <label className="field">
                        <span>Temporary API key</span>
                        <input
                          type="password"
                          value={form.apiKey}
                          onChange={(event) => updateForm("apiKey", event.target.value)}
                          placeholder="Used only for this request"
                          autoComplete="off"
                        />
                      </label>
                    )}
                  {["ollama", "lmstudio", "custom"].includes(form.provider) && (
                    <label className="field">
                      <span>Base URL</span>
                      <input
                        value={form.baseUrl}
                        onChange={(event) => updateForm("baseUrl", event.target.value)}
                        placeholder="http://localhost:11434"
                      />
                    </label>
                  )}
                  {form.provider !== "template" && (
                    <label className="field">
                      <span>Model override</span>
                      <input
                        value={form.model}
                        onChange={(event) => updateForm("model", event.target.value)}
                        placeholder="Leave blank for the default model"
                      />
                    </label>
                  )}
                </div>
              )}

              {stage === "destinations" ? (
                <div className="output-empty">
                  <div className="compose-readiness">
                    <div className="compose-readiness__top">
                      <div>
                        <span>Campaign readiness</span>
                        <h3>{composeReady ? "Ready to shape the campaign." : "Bring one strong source signal."}</h3>
                      </div>
                      <b className={composeReady ? "is-ready" : ""}>{composeReady ? "Ready" : "Needs source"}</b>
                    </div>
                    <p>
                      {composeReady
                        ? "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."
                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}
                    </p>
                    <div className="compose-readiness__metrics">
                      <div><strong>{sourceSignals}</strong><span>source signals</span></div>
                      <div><strong>{channels.length}</strong><span>destinations</span></div>
                      <div><strong>{provider.label}</strong><span>generation route</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="review-workspace">
                  <div className="review-tabs" aria-label="Campaign channels">
                    {channels.map((channelId) => {
                      const meta = channelMeta(channelId);
                      return (
                        <button
                          key={channelId}
                          className={activeChannel === channelId ? "is-active" : ""}
                          onClick={() => setActiveChannel(channelId)}
                        >
                          <span>
                            <PlatformIcon platform={channelId} size={13} />
                          </span>
                          {meta.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="review-nav" aria-label="Move between campaign drafts">
                    <button type="button" onClick={() => moveReviewChannel(-1)}>← Previous</button>
                    <button type="button" onClick={() => moveReviewChannel(1)}>Next →</button>
                  </div>

                  <div className={`native-preview native-preview--${activeChannel}`}>
                    <header>
                      <div className="preview-avatar">
                        <PlatformIcon platform={activeChannel} size={19} />
                      </div>
                      <div>
                        <strong>{activeMeta.label} draft</strong>
                        <span>{activeMeta.tone}</span>
                      </div>
                      <span className={`connection-badge ${canPublishCurrent ? "connection-badge--ready" : ""}`}>
                        {canPublishCurrent
                          ? "Direct publishing"
                          : OFFICIAL_CONNECTORS.has(activeChannel)
                            ? "Connector optional"
                            : "Export ready"}
                      </span>
                    </header>

                    <textarea
                      value={currentPost}
                      onChange={(event) =>
                        setPosts((previous) => ({
                          ...previous,
                          [activeChannel]: event.target.value,
                        }))
                      }
                      placeholder="No draft was generated for this channel."
                      aria-label={`${activeMeta.label} campaign draft`}
                    />

                    <footer>
                      <span className={isOverLimit ? "is-over-limit" : ""}>
                        {xThreadMode
                          ? `${xThreadParts.length} posts · longest ${xLongestPart.toLocaleString()} / ${activeMeta.limit.toLocaleString()} characters`
                          : `${currentPost.length.toLocaleString()}${activeMeta.limit ? ` / ${activeMeta.limit.toLocaleString()}` : ""} characters`}
                      </span>
                      <span>Editable before export or publish</span>
                    </footer>

                    {activeMeta.limit && (
                      <div
                        className={`character-guide ${isOverLimit ? "is-over-limit" : ""}`}
                        aria-label={`${characterPercent}% of character guide used`}
                      >
                        <span style={{ width: `${characterPercent}%` }} />
                      </div>
                    )}
                  </div>

                  <aside className="review-inspector" aria-label={`${activeMeta.label} draft guidance`}>
                    <div className="review-inspector__eyebrow">Channel intelligence</div>
                    <h3>{activeMeta.label}</h3>
                    <dl>
                      <div><dt>Voice</dt><dd>{activeMeta.tone}</dd></div>
                      <div><dt>Route</dt><dd>{canPublishCurrent ? "Connected official API" : OFFICIAL_CONNECTORS.has(activeChannel) ? "Official connector available; manual handoff remains available" : "Review, copy, export, and open-platform handoff"}</dd></div>
                      <div><dt>Length</dt><dd>{xThreadMode ? `${xThreadParts.length} posts; longest is ${xLongestPart} of ${activeMeta.limit} characters` : activeMeta.limit ? `${currentPost.length.toLocaleString()} of ${activeMeta.limit.toLocaleString()} characters` : `${currentPost.length.toLocaleString()} characters; no fixed guide`}</dd></div>
                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
                    </dl>
                    {activeChannel === "reddit" && (
                      <div className="review-publish-fields">
                        <label>
                          <span>Subreddit</span>
                          <input
                            value={publishOptions.reddit?.subreddit || ""}
                            onChange={(event) => updatePublishOption("reddit", "subreddit", event.target.value)}
                            placeholder="e.g. SideProject"
                          />
                        </label>
                        <label>
                          <span>Post title</span>
                          <input
                            value={publishOptions.reddit?.title || ""}
                            onChange={(event) => updatePublishOption("reddit", "title", event.target.value)}
                            placeholder={form.projectName || "A clear, factual title"}
                          />
                        </label>
                        <small>Required for direct Reddit publishing. Community rules still apply.</small>
                      </div>
                    )}
                  </aside>

                  <div className="review-actions">
                    <button className="button button--outline" onClick={() => copyCurrentPost()}>
                      <CopyIcon /> Copy draft
                    </button>
                    <button className="button button--outline" onClick={saveCampaign}>
                      Save locally
                    </button>
                    <button
                      className="button button--dark"
                      onClick={canPublishCurrent ? publishCurrentPost : copyAndOpenCurrent}
                      disabled={busy || !currentPost}
                    >
                      {canPublishCurrent
                        ? "Publish approved draft"
                        : activeMeta.openUrl
                          ? `Copy & open ${activeMeta.label}`
                          : "Copy approved draft"}
                      <ArrowIcon />
                    </button>
                  </div>

                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (
                    <button
                      className="publishing-route-link"
                      onClick={() => navigateSection("connections")}
                    >
                      Configure the official {activeMeta.label} connector
                      <ArrowIcon />
                    </button>
                  )}

                  {result?.warnings?.length > 0 && (
                    <details className="route-note">
                      <summary>Generation and integration notes ({result.warnings.length})</summary>
                      <ul>
                        {result.warnings.map((warning, index) => (
                          <li key={index}>{warning}</li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="export-row">
                    <div>
                      <strong>Take the full campaign with you</strong>
                      <span>Export every selected draft and the generation metadata.</span>
                    </div>
                    <button onClick={exportMarkdown}>Markdown</button>
                    <button onClick={exportJson}>JSON</button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="studio-actionbar" id="campaign-command">
            <div className="studio-actionbar__summary">
              <span>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}</span>
              <i />
              <span>{channels.length} destinations</span>
              <i />
              <span>{provider.label}</span>
            </div>
            <div className="studio-actionbar__actions">
              {stage !== "source" && (
                <button
                  type="button"
                  className="button button--outline"
                  onClick={() => navigateStudioFlow(stage === "review" ? "destinations" : "source")}
                  disabled={busy}
                >
                  Back
                </button>
              )}
              {stage === "source" ? (
                <button
                  type="button"
                  className="button button--champagne button--premium"
                  onClick={() => navigateStudioFlow("destinations")}
                  disabled={sourceSignals === 0}
                >
                  Continue to destinations <ArrowIcon />
                </button>
              ) : (
                <button
                  type="button"
                  className="button button--champagne button--premium"
                  onClick={generateCampaign}
                  disabled={busy || !composeReady}
                >
                  {busy
                    ? "Building campaign…"
                    : stage === "review"
                      ? "Regenerate campaign"
                      : "Build campaign"}
                  {!busy && <SparkIcon />}
                </button>
              )}
            </div>
          </div>
        </main>
      )}

      {section === "library" && (
        <main className="secondary-page" id="workspace-content">
          <header className="secondary-heading">
            <div>
              <p className="eyebrow eyebrow--dark">
                <span /> Local library
              </p>
              <h1>Your saved campaigns.</h1>
              <p>Stored in this browser. Nothing here is treated as published.</p>
            </div>
            <button
              className="button button--dark"
              onClick={() => {
                navigateSection("studio");
                setStage("source");
              }}
            >
              New campaign <ArrowIcon />
            </button>
          </header>

          {library.length === 0 ? (
            <div className="empty-library">
              <span>◇</span>
              <h2>No saved campaigns yet.</h2>
              <p>Generate a campaign, review it, then save it locally.</p>
            </div>
          ) : (
            <div className="library-grid">
              {library.map((item) => (
                <article key={item.id} className="library-card">
                  <div className="library-card__top">
                    <span>{item.fallbackUsed ? "Fallback route" : item.providerUsed || "Generated"}</span>
                    <small>{formatDate(item.updatedAt)}</small>
                  </div>
                  <h2>{item.title}</h2>
                  <div className="library-card__channels">
                    {(item.channels || []).map((id) => (
                      <span key={id} title={channelMeta(id).label}>
                        <PlatformIcon platform={id} size={14} />
                      </span>
                    ))}
                  </div>
                  <p>
                    {Object.values(item.posts || {})[0]?.slice(0, 170) || "Saved campaign package"}
                    {Object.values(item.posts || {})[0]?.length > 170 ? "…" : ""}
                  </p>
                  <footer>
                    <button onClick={() => openCampaign(item)}>Open campaign</button>
                    <button className="danger-link" onClick={() => deleteCampaign(item.id)}>
                      Delete
                    </button>
                  </footer>
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {section === "connections" && (
        <main className="secondary-page" id="workspace-content">
          <header className="secondary-heading">
            <div>
              <p className="eyebrow eyebrow--dark">
                <span /> Publishing paths
              </p>
              <h1>Every destination has a clear next step.</h1>
              <p>
                Official connectors publish only after approval. Manual destinations stay useful with a
                copy, export, and open-platform path.
              </p>
            </div>
            <button
              className="button button--outline"
              onClick={refreshConnections}
              disabled={connectionsLoading}
            >
              {connectionsLoading ? "Checking…" : "Refresh status"}
            </button>
          </header>

          <section className="connection-summary" aria-label="Publishing connection summary">
            <div>
              <strong>3</strong>
              <span>Official OAuth routes</span>
            </div>
            <div>
              <strong>{CHANNELS.length - OFFICIAL_CONNECTORS.size}</strong>
              <span>Export-ready destinations</span>
            </div>
            <div>
              <strong>100%</strong>
              <span>Review before action</span>
            </div>
          </section>

          <section className="connector-readiness" aria-labelledby="connector-readiness-title">
            <div className="connector-readiness__heading">
              <div>
                <h2 id="connector-readiness-title">Official connector readiness</h2>
                <p>Implementation, deployment credentials, account authorization, and live post verification are separate gates.</p>
              </div>
            </div>
            <div className="connector-readiness__grid">
              {Array.from(OFFICIAL_CONNECTORS).map((platformId) => {
                const status = connections[platformId] || {};
                const inspected = Boolean(accessToken && Object.keys(connections).length > 0);
                const ready = Boolean(inspected && status.configured && status.connected && !status.expired);
                const readinessLabel = connectionsLoading
                  ? "Checking"
                  : !inspected
                    ? "Unlock to inspect"
                    : ready
                      ? "Authorized"
                      : status.configured
                        ? "Needs authorization"
                        : "Needs credentials";
                return (
                  <article key={platformId} className="connector-readiness__card">
                    <header>
                      <h3>{channelMeta(platformId).label}</h3>
                      <span className={`readiness-state ${ready ? "is-ready" : ""}`}>{readinessLabel}</span>
                    </header>
                    <ul>
                      <li>Credentials: {!inspected ? "unlock and refresh to inspect" : status.configured ? "configured" : "missing in deployment"}</li>
                      <li>Authorization: {!inspected ? "not inspected" : status.expired ? "expired" : status.connected ? "active" : "not completed"}</li>
                      <li>Refresh: {!inspected ? "not inspected" : status.hasRefreshToken ? "available" : "not yet verified"}</li>
                      <li>Live post test: {status.readiness?.publishTest === "verified" ? "verified" : "required"}</li>
                      {status.callbackUrl && <li>Callback: <code>{status.callbackUrl}</code></li>}
                      {status.scopes?.length > 0 && <li>Scopes: {status.scopes.join(" · ")}</li>}
                    </ul>
                  </article>
                );
              })}
            </div>
          </section>

          <div className="connections-grid">
            {CHANNELS.map((channel) => {
              const status = connections[channel.id];
              const official = OFFICIAL_CONNECTORS.has(channel.id);
              const connected = Boolean(status?.connected && !status?.expired && !status?.manualOnly);
              const canConnect = official && Boolean(status?.configured);
              let description = status?.reason;

              if (!description && connected) {
                description = `Connected as ${
                  status?.profile?.username || status?.profile?.name || "official account"
                }.`;
              }
              if (!description && status?.expired) {
                description = "The stored session expired. Reconnect this account.";
              }
              if (!description && accessToken && canConnect) {
                description = "Official connector is configured and ready to connect.";
              }
              if (!description && accessToken && official) {
                description = "OAuth credentials are not configured in the deployment environment.";
              }
              if (!description && official) {
                description = "Unlock the owner session to inspect and connect the official publishing route.";
              }
              if (!description) {
                description = channel.openUrl
                  ? `Generate the draft, copy it, and open ${channel.label} from the review workspace.`
                  : "Generate and copy the approved draft into your existing publishing workflow.";
              }

              return (
                <article key={channel.id} className={`connection-card ${official ? "is-official" : ""}`}>
                  <div className="connection-card__mark">
                    <PlatformIcon platform={channel.id} size={23} branded />
                  </div>
                  <div className="connection-card__body">
                    <div className="connection-card__title">
                      <h2>{channel.label}</h2>
                      {official && <span>Official API</span>}
                    </div>
                    <p>{description}</p>
                  </div>
                  <div className="connection-card__actions">
                    <span className={connected ? "status-tag status-tag--ready" : "status-tag"}>
                      {connected
                        ? "Connected"
                        : status?.expired
                          ? "Expired"
                          : official
                            ? "Not connected"
                            : "Export ready"}
                    </span>
                    {connected && (
                      <button
                        className="connector-action connector-action--quiet"
                        onClick={() => disconnectPlatform(channel.id)}
                        disabled={busy}
                      >
                        Disconnect
                      </button>
                    )}
                    {!connected && canConnect && (
                      <button
                        className="connector-action"
                        onClick={() => connectPlatform(channel.id)}
                        disabled={busy}
                      >
                        Connect
                      </button>
                    )}
                    {!official && (
                      <button
                        className="connector-action connector-action--quiet"
                        onClick={() => {
                          navigateSection("studio");
                          setStage(result ? "review" : "compose");
                          if (!channels.includes(channel.id)) {
                            setChannels((previous) => [...previous, channel.id]);
                          }
                          setActiveChannel(channel.id);
                        }}
                      >
                        Use in Studio
                      </button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>

          <div className="truth-panel">
            <div>
              <span>Why this matters</span>
              <h2>Professional automation starts with truthful states.</h2>
            </div>
            <p>
              SignalFlow reports success only after a platform API confirms it. OAuth state and tokens are
              encrypted in HTTP-only cookies, while manual channels remain explicit instead of pretending to
              be connected.
            </p>
          </div>
        </main>
      )}

      {section === "settings" && (
        <main className="secondary-page settings-page" id="workspace-content">
          <header className="secondary-heading">
            <div>
              <p className="eyebrow eyebrow--dark">
                <span /> Product settings
              </p>
              <h1>Keep setup out of the creative flow.</h1>
              <p>Advanced access and provider details live here—not in the middle of every campaign.</p>
            </div>
          </header>

          <div className="settings-grid">
            <section className="settings-card">
              <span className="settings-card__number">01</span>
              <h2>Owner access</h2>
              <p>Unlock server-configured model routes and official social connectors for this hosted instance.</p>
              {accessToken ? (
                <div className="settings-success">
                  <span /> Owner session is active.
                  <button onClick={lockOwnerSession}>Close session</button>
                </div>
              ) : (
                <div className="settings-form">
                  <input
                    type="password"
                    value={ownerKey}
                    onChange={(event) => setOwnerKey(event.target.value)}
                    placeholder="Owner access key"
                  />
                  <button className="button button--dark" onClick={unlockOwnerSession} disabled={busy}>
                    Unlock
                  </button>
                </div>
              )}
            </section>

            <section className="settings-card">
              <span className="settings-card__number">02</span>
              <h2>Local data</h2>
              <p>Saved campaigns live in this browser. Export anything important before clearing local storage.</p>
              <div className="settings-actions">
                <button
                  onClick={() =>
                    downloadText(
                      "signalflow-local-library.json",
                      JSON.stringify(library, null, 2),
                      "application/json",
                    )
                  }
                >
                  Export library
                </button>
                <button
                  className="danger-link"
                  onClick={() => {
                    if (window.confirm("Clear the local campaign library?")) {
                      setLibrary([]);
                      window.localStorage.removeItem(LIBRARY_KEY);
                    }
                  }}
                >
                  Clear library
                </button>
              </div>
            </section>

            <section className="settings-card settings-card--wide">
              <span className="settings-card__number">03</span>
              <h2>Security and publishing policy</h2>
              <p>
                Temporary model keys are used only for the current generation request. Social OAuth tokens
                remain encrypted in HTTP-only cookies and are never returned to page JavaScript or saved in
                the campaign library. Manual channels never claim API publication.
              </p>
              <div className="settings-links">
                <a href="/privacy">Read privacy details</a>
                <a href="/terms">Read product terms</a>
                <a href="/llms.txt">Open AI-readable summary</a>
              </div>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
