"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { createBrowserIdentityApplication } from "../lib/application/browserIdentityApplication.mjs";
import WorkspaceShell from "./WorkspaceShell";
import styles from "./VoiceWorkspace.module.css";

const LOCAL_WORKSPACE_ID = "local-personal";
const LOCAL_USER_ID = "owner";

function lines(value) {
  return Array.isArray(value) ? value.join("\n") : "";
}

function defaultForm() {
  return {
    primaryTopics: "",
    expertise: "",
    interests: "",
    backgroundContext: "",
    desiredAudienceImpressions: "",
    qualitiesToSignal: "",
    qualitiesToAvoid: "",
    dislikes: "generic launch language\nforced engagement questions\nclaims that sound more certain than the evidence",
    writingPrinciples: "specific over impressive\nexplain the reason or trade-off when it matters\nkeep the same person across platforms",
    blockedPhrases: "",
    customBoundaryRules: "never invent metrics, customer claims, or personal vulnerability",
    approvedExamples: "",
    technicalDepth: "balanced",
    vulnerabilityPreference: "selective",
    emojiPolicy: "rare",
    linkedinRules: "Use enough context to make the reasoning clear.\nPrefer reflection, decision, or lesson over launch hype.",
    xRules: "Get to the observation quickly without becoming cryptic.\nUse a thread only when the idea cannot stay coherent in one post.",
  };
}

function formFromProfile(bundle) {
  if (!bundle?.identity && !bundle?.voice && !bundle?.perception && !bundle?.boundary) return defaultForm();
  return {
    ...defaultForm(),
    primaryTopics: lines(bundle.identity?.primaryTopics),
    expertise: lines(bundle.identity?.expertise),
    interests: lines(bundle.identity?.interests),
    backgroundContext: bundle.identity?.backgroundContext || "",
    desiredAudienceImpressions: lines(bundle.perception?.desiredAudienceImpressions),
    qualitiesToSignal: lines(bundle.perception?.qualitiesToSignal),
    qualitiesToAvoid: lines(bundle.perception?.qualitiesToAvoid),
    dislikes: lines(bundle.voice?.dislikes),
    writingPrinciples: lines(bundle.voice?.writingPrinciples),
    blockedPhrases: lines(bundle.boundary?.blockedPhrases),
    customBoundaryRules: (bundle.boundary?.customRules || []).map((item) => item.rule).join("\n"),
    approvedExamples: lines(bundle.voice?.approvedExamples),
    technicalDepth: bundle.identity?.technicalDepth || "balanced",
    vulnerabilityPreference: bundle.identity?.vulnerabilityPreference || "selective",
    emojiPolicy: bundle.voice?.emojiPolicy || "rare",
    linkedinRules: lines(bundle.platformExpressions?.linkedin?.expressionRules),
    xRules: lines(bundle.platformExpressions?.x?.expressionRules),
  };
}

function versionLabel(record) {
  return record ? `v${record.version}` : "Not set";
}

export default function VoiceWorkspace() {
  const [form, setForm] = useState(defaultForm);
  const [profile, setProfile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const [snapshot, setSnapshot] = useState(null);
  const [snapshotPlatform, setSnapshotPlatform] = useState("linkedin");

  const application = useMemo(() => createBrowserIdentityApplication({
    getStorage: () => window.localStorage,
    workspaceId: LOCAL_WORKSPACE_ID,
    userId: LOCAL_USER_ID,
  }), []);

  const reload = useCallback(async () => {
    try {
      const current = await application.getMinimalProfile();
      setProfile(current);
      setForm(formFromProfile(current));
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not load your Voice profile." });
    }
  }, [application]);

  useEffect(() => { reload(); }, [reload]);

  function update(key, value) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function save(event) {
    event.preventDefault();
    setBusy(true);
    setMessage(null);
    try {
      const saved = await application.saveMinimalProfile(form);
      setProfile(saved);
      setMessage({ type: "success", text: "Voice saved as a new explicit profile version. Previous versions remain in browser-local history." });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not save this Voice profile." });
    } finally {
      setBusy(false);
    }
  }

  async function previewSnapshot() {
    setBusy(true);
    setMessage(null);
    try {
      const created = await application.createIdentityContextSnapshot({ platform: snapshotPlatform });
      setSnapshot(created);
      setMessage({ type: "success", text: `${snapshotPlatform === "x" ? "X" : "LinkedIn"} context snapshot created from exact profile versions.` });
    } catch (error) {
      setMessage({ type: "error", text: error?.message || "SignalFlow could not resolve the identity context." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <WorkspaceShell activeItem="voice" statusLabel="Explicit identity · browser-local" statusTone="ready">
      <main className={styles.page} id="workspace-content">
        <header className={styles.heading}>
          <div>
            <p className={styles.eyebrow}>VOICE · EXPLICIT IDENTITY</p>
            <h1>Teach SignalFlow what should remain recognizably you.</h1>
            <p>This is not a tone preset. These are explicit, versioned instructions about identity, perception, voice and boundaries that future strategy and generation must cite.</p>
          </div>
          <div className={styles.versionStrip} aria-label="Current profile versions">
            <span>Identity <b>{versionLabel(profile?.identity)}</b></span>
            <span>Voice <b>{versionLabel(profile?.voice)}</b></span>
            <span>Boundaries <b>{versionLabel(profile?.boundary)}</b></span>
          </div>
        </header>

        {message && <div className={`${styles.message} ${styles[`message_${message.type}`] || ""}`} role="status">{message.text}</div>}

        <div className={styles.layout}>
          <form className={styles.form} onSubmit={save}>
            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span>01 · IDENTITY</span>
                <h2>What do you actually work on and care about?</h2>
                <p>Enough context to prevent SignalFlow from reducing you to one job title or one project.</p>
              </div>
              <div className={styles.fields}>
                <label><span>Primary things you work / talk about</span><textarea rows={4} value={form.primaryTopics} onChange={(event) => update("primaryTopics", event.target.value)} placeholder="software systems\nAI products\nhardware / engineering\nscience..." /></label>
                <div className={styles.twoCol}>
                  <label><span>Expertise / credible context</span><textarea rows={3} value={form.expertise} onChange={(event) => update("expertise", event.target.value)} /></label>
                  <label><span>Interests beyond the obvious</span><textarea rows={3} value={form.interests} onChange={(event) => update("interests", event.target.value)} /></label>
                </div>
                <label><span>Background worth knowing when relevant</span><textarea rows={3} value={form.backgroundContext} onChange={(event) => update("backgroundContext", event.target.value)} placeholder="Only context that may legitimately influence public communication." /></label>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span>02 · PERCEPTION</span>
                <h2>How should people understand you over time?</h2>
                <p>Desired perception is different from sounding impressive in every post.</p>
              </div>
              <div className={styles.fields}>
                <label><span>What should a thoughtful reader come away believing?</span><textarea rows={4} value={form.desiredAudienceImpressions} onChange={(event) => update("desiredAudienceImpressions", event.target.value)} /></label>
                <div className={styles.twoCol}>
                  <label><span>Qualities to signal</span><textarea rows={3} value={form.qualitiesToSignal} onChange={(event) => update("qualitiesToSignal", event.target.value)} /></label>
                  <label><span>Qualities / impressions to avoid</span><textarea rows={3} value={form.qualitiesToAvoid} onChange={(event) => update("qualitiesToAvoid", event.target.value)} /></label>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span>03 · VOICE</span>
                <h2>What makes AI-written content stop sounding like you?</h2>
                <p>Write rules in plain language. SignalFlow will later learn from edits separately; explicit rules always outrank learned guesses.</p>
              </div>
              <div className={styles.fields}>
                <div className={styles.twoCol}>
                  <label><span>Writing principles</span><textarea rows={5} value={form.writingPrinciples} onChange={(event) => update("writingPrinciples", event.target.value)} /></label>
                  <label><span>Things you dislike in AI writing</span><textarea rows={5} value={form.dislikes} onChange={(event) => update("dislikes", event.target.value)} /></label>
                </div>
                <label><span>Optional example of your own writing</span><textarea rows={5} value={form.approvedExamples} onChange={(event) => update("approvedExamples", event.target.value)} placeholder="Paste one example you genuinely like. This remains explicit profile context, not a training claim." /></label>
                <div className={styles.compactGrid}>
                  <label><span>Technical depth</span><select value={form.technicalDepth} onChange={(event) => update("technicalDepth", event.target.value)}><option value="light">Light</option><option value="balanced">Balanced</option><option value="deep">Deep when useful</option></select></label>
                  <label><span>Personal vulnerability</span><select value={form.vulnerabilityPreference} onChange={(event) => update("vulnerabilityPreference", event.target.value)}><option value="avoid">Avoid</option><option value="selective">Selective</option><option value="open">Open when genuine</option></select></label>
                  <label><span>Emoji</span><select value={form.emojiPolicy} onChange={(event) => update("emojiPolicy", event.target.value)}><option value="none">None</option><option value="rare">Rare</option><option value="natural">Natural only</option><option value="allowed">Allowed</option></select></label>
                </div>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span>04 · BOUNDARIES</span>
                <h2>What must SignalFlow never invent, expose or turn into a style?</h2>
                <p>Explicit boundaries have higher precedence than campaign instructions, platform conventions, or later learned preferences.</p>
              </div>
              <div className={styles.fields}>
                <div className={styles.twoCol}>
                  <label><span>Blocked phrases / claims</span><textarea rows={4} value={form.blockedPhrases} onChange={(event) => update("blockedPhrases", event.target.value)} placeholder="One exact phrase or claim per line." /></label>
                  <label><span>Other hard rules</span><textarea rows={4} value={form.customBoundaryRules} onChange={(event) => update("customBoundaryRules", event.target.value)} /></label>
                </div>
                <p className={styles.policyNote}>Built in for this profile: unverified metrics and fabricated vulnerability are block-level rules; exaggerated launch language is flagged by default.</p>
              </div>
            </section>

            <section className={styles.section}>
              <div className={styles.sectionIntro}>
                <span>05 · PLATFORM EXPRESSION</span>
                <h2>Same person. Different native expression.</h2>
                <p>LinkedIn and X can adapt depth and pacing, but neither may override global boundaries.</p>
              </div>
              <div className={styles.fields}>
                <div className={styles.twoCol}>
                  <label><span>LinkedIn</span><textarea rows={5} value={form.linkedinRules} onChange={(event) => update("linkedinRules", event.target.value)} /></label>
                  <label><span>X</span><textarea rows={5} value={form.xRules} onChange={(event) => update("xRules", event.target.value)} /></label>
                </div>
              </div>
            </section>

            <div className={styles.saveBar}>
              <div><strong>Save explicit profile</strong><span>Creates new versions; it does not erase the previous profile history.</span></div>
              <button type="submit" disabled={busy}>{busy ? "Saving…" : "Save Voice"}</button>
            </div>
          </form>

          <aside className={styles.inspector}>
            <div className={styles.inspectorHead}><span>GENERATION CONTEXT</span><strong>See what a future draft will inherit.</strong><p>A snapshot freezes exact profile versions so changing Voice tomorrow does not rewrite how an older draft was produced.</p></div>
            <div className={styles.snapshotControls}>
              <label><span>Preview for</span><select value={snapshotPlatform} onChange={(event) => setSnapshotPlatform(event.target.value)}><option value="linkedin">LinkedIn</option><option value="x">X</option></select></label>
              <button type="button" onClick={previewSnapshot} disabled={busy}>Resolve snapshot</button>
            </div>

            <ol className={styles.precedence}>
              <li><b>1</b><span>Safety / authorization</span></li>
              <li><b>2</b><span>Explicit boundaries</span></li>
              <li><b>3</b><span>Campaign instruction</span></li>
              <li><b>4</b><span>Platform expression</span></li>
              <li><b>5</b><span>Global identity + voice</span></li>
              <li className={styles.future}><b>6</b><span>Learned preference · later</span></li>
            </ol>

            {snapshot ? (
              <div className={styles.snapshot}>
                <span>SNAPSHOT CREATED</span>
                <strong>{snapshotPlatform === "x" ? "X" : "LinkedIn"} · {snapshot.identityContextSnapshotId.slice(-12)}</strong>
                <div className={styles.snapshotRefs}>
                  {Object.entries(snapshot.profileRefs || {}).map(([key, ref]) => <p key={key}><span>{key}</span><b>v{ref.version}</b></p>)}
                </div>
                <small>{snapshot.effectiveRules.length} ordered rules available to strategy/generation.</small>
              </div>
            ) : (
              <div className={styles.snapshotEmpty}>Save your profile, then resolve a context snapshot to inspect the versioned generation input.</div>
            )}
          </aside>
        </div>
      </main>
    </WorkspaceShell>
  );
}
