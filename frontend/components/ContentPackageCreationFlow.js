import React, { useState, useEffect, useRef } from "react";
import { useRecorder } from "../hooks/useRecorder";
import { CHANNELS, OUTPUT_TYPES, MODEL_ROUTES_META } from "../lib/config";
import PlatformPreviews from "./PlatformPreviews";
import { Icons } from "./Icons";

const TONE_OPTIONS = ["professional", "founder-style", "technical", "educational", "casual", "launch-style"];

export default function ContentPackageCreationFlow({
  activeProject,
  aiSettings,
  onSaveSettings,
  projects = [],
  activeProjectId,
  onSelectActiveProject,
  onSaveProject,
  connectedChannels = {},
  onSavePackage,
  setView,
  initialSource = "manual",
  onPublishNow,
  onSchedulePost,
  onExport,
  onConnectPlatform
}) {
  // Form values
  const [notes, setNotes] = useState("");
  const [title, setTitle] = useState("");
  const [audienceUnderstand, setAudienceUnderstand] = useState("");
  const [mainValue, setMainValue] = useState("");
  const [tone, setTone] = useState("founder-style");
  const [selectedChannels, setSelectedChannels] = useState(["linkedin", "x"]);
  const [selectedOutputs, setSelectedOutputs] = useState(["caption", "text", "image", "video", "carousel", "doc"]);
  const [appUrl, setAppUrl] = useState("");
  const [pastedText, setPastedText] = useState("");

  // Brand folder
  const [selectedFolderId, setSelectedFolderId] = useState(activeProjectId || "default-project");
  const [showNewBrand, setShowNewBrand] = useState(false);
  const [newBrandName, setNewBrandName] = useState("");
  const [newBrandDesc, setNewBrandDesc] = useState("");

  // URL / repo  
  const [scrapeUrl, setScrapeUrl] = useState("");
  const [repoUrl, setRepoUrl] = useState("");
  const [githubToken, setGithubToken] = useState("");

  // Media references
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [recordingNotes, setRecordingNotes] = useState("");
  const [showRecordingNotesForm, setShowRecordingNotesForm] = useState(false);

  // Generation status
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationError, setGenerationError] = useState("");
  const [generationResult, setGenerationResult] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState("Ingesting release assets...");

  // AI Provider selection (inline)
  const currentProvider = aiSettings.defaultProvider || "template";

  // Attachment toggles (all open by default, no click-to-expand)
  const [showAttachUrl, setShowAttachUrl] = useState(false);
  const [showAttachCode, setShowAttachCode] = useState(false);
  const [showAttachRepo, setShowAttachRepo] = useState(false);

  // Step refs for smooth scrolling
  const stepRefs = {
    step1: useRef(null),
    step2: useRef(null),
    step3: useRef(null),
    step4: useRef(null),
    step5: useRef(null),
    step6: useRef(null),
    step7: useRef(null)
  };

  useEffect(() => {
    if (!isGenerating) return;
    const statuses = [
      "Scanning input material details...",
      "Analyzing core value hooks...",
      "Drafting LinkedIn post outlines...",
      "Writing native X/Twitter developer thread...",
      "Formatting release notes & documentation summaries...",
      "Polishing tone presets and audience alignments...",
      "Assembling final creative package..."
    ];
    let index = 0;
    setLoadingStatus(statuses[0]);
    const interval = setInterval(() => {
      index = (index + 1) % statuses.length;
      setLoadingStatus(statuses[index]);
    }, 1600);
    return () => clearInterval(interval);
  }, [isGenerating]);

  // Screen recorder setup
  const videoPreviewRef = useRef(null);
  const {
    captureStatus,
    setCaptureStatus,
    micEnabled,
    setMicEnabled,
    error: recorderError,
    startRecording,
    stopRecording,
    captureFrame
  } = useRecorder({
    onRecordingFinished: (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const newFile = {
        id: `record-${Date.now()}`,
        name: filename,
        size: blob.size,
        type: blob.type,
        category: "screen recording",
        url: url,
        blob: blob
      };
      setUploadedFiles(prev => [newFile, ...prev]);
      setShowRecordingNotesForm(true);
    },
    onScreenshotCaptured: (blob, filename) => {
      const url = URL.createObjectURL(blob);
      const newFile = {
        id: `screenshot-${Date.now()}`,
        name: filename,
        size: blob.size,
        type: blob.type,
        category: "screenshot",
        url: url,
        blob: blob
      };
      setUploadedFiles(prev => [newFile, ...prev]);
    }
  });

  useEffect(() => {
    if (activeProject) {
      setTitle(`Launch kit for ${activeProject.name}`);
      setNotes(activeProject.description || "");
      setAppUrl(activeProject.url || "");
      setTone(activeProject.brandVoice || "founder-style");
      setSelectedChannels(activeProject.platforms || ["linkedin", "x"]);
      setSelectedFolderId(activeProject.id || "default-project");
    }
  }, [activeProject]);

  function handleFileChange(e) {
    const files = Array.from(e.target.files || []);
    files.forEach(file => {
      const ext = file.name.split(".").pop().toLowerCase();
      let category = "doc";
      if (["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) {
        category = "screenshot";
      } else if (["mp4", "mov", "webm", "avi"].includes(ext)) {
        category = "screen recording";
      }
      const url = URL.createObjectURL(file);
      const newFile = {
        id: `upload-${Date.now()}-${Math.random()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        category,
        url,
        file
      };
      setUploadedFiles(prev => [...prev, newFile]);
    });
  }

  function handleRemoveFile(id) {
    setUploadedFiles(prev => prev.filter(f => f.id !== id));
  }

  function handleSelectProvider(key) {
    if (onSaveSettings) {
      onSaveSettings({ ...aiSettings, defaultProvider: key });
    }
  }

  function handleCreateNewBrand() {
    if (!newBrandName.trim()) return;
    const newProject = {
      id: `project-${Date.now()}`,
      name: newBrandName.trim(),
      description: newBrandDesc.trim(),
      brandVoice: tone,
      platforms: selectedChannels,
      createdAt: new Date().toISOString()
    };
    if (onSaveProject) onSaveProject(newProject);
    setSelectedFolderId(newProject.id);
    if (onSelectActiveProject) onSelectActiveProject(newProject.id);
    setShowNewBrand(false);
    setNewBrandName("");
    setNewBrandDesc("");
  }

  async function triggerGeneration() {
    setIsGenerating(true);
    setGenerationError("");
    setGenerationResult(null);

    const provider = aiSettings.defaultProvider || "template";
    const currentConfig = aiSettings[provider] || {};

    const selectedProject = projects.find(p => p.id === selectedFolderId) || activeProject;

    const payload = {
      project_name: selectedProject?.name || "SignalFlow Project",
      notes: `${notes}\n\nAudience understands: ${audienceUnderstand}\nMain Value: ${mainValue}\nRecording Context: ${recordingNotes}`,
      audience: selectedProject?.audience || "developers, founders",
      app_url: appUrl || selectedProject?.url || "",
      generator: provider,
      channels: selectedChannels,
      output_types: selectedOutputs,
      document_text: pastedText,
      repo: repoUrl || "",
      github_token: githubToken || "",
      media_items: uploadedFiles.map(f => ({
        name: f.name,
        category: f.category,
        size: f.size,
        type: f.type,
        url: f.url
      })),
      providerApiKey: currentConfig.apiKey || "",
      providerBaseUrl: currentConfig.baseUrl || "",
      providerModelName: currentConfig.model || ""
    };

    if (scrapeUrl) {
      payload.docs_url = scrapeUrl;
    }

    try {
      const resp = await fetch("/api/launch_kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      const data = await resp.json();
      if (!resp.ok) {
        throw new Error(data.error || "Package generation failed on the server.");
      }
      setGenerationResult(data);
      // Scroll to results
      setTimeout(() => {
        stepRefs.step6.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
    } catch (err) {
      console.error(err);
      setGenerationError(err.message || "An unexpected generation error occurred.");
    } finally {
      setIsGenerating(false);
    }
  }

  function handleSaveDraft(editedPosts) {
    if (!generationResult) return;
    const selectedProject = projects.find(p => p.id === selectedFolderId) || activeProject;
    const finalPkg = {
      id: `pkg-${Date.now()}`,
      projectId: selectedFolderId || "default-project",
      title: title || `Launch Package - ${new Date().toLocaleDateString()}`,
      sourceType: "wizard",
      sourceText: notes + " " + pastedText,
      sourceAssets: uploadedFiles.map(f => ({ name: f.name, category: f.category, url: f.url })),
      tone,
      goal: selectedProject?.goals?.[0] || "launch",
      platforms: selectedChannels,
      outputs: selectedOutputs,
      status: "draft",
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      aiProvider: aiSettings.defaultProvider,
      package: {
        ...generationResult.package,
        posts: {
          ...generationResult.package?.posts,
          ...editedPosts
        }
      },
      posts: {
        ...generationResult.posts,
        ...editedPosts
      },
      markdown: generationResult.markdown,
      image_base64: generationResult.image_base64
    };
    onSavePackage(finalPkg);
    setView("library");
  }

  const providerMeta = MODEL_ROUTES_META.find(m => m.key === currentProvider);
  const canGenerate = notes.trim() && selectedChannels.length > 0;

  // ─── RENDER ───────────────────────────────────────────────────
  return (
    <div style={styles.wizardContainer}>
      {/* ── Full-screen generation loader ── */}
      {isGenerating && (
        <div style={styles.loaderOverlay}>
          <div style={styles.loaderCard} className="hand-drawn fade-in-up">
            <div style={styles.sketchContainer}>
              <svg viewBox="0 0 100 100" style={styles.sketchSvg}>
                <rect x="25" y="15" width="50" height="70" rx="4" fill="#fff" stroke="var(--ink-black)" strokeWidth="3" />
                <rect x="40" y="8" width="20" height="8" rx="2" fill="var(--pastel-yellow)" stroke="var(--ink-black)" strokeWidth="2.5" />
                <line x1="35" y1="35" x2="65" y2="35" stroke="var(--ink-black)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30" strokeDashoffset="30" style={{ animation: "lineDraw 1.2s forwards 0.3s" }} />
                <line x1="35" y1="48" x2="60" y2="48" stroke="var(--ink-black)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="25" strokeDashoffset="25" style={{ animation: "lineDraw 1s forwards 1.2s" }} />
                <line x1="35" y1="61" x2="65" y2="61" stroke="var(--ink-black)" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="30" strokeDashoffset="30" style={{ animation: "lineDraw 1.2s forwards 2s" }} />
              </svg>
              <div style={styles.animatedPencil}>
                <svg viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" style={{ width: "32px", height: "32px", fill: "none", stroke: "var(--ink-black)", strokeWidth: 2.5 }}>
                  <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z" />
                </svg>
              </div>
            </div>
            <h3 style={styles.loaderTitle} className="handwritten">Crafting your content...</h3>
            <p style={styles.loaderStatus}>{loadingStatus}</p>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={styles.pageHeader}>
        <div>
          <h1 style={styles.pageTitle}>Create Content</h1>
          <p style={styles.pageSubtitle}>Fill in the details below, select your platforms, and hit generate.</p>
        </div>
        {providerMeta && (
          <div style={styles.activeBadge} className="hand-drawn">
            <span style={styles.modelDot} />
            <span style={{ fontSize: "12px", color: "#6b6b6b" }}>Engine: <strong style={{ color: "var(--ink-black)" }}>{providerMeta.title}</strong></span>
          </div>
        )}
      </div>

      {generationError && (
        <div style={styles.errorAlert} className="hand-drawn">
          <strong>Generation Error:</strong> {generationError}
          <p style={{ margin: "4px 0 0 0", fontSize: "12px" }}>
            Check your API key in Step 1 or switch to "SignalFlow AI (Demo Mode)".
          </p>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════
          STEP 1 — AI Engine
         ══════════════════════════════════════════════════════════ */}
      <section ref={stepRefs.step1} style={styles.wizardSection}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>1</span>
          <div>
            <h2 style={styles.stepTitle}>AI Engine</h2>
            <p style={styles.stepDesc}>Pick a provider or use the free demo template.</p>
          </div>
        </div>
        <div style={styles.stepBody}>
          <div style={styles.providerGrid}>
            {MODEL_ROUTES_META.map(m => {
              const isActive = currentProvider === m.key;
              return (
                <button
                  key={m.key}
                  onClick={() => handleSelectProvider(m.key)}
                  style={{
                    ...styles.providerCard,
                    ...(isActive ? styles.providerCardActive : {})
                  }}
                  className="hand-drawn-btn"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ fontWeight: "700", fontSize: "13px", color: isActive ? "var(--ink-black)" : "#555" }}>{m.title}</span>
                    <span style={{
                      fontSize: "10px",
                      padding: "2px 8px",
                      borderRadius: "20px",
                      background: m.badge === "Local" ? "var(--pastel-green)" : "var(--pastel-blue)",
                      color: "var(--ink-black)",
                      fontWeight: "600",
                      border: "1px solid var(--ink-black)"
                    }}>{m.badge}</span>
                  </div>
                  <p style={{ fontSize: "11px", color: "#888", margin: "6px 0 0 0", lineHeight: "1.4" }}>{m.use}</p>
                </button>
              );
            })}
          </div>
          {/* Inline API Key input if a cloud provider is selected */}
          {providerMeta && providerMeta.badge === "Cloud" && (
            <div style={{ marginTop: "16px", padding: "16px", background: "#faf9f6", border: "2px dashed rgba(0,0,0,0.1)", borderRadius: "12px" }}>
              <label style={styles.label}>API Key for {providerMeta.title}</label>
              <input
                type="password"
                value={aiSettings[currentProvider]?.apiKey || ""}
                onChange={(e) => {
                  const updated = { ...aiSettings, [currentProvider]: { ...aiSettings[currentProvider], apiKey: e.target.value } };
                  if (onSaveSettings) onSaveSettings(updated);
                }}
                style={{ ...styles.input, marginTop: "6px", width: "100%", boxSizing: "border-box" }}
                placeholder={`Enter your ${providerMeta.title} API key...`}
                className="hand-drawn-input"
              />
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STEP 2 — What did you build?
         ══════════════════════════════════════════════════════════ */}
      <section ref={stepRefs.step2} style={styles.wizardSection}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>2</span>
          <div>
            <h2 style={styles.stepTitle}>What did you build?</h2>
            <p style={styles.stepDesc}>Describe your product, update, or feature — the more context, the better the output.</p>
          </div>
        </div>
        <div style={styles.stepBody}>
          {/* Main textarea */}
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            style={styles.mainTextarea}
            placeholder="Tell us about your launch, feature update, or product... write freely, paste changelog, or describe what makes it special."
            required
            className="hand-drawn-input"
          />

          {/* Quick optional fields — always visible */}
          <div style={styles.optionalFieldsRow}>
            <div style={styles.halfField}>
              <label style={styles.label}>Draft Title (optional)</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                style={styles.input}
                placeholder="e.g. Launch Kit v2.0"
                className="hand-drawn-input"
              />
            </div>
            <div style={styles.halfField}>
              <label style={styles.label}>Brand Voice</label>
              <select value={tone} onChange={(e) => setTone(e.target.value)} style={styles.select} className="hand-drawn-input">
                {TONE_OPTIONS.map(t => (
                  <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={styles.optionalFieldsRow}>
            <div style={styles.halfField}>
              <label style={styles.label}>Value Proposition (optional)</label>
              <input type="text" value={mainValue} onChange={(e) => setMainValue(e.target.value)} style={styles.input} placeholder="e.g. Saves 10 hours per week" className="hand-drawn-input" />
            </div>
            <div style={styles.halfField}>
              <label style={styles.label}>App URL (optional)</label>
              <input type="url" value={appUrl} onChange={(e) => setAppUrl(e.target.value)} style={styles.input} placeholder="https://myproduct.com" className="hand-drawn-input" />
            </div>
          </div>

          {/* Attachment buttons row */}
          <div style={styles.attachRow}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#999" }}>📎 Add context:</span>
            <button onClick={() => document.getElementById("wizard-file-upload").click()} style={styles.attachPill} className="hand-drawn-btn">
              📸 Upload Files
            </button>
            <input id="wizard-file-upload" type="file" multiple accept="image/*,video/*,.pdf,.md,.txt" onChange={handleFileChange} style={{ display: "none" }} />
            <button onClick={() => setShowAttachUrl(!showAttachUrl)} style={{ ...styles.attachPill, ...(showAttachUrl ? styles.attachPillActive : {}) }} className="hand-drawn-btn">🔗 Website URL</button>
            <button onClick={() => setShowAttachCode(!showAttachCode)} style={{ ...styles.attachPill, ...(showAttachCode ? styles.attachPillActive : {}) }} className="hand-drawn-btn">📝 Paste Code</button>
            <button onClick={() => setShowAttachRepo(!showAttachRepo)} style={{ ...styles.attachPill, ...(showAttachRepo ? styles.attachPillActive : {}) }} className="hand-drawn-btn">💻 Scan Repo</button>
            {captureStatus === "idle" && (
              <button onClick={startRecording} style={styles.attachPill} className="hand-drawn-btn">🎙️ Record Screen</button>
            )}
            {captureStatus === "recording" && (
              <>
                <button onClick={stopRecording} style={{ ...styles.attachPill, background: "#fee2e2", borderColor: "#ef4444" }} className="hand-drawn-btn">⏹️ Stop</button>
                <button onClick={captureFrame} style={styles.attachPill} className="hand-drawn-btn">📸 Frame</button>
              </>
            )}
          </div>

          {/* Conditional attachment fields */}
          {showAttachUrl && (
            <div style={styles.inlinePanel}>
              <label style={styles.label}>Website / Documentation URL</label>
              <input type="url" value={scrapeUrl} onChange={(e) => setScrapeUrl(e.target.value)} style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} placeholder="https://myproduct.com/docs" className="hand-drawn-input" />
            </div>
          )}
          {showAttachCode && (
            <div style={styles.inlinePanel}>
              <label style={styles.label}>Paste Changelog, Code, or Notes</label>
              <textarea value={pastedText} onChange={(e) => setPastedText(e.target.value)} style={{ ...styles.mainTextarea, minHeight: "100px" }} placeholder="Paste feature details, markdown, release notes, etc..." className="hand-drawn-input" />
            </div>
          )}
          {showAttachRepo && (
            <div style={styles.inlinePanel}>
              <label style={styles.label}>Repository Path or GitHub URL</label>
              <input type="text" value={repoUrl} onChange={(e) => setRepoUrl(e.target.value)} style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} placeholder="https://github.com/user/repo or C:\workspace\app" className="hand-drawn-input" />
              <div style={{ marginTop: "8px" }}>
                <label style={styles.label}>GitHub Token (optional, for private repos)</label>
                <input type="password" value={githubToken} onChange={(e) => setGithubToken(e.target.value)} style={{ ...styles.input, width: "100%", boxSizing: "border-box" }} placeholder="ghp_..." className="hand-drawn-input" />
              </div>
            </div>
          )}

          {showRecordingNotesForm && (
            <div style={styles.inlinePanel}>
              <label style={styles.label}>Walkthrough Notes</label>
              <textarea value={recordingNotes} onChange={(e) => setRecordingNotes(e.target.value)} style={{ ...styles.mainTextarea, minHeight: "60px" }} placeholder="Key highlights from your recording..." className="hand-drawn-input" />
            </div>
          )}

          {/* Uploaded files badges */}
          {uploadedFiles.length > 0 && (
            <div style={styles.filesList}>
              {uploadedFiles.map(file => (
                <div key={file.id} style={styles.fileBadge} className="hand-drawn">
                  <span>{file.category === "screenshot" ? "🖼️" : "🎥"}</span>
                  <span style={{ fontSize: "12px", fontWeight: "600" }}>{file.name}</span>
                  <span style={{ fontSize: "10px", color: "#aaa" }}>{(file.size / 1024 / 1024).toFixed(1)}MB</span>
                  <button onClick={() => handleRemoveFile(file.id)} style={styles.fileRemoveBtn}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STEP 3 — Brand Folder
         ══════════════════════════════════════════════════════════ */}
      <section ref={stepRefs.step3} style={styles.wizardSection}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>3</span>
          <div>
            <h2 style={styles.stepTitle}>Brand Folder</h2>
            <p style={styles.stepDesc}>Choose which brand profile to save this content under.</p>
          </div>
        </div>
        <div style={styles.stepBody}>
          <div style={styles.folderGrid}>
            {projects.map(p => {
              const isSelected = selectedFolderId === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => {
                    setSelectedFolderId(p.id);
                    if (onSelectActiveProject) onSelectActiveProject(p.id);
                  }}
                  style={{
                    ...styles.folderCard,
                    ...(isSelected ? styles.folderCardActive : {})
                  }}
                  className="hand-drawn-btn"
                >
                  <div style={styles.folderIcon}>📁</div>
                  <span style={{ fontWeight: "700", fontSize: "13px", color: isSelected ? "var(--ink-black)" : "#555" }}>{p.name}</span>
                  {p.brandVoice && <span style={{ fontSize: "10px", color: "#aaa" }}>{p.brandVoice}</span>}
                </button>
              );
            })}

            {/* New Brand button */}
            <button
              onClick={() => setShowNewBrand(!showNewBrand)}
              style={{
                ...styles.folderCard,
                borderStyle: "dashed",
                ...(showNewBrand ? { background: "var(--pastel-yellow)", borderColor: "var(--ink-black)" } : {})
              }}
              className="hand-drawn-btn"
            >
              <div style={{ fontSize: "24px" }}>✚</div>
              <span style={{ fontWeight: "600", fontSize: "12px", color: "#888" }}>New Brand</span>
            </button>
          </div>

          {showNewBrand && (
            <div style={{ ...styles.inlinePanel, marginTop: "16px" }}>
              <div style={styles.optionalFieldsRow}>
                <div style={styles.halfField}>
                  <label style={styles.label}>Brand Name *</label>
                  <input type="text" value={newBrandName} onChange={(e) => setNewBrandName(e.target.value)} style={styles.input} placeholder="My SaaS Product" className="hand-drawn-input" />
                </div>
                <div style={styles.halfField}>
                  <label style={styles.label}>Description (optional)</label>
                  <input type="text" value={newBrandDesc} onChange={(e) => setNewBrandDesc(e.target.value)} style={styles.input} placeholder="Brief brand description" className="hand-drawn-input" />
                </div>
              </div>
              <button onClick={handleCreateNewBrand} disabled={!newBrandName.trim()} style={{ ...styles.smallBtn, marginTop: "12px", opacity: newBrandName.trim() ? 1 : 0.5 }} className="hand-drawn-btn">
                Create Brand Folder
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STEP 4 — Platforms
         ══════════════════════════════════════════════════════════ */}
      <section ref={stepRefs.step4} style={styles.wizardSection}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>4</span>
          <div>
            <h2 style={styles.stepTitle}>Where do you want to post?</h2>
            <p style={styles.stepDesc}>Select the platforms you want content for — we'll only generate for the ones you pick.</p>
          </div>
        </div>
        <div style={styles.stepBody}>
          <div style={styles.platformGrid}>
            {CHANNELS.map(([key, label, emoji, color]) => {
              const isSelected = selectedChannels.includes(key);
              return (
                <button
                  key={key}
                  onClick={() => {
                    setSelectedChannels(prev =>
                      prev.includes(key) ? prev.filter(c => c !== key) : [...prev, key]
                    );
                  }}
                  style={{
                    ...styles.platformCard,
                    ...(isSelected ? {
                      background: `${color}12`,
                      borderColor: color,
                      boxShadow: `3px 3px 0px ${color}`
                    } : {})
                  }}
                  className="hand-drawn-btn"
                >
                  <span style={{ fontSize: "22px" }}>{Icons[key] ? <span style={{ display: "inline-flex" }}>{Icons[key]({ size: 22, color: isSelected ? color : "#999" })}</span> : emoji}</span>
                  <span style={{ fontWeight: isSelected ? "700" : "500", fontSize: "13px", color: isSelected ? color : "#888" }}>{label}</span>
                  {isSelected && <span style={{ fontSize: "16px", color }}>✓</span>}
                </button>
              );
            })}
          </div>

          {selectedChannels.length === 0 && (
            <p style={{ fontSize: "12px", color: "#ef4444", marginTop: "8px" }}>Please select at least one platform to generate content for.</p>
          )}
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STEP 5 — Generate
         ══════════════════════════════════════════════════════════ */}
      <section ref={stepRefs.step5} style={styles.wizardSection}>
        <div style={styles.stepHeader}>
          <span style={styles.stepNumber}>5</span>
          <div>
            <h2 style={styles.stepTitle}>Generate</h2>
            <p style={styles.stepDesc}>Ready? Hit the button to create content drafts for your selected platforms.</p>
          </div>
        </div>
        <div style={{ ...styles.stepBody, display: "flex", flexDirection: "column", alignItems: "center", gap: "16px", padding: "40px 24px" }}>
          <button
            onClick={triggerGeneration}
            disabled={!canGenerate || isGenerating}
            style={{
              ...styles.generateBtn,
              ...(!canGenerate || isGenerating ? styles.generateBtnDisabled : {})
            }}
            className="hand-drawn-btn"
          >
            {isGenerating ? "🤖 Generating..." : "✦ Generate Content Drafts"}
          </button>
          {!canGenerate && (
            <p style={{ fontSize: "12px", color: "#aaa", margin: 0 }}>
              {!notes.trim() ? "Step 2: Describe what you built first." : "Step 4: Select at least one platform."}
            </p>
          )}
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", justifyContent: "center", marginTop: "8px" }}>
            {selectedChannels.map(key => {
              const ch = CHANNELS.find(c => c[0] === key);
              if (!ch) return null;
              return (
                <span key={key} style={styles.selectedPlatformTag}>
                  {ch[2]} {ch[1]}
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════════════════════════
          STEP 6 — Review Drafts (only shown after generation)
         ══════════════════════════════════════════════════════════ */}
      {generationResult && (
        <section ref={stepRefs.step6} style={styles.wizardSection}>
          <div style={styles.stepHeader}>
            <span style={{ ...styles.stepNumber, background: "var(--pastel-green)" }}>6</span>
            <div>
              <h2 style={styles.stepTitle}>Review Your Drafts</h2>
              <p style={styles.stepDesc}>Edit, adjust, and finalize your content. Only your selected platforms are shown.</p>
            </div>
            <button onClick={() => setGenerationResult(null)} style={styles.resetBtn} className="hand-drawn-btn">↺ Regenerate</button>
          </div>
          <div style={styles.stepBody}>
            <PlatformPreviews
              generationResult={generationResult}
              onSave={handleSaveDraft}
              onCancel={() => setGenerationResult(null)}
              onPublishNow={onPublishNow}
              onSchedulePost={onSchedulePost}
              onExport={onExport}
            />
          </div>
        </section>
      )}

      {/* ══════════════════════════════════════════════════════════
          STEP 7 — Connect & Publish (only shown after generation)
         ══════════════════════════════════════════════════════════ */}
      {generationResult && (
        <section ref={stepRefs.step7} style={styles.wizardSection}>
          <div style={styles.stepHeader}>
            <span style={{ ...styles.stepNumber, background: "var(--pastel-lavender)" }}>7</span>
            <div>
              <h2 style={styles.stepTitle}>Connect & Publish</h2>
              <p style={styles.stepDesc}>Post directly, schedule, or export your generated content.</p>
            </div>
          </div>
          <div style={styles.stepBody}>
            <div style={styles.publishGrid}>
              {selectedChannels.map(key => {
                const ch = CHANNELS.find(c => c[0] === key);
                if (!ch) return null;
                const isConnected = connectedChannels[key];
                return (
                  <div key={key} style={styles.publishCard} className="hand-drawn">
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <span style={{ fontSize: "20px" }}>{ch[2]}</span>
                      <span style={{ fontWeight: "700", fontSize: "14px" }}>{ch[1]}</span>
                    </div>
                    {isConnected ? (
                      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                        <button
                          onClick={() => onPublishNow && onPublishNow(key, generationResult.posts?.[key])}
                          style={{ ...styles.smallBtn, background: ch[3], color: "#fff" }}
                          className="hand-drawn-btn"
                        >
                          Post Now
                        </button>
                        <button
                          onClick={() => onSchedulePost && onSchedulePost(key, generationResult.posts?.[key])}
                          style={styles.smallBtn}
                          className="hand-drawn-btn"
                        >
                          Schedule
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => onConnectPlatform && onConnectPlatform(key)}
                        style={{ ...styles.smallBtn, marginTop: "12px", borderStyle: "dashed" }}
                        className="hand-drawn-btn"
                      >
                        🔗 Connect Account
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "24px" }}>
              <button onClick={() => handleSaveDraft({})} style={{ ...styles.generateBtn, fontSize: "14px", padding: "12px 28px" }} className="hand-drawn-btn">
                💾 Save to Library
              </button>
              <button onClick={() => onExport && onExport(generationResult)} style={{ ...styles.smallBtn, padding: "12px 20px" }} className="hand-drawn-btn">
                📥 Export Package
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Bottom spacer */}
      <div style={{ height: "80px" }} />
    </div>
  );
}


// ─── STYLES ─────────────────────────────────────────────────────
const styles = {
  wizardContainer: {
    padding: "32px 40px",
    maxWidth: "860px",
    margin: "0 auto",
    display: "flex",
    flexDirection: "column",
    gap: "12px",
    fontFamily: "'Plus Jakarta Sans', system-ui, -apple-system, sans-serif"
  },

  // Page header
  pageHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "12px"
  },
  pageTitle: {
    fontSize: "26px",
    fontWeight: "800",
    color: "var(--ink-black)",
    margin: 0,
    fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: "-0.5px"
  },
  pageSubtitle: {
    fontSize: "14px",
    color: "#999",
    margin: "4px 0 0 0"
  },
  activeBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "8px 14px",
    background: "#fff",
    border: "2px solid var(--ink-black)",
    borderRadius: "10px",
    boxShadow: "2px 2px 0px var(--ink-black)"
  },
  modelDot: {
    width: "8px",
    height: "8px",
    borderRadius: "50%",
    background: "#00f5d4",
    animation: "pulse-dot 2s infinite ease-in-out"
  },

  // Section card
  wizardSection: {
    background: "#fff",
    border: "2.5px solid var(--ink-black)",
    borderRadius: "16px",
    overflow: "hidden",
    boxShadow: "4px 5px 0px var(--ink-black)"
  },
  stepHeader: {
    display: "flex",
    alignItems: "center",
    gap: "16px",
    padding: "20px 28px",
    borderBottom: "2px solid rgba(0,0,0,0.06)",
    background: "#fefcf8"
  },
  stepNumber: {
    width: "36px",
    height: "36px",
    borderRadius: "50%",
    background: "var(--pastel-yellow)",
    border: "2px solid var(--ink-black)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "900",
    fontSize: "16px",
    color: "var(--ink-black)",
    flexShrink: 0,
    fontFamily: "'Space Grotesk', sans-serif"
  },
  stepTitle: {
    fontSize: "17px",
    fontWeight: "700",
    color: "var(--ink-black)",
    margin: 0,
    letterSpacing: "-0.2px"
  },
  stepDesc: {
    fontSize: "12px",
    color: "#999",
    margin: "2px 0 0 0"
  },
  stepBody: {
    padding: "24px 28px"
  },

  // Providers grid  
  providerGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "10px"
  },
  providerCard: {
    padding: "14px 16px",
    background: "#faf9f6",
    border: "2px solid rgba(0,0,0,0.08)",
    borderRadius: "12px",
    textAlign: "left",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "inherit"
  },
  providerCardActive: {
    background: "var(--pastel-green)",
    borderColor: "var(--ink-black)",
    boxShadow: "3px 3px 0px var(--ink-black)"
  },

  // Main textarea
  mainTextarea: {
    width: "100%",
    boxSizing: "border-box",
    minHeight: "160px",
    background: "#fffdf9",
    border: "2px solid rgba(0,0,0,0.1)",
    borderRadius: "12px",
    padding: "16px 20px",
    fontSize: "14px",
    color: "var(--ink-black)",
    outline: "none",
    resize: "vertical",
    fontFamily: "inherit",
    lineHeight: "1.7",
    backgroundImage: "linear-gradient(rgba(36, 113, 93, 0.06) 1px, transparent 1px)",
    backgroundSize: "100% 28px",
    backgroundAttachment: "local",
    transition: "border-color 0.2s ease"
  },

  // Optional fields  
  optionalFieldsRow: {
    display: "grid",
    gridTemplateColumns: "1fr 1fr",
    gap: "16px",
    marginTop: "16px"
  },
  halfField: {
    display: "flex",
    flexDirection: "column",
    gap: "6px"
  },

  // Shared input styles
  label: {
    fontSize: "11px",
    fontWeight: "700",
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.5px"
  },
  input: {
    background: "#fff",
    border: "2px solid rgba(0,0,0,0.08)",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "var(--ink-black)",
    outline: "none",
    fontSize: "13px",
    transition: "border-color 0.2s ease",
    fontFamily: "inherit"
  },
  select: {
    background: "#fff",
    border: "2px solid rgba(0,0,0,0.08)",
    borderRadius: "10px",
    padding: "10px 14px",
    color: "var(--ink-black)",
    outline: "none",
    fontSize: "13px",
    cursor: "pointer",
    fontFamily: "inherit"
  },

  // Attachment row
  attachRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    alignItems: "center",
    marginTop: "16px",
    padding: "12px 16px",
    background: "#faf9f6",
    borderRadius: "12px",
    border: "1.5px dashed rgba(0,0,0,0.1)"
  },
  attachPill: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "6px 14px",
    fontSize: "12px",
    background: "#fff",
    border: "2px solid rgba(0,0,0,0.08)",
    borderRadius: "20px",
    cursor: "pointer",
    fontWeight: "600",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
    color: "#555"
  },
  attachPillActive: {
    background: "var(--pastel-yellow)",
    borderColor: "var(--ink-black)"
  },
  inlinePanel: {
    padding: "16px",
    background: "#faf9f6",
    border: "2px solid rgba(0,0,0,0.06)",
    borderRadius: "12px",
    marginTop: "12px"
  },

  // Files list
  filesList: {
    display: "flex",
    flexWrap: "wrap",
    gap: "8px",
    marginTop: "16px"
  },
  fileBadge: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    padding: "6px 12px",
    background: "#faf9f6",
    border: "1.5px solid rgba(0,0,0,0.08)",
    borderRadius: "8px"
  },
  fileRemoveBtn: {
    background: "transparent",
    border: "none",
    color: "#ef4444",
    fontWeight: "700",
    cursor: "pointer",
    fontSize: "12px"
  },

  // Folder grid
  folderGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "12px"
  },
  folderCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "20px 16px",
    background: "#faf9f6",
    border: "2px solid rgba(0,0,0,0.08)",
    borderRadius: "14px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
    textAlign: "center"
  },
  folderCardActive: {
    background: "var(--pastel-green)",
    borderColor: "var(--ink-black)",
    boxShadow: "3px 3px 0px var(--ink-black)"
  },
  folderIcon: {
    fontSize: "28px"
  },

  // Platform selection grid
  platformGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
    gap: "12px"
  },
  platformCard: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: "6px",
    padding: "18px 16px",
    background: "#faf9f6",
    border: "2.5px solid rgba(0,0,0,0.08)",
    borderRadius: "14px",
    cursor: "pointer",
    transition: "all 0.15s ease",
    fontFamily: "inherit",
    textAlign: "center"
  },

  // Generate button
  generateBtn: {
    background: "var(--ink-black)",
    color: "#fff",
    border: "none",
    padding: "16px 40px",
    borderRadius: "14px",
    fontSize: "16px",
    fontWeight: "700",
    cursor: "pointer",
    boxShadow: "4px 4px 0px var(--pastel-green)",
    transition: "all 0.2s ease",
    fontFamily: "'Space Grotesk', sans-serif",
    letterSpacing: "-0.3px"
  },
  generateBtnDisabled: {
    background: "#ddd",
    color: "#aaa",
    cursor: "not-allowed",
    boxShadow: "none"
  },

  // Selected platform tags
  selectedPlatformTag: {
    display: "inline-flex",
    alignItems: "center",
    gap: "4px",
    padding: "4px 12px",
    background: "var(--pastel-green)",
    border: "1.5px solid var(--ink-black)",
    borderRadius: "20px",
    fontSize: "12px",
    fontWeight: "600",
    color: "var(--ink-black)"
  },

  // Publish section  
  publishGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
    gap: "12px"
  },
  publishCard: {
    padding: "20px",
    background: "#faf9f6",
    border: "2px solid rgba(0,0,0,0.08)",
    borderRadius: "14px"
  },

  // Shared utility
  smallBtn: {
    padding: "8px 16px",
    borderRadius: "10px",
    background: "#fff",
    border: "2px solid var(--ink-black)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
    color: "var(--ink-black)"
  },
  resetBtn: {
    marginLeft: "auto",
    padding: "6px 14px",
    borderRadius: "8px",
    background: "#fff",
    border: "2px solid rgba(0,0,0,0.1)",
    fontSize: "12px",
    fontWeight: "600",
    cursor: "pointer",
    fontFamily: "inherit",
    color: "#888"
  },

  // Error
  errorAlert: {
    padding: "14px 18px",
    background: "rgba(239, 68, 68, 0.05)",
    border: "2px solid rgba(239, 68, 68, 0.2)",
    borderRadius: "12px",
    color: "#ef4444",
    fontSize: "13px",
    lineHeight: "1.5"
  },

  // Loader
  loaderOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1000,
    background: "rgba(251, 249, 244, 0.85)",
    backdropFilter: "blur(8px)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center"
  },
  loaderCard: {
    width: "400px",
    background: "#fff",
    padding: "40px 30px",
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    textAlign: "center",
    position: "relative",
    overflow: "hidden",
    border: "2.5px solid var(--ink-black)",
    borderRadius: "16px",
    boxShadow: "6px 6px 0px var(--ink-black)"
  },
  sketchContainer: {
    position: "relative",
    width: "120px",
    height: "120px",
    marginBottom: "20px"
  },
  sketchSvg: {
    width: "100%",
    height: "100%"
  },
  animatedPencil: {
    position: "absolute",
    top: "35px",
    left: "55px",
    width: "32px",
    height: "32px",
    transformOrigin: "bottom left",
    animation: "pencilWrite 1.8s ease-in-out infinite"
  },
  loaderTitle: {
    fontSize: "22px",
    fontWeight: "700",
    color: "var(--ink-black)",
    margin: "0 0 10px 0"
  },
  loaderStatus: {
    fontSize: "13px",
    color: "#888",
    margin: 0,
    fontWeight: "500"
  }
};
