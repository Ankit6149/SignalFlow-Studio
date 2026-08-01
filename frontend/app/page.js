"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import PortableTransferPanel from "../components/PortableTransferPanel";
import PlatformIcon from "../components/PlatformIcon";
import {
  createSourceSnapshot,
  resolveStudioStage,
  restoreSourceSnapshot,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";
import {
  evaluateProviderReadiness,
  pickRecommendedProvider,
} from "../lib/studio/providerReadiness.mjs";
import {
  createGenerationRun,
  createGenerationSourceSnapshot,
  getCampaignFreshness,
  getGenerationSourceChanges,
  restoreGenerationRun,
} from "../lib/studio/campaignFreshness.mjs";
import {
  campaignReducer,
  createInitialCampaignState,
} from "../lib/studio/campaignState.mjs";
import { acceptGenerationResponse } from "../lib/studio/generationAcceptance.mjs";
import {
  editedChannels,
  regenerationTargets,
  REGENERATION_POLICIES,
} from "../lib/studio/regenerationPolicy.mjs";
import {
  selectCampaignStatus,
  selectChannelStatus,
  selectPublishAvailability,
} from "../lib/studio/campaignStatus.mjs";
import {
  createUploadSourceBundle,
  projectGenerationMediaItem,
} from "../lib/domain/sourceArtifacts.mjs";
import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";
import { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";

const LEGACY_ACCESS_TOKEN_KEY = "signalflow_owner_token";
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
  { id: "gemini", label: "Gemini", hint: "Use a temporary Google AI Studio key or the securely configured server route." },
  { id: "openai", label: "OpenAI", hint: "Use a temporary OpenAI key or the securely configured server route." },
  { id: "claude", label: "Claude", hint: "Use a temporary Anthropic key or the securely configured server route." },
  { id: "openrouter", label: "OpenRouter", hint: "Route generation through a model available in your OpenRouter account." },
  { id: "groq", label: "Groq", hint: "Use a Groq key for fast hosted generation." },
  { id: "custom", label: "Custom gateway", hint: "Use an OpenAI-compatible endpoint and model." },
  { id: "ollama", label: "Ollama", hint: "Use a reachable Ollama endpoint in local or trusted self-hosted deployments." },
  { id: "lmstudio", label: "LM Studio", hint: "Use a reachable LM Studio endpoint in local or trusted self-hosted deployments." },
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
    question: "Can I bring my own model provider?",
    answer:
      "Yes. SignalFlow supports Gemini, OpenAI, Claude, OpenRouter, Groq, Ollama, LM Studio, and custom OpenAI-compatible endpoints. Campaign generation requires a real model route.",
  },
];

function safeJsonParse(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

async function readJsonResponse(response, fallbackMessage) {
  const text = await response.text();
  const parsed = safeJsonParse(text, null);
  if (parsed && typeof parsed === "object") return parsed;
  throw new Error(response.ok ? fallbackMessage : `${fallbackMessage} (HTTP ${response.status})`);
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

const SOURCE_STATE_PRESENTATION = Object.freeze({
  usable_evidence: { label: "Usable evidence", description: "Verified extracted content can contribute to generation." },
  reference_only: { label: "Reference only", description: "Retained as context but not counted as extracted evidence." },
  processing: { label: "Processing", description: "This source is not ready for generation yet." },
  failed: { label: "Failed", description: "Ingestion or extraction failed; review or replace this source." },
  unsupported: { label: "Unsupported", description: "The current deployment cannot process this source type." },
});

function sourceFilePresentation(file) {
  const state = file?.sourceArtifact?.usability?.state
    || (file?.extracted ? "usable_evidence" : "reference_only");
  const presentation = SOURCE_STATE_PRESENTATION[state] || SOURCE_STATE_PRESENTATION.reference_only;
  const evidenceState = file?.sourceArtifact?.usability?.evidenceState || (file?.extracted ? "verified" : "unverified");
  return {
    state,
    label: presentation.label,
    description: presentation.description,
    evidenceLabel: evidenceState === "verified" ? "Verified evidence" : evidenceState === "not_applicable" ? "Evidence not applicable" : "Unverified evidence",
    versionId: file?.sourceArtifact?.sourceArtifactVersionId || "Legacy source",
  };
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

function createClientId(kind) {
  const randomId = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `signalflow-${kind}-${randomId}`;
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
  const [campaignState, dispatchCampaign] = useReducer(
    campaignReducer,
    undefined,
    createInitialCampaignState,
  );
  const {
    stage,
    result,
    generationRun,
    posts,
    generatedPosts,
    channelStates,
    activeChannel,
    archives,
    revision,
    savedRevision,
    exportedRevision,
    lastSavedAt,
    lastExportedAt,
    savedSourceFingerprint,
  } = campaignState;
  const [form, setForm] = useState({
    projectName: "",
    notes: "",
    audience: "Founders, builders, and early users",
    links: "",
    repo: "",
    provider: "gemini",
    apiKey: "",
    model: "",
    baseUrl: "",
  });
  const [channels, setChannels] = useState(DEFAULT_CHANNELS);
  const [files, setFiles] = useState([]);
  const [documentText, setDocumentText] = useState([]);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [library, setLibrary] = useState([]);
  const [currentCampaignId, setCurrentCampaignId] = useState("");
  const [regenerationDialogOpen, setRegenerationDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);
  const [connections, setConnections] = useState({});
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [providerStatuses, setProviderStatuses] = useState({});
  const [capabilitySnapshot, setCapabilitySnapshot] = useState(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);
  const [providerTest, setProviderTest] = useState({ status: "idle", message: "" });
  const [accessToken, setAccessToken] = useState("");
  const [ownerKey, setOwnerKey] = useState("");
  const [publishOptions, setPublishOptions] = useState({
    reddit: { subreddit: "", title: "" },
  });
  const fileInputRef = useRef(null);
  const campaignApplication = useMemo(() => createBrowserCampaignApplication({
    getStorage: () => window.localStorage,
    key: LIBRARY_KEY,
    limit: 30,
  }), []);

  const availableProviders = useMemo(
    () => PROVIDERS.filter(
      (item) => providerStatusLoading || providerStatuses[item.id]?.available !== false,
    ),
    [providerStatusLoading, providerStatuses],
  );
  const provider = useMemo(
    () => availableProviders.find((item) => item.id === form.provider) || availableProviders[0] || PROVIDERS[0],
    [availableProviders, form.provider],
  );
  const activeMeta = channelMeta(activeChannel);
  const currentPost = posts[activeChannel] || "";
  const currentConnection = connections[activeChannel] || null;
  const currentSourceSnapshot = useMemo(
    () =>
      createGenerationSourceSnapshot(
        { form, channels, files, documentText },
        { createdAt: null },
      ),
    [form, channels, files, documentText],
  );
  const campaignFreshness = getCampaignFreshness({
    hasResult: Boolean(result),
    currentSourceFingerprint: currentSourceSnapshot.fingerprint,
    generationRun,
  });
  const isCampaignStale = campaignFreshness.isStale;
  const sourceChangeLabels = isCampaignStale
    ? getGenerationSourceChanges(generationRun?.sourceSnapshot, currentSourceSnapshot)
    : [];
  const canPublishCurrent = Boolean(
    campaignFreshness.canUseCurrentGeneration &&
      currentConnection?.connected &&
      !currentConnection?.expired &&
      !currentConnection?.manualOnly,
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
  const providerReadiness = evaluateProviderReadiness({
    provider: form.provider,
    apiKey: form.apiKey,
    baseUrl: form.baseUrl,
    status: providerStatusLoading
      ? { available: false, reason: "Checking deployment capabilities…" }
      : providerStatuses[form.provider],
  });
  const sourceAndChannelsReady = sourceSignals > 0 && channels.length > 0;
  const composeReady = sourceAndChannelsReady && providerReadiness.ready;
  const connectedOfficialCount = Array.from(OFFICIAL_CONNECTORS).filter(
    (id) => connections[id]?.connected && !connections[id]?.expired,
  ).length;
  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));
  const sourceArtifactSummary = files.reduce((summary, file) => {
    const state = sourceFilePresentation(file).state;
    summary[state] = (summary[state] || 0) + 1;
    return summary;
  }, {});

  const campaignStatus = selectCampaignStatus({
    state: campaignState,
    isStale: isCampaignStale,
    currentSourceFingerprint: currentSourceSnapshot.fingerprint,
    hasCampaignId: Boolean(currentCampaignId),
  });
  const activeChannelStatus = selectChannelStatus({
    channelState: channelStates[activeChannel],
    isStale: isCampaignStale,
    content: currentPost,
  });
  const editedDraftChannels = editedChannels({ channels, channelStates });
  const uneditedRegenerationTargets = regenerationTargets({
    policy: REGENERATION_POLICIES.UNEDITED,
    channels,
    channelStates,
    activeChannel,
  });
  const publishAvailability = selectPublishAvailability({
    channelStatus: activeChannelStatus,
    isStale: isCampaignStale,
    hasContent: Boolean(currentPost),
    isOverLimit,
    connectorReady: canPublishCurrent,
    manualRoute: Boolean(activeMeta.openUrl || !OFFICIAL_CONNECTORS.has(activeChannel)),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    void campaignApplication.listCampaigns()
      .then(setLibrary)
      .catch(() => setMessage({
        type: "error",
        text: "The browser could not read or migrate the local campaign library.",
      }));
    void syncOwnerSession();
    void refreshProviderStatus();

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
    refreshProviderStatus();
  }, [entered, accessToken]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    function respondToCapabilityRequest(event) {
      const requestId = event?.detail?.requestId;
      if (!requestId || !capabilitySnapshot) return;
      window.dispatchEvent(new CustomEvent("SignalFlowCapabilitiesAvailable", {
        detail: { requestId, snapshot: capabilitySnapshot },
      }));
    }
    window.addEventListener("SignalFlowRequestCapabilities", respondToCapabilityRequest);
    return () => window.removeEventListener("SignalFlowRequestCapabilities", respondToCapabilityRequest);
  }, [capabilitySnapshot]);

  useEffect(() => {
    if (!channels.includes(activeChannel) && channels.length) {
      setActiveChannel(channels[0]);
    }
  }, [channels, activeChannel]);

  useEffect(() => {
    if (!regenerationDialogOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setRegenerationDialogOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [regenerationDialogOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, [entered, section]);

  async function refreshProviderStatus() {
    setProviderStatusLoading(true);
    try {
      const response = await fetch("/api/capabilities", { cache: "no-store" });
      const raw = await readJsonResponse(response, "SignalFlow could not read deployment capabilities.");
      if (!response.ok) throw new Error(raw.error || "SignalFlow could not read deployment capabilities.");
      const data = parseCapabilitySnapshot(raw);
      const statuses = data.capabilities.models.providers;
      setCapabilitySnapshot(data);
      setProviderStatuses(statuses);
      const recommended = pickRecommendedProvider({
        statuses,
        fallback: form.provider,
      });
      setForm((previous) => {
        const current = statuses[previous.provider];
        if (
          current?.available !== false &&
          (previous.apiKey.trim() || previous.baseUrl.trim() || current?.configured)
        ) {
          return previous;
        }
        return previous.provider === recommended ? previous : { ...previous, provider: recommended };
      });
    } catch (error) {
      setCapabilitySnapshot(null);
      setProviderStatuses(
        Object.fromEntries(PROVIDERS.map((item) => [item.id, {
          id: item.id,
          label: item.label,
          available: false,
          configured: false,
          reason: error.message || "SignalFlow could not verify this model route.",
        }])),
      );
    } finally {
      setProviderStatusLoading(false);
    }
  }

  async function testProviderConnection() {
    if (!providerReadiness.ready) {
      setProviderTest({ status: "error", message: providerReadiness.reason });
      return;
    }
    setProviderTest({ status: "testing", message: "Testing model route…" });
    try {
      const response = await fetch("/api/provider_test", {
        method: "POST",
        headers: authHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({
          provider: form.provider,
          modelName: form.model.trim(),
          baseUrl: form.baseUrl.trim(),
          temporaryApiKey: form.apiKey.trim(),
        }),
      });
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable provider test response.");
      if (!response.ok || !data.ok) throw new Error(data.error || "Model route test failed.");
      setProviderTest({ status: "success", message: data.message || "Model route connected successfully." });
      void refreshProviderStatus();
    } catch (error) {
      setProviderTest({ status: "error", message: error.message });
    }
  }

  async function syncOwnerSession() {
    try {
      const response = await fetch("/api/session");
      const data = await readJsonResponse(response, "SignalFlow could not verify the owner session.");
      setAccessToken(data.authenticated ? "cookie-session" : "");
    } catch {
      setAccessToken("");
    }
  }

  function authHeaders(extra = {}) {
    return { ...extra };
  }

  function setStage(nextStage) {
    dispatchCampaign({ type: "SET_STAGE", stage: nextStage });
  }

  function setActiveChannel(channel) {
    dispatchCampaign({ type: "SET_ACTIVE_CHANNEL", channel });
  }

  function startNewCampaign() {
    setCurrentCampaignId("");
    setRegenerationDialogOpen(false);
    setVersionHistoryOpen(false);
    dispatchCampaign({ type: "RESET_CAMPAIGN" });
    setForm({
      projectName: "",
      notes: "",
      audience: "Founders, builders, and early users",
      links: "",
      repo: "",
      provider: "gemini",
      apiKey: "",
      model: "",
      baseUrl: "",
    });
    setChannels(DEFAULT_CHANNELS);
    setFiles([]);
    setDocumentText([]);
    setPublishOptions({ reddit: { subreddit: "", title: "" } });
    setMessage(null);
    navigateSection("studio");
  }

  function enterStudio() {
    setEntered(true);
    startNewCampaign();
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

  function reportStaleCampaign() {
    setMessage({
      type: "warning",
      text: "Source inputs changed after generation. Regenerate the campaign before copying, exporting, or publishing these drafts.",
    });
  }

  function navigateStudioFlow(targetStage) {
    const nextStage = resolveStudioStage(targetStage, {
      hasSource: sourceSignals > 0,
      hasResult: Boolean(result),
    });
    setStage(nextStage);
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

    const { accepted, skippedCount } = selectAcceptedFiles(picked, files.length);
    if (!accepted.length) {
      setMessage({ type: "warning", text: "SignalFlow accepts up to 12 source files per campaign. Remove one before adding another." });
      event.target.value = "";
      return;
    }

    const nextFiles = [];
    const nextText = [];
    let extractionFailures = 0;
    for (const file of accepted) {
      const isText =
        file.type.startsWith("text/") ||
        /\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);
      let extractedText = "";
      let extractionFailed = false;
      if (isText && file.size <= 500000) {
        try {
          extractedText = (await file.text()).slice(0, 12000);
          nextText.push(`FILE: ${file.name}
${extractedText}`);
        } catch {
          extractionFailed = true;
          extractionFailures += 1;
        }
      }
      const now = new Date().toISOString();
      const bundle = createUploadSourceBundle({
        file: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          clientReferenceId: createClientId("upload"),
          truncated: extractedText.length === 12000,
        },
        extractedText,
        extractionFailed,
        workspaceId: "browser-local",
        campaignId: currentCampaignId || null,
        assetId: createClientId("asset"),
        sourceArtifactId: createClientId("source-artifact"),
        now,
      });
      nextFiles.push({
        name: bundle.sourceArtifact.originalName,
        type: bundle.sourceArtifact.mimeType,
        size: bundle.sourceArtifact.byteSize,
        extracted: bundle.sourceArtifact.extraction.state === "complete",
        description: bundle.sourceArtifact.userMetadata.description,
        asset: bundle.asset,
        sourceArtifact: bundle.sourceArtifact,
        createdAt: now,
      });
    }

    setFiles((previous) => [...previous, ...nextFiles]);
    setDocumentText((previous) => [...previous, ...nextText]);

    if (skippedCount > 0) {
      setMessage({ type: "warning", text: `Added ${accepted.length} file${accepted.length === 1 ? "" : "s"}; skipped ${skippedCount} because the campaign limit is 12.` });
    } else if (extractionFailures > 0) {
      setMessage({ type: "warning", text: `Added the files, but ${extractionFailures} text file${extractionFailures === 1 ? "" : "s"} could not be extracted in this browser.` });
    } else if (nextText.length === 0) {
      setMessage({ type: "warning", text: "The files were added as asset references only. Add a written brief because visual analysis is not enabled in this route yet." });
    }
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

  async function requestGeneration(requestedChannels) {
    if (!form.notes.trim() && !form.links.trim() && !form.repo.trim() && documentText.length === 0) {
      throw new Error("Add a brief, link, repository, or extractable text file before generating.");
    }
    if (!providerReadiness.ready) {
      navigateStudioFlow("destinations");
      throw new Error(providerReadiness.reason);
    }

    const requestedSourceSnapshot = createGenerationSourceSnapshot({
      form,
      channels,
      files,
      documentText,
    });
    const response = await fetch("/api/launch_kit", {
      method: "POST",
      headers: authHeaders({ "Content-Type": "application/json" }),
      body: JSON.stringify({
        project_name: form.projectName.trim() || "Untitled campaign",
        notes: form.notes.trim(),
        audience: form.audience.trim(),
        docs_url: form.links.trim(),
        repo: form.repo.trim(),
        channels: requestedChannels,
        output_types: ["posts", "media_plan", "markdown", "json"],
        generator: form.provider,
        providerApiKey: form.apiKey.trim(),
        providerModelName: form.model.trim(),
        providerBaseUrl: form.baseUrl.trim(),
        document_text: documentText,
        assets: files.map((file) => file.asset).filter(Boolean),
        source_artifacts: files.map((file) => file.sourceArtifact).filter(Boolean),
        media_items: files.map((file) => projectGenerationMediaItem(
          file.sourceArtifact || {
            ...file,
            assetId: file.asset?.assetId || file.assetId,
          },
          {
            workspaceId: file.sourceArtifact?.workspaceId || file.asset?.workspaceId || "browser-local",
            campaignId: file.sourceArtifact?.campaignId || file.asset?.campaignId || currentCampaignId || null,
            now: file.sourceArtifact?.createdAt || file.asset?.createdAt || file.createdAt || new Date(0).toISOString(),
          },
        )),
      }),
    });

    const data = await readJsonResponse(response, "SignalFlow returned an unreadable generation response.");
    if (!response.ok || data.ok === false) {
      throw new Error(data.error || "SignalFlow could not generate this campaign.");
    }
    const accepted = acceptGenerationResponse({ response: data, requestedChannels });
    const nextGenerationRun = createGenerationRun({
      sourceSnapshot: requestedSourceSnapshot,
      response: accepted.result,
      provider: form.provider,
      model: form.model.trim(),
    });
    return { accepted, nextGenerationRun, data };
  }

  async function generateInitialCampaign() {
    setBusy(true);
    setMessage(null);
    try {
      const { accepted, nextGenerationRun, data } = await requestGeneration(channels);
      dispatchCampaign({
        type: "ACCEPT_GENERATION",
        payload: {
          result: accepted.result,
          generationRun: nextGenerationRun,
          posts: accepted.posts,
          requestedChannels: channels,
          activeChannel: accepted.activeChannel,
        },
      });
      setMessage({
        type: accepted.failedChannels.length ? "warning" : "success",
        text: accepted.failedChannels.length
          ? `Campaign generated with ${data.providerUsed || provider.label}; ${accepted.failedChannels.join(", ")} failed without replacing successful drafts.`
          : `Campaign generated with ${data.providerUsed || provider.label}. Review and approve each destination before publishing.`,
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function performRegeneration(policy, channel = activeChannel) {
    const targetChannels = regenerationTargets({ policy, channels, channelStates, activeChannel: channel });
    if (!targetChannels.length) {
      setRegenerationDialogOpen(false);
      setMessage({ type: "warning", text: "There are no eligible destinations for this regeneration choice." });
      return;
    }

    setRegenerationDialogOpen(false);
    setBusy(true);
    setMessage(null);
    try {
      const { accepted, nextGenerationRun, data } = await requestGeneration(targetChannels);
      const archivedAt = new Date().toISOString();
      dispatchCampaign({
        type: "APPLY_REGENERATION",
        payload: {
          result: accepted.result,
          generationRun: nextGenerationRun,
          posts: accepted.posts,
          targetChannels,
          policy,
          archiveId: createClientId("archive"),
          archivedAt,
          activeChannel: policy === REGENERATION_POLICIES.CHANNEL ? channel : activeChannel,
        },
      });
      setMessage({
        type: accepted.failedChannels.length ? "warning" : "success",
        text: accepted.failedChannels.length
          ? `Regeneration completed with ${data.providerUsed || provider.label}; ${accepted.failedChannels.join(", ")} failed and their existing drafts were preserved.`
          : policy === REGENERATION_POLICIES.CHANNEL
            ? `${channelMeta(channel).label} regenerated. Every other destination remained unchanged.`
            : policy === REGENERATION_POLICIES.UNEDITED
              ? `Regenerated ${targetChannels.length} unedited destinations. ${editedDraftChannels.length} edited drafts were preserved exactly.`
              : "The previous campaign version was archived and all selected destinations were regenerated.",
      });
    } catch (error) {
      setMessage({ type: "error", text: `${error.message} Existing drafts and edits were not changed.` });
    } finally {
      setBusy(false);
    }
  }

  function handleGenerationAction() {
    if (!result) {
      void generateInitialCampaign();
      return;
    }
    if (campaignStatus.hasEditedDrafts) {
      setRegenerationDialogOpen(true);
      return;
    }
    void performRegeneration(REGENERATION_POLICIES.ARCHIVE_ALL);
  }

  function restoreArchivedVersion(archiveId) {
    const restoredAt = new Date().toISOString();
    dispatchCampaign({
      type: "RESTORE_ARCHIVE",
      payload: {
        archiveId,
        currentArchiveId: createClientId("archive"),
        restoredAt,
      },
    });
    setMessage({ type: "success", text: "Archived campaign version restored. Save to keep it as the current local version." });
  }

  function discardArchivedVersion(archiveId) {
    if (!window.confirm("Discard this archived campaign version? This cannot be undone.")) return;
    dispatchCampaign({ type: "DISCARD_ARCHIVE", archiveId });
  }

  function currentEditorState(overrides = {}) {
    return {
      revision,
      savedRevision,
      exportedRevision,
      lastSavedAt,
      lastExportedAt,
      savedSourceFingerprint,
      ...overrides,
    };
  }

  function currentCampaignInput(overrides = {}) {
    return {
      campaignId: currentCampaignId,
      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",
      channels: [...channels],
      posts: { ...posts },
      generatedPosts: { ...generatedPosts },
      channelStates: structuredClone(channelStates),
      archives: structuredClone(archives),
      result,
      generationRun,
      editorState: currentEditorState(),
      brief: { ...form },
      publishOptions,
      ...createSourceSnapshot(files, documentText),
      ...overrides,
    };
  }

  async function persistCampaign({ asCopy = false } = {}) {
    if (!result) return;
    const savedAt = new Date().toISOString();
    const input = currentCampaignInput({
      updatedAt: savedAt,
      editorState: currentEditorState({
        savedRevision: revision,
        lastSavedAt: savedAt,
        savedSourceFingerprint: currentSourceSnapshot.fingerprint,
      }),
    });
    try {
      const saved = asCopy
        ? await campaignApplication.saveAsCopy(input)
        : await campaignApplication.saveCampaign(input);
      setCurrentCampaignId(saved.campaignId);
      setLibrary(await campaignApplication.listCampaigns());
      dispatchCampaign({
        type: "MARK_SAVED",
        payload: { savedAt, sourceFingerprint: currentSourceSnapshot.fingerprint },
      });
      setMessage({
        type: "success",
        text: asCopy
          ? "Saved as a separate local campaign copy. The original remains unchanged."
          : "Campaign saved to your local library.",
      });
    } catch (error) {
      setMessage({
        type: "error",
        text: `The browser could not save this campaign${error?.name === "QuotaExceededError" ? " because local storage is full" : ""}. Export Markdown or JSON now before leaving this page.`,
      });
    }
  }

  async function saveCampaign() {
    await persistCampaign();
  }

  async function saveCampaignAsCopy() {
    await persistCampaign({ asCopy: true });
  }

  function openCampaign(item) {
    try {
      const restored = campaignApplication.openCampaign(item);
      setCurrentCampaignId(restored.campaignId);
      setForm((previous) => ({ ...previous, ...restored.brief, apiKey: "" }));
      setChannels(restored.channels);
      dispatchCampaign({
        type: "RESTORE_CAMPAIGN",
        payload: {
          posts: restored.posts,
          generatedPosts: restored.generatedPosts,
          channelStates: restored.channelStates,
          archives: restored.archives,
          result: restored.result,
          generationRun: restored.generationRun,
          revision: restored.revision,
          savedRevision: restored.savedRevision,
          exportedRevision: restored.exportedRevision,
          lastSavedAt: restored.lastSavedAt,
          lastExportedAt: restored.lastExportedAt,
          savedSourceFingerprint: restored.savedSourceFingerprint,
          activeChannel: restored.channels[0] || "linkedin",
        },
      });
      setPublishOptions(restored.publishOptions || { reddit: { subreddit: "", title: "" } });
      setFiles(restored.sourceFiles || []);
      setDocumentText(restored.documentText || []);
      setVersionHistoryOpen(false);
      navigateSection("studio");
    } catch {
      setMessage({ type: "error", text: "This saved campaign could not be migrated or opened safely." });
    }
  }

  async function deleteCampaign(campaignId) {
    if (!window.confirm("Delete this saved campaign from the current browser?")) return;
    try {
      await campaignApplication.deleteCampaign(campaignId);
      setLibrary(await campaignApplication.listCampaigns());
      if (currentCampaignId === campaignId) setCurrentCampaignId("");
    } catch {
      setMessage({ type: "error", text: "The browser could not update the local campaign library." });
    }
  }

  async function copyCurrentPost(showMessage = true) {
    if (isCampaignStale) {
      reportStaleCampaign();
      return false;
    }
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
    if (isCampaignStale) {
      reportStaleCampaign();
      return;
    }
    let openedWindow = null;
    if (activeMeta.openUrl) {
      openedWindow = window.open(activeMeta.openUrl, "_blank");
      if (openedWindow) openedWindow.opener = null;
    }

    const copied = await copyCurrentPost(false);
    if (!copied) return;

    if (activeMeta.openUrl) {
      setMessage({
        type: openedWindow ? "success" : "warning",
        text: openedWindow
          ? `${activeMeta.label} draft copied. The platform was opened in a new tab.`
          : `${activeMeta.label} draft copied, but the browser blocked the new tab. Open the platform manually.`,
      });
      return;
    }

    setMessage({ type: "success", text: `${activeMeta.label} draft copied. Paste it into your publishing tool.` });
  }

  function exportMarkdown() {
    if (campaignStatus.exportBlockedReason) {
      setMessage({ type: "warning", text: campaignStatus.exportBlockedReason });
      return;
    }
    try {
      const projection = campaignApplication.projectMarkdown(currentCampaignInput());
      downloadText(projection.filename, projection.content, projection.mimeType);
      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt: new Date().toISOString() } });
      setMessage({ type: "success", text: "Current campaign revision exported as Markdown." });
    } catch {
      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into Markdown." });
    }
  }

  function exportJson() {
    if (campaignStatus.exportBlockedReason) {
      setMessage({ type: "warning", text: campaignStatus.exportBlockedReason });
      return;
    }
    try {
      const projection = campaignApplication.projectJson(currentCampaignInput());
      downloadText(projection.filename, projection.content, projection.mimeType);
      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt: new Date().toISOString() } });
      setMessage({ type: "success", text: "Current campaign revision exported as versioned JSON." });
    } catch {
      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into JSON." });
    }
  }

  async function publishCurrentPost() {
    if (!publishAvailability.ready) {
      setMessage({ type: "warning", text: publishAvailability.reason });
      return;
    }
    if (!canPublishCurrent) {
      await copyAndOpenCurrent();
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
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable publishing response.");
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
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable connector response.");
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
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable disconnect response.");
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
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable session response.");
      if (!response.ok) throw new Error(data.error || "The owner key was not accepted.");
      setAccessToken(data.authenticated ? "cookie-session" : "");
      window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
      window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
      setOwnerKey("");
      setMessage({
        type: "success",
        text: data.locked === false ? "Access lock is disabled for this deployment." : "Owner session unlocked.",
      });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function lockOwnerSession() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => null);
    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
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
          <span className={`connection-light ${providerReadiness.ready ? "connection-light--on" : ""}`} />
          <span>{providerReadiness.ready ? `${accessToken ? "Owner · " : ""}${provider.label}` : "Model setup needed"}</span>
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
        <main
          className="studio-page"
          id="workspace-content"
          data-stage={stage}
          data-freshness={campaignFreshness.status}
        >
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
                <>
                  <div className="file-list" aria-label="Canonical campaign sources">
                    {files.map((file, index) => {
                      const sourceState = sourceFilePresentation(file);
                      return (
                        <div key={file.sourceArtifact?.sourceArtifactId || `${file.name}-${index}`} className="file-chip file-chip--canonical">
                          <span className="file-chip__identity">
                            <span>{file.name}</span>
                            <small title={sourceState.versionId}>
                              {sourceState.evidenceLabel} · {Math.max(1, Math.round(file.size / 1024))} KB
                            </small>
                          </span>
                          <span
                            className={`source-state-badge is-${sourceState.state}`}
                            title={sourceState.description}
                          >
                            {sourceState.label}
                          </span>
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
                      );
                    })}
                  </div>
                  <div className="source-contract-summary" role="status" aria-live="polite">
                    <strong>Source contract v1</strong>
                    <span>{sourceArtifactSummary.usable_evidence || 0} usable</span>
                    <i />
                    <span>{sourceArtifactSummary.reference_only || 0} reference only</span>
                    {(sourceArtifactSummary.processing || 0) > 0 && <><i /><span>{sourceArtifactSummary.processing} processing</span></>}
                    {(sourceArtifactSummary.failed || 0) > 0 && <><i /><span>{sourceArtifactSummary.failed} failed</span></>}
                  </div>
                </>
              )}

            </section>

            <section className={`panel output-panel ${stage === "source" ? "is-step-hidden" : ""}`} id="campaign-destinations">
              <div className="panel-kicker panel-kicker--with-actions">
                <span>02</span>
                <b>Channels and output</b>
                <div>
                  <button onClick={useCoreChannels}>Core</button>
                  <button onClick={selectAllChannels}>All</button>
                  <button onClick={() => setChannels([])}>Clear</button>
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


              <aside className="model-route-panel" aria-label="Model generation route">
                <header className="model-route-panel__header">
                  <div>
                    <div className="model-route-panel__eyebrow">Generation engine</div>
                    <h3>Model route</h3>
                  </div>
                  <span className={`model-route-status ${providerReadiness.ready ? "is-ready" : ""}`}>
                    {providerStatusLoading ? "Checking" : providerReadiness.ready ? "Ready" : "Setup needed"}
                  </span>
                </header>

                <div className="model-route-current" aria-live="polite">
                  <div>
                    <span>Current route</span>
                    <strong>{provider.label}</strong>
                  </div>
                  <small>{providerReadiness.ready ? "Ready for this campaign" : providerReadiness.reason}</small>
                </div>

                <div className="model-route-core">
                  <label className="field">
                    <span>Audience</span>
                    <input
                      value={form.audience}
                      onChange={(event) => updateForm("audience", event.target.value)}
                    />
                  </label>
                </div>

                <details className="model-route-advanced">
                  <summary>
                    <span>Advanced model settings</span>
                    <small>{provider.label}</small>
                  </summary>
                  <div className="model-route-advanced__content">
                    <div className="model-provider-grid" role="list" aria-label="Available model providers">
                      {availableProviders.map((item) => {
                        const configured = Boolean(providerStatuses[item.id]?.configured);
                        return (
                          <button
                            key={item.id}
                            type="button"
                            className={`model-provider-option ${form.provider === item.id ? "is-selected" : ""}`}
                            onClick={() => {
                              updateForm("provider", item.id);
                              setProviderTest({ status: "idle", message: "" });
                            }}
                            aria-pressed={form.provider === item.id}
                          >
                            <span>{item.label}</span>
                            <small className={configured ? "is-configured" : ""} aria-label={configured ? "Configured on server" : "Not configured on server"} />
                          </button>
                        );
                      })}
                    </div>

                    <div className="model-route-fields">
                      {!['ollama', 'lmstudio'].includes(form.provider) && (
                        <label className="field">
                          <span>Temporary API key</span>
                          <input
                            type="password"
                            value={form.apiKey}
                            onChange={(event) => updateForm("apiKey", event.target.value)}
                            placeholder={providerStatuses[form.provider]?.configured ? "Server route configured — optional override" : "Required when the server route is not configured"}
                            autoComplete="off"
                          />
                        </label>
                      )}
                      {['ollama', 'lmstudio', 'custom'].includes(form.provider) && (
                        <label className="field">
                          <span>Base URL</span>
                          <input
                            value={form.baseUrl}
                            onChange={(event) => updateForm("baseUrl", event.target.value)}
                            placeholder={form.provider === 'ollama' ? 'http://localhost:11434/v1' : form.provider === 'lmstudio' ? 'http://localhost:1234/v1' : 'https://provider.example/v1'}
                          />
                        </label>
                      )}
                      <label className="field">
                        <span>Model override</span>
                        <input
                          value={form.model}
                          onChange={(event) => updateForm("model", event.target.value)}
                          placeholder={providerStatuses[form.provider]?.defaultModel || "Leave blank for the provider default"}
                        />
                      </label>
                    </div>
                  </div>
                </details>

                <div className="model-route-actions">
                  <button
                    type="button"
                    className="button button--outline"
                    onClick={testProviderConnection}
                    disabled={providerTest.status === "testing" || !providerReadiness.ready}
                  >
                    {providerTest.status === "testing" ? "Testing…" : "Test connection"}
                  </button>
                </div>
                <p className={`model-route-message ${providerTest.status === "error" ? "is-error" : ""}`}>
                  {providerTest.status === "idle" ? providerReadiness.reason : providerTest.message}
                </p>
                <p className="model-route-note">
                  Temporary keys are sent only with this request. SignalFlow does not save them in the campaign library.
                </p>
              </aside>

              {stage === "destinations" ? (
                <div className="output-empty">
                  <div className="compose-readiness">
                    <div className="compose-readiness__top">
                      <div>
                        <span>Campaign readiness</span>
                        <h3>{!sourceAndChannelsReady ? "Choose source and destinations." : providerReadiness.ready ? "Ready to shape the campaign." : "Connect a model route."}</h3>
                      </div>
                      <b className={composeReady ? "is-ready" : ""}>{composeReady ? "Ready" : providerReadiness.ready ? "Needs source" : "Needs model"}</b>
                    </div>
                    <p>
                      {!sourceAndChannelsReady
                        ? "Add product evidence and select at least one destination."
                        : providerReadiness.ready
                          ? "SignalFlow has enough context and a real model route to build editable drafts."
                          : providerReadiness.reason}
                    </p>
                    <div className="compose-readiness__metrics">
                      <div><strong>{sourceSignals}</strong><span>source signals</span></div>
                      <div><strong>{channels.length}</strong><span>destinations</span></div>
                      <div><strong>{provider.label}</strong><span>generation route</span></div>
                    </div>
                  </div>
                </div>
              ) : (
                <div className={`review-workspace ${isCampaignStale ? "has-stale-campaign" : ""}`}>
                  <div className="campaign-status-strip" role="status" aria-live="polite">
                    <div className="campaign-status-strip__primary">
                      <span className={`campaign-state-badge is-${campaignStatus.campaignKey}`}>
                        {campaignStatus.campaignLabel}
                      </span>
                      <strong>{form.projectName.trim() || "Untitled campaign"}</strong>
                      <small>Revision {revision} · {campaignStatus.approvedCount}/{channels.length} approved · {campaignStatus.editedCount} edited</small>
                    </div>
                    <div className="campaign-status-strip__meta">
                      <small>{lastSavedAt ? `Saved ${formatDate(lastSavedAt)}` : "Not saved yet"}</small>
                      <small>{campaignStatus.isExportedCurrent ? `Exported ${formatDate(lastExportedAt)}` : lastExportedAt ? "Changed since last export" : "Not exported yet"}</small>
                    </div>
                  </div>
                  {isCampaignStale && (
                    <div className="campaign-stale-banner" role="alert" aria-live="assertive">
                      <div className="campaign-stale-banner__copy">
                        <span className="campaign-stale-banner__label">Source changed</span>
                        <strong>These drafts belong to an earlier campaign snapshot.</strong>
                      </div>
                      <p>
                        Review remains available, but SignalFlow blocks copy, export, and publishing until the
                        campaign is regenerated from the current source.
                      </p>
                      {sourceChangeLabels.length > 0 && (
                        <small>Changed: {sourceChangeLabels.join(", ")}.</small>
                      )}
                      <button type="button" onClick={() => navigateStudioFlow("destinations")}>
                        Review changes
                      </button>
                    </div>
                  )}
                  <div className="review-tabs" aria-label="Campaign channels">
                    {channels.map((channelId) => {
                      const meta = channelMeta(channelId);
                      const status = selectChannelStatus({
                        channelState: channelStates[channelId],
                        isStale: isCampaignStale,
                        content: posts[channelId] || "",
                      });
                      return (
                        <button
                          key={channelId}
                          className={activeChannel === channelId ? "is-active" : ""}
                          onClick={() => setActiveChannel(channelId)}
                          aria-label={`${meta.label}: ${status.label}`}
                        >
                          <span>
                            <PlatformIcon platform={channelId} size={13} />
                          </span>
                          <span className="review-tab__copy">
                            <strong>{meta.label}</strong>
                            <small className="review-tab__status">{status.label}</small>
                          </span>
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
                      <span className={`draft-state-badge is-${activeChannelStatus.key}`}>
                        {activeChannelStatus.label}
                      </span>
                    </header>

                    <textarea
                      value={currentPost}
                      onChange={(event) =>
                        dispatchCampaign({
                          type: "EDIT_POST",
                          channel: activeChannel,
                          text: event.target.value,
                        })
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
                      <div>
                        <dt>Route</dt>
                        <dd>
                          {isCampaignStale
                            ? "Blocked until regeneration from the current source"
                            : canPublishCurrent
                              ? "Connected official API"
                              : OFFICIAL_CONNECTORS.has(activeChannel)
                                ? "Official connector available; manual handoff remains available"
                                : "Review, copy, export, and open-platform handoff"}
                        </dd>
                      </div>
                      <div><dt>Length</dt><dd>{xThreadMode ? `${xThreadParts.length} posts; longest is ${xLongestPart} of ${activeMeta.limit} characters` : activeMeta.limit ? `${currentPost.length.toLocaleString()} of ${activeMeta.limit.toLocaleString()} characters` : `${currentPost.length.toLocaleString()} characters; no fixed guide`}</dd></div>
                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
                      <div><dt>Draft state</dt><dd>{activeChannelStatus.label}{activeChannelStatus.isEdited && activeChannelStatus.isApproved ? " · edited and approved" : ""}</dd></div>
                      <div><dt>Generation run</dt><dd>{channelStates[activeChannel]?.generationRunId || generationRun?.generationRunId || "Not tracked"}</dd></div>
                    </dl>

                    <div className="draft-state-actions" aria-label={`${activeMeta.label} draft state actions`}>
                      <button
                        type="button"
                        className={channelStates[activeChannel]?.approved ? "is-approved" : ""}
                        onClick={() => dispatchCampaign({
                          type: channelStates[activeChannel]?.approved ? "MARK_CHANNEL_NEEDS_REVIEW" : "MARK_CHANNEL_APPROVED",
                          channel: activeChannel,
                        })}
                        disabled={!currentPost || isCampaignStale}
                      >
                        {channelStates[activeChannel]?.approved ? "Return to review" : "Mark approved"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void performRegeneration(REGENERATION_POLICIES.CHANNEL, activeChannel)}
                        disabled={busy || !providerReadiness.ready}
                      >
                        Regenerate this channel
                      </button>
                      {channelStates[activeChannel]?.edited && generatedPosts[activeChannel] && (
                        <button
                          type="button"
                          onClick={() => dispatchCampaign({ type: "RESTORE_GENERATED", channel: activeChannel })}
                        >
                          Restore generated copy
                        </button>
                      )}
                    </div>

                    <div className="version-history">
                      <button
                        type="button"
                        className="version-history-toggle"
                        onClick={() => setVersionHistoryOpen((open) => !open)}
                        aria-expanded={versionHistoryOpen}
                      >
                        <span>Version history</span>
                        <span>{archives.length}</span>
                      </button>
                      {versionHistoryOpen && (
                        <div className="version-history-list">
                          {archives.length === 0 ? (
                            <small>No archived generation versions yet.</small>
                          ) : archives.map((archive) => (
                            <article className="version-history-item" key={archive.archiveId}>
                              <header>
                                <div>
                                  <strong>{archive.reason === "channel" ? "Channel regeneration" : archive.reason === "unedited" ? "Unedited regeneration" : "Full campaign version"}</strong>
                                  <small>{formatDate(archive.createdAt)} · revision {archive.revision}</small>
                                </div>
                              </header>
                              <div className="version-history-item__actions">
                                <button type="button" onClick={() => restoreArchivedVersion(archive.archiveId)}>Restore</button>
                                <button type="button" onClick={() => discardArchivedVersion(archive.archiveId)}>Discard</button>
                              </div>
                            </article>
                          ))}
                        </div>
                      )}
                    </div>
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
                    <button
                      className="button button--outline"
                      onClick={() => copyCurrentPost()}
                      disabled={Boolean(campaignStatus.copyBlockedReason) || !currentPost}
                      title={campaignStatus.copyBlockedReason || undefined}
                    >
                      <CopyIcon /> Copy draft
                    </button>
                    <div className="save-action-group">
                      <button className="button button--outline" onClick={saveCampaign} disabled={busy}>
                        {currentCampaignId ? "Save changes" : "Save locally"}
                      </button>
                      <button className="button button--outline" onClick={saveCampaignAsCopy} disabled={busy}>
                        Save as copy
                      </button>
                    </div>
                    <button
                      className="button button--dark"
                      onClick={publishCurrentPost}
                      disabled={busy || !publishAvailability.ready}
                      title={publishAvailability.reason || undefined}
                    >
                      {!publishAvailability.ready
                        ? channelStates[activeChannel]?.approved
                          ? "Action unavailable"
                          : "Approve to continue"
                        : canPublishCurrent
                          ? "Publish approved draft"
                          : activeMeta.openUrl
                            ? `Copy & open ${activeMeta.label}`
                            : "Copy approved draft"}
                      <ArrowIcon />
                    </button>
                    {!publishAvailability.ready && (
                      <p className="review-action-reason" role="status">{publishAvailability.reason}</p>
                    )}
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
                    <button onClick={exportMarkdown} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>Markdown</button>
                    <button onClick={exportJson} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>JSON</button>
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
                  onClick={handleGenerationAction}
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

      {regenerationDialogOpen && (
        <div
          className="regeneration-dialog-backdrop"
          onMouseDown={() => setRegenerationDialogOpen(false)}
        >
          <section
            className="regeneration-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="regeneration-dialog-title"
            aria-describedby="regeneration-dialog-description"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="regeneration-dialog__eyebrow">Protect manual work</div>
            <h2 id="regeneration-dialog-title">Choose how to regenerate.</h2>
            <p id="regeneration-dialog-description">
              {editedDraftChannels.length} destination{editedDraftChannels.length === 1 ? " has" : "s have"} manual edits. SignalFlow will never replace them without a deliberate choice.
            </p>
            <div className="regeneration-dialog__options">
              <button
                type="button"
                className="regeneration-option"
                autoFocus
                onClick={() => void performRegeneration(REGENERATION_POLICIES.UNEDITED)}
                disabled={uneditedRegenerationTargets.length === 0}
              >
                <strong>Regenerate only unedited destinations</strong>
                <span>Keep all {editedDraftChannels.length} edited drafts byte-for-byte unchanged and regenerate {uneditedRegenerationTargets.length} other destinations.</span>
              </button>
              <button
                type="button"
                className="regeneration-option"
                onClick={() => void performRegeneration(REGENERATION_POLICIES.ARCHIVE_ALL)}
              >
                <strong>Archive edits and regenerate everything</strong>
                <span>Save the complete current campaign in Version history, then regenerate all {channels.length} selected destinations.</span>
              </button>
            </div>
            <div className="regeneration-dialog__footer">
              <button type="button" onClick={() => setRegenerationDialogOpen(false)}>Cancel</button>
            </div>
          </section>
        </div>
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
              onClick={startNewCampaign}
            >
              New campaign <ArrowIcon />
            </button>
          </header>

          <PortableTransferPanel
            campaigns={library}
            onLibraryChanged={async () => {
              setLibrary(await campaignApplication.listCampaigns());
            }}
          />

          {library.length === 0 ? (
            <div className="empty-library">
              <span>◇</span>
              <h2>No saved campaigns yet.</h2>
              <p>Generate a campaign, review it, then save it locally.</p>
            </div>
          ) : (
            <div className="library-grid">
              {library.map((item) => (
                <article key={item.campaignId} className="library-card">
                  <div className="library-card__top">
                    <span>{item.providerUsed || "Generated"}</span>
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
                    {item.preview?.slice(0, 170) || "Saved campaign package"}
                    {item.preview?.length > 170 ? "…" : ""}
                  </p>
                  <footer>
                    <button onClick={() => openCampaign(item)}>Open campaign</button>
                    <button className="danger-link" onClick={() => deleteCampaign(item.campaignId)}>
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
                          setStage(result ? "review" : sourceSignals > 0 ? "destinations" : "source");
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
