from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"Expected one {label}, found {count}")
    return source.replace(before, after, 1)


def replace_between(source: str, start: str, end: str, replacement: str, label: str) -> str:
    start_index = source.find(start)
    if start_index < 0:
        raise RuntimeError(f"Missing start for {label}")
    end_index = source.find(end, start_index + len(start))
    if end_index < 0:
        raise RuntimeError(f"Missing end for {label}")
    return source[:start_index] + replacement + source[end_index:]


page_path = Path("frontend/app/page.js")
page = page_path.read_text()

page = replace_once(
    page,
    '''import { acceptGenerationResponse } from "../lib/studio/generationAcceptance.mjs";
import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";
import { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";''',
    '''import { acceptGenerationResponse } from "../lib/studio/generationAcceptance.mjs";
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
import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";
import { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";''',
    "Studio state imports",
)

page = replace_once(
    page,
    '''function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
''',
    '''function formatDate(value) {
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
''',
    "client ID helper",
)

page = replace_once(
    page,
    '  const { stage, result, generationRun, posts, activeChannel } = campaignState;',
    '''  const {
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
  } = campaignState;''',
    "campaign state destructuring",
)

page = replace_once(
    page,
    '  const [currentCampaignId, setCurrentCampaignId] = useState("");',
    '''  const [currentCampaignId, setCurrentCampaignId] = useState("");
  const [regenerationDialogOpen, setRegenerationDialogOpen] = useState(false);
  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);''',
    "campaign dialog state",
)

page = replace_once(
    page,
    '  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));',
    '''  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));
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
  });''',
    "campaign status selectors",
)

page = replace_once(
    page,
    '''  useEffect(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {''',
    '''  useEffect(() => {
    if (!regenerationDialogOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setRegenerationDialogOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [regenerationDialogOpen]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {''',
    "regeneration dialog keyboard behavior",
)

page = replace_once(
    page,
    '''  function startNewCampaign() {
    setCurrentCampaignId("");
    dispatchCampaign({ type: "RESET_CAMPAIGN" });''',
    '''  function startNewCampaign() {
    setCurrentCampaignId("");
    setRegenerationDialogOpen(false);
    setVersionHistoryOpen(false);
    dispatchCampaign({ type: "RESET_CAMPAIGN" });''',
    "new campaign reset",
)

page = replace_between(
    page,
    "  async function generateCampaign() {",
    "  function currentCampaignInput(overrides = {}) {",
    '''  async function requestGeneration(requestedChannels) {
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
        media_items: files.map(({ name, type, size, description }) => ({
          name,
          type,
          size,
          description,
        })),
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

  function currentCampaignInput(overrides = {}) {''',
    "generation workflow",
)

page = replace_between(
    page,
    "  function currentCampaignInput(overrides = {}) {",
    "  async function saveCampaign() {",
    '''  function currentCampaignInput(overrides = {}) {
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

  async function saveCampaign() {''',
    "campaign persistence input",
)

page = replace_between(
    page,
    "  async function saveCampaign() {",
    "  function openCampaign(item) {",
    '''  async function persistCampaign({ asCopy = false } = {}) {
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

  function openCampaign(item) {''',
    "campaign save operations",
)

page = replace_once(
    page,
    '''          posts: restored.posts,
          result: restored.result,
          generationRun: restored.generationRun,
          activeChannel: restored.channels[0] || "linkedin",''',
    '''          posts: restored.posts,
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
          activeChannel: restored.channels[0] || "linkedin",''',
    "campaign restore payload",
)

page = replace_once(
    page,
    '''      navigateSection("studio");
    } catch {''',
    '''      setVersionHistoryOpen(false);
      navigateSection("studio");
    } catch {''',
    "campaign open UI reset",
)

page = replace_between(
    page,
    "  function exportMarkdown() {",
    "  function exportJson() {",
    '''  function exportMarkdown() {
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

  function exportJson() {''',
    "Markdown export state",
)

page = replace_between(
    page,
    "  function exportJson() {",
    "  async function publishCurrentPost() {",
    '''  function exportJson() {
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

  async function publishCurrentPost() {''',
    "JSON export state",
)

page = replace_between(
    page,
    "  async function publishCurrentPost() {",
    "    if (isOverLimit) {",
    '''  async function publishCurrentPost() {
    if (!publishAvailability.ready) {
      setMessage({ type: "warning", text: publishAvailability.reason });
      return;
    }
    if (!canPublishCurrent) {
      await copyAndOpenCurrent();
      return;
    }

    if (isOverLimit) {''',
    "publish state guard",
)

page = replace_once(
    page,
    '                <div className={`review-workspace ${isCampaignStale ? "has-stale-campaign" : ""}`}>',
    '''                <div className={`review-workspace ${isCampaignStale ? "has-stale-campaign" : ""}`}>
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
                  </div>''',
    "campaign status strip",
)

page = replace_once(
    page,
    '''                      const meta = channelMeta(channelId);
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
                      );''',
    '''                      const meta = channelMeta(channelId);
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
                      );''',
    "channel status tabs",
)

page = replace_between(
    page,
    "                      <span\n                        className={`connection-badge ${",
    "                      </span>\n                    </header>",
    '''                      <span className={`draft-state-badge is-${activeChannelStatus.key}`}>
                        {activeChannelStatus.label}
                      </span>
                    </header>''',
    "active draft status badge",
)

page = replace_once(
    page,
    '''                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
                    </dl>''',
    '''                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>
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
                    </div>''',
    "draft state and version controls",
)

page = replace_between(
    page,
    '                  <div className="review-actions">',
    "                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (",
    '''                  <div className="review-actions">
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

                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (''',
    "review actions",
)

page = replace_once(
    page,
    '''                    <button onClick={exportMarkdown} disabled={isCampaignStale}>Markdown</button>
                    <button onClick={exportJson} disabled={isCampaignStale}>JSON</button>''',
    '''                    <button onClick={exportMarkdown} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>Markdown</button>
                    <button onClick={exportJson} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>JSON</button>''',
    "export action availability",
)

page = replace_once(
    page,
    "                  onClick={generateCampaign}",
    "                  onClick={handleGenerationAction}",
    "generation action button",
)

page = replace_once(
    page,
    '      {section === "library" && (',
    '''      {regenerationDialogOpen && (
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

      {section === "library" && (''',
    "regeneration policy dialog",
)

page_path.write_text(page)

layout_path = Path("frontend/app/layout.js")
layout = layout_path.read_text()
layout = replace_once(
    layout,
    'import "../app/campaign-freshness.css";',
    'import "../app/campaign-freshness.css";\nimport "../app/campaign-versioning.css";',
    "campaign versioning stylesheet import",
)
layout_path.write_text(layout)

css_path = Path("frontend/app/campaign-versioning.css")
css = css_path.read_text()
css = replace_once(
    css,
    '''.app-shell .review-tab__copy {
  min-width: 0;
  flex: 1;
  display: grid;
  gap: 0.18rem;
}''',
    '''.app-shell .review-tabs button .review-tab__copy {
  width: auto;
  height: auto;
  min-width: 0;
  flex: 1;
  border: 0;
  border-radius: 0;
  display: grid;
  place-items: initial;
  gap: 0.18rem;
  background: transparent;
}''',
    "review tab copy reset",
)
css_path.write_text(css)
