"use client";

import { useEffect, useMemo, useRef, useState } from "react";

const ACCESS_TOKEN_KEY = "signalflow_owner_token";
const LIBRARY_KEY = "signalflow_recovery_library";

const CHANNELS = [
  { id: "linkedin", label: "LinkedIn", mark: "in", tone: "Professional narrative" },
  { id: "x", label: "X", mark: "X", tone: "Sharp, concise thread" },
  { id: "instagram", label: "Instagram", mark: "◎", tone: "Visual caption" },
  { id: "reddit", label: "Reddit", mark: "r/", tone: "Community-first post" },
  { id: "newsletter", label: "Newsletter", mark: "✉", tone: "Long-form update" },
  { id: "blog", label: "Blog", mark: "Aa", tone: "Editorial article" },
];

const PROVIDERS = [
  { id: "template", label: "Local template", hint: "Works instantly. No key required." },
  { id: "gemini", label: "Gemini", hint: "Use your Gemini API key or server configuration." },
  { id: "openai", label: "OpenAI", hint: "Use your OpenAI key or server configuration." },
  { id: "claude", label: "Claude", hint: "Use your Anthropic key or server configuration." },
  { id: "groq", label: "Groq", hint: "Fast hosted generation with your key." },
  { id: "ollama", label: "Ollama", hint: "Runs against your local Ollama endpoint." },
  { id: "lmstudio", label: "LM Studio", hint: "Runs against your local LM Studio endpoint." },
  { id: "custom", label: "Custom OpenAI-compatible", hint: "Bring your own endpoint and model." },
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

function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark ${compact ? "brand-mark--compact" : ""}`} aria-label="SignalFlow Studio">
      <span className="brand-mark__glyph" aria-hidden="true">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-mark__copy">
        <strong>SignalFlow</strong>
        {!compact && <small>STUDIO</small>}
      </span>
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path d="M4 10h11M11 5l5 5-5 5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SparkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 2.8c.8 4.7 3.5 7.4 8.2 8.2-4.7.8-7.4 3.5-8.2 8.2-.8-4.7-3.5-7.4-8.2-8.2 4.7-.8 7.4-3.5 8.2-8.2Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  );
}

function LandingPage({ onEnter }) {
  return (
    <main className="landing-shell">
      <header className="landing-nav">
        <BrandMark />
        <div className="landing-nav__actions">
          <a href="https://github.com/Ankit6149/SignalFlow-Studio" target="_blank" rel="noreferrer">GitHub</a>
          <button className="button button--light button--small" onClick={onEnter}>Open studio <ArrowIcon /></button>
        </div>
      </header>

      <section className="landing-hero">
        <div className="landing-hero__copy">
          <p className="eyebrow"><span /> One idea. Every channel. Still your voice.</p>
          <h1>Turn what you built into content people actually stop for.</h1>
          <p className="landing-hero__lede">
            SignalFlow turns product notes, links, repositories, screenshots, and rough thoughts into a complete, reviewable publishing package—without forcing you through a maze of dashboards.
          </p>
          <div className="landing-hero__actions">
            <button className="button button--champagne" onClick={onEnter}>Create your first campaign <ArrowIcon /></button>
            <span>Local-first · Bring your own model · Review before publish</span>
          </div>
          <div className="landing-proof">
            <div><strong>01</strong><span>Add context</span></div>
            <div><strong>02</strong><span>Shape the story</span></div>
            <div><strong>03</strong><span>Approve each channel</span></div>
          </div>
        </div>

        <div className="landing-hero__visual" aria-label="SignalFlow campaign preview">
          <div className="visual-glow" />
          <div className="visual-photo">
            <img src="/creator-working.png" alt="Creator working at a refined desk" />
            <span>Raw material</span>
          </div>
          <article className="floating-card floating-card--main">
            <header>
              <div className="mini-brand"><span className="mini-brand__dot" /> SignalFlow campaign</div>
              <span className="status-pill">Ready to review</span>
            </header>
            <div className="floating-card__headline">A launch story, shaped for every room it enters.</div>
            <div className="floating-card__channels">
              <span>in</span><span>X</span><span>◎</span><span>✉</span>
            </div>
            <div className="floating-card__bars"><i /><i /><i /></div>
          </article>
          <article className="floating-card floating-card--note">
            <small>VOICE DIRECTION</small>
            <strong>Confident, human, precise.</strong>
          </article>
          <article className="floating-card floating-card--metric">
            <small>FROM ONE BRIEF</small>
            <strong>6 channel-ready drafts</strong>
          </article>
        </div>
      </section>

      <section className="landing-strip">
        <span>Describe once</span><i />
        <span>Extract the signal</span><i />
        <span>Preview natively</span><i />
        <span>Publish only after approval</span>
      </section>

      <section className="landing-editorial">
        <div className="landing-editorial__intro">
          <p className="eyebrow eyebrow--dark"><span /> Built around the real job</p>
          <h2>Not another content dashboard. A clear path from proof to post.</h2>
        </div>
        <div className="editorial-grid">
          <article>
            <span className="editorial-index">A</span>
            <h3>Bring the evidence</h3>
            <p>Paste a product brief, a launch URL, repository context, research links, or text files. SignalFlow keeps everything in one campaign.</p>
          </article>
          <article>
            <span className="editorial-index">B</span>
            <h3>See the actual output</h3>
            <p>Edit each channel beside a platform-style preview. No hidden generation step and no unexplained “workspace” objects.</p>
          </article>
          <article>
            <span className="editorial-index">C</span>
            <h3>Stay in control</h3>
            <p>Nothing is marked as published unless an official connector confirms it. Manual-only channels remain honestly manual.</p>
          </article>
        </div>
      </section>

      <section className="landing-cta">
        <div>
          <p className="eyebrow"><span /> Your work already has a story</p>
          <h2>Give it a publishing system worthy of it.</h2>
        </div>
        <button className="button button--champagne" onClick={onEnter}>Enter SignalFlow <ArrowIcon /></button>
      </section>
    </main>
  );
}

export default function Home() {
  const [entered, setEntered] = useState(false);
  const [section, setSection] = useState("studio");
  const [stage, setStage] = useState("compose");
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
  const [channels, setChannels] = useState(["linkedin", "x", "instagram"]);
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
  const fileInputRef = useRef(null);

  const provider = useMemo(() => PROVIDERS.find((item) => item.id === form.provider) || PROVIDERS[0], [form.provider]);
  const currentPost = posts[activeChannel] || "";
  const currentConnection = connections[activeChannel] || null;
  const canPublishCurrent = Boolean(currentConnection?.connected && !currentConnection?.manualOnly);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setAccessToken(window.localStorage.getItem(ACCESS_TOKEN_KEY) || "");
    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));
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

  function updateForm(key, value) {
    setForm((previous) => ({ ...previous, [key]: value }));
  }

  function toggleChannel(channelId) {
    setChannels((previous) => {
      if (previous.includes(channelId)) {
        if (previous.length === 1) return previous;
        return previous.filter((item) => item !== channelId);
      }
      return [...previous, channelId];
    });
  }

  async function handleFiles(event) {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    const nextFiles = [];
    const nextText = [];

    for (const file of picked) {
      const isText = file.type.startsWith("text/") || /\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs)$/i.test(file.name);
      if (isText && file.size <= 500000) {
        try {
          const text = await file.text();
          nextText.push(`FILE: ${file.name}\n${text.slice(0, 12000)}`);
        } catch {
          nextText.push(`FILE: ${file.name} (could not read text in browser)`);
        }
      }
      nextFiles.push({ name: file.name, type: file.type || "file", size: file.size });
    }

    setFiles((previous) => [...previous, ...nextFiles].slice(0, 10));
    setDocumentText((previous) => [...previous, ...nextText].slice(0, 10));
    event.target.value = "";
  }

  function removeFile(index) {
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    setDocumentText((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
  }

  async function generateCampaign() {
    if (!form.notes.trim() && !form.links.trim() && !form.repo.trim() && documentText.length === 0) {
      setMessage({ type: "error", text: "Add a brief, link, repository, or text file before generating." });
      return;
    }

    setBusy(true);
    setMessage(null);

    try {
      const response = await fetch("/api/launch_kit", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
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
          media_items: files.map((file) => ({ name: file.name, type: file.type, size: file.size })),
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
          ? "Campaign created with a fallback route. Review the provider note before publishing."
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
    setActiveChannel((item.channels || ["linkedin"])[0]);
    setStage("review");
    setSection("studio");
  }

  function deleteCampaign(id) {
    const next = library.filter((item) => item.id !== id);
    setLibrary(next);
    window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));
  }

  async function copyCurrentPost() {
    if (!currentPost) return;
    await navigator.clipboard.writeText(currentPost);
    setMessage({ type: "success", text: `${CHANNELS.find((item) => item.id === activeChannel)?.label || "Post"} copied.` });
  }

  function exportMarkdown() {
    const name = (form.projectName || "signalflow-campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    const fallbackMarkdown = channels.map((channel) => `## ${CHANNELS.find((item) => item.id === channel)?.label || channel}\n\n${posts[channel] || ""}`).join("\n\n---\n\n");
    downloadText(`${name || "signalflow-campaign"}.md`, result?.markdown || fallbackMarkdown, "text/markdown");
  }

  function exportJson() {
    const name = (form.projectName || "signalflow-campaign").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
    downloadText(`${name || "signalflow-campaign"}.json`, JSON.stringify({ campaign: form.projectName, channels, posts, result }, null, 2), "application/json");
  }

  async function publishCurrentPost() {
    if (!currentPost) return;
    if (!canPublishCurrent) {
      setMessage({
        type: "warning",
        text: currentConnection?.reason || `${CHANNELS.find((item) => item.id === activeChannel)?.label || activeChannel} is not connected. Copy or export this draft instead.`,
      });
      return;
    }

    const confirmed = window.confirm(`Publish this approved draft to ${CHANNELS.find((item) => item.id === activeChannel)?.label}?`);
    if (!confirmed) return;

    setBusy(true);
    setMessage(null);
    try {
      const response = await fetch("/api/publish", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({
          platform: activeChannel,
          content: currentPost,
          projectName: form.projectName,
        }),
      });
      const data = await response.json();
      if (!data.ok) throw new Error(data.error || "The platform did not confirm publication.");
      setMessage({ type: "success", text: `Published to ${CHANNELS.find((item) => item.id === activeChannel)?.label}.` });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function refreshConnections() {
    setConnectionsLoading(true);
    try {
      const response = await fetch("/api/social/status", {
        headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
      });
      if (!response.ok) throw new Error("Owner access is required to inspect official connectors.");
      const data = await response.json();
      setConnections(data.platforms || {});
    } catch {
      setConnections({});
    } finally {
      setConnectionsLoading(false);
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
      window.localStorage.setItem(ACCESS_TOKEN_KEY, data.token);
      setAccessToken(data.token);
      setOwnerKey("");
      setMessage({ type: "success", text: "Owner session unlocked." });
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  function lockOwnerSession() {
    window.localStorage.removeItem(ACCESS_TOKEN_KEY);
    setAccessToken("");
    setConnections({});
    setMessage({ type: "success", text: "Owner session closed." });
  }

  if (!entered) {
    return <LandingPage onEnter={() => setEntered(true)} />;
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <button className="brand-button" onClick={() => setEntered(false)}><BrandMark compact /></button>
        <nav className="app-nav" aria-label="Primary navigation">
          {[
            ["studio", "Studio"],
            ["library", "Library"],
            ["connections", "Connections"],
            ["settings", "Settings"],
          ].map(([id, label]) => (
            <button key={id} className={section === id ? "is-active" : ""} onClick={() => setSection(id)}>{label}</button>
          ))}
        </nav>
        <div className="app-header__status">
          <span className={`connection-light ${accessToken ? "connection-light--on" : ""}`} />
          {accessToken ? "Owner session" : "Local mode"}
        </div>
      </header>

      {message && (
        <div className={`toast toast--${message.type}`} role="status">
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>×</button>
        </div>
      )}

      {section === "studio" && (
        <main className="studio-page">
          <header className="studio-heading">
            <div>
              <p className="eyebrow eyebrow--dark"><span /> Campaign studio</p>
              <h1>{stage === "compose" ? "What are we telling the world?" : "Shape every draft before it leaves."}</h1>
              <p>{stage === "compose" ? "Bring the raw material. SignalFlow will turn it into one coherent, channel-ready campaign." : "Edit the words, inspect the route, then publish or export deliberately."}</p>
            </div>
            {stage === "review" && (
              <button className="button button--outline" onClick={() => setStage("compose")}>Edit campaign brief</button>
            )}
          </header>

          <div className={`studio-grid ${stage === "review" ? "studio-grid--review" : ""}`}>
            <section className="panel composer-panel">
              <div className="panel-kicker"><span>01</span> Campaign brief</div>
              <label className="field">
                <span>Campaign name</span>
                <input value={form.projectName} onChange={(event) => updateForm("projectName", event.target.value)} placeholder="e.g. SignalFlow public beta" />
              </label>
              <label className="field field--large">
                <span>What happened, and why should anyone care?</span>
                <textarea value={form.notes} onChange={(event) => updateForm("notes", event.target.value)} placeholder="Paste the messy version: what you built, the problem, the proof, the launch details, quotes, numbers, and the action you want people to take." />
                <small>{form.notes.length.toLocaleString()} characters</small>
              </label>

              <div className="source-grid">
                <label className="field">
                  <span>Links to extract</span>
                  <textarea className="compact-textarea" value={form.links} onChange={(event) => updateForm("links", event.target.value)} placeholder="Docs, landing page, research links…" />
                </label>
                <label className="field">
                  <span>GitHub repository</span>
                  <input value={form.repo} onChange={(event) => updateForm("repo", event.target.value)} placeholder="https://github.com/owner/repo" />
                </label>
              </div>

              <div className="upload-zone" onClick={() => fileInputRef.current?.click()} role="button" tabIndex={0} onKeyDown={(event) => event.key === "Enter" && fileInputRef.current?.click()}>
                <input ref={fileInputRef} type="file" multiple hidden onChange={handleFiles} />
                <div className="upload-zone__icon">＋</div>
                <div><strong>Add proof and source files</strong><span>Text, Markdown, CSV, JSON, code, images, or screenshots</span></div>
                <button type="button" className="text-button">Browse</button>
              </div>

              {files.length > 0 && (
                <div className="file-list">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="file-chip">
                      <span>{file.name}</span>
                      <small>{Math.max(1, Math.round(file.size / 1024))} KB</small>
                      <button aria-label={`Remove ${file.name}`} onClick={() => removeFile(index)}>×</button>
                    </div>
                  ))}
                </div>
              )}

              <button className="advanced-toggle" onClick={() => setShowAdvanced((value) => !value)}>
                <span>Voice and model route</span><span>{showAdvanced ? "−" : "+"}</span>
              </button>

              {showAdvanced && (
                <div className="advanced-panel">
                  <label className="field">
                    <span>Audience</span>
                    <input value={form.audience} onChange={(event) => updateForm("audience", event.target.value)} />
                  </label>
                  <label className="field">
                    <span>Generation route</span>
                    <select value={form.provider} onChange={(event) => updateForm("provider", event.target.value)}>
                      {PROVIDERS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                    </select>
                    <small>{provider.hint}</small>
                  </label>
                  {form.provider !== "template" && !["ollama", "lmstudio"].includes(form.provider) && (
                    <label className="field">
                      <span>Temporary API key</span>
                      <input type="password" value={form.apiKey} onChange={(event) => updateForm("apiKey", event.target.value)} placeholder="Used only for this request" autoComplete="off" />
                    </label>
                  )}
                  {["ollama", "lmstudio", "custom"].includes(form.provider) && (
                    <label className="field">
                      <span>Base URL</span>
                      <input value={form.baseUrl} onChange={(event) => updateForm("baseUrl", event.target.value)} placeholder="http://localhost:11434" />
                    </label>
                  )}
                  {form.provider !== "template" && (
                    <label className="field">
                      <span>Model override</span>
                      <input value={form.model} onChange={(event) => updateForm("model", event.target.value)} placeholder="Leave blank for the default model" />
                    </label>
                  )}
                </div>
              )}
            </section>

            <section className="panel output-panel">
              <div className="panel-kicker"><span>02</span> Channels and output</div>
              <div className="channel-picker">
                {CHANNELS.map((channel) => {
                  const selected = channels.includes(channel.id);
                  return (
                    <button key={channel.id} className={selected ? "channel-option is-selected" : "channel-option"} onClick={() => toggleChannel(channel.id)}>
                      <span className="channel-option__mark">{channel.mark}</span>
                      <span><strong>{channel.label}</strong><small>{channel.tone}</small></span>
                      <i>{selected ? "✓" : "+"}</i>
                    </button>
                  );
                })}
              </div>

              {stage === "compose" ? (
                <div className="output-empty">
                  <div className="output-empty__art">
                    <div className="ghost-post ghost-post--one"><span /> <i /><i /><i /></div>
                    <div className="ghost-post ghost-post--two"><span /> <i /><i /></div>
                    <div className="ghost-post ghost-post--three"><span /> <i /><i /><i /></div>
                  </div>
                  <h3>Your campaign will appear here.</h3>
                  <p>SignalFlow creates editable drafts, a media direction, warnings, and export files from the same brief.</p>
                </div>
              ) : (
                <div className="review-workspace">
                  <div className="review-tabs">
                    {channels.map((channelId) => {
                      const meta = CHANNELS.find((item) => item.id === channelId);
                      return (
                        <button key={channelId} className={activeChannel === channelId ? "is-active" : ""} onClick={() => setActiveChannel(channelId)}>
                          <span>{meta?.mark}</span>{meta?.label}
                        </button>
                      );
                    })}
                  </div>

                  <div className="native-preview">
                    <header>
                      <div className="preview-avatar">SF</div>
                      <div><strong>SignalFlow campaign</strong><span>Draft preview · {CHANNELS.find((item) => item.id === activeChannel)?.label}</span></div>
                      <span className={`connection-badge ${canPublishCurrent ? "connection-badge--ready" : ""}`}>{canPublishCurrent ? "Connected" : "Review mode"}</span>
                    </header>
                    <textarea value={currentPost} onChange={(event) => setPosts((previous) => ({ ...previous, [activeChannel]: event.target.value }))} placeholder="No draft was generated for this channel." />
                    <footer><span>{currentPost.length.toLocaleString()} characters</span><span>Editable before export or publish</span></footer>
                  </div>

                  <div className="review-actions">
                    <button className="button button--outline" onClick={copyCurrentPost}>Copy draft</button>
                    <button className="button button--outline" onClick={saveCampaign}>Save locally</button>
                    <button className="button button--dark" onClick={publishCurrentPost} disabled={busy || !currentPost}>{canPublishCurrent ? "Publish approved draft" : "Check publishing path"}<ArrowIcon /></button>
                  </div>

                  {result?.warnings?.length > 0 && (
                    <details className="route-note">
                      <summary>Generation and integration notes ({result.warnings.length})</summary>
                      <ul>{result.warnings.map((warning, index) => <li key={index}>{warning}</li>)}</ul>
                    </details>
                  )}

                  <div className="export-row">
                    <div><strong>Take the full campaign with you</strong><span>Export all approved drafts and generation metadata.</span></div>
                    <button onClick={exportMarkdown}>Markdown</button>
                    <button onClick={exportJson}>JSON</button>
                  </div>
                </div>
              )}
            </section>
          </div>

          <div className="studio-actionbar">
            <div>
              <span>{channels.length} channel{channels.length === 1 ? "" : "s"}</span>
              <i />
              <span>{provider.label}</span>
              <i />
              <span>{files.length} file{files.length === 1 ? "" : "s"}</span>
            </div>
            <button className="button button--champagne" onClick={generateCampaign} disabled={busy}>
              {busy ? "Building campaign…" : stage === "review" ? "Regenerate campaign" : "Build campaign"}
              {!busy && <SparkIcon />}
            </button>
          </div>
        </main>
      )}

      {section === "library" && (
        <main className="secondary-page">
          <header className="secondary-heading">
            <div><p className="eyebrow eyebrow--dark"><span /> Local library</p><h1>Your saved campaigns.</h1><p>Stored in this browser. Nothing here is treated as published.</p></div>
            <button className="button button--dark" onClick={() => { setSection("studio"); setStage("compose"); }}>New campaign <ArrowIcon /></button>
          </header>
          {library.length === 0 ? (
            <div className="empty-library"><span>◇</span><h2>No saved campaigns yet.</h2><p>Generate a campaign, review it, then save it locally.</p></div>
          ) : (
            <div className="library-grid">
              {library.map((item) => (
                <article key={item.id} className="library-card">
                  <div className="library-card__top"><span>{item.fallbackUsed ? "Fallback route" : item.providerUsed || "Generated"}</span><small>{formatDate(item.updatedAt)}</small></div>
                  <h2>{item.title}</h2>
                  <div className="library-card__channels">{(item.channels || []).map((id) => <span key={id}>{CHANNELS.find((channel) => channel.id === id)?.mark || id}</span>)}</div>
                  <p>{Object.values(item.posts || {})[0]?.slice(0, 170) || "Saved campaign package"}{Object.values(item.posts || {})[0]?.length > 170 ? "…" : ""}</p>
                  <footer><button onClick={() => openCampaign(item)}>Open campaign</button><button className="danger-link" onClick={() => deleteCampaign(item.id)}>Delete</button></footer>
                </article>
              ))}
            </div>
          )}
        </main>
      )}

      {section === "connections" && (
        <main className="secondary-page">
          <header className="secondary-heading">
            <div><p className="eyebrow eyebrow--dark"><span /> Publishing paths</p><h1>Know exactly what can publish.</h1><p>Connected means an official connector is available. Everything else stays manual and honest.</p></div>
            <button className="button button--outline" onClick={refreshConnections} disabled={connectionsLoading}>{connectionsLoading ? "Checking…" : "Refresh status"}</button>
          </header>
          <div className="connections-grid">
            {CHANNELS.map((channel) => {
              const status = connections[channel.id];
              const connected = Boolean(status?.connected && !status?.manualOnly);
              return (
                <article key={channel.id} className="connection-card">
                  <div className="connection-card__mark">{channel.mark}</div>
                  <div className="connection-card__body"><h2>{channel.label}</h2><p>{status?.reason || (connected ? `Connected as ${status?.profile?.username || status?.profile?.name || "official account"}.` : accessToken ? "Official connector is not connected." : "Unlock the owner session to inspect official connector status.")}</p></div>
                  <span className={connected ? "status-tag status-tag--ready" : "status-tag"}>{connected ? "Connected" : status?.manualOnly ? "Manual" : "Not connected"}</span>
                </article>
              );
            })}
          </div>
          <div className="truth-panel">
            <div><span>Why this matters</span><h2>SignalFlow no longer simulates a successful post.</h2></div>
            <p>The publish button only reports success after the server-side provider returns a confirmed result. Manual-only channels direct you to copy or export the approved draft instead.</p>
          </div>
        </main>
      )}

      {section === "settings" && (
        <main className="secondary-page settings-page">
          <header className="secondary-heading"><div><p className="eyebrow eyebrow--dark"><span /> Product settings</p><h1>Keep setup out of the creative flow.</h1><p>Advanced access and provider details live here—not in the middle of every campaign.</p></div></header>
          <div className="settings-grid">
            <section className="settings-card">
              <span className="settings-card__number">01</span>
              <h2>Owner access</h2>
              <p>Unlock server-configured model routes and official social connectors for this hosted instance.</p>
              {accessToken ? (
                <div className="settings-success"><span /> Owner session is active.<button onClick={lockOwnerSession}>Close session</button></div>
              ) : (
                <div className="settings-form"><input type="password" value={ownerKey} onChange={(event) => setOwnerKey(event.target.value)} placeholder="Owner access key" /><button className="button button--dark" onClick={unlockOwnerSession} disabled={busy}>Unlock</button></div>
              )}
            </section>
            <section className="settings-card">
              <span className="settings-card__number">02</span>
              <h2>Local data</h2>
              <p>Saved campaigns live in this browser. Export anything important before clearing local storage.</p>
              <div className="settings-actions"><button onClick={() => downloadText("signalflow-local-library.json", JSON.stringify(library, null, 2), "application/json")}>Export library</button><button className="danger-link" onClick={() => { if (window.confirm("Clear the local campaign library?")) { setLibrary([]); window.localStorage.removeItem(LIBRARY_KEY); } }}>Clear library</button></div>
            </section>
            <section className="settings-card settings-card--wide">
              <span className="settings-card__number">03</span>
              <h2>Model policy</h2>
              <p>Temporary API keys entered in the campaign composer are sent only with that generation request and are not included when a campaign is saved locally. Server environment keys remain server-side.</p>
            </section>
          </div>
        </main>
      )}
    </div>
  );
}
