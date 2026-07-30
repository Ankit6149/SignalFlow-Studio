import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

function replaceBetween(source, start, end, replacement, label) {
  const startIndex = source.indexOf(start);
  if (startIndex < 0) throw new Error(`Missing start for ${label}`);
  const endIndex = source.indexOf(end, startIndex + start.length);
  if (endIndex < 0) throw new Error(`Missing end for ${label}`);
  return `${source.slice(0, startIndex)}${replacement}${source.slice(endIndex)}`;
}

const pagePath = "frontend/app/page.js";
let page = fs.readFileSync(pagePath, "utf8");

page = replaceOnce(
  page,
  'import { acceptGenerationResponse } from "../lib/studio/generationAcceptance.mjs";\nimport { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";\nimport { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";',
  'import { acceptGenerationResponse } from "../lib/studio/generationAcceptance.mjs";\nimport {\n  editedChannels,\n  regenerationTargets,\n  REGENERATION_POLICIES,\n} from "../lib/studio/regenerationPolicy.mjs";\nimport {\n  selectCampaignStatus,\n  selectChannelStatus,\n  selectPublishAvailability,\n} from "../lib/studio/campaignStatus.mjs";\nimport { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";\nimport { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";',
  "Studio state imports",
);

page = replaceOnce(
  page,
  `function formatDate(value) {\n  if (!value) return "Just now";\n  return new Intl.DateTimeFormat("en", {\n    day: "numeric",\n    month: "short",\n    hour: "numeric",\n    minute: "2-digit",\n  }).format(new Date(value));\n}\n`,
  `function formatDate(value) {\n  if (!value) return "Just now";\n  return new Intl.DateTimeFormat("en", {\n    day: "numeric",\n    month: "short",\n    hour: "numeric",\n    minute: "2-digit",\n  }).format(new Date(value));\n}\n\nfunction createClientId(kind) {\n  const randomId = globalThis.crypto?.randomUUID?.()\n    || \`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}\`;\n  return \`signalflow-${kind}-${randomId}\`;\n}\n`,
  "client ID helper",
);

page = replaceOnce(
  page,
  '  const { stage, result, generationRun, posts, activeChannel } = campaignState;',
  `  const {\n    stage,\n    result,\n    generationRun,\n    posts,\n    generatedPosts,\n    channelStates,\n    activeChannel,\n    archives,\n    revision,\n    savedRevision,\n    exportedRevision,\n    lastSavedAt,\n    lastExportedAt,\n    savedSourceFingerprint,\n  } = campaignState;`,
  "campaign state destructuring",
);

page = replaceOnce(
  page,
  '  const [currentCampaignId, setCurrentCampaignId] = useState("");',
  '  const [currentCampaignId, setCurrentCampaignId] = useState("");\n  const [regenerationDialogOpen, setRegenerationDialogOpen] = useState(false);\n  const [versionHistoryOpen, setVersionHistoryOpen] = useState(false);',
  "campaign dialog state",
);

page = replaceOnce(
  page,
  '  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));',
  `  const reviewIndex = Math.max(0, channels.indexOf(activeChannel));\n  const campaignStatus = selectCampaignStatus({\n    state: campaignState,\n    isStale: isCampaignStale,\n    currentSourceFingerprint: currentSourceSnapshot.fingerprint,\n    hasCampaignId: Boolean(currentCampaignId),\n  });\n  const activeChannelStatus = selectChannelStatus({\n    channelState: channelStates[activeChannel],\n    isStale: isCampaignStale,\n    content: currentPost,\n  });\n  const editedDraftChannels = editedChannels({ channels, channelStates });\n  const uneditedRegenerationTargets = regenerationTargets({\n    policy: REGENERATION_POLICIES.UNEDITED,\n    channels,\n    channelStates,\n    activeChannel,\n  });\n  const publishAvailability = selectPublishAvailability({\n    channelStatus: activeChannelStatus,\n    isStale: isCampaignStale,\n    hasContent: Boolean(currentPost),\n    isOverLimit,\n    connectorReady: canPublishCurrent,\n    manualRoute: Boolean(activeMeta.openUrl || !OFFICIAL_CONNECTORS.has(activeChannel)),\n  });`,
  "campaign status selectors",
);

page = replaceOnce(
  page,
  `  useEffect(() => {\n    if (typeof window === "undefined") return;\n    window.requestAnimationFrame(() => {`,
  `  useEffect(() => {\n    if (!regenerationDialogOpen) return undefined;\n    function closeOnEscape(event) {\n      if (event.key === "Escape") setRegenerationDialogOpen(false);\n    }\n    window.addEventListener("keydown", closeOnEscape);\n    return () => window.removeEventListener("keydown", closeOnEscape);\n  }, [regenerationDialogOpen]);\n\n  useEffect(() => {\n    if (typeof window === "undefined") return;\n    window.requestAnimationFrame(() => {`,
  "regeneration dialog keyboard behavior",
);

page = replaceOnce(
  page,
  `  function startNewCampaign() {\n    setCurrentCampaignId("");\n    dispatchCampaign({ type: "RESET_CAMPAIGN" });`,
  `  function startNewCampaign() {\n    setCurrentCampaignId("");\n    setRegenerationDialogOpen(false);\n    setVersionHistoryOpen(false);\n    dispatchCampaign({ type: "RESET_CAMPAIGN" });`,
  "new campaign reset",
);

page = replaceBetween(
  page,
  "  async function generateCampaign() {",
  "  function currentCampaignInput(overrides = {}) {",
  `  async function requestGeneration(requestedChannels) {\n    if (!form.notes.trim() && !form.links.trim() && !form.repo.trim() && documentText.length === 0) {\n      throw new Error("Add a brief, link, repository, or extractable text file before generating.");\n    }\n    if (!providerReadiness.ready) {\n      navigateStudioFlow("destinations");\n      throw new Error(providerReadiness.reason);\n    }\n\n    const requestedSourceSnapshot = createGenerationSourceSnapshot({\n      form,\n      channels,\n      files,\n      documentText,\n    });\n    const response = await fetch("/api/launch_kit", {\n      method: "POST",\n      headers: authHeaders({ "Content-Type": "application/json" }),\n      body: JSON.stringify({\n        project_name: form.projectName.trim() || "Untitled campaign",\n        notes: form.notes.trim(),\n        audience: form.audience.trim(),\n        docs_url: form.links.trim(),\n        repo: form.repo.trim(),\n        channels: requestedChannels,\n        output_types: ["posts", "media_plan", "markdown", "json"],\n        generator: form.provider,\n        providerApiKey: form.apiKey.trim(),\n        providerModelName: form.model.trim(),\n        providerBaseUrl: form.baseUrl.trim(),\n        document_text: documentText,\n        media_items: files.map(({ name, type, size, description }) => ({\n          name,\n          type,\n          size,\n          description,\n        })),\n      }),\n    });\n\n    const data = await readJsonResponse(response, "SignalFlow returned an unreadable generation response.");\n    if (!response.ok || data.ok === false) {\n      throw new Error(data.error || "SignalFlow could not generate this campaign.");\n    }\n    const accepted = acceptGenerationResponse({ response: data, requestedChannels });\n    const nextGenerationRun = createGenerationRun({\n      sourceSnapshot: requestedSourceSnapshot,\n      response: accepted.result,\n      provider: form.provider,\n      model: form.model.trim(),\n    });\n    return { accepted, nextGenerationRun, data };\n  }\n\n  async function generateInitialCampaign() {\n    setBusy(true);\n    setMessage(null);\n    try {\n      const { accepted, nextGenerationRun, data } = await requestGeneration(channels);\n      dispatchCampaign({\n        type: "ACCEPT_GENERATION",\n        payload: {\n          result: accepted.result,\n          generationRun: nextGenerationRun,\n          posts: accepted.posts,\n          requestedChannels: channels,\n          activeChannel: accepted.activeChannel,\n        },\n      });\n      setMessage({\n        type: accepted.failedChannels.length ? "warning" : "success",\n        text: accepted.failedChannels.length\n          ? \`Campaign generated with ${data.providerUsed || provider.label}; ${accepted.failedChannels.join(", ")} failed without replacing successful drafts.\`\n          : \`Campaign generated with ${data.providerUsed || provider.label}. Review and approve each destination before publishing.\`,\n      });\n    } catch (error) {\n      setMessage({ type: "error", text: error.message });\n    } finally {\n      setBusy(false);\n    }\n  }\n\n  async function performRegeneration(policy, channel = activeChannel) {\n    const targetChannels = regenerationTargets({ policy, channels, channelStates, activeChannel: channel });\n    if (!targetChannels.length) {\n      setRegenerationDialogOpen(false);\n      setMessage({ type: "warning", text: "There are no eligible destinations for this regeneration choice." });\n      return;\n    }\n\n    setRegenerationDialogOpen(false);\n    setBusy(true);\n    setMessage(null);\n    try {\n      const { accepted, nextGenerationRun, data } = await requestGeneration(targetChannels);\n      const archivedAt = new Date().toISOString();\n      dispatchCampaign({\n        type: "APPLY_REGENERATION",\n        payload: {\n          result: accepted.result,\n          generationRun: nextGenerationRun,\n          posts: accepted.posts,\n          targetChannels,\n          policy,\n          archiveId: createClientId("archive"),\n          archivedAt,\n          activeChannel: policy === REGENERATION_POLICIES.CHANNEL ? channel : activeChannel,\n        },\n      });\n      setMessage({\n        type: accepted.failedChannels.length ? "warning" : "success",\n        text: accepted.failedChannels.length\n          ? \`Regeneration completed with ${data.providerUsed || provider.label}; ${accepted.failedChannels.join(", ")} failed and their existing drafts were preserved.\`\n          : policy === REGENERATION_POLICIES.CHANNEL\n            ? \`${channelMeta(channel).label} regenerated. Every other destination remained unchanged.\`\n            : policy === REGENERATION_POLICIES.UNEDITED\n              ? \`Regenerated ${targetChannels.length} unedited destinations. ${editedDraftChannels.length} edited drafts were preserved exactly.\`\n              : "The previous campaign version was archived and all selected destinations were regenerated.",\n      });\n    } catch (error) {\n      setMessage({ type: "error", text: \`${error.message} Existing drafts and edits were not changed.\` });\n    } finally {\n      setBusy(false);\n    }\n  }\n\n  function handleGenerationAction() {\n    if (!result) {\n      void generateInitialCampaign();\n      return;\n    }\n    if (campaignStatus.hasEditedDrafts) {\n      setRegenerationDialogOpen(true);\n      return;\n    }\n    void performRegeneration(REGENERATION_POLICIES.ARCHIVE_ALL);\n  }\n\n  function restoreArchivedVersion(archiveId) {\n    const restoredAt = new Date().toISOString();\n    dispatchCampaign({\n      type: "RESTORE_ARCHIVE",\n      payload: {\n        archiveId,\n        currentArchiveId: createClientId("archive"),\n        restoredAt,\n      },\n    });\n    setMessage({ type: "success", text: "Archived campaign version restored. Save to keep it as the current local version." });\n  }\n\n  function discardArchivedVersion(archiveId) {\n    if (!window.confirm("Discard this archived campaign version? This cannot be undone.")) return;\n    dispatchCampaign({ type: "DISCARD_ARCHIVE", archiveId });\n  }\n\n  function currentEditorState(overrides = {}) {\n    return {\n      revision,\n      savedRevision,\n      exportedRevision,\n      lastSavedAt,\n      lastExportedAt,\n      savedSourceFingerprint,\n      ...overrides,\n    };\n  }\n\n  function currentCampaignInput(overrides = {}) {`,
  "generation workflow",
);

page = replaceBetween(
  page,
  "  function currentCampaignInput(overrides = {}) {",
  "  async function saveCampaign() {",
  `  function currentCampaignInput(overrides = {}) {\n    return {\n      campaignId: currentCampaignId,\n      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",\n      channels: [...channels],\n      posts: { ...posts },\n      generatedPosts: { ...generatedPosts },\n      channelStates: structuredClone(channelStates),\n      archives: structuredClone(archives),\n      result,\n      generationRun,\n      editorState: currentEditorState(),\n      brief: { ...form },\n      publishOptions,\n      ...createSourceSnapshot(files, documentText),\n      ...overrides,\n    };\n  }\n\n  async function saveCampaign() {`,
  "campaign persistence input",
);

page = replaceBetween(
  page,
  "  async function saveCampaign() {",
  "  function openCampaign(item) {",
  `  async function persistCampaign({ asCopy = false } = {}) {\n    if (!result) return;\n    const savedAt = new Date().toISOString();\n    const input = currentCampaignInput({\n      updatedAt: savedAt,\n      editorState: currentEditorState({\n        savedRevision: revision,\n        lastSavedAt: savedAt,\n        savedSourceFingerprint: currentSourceSnapshot.fingerprint,\n      }),\n    });\n    try {\n      const saved = asCopy\n        ? await campaignApplication.saveAsCopy(input)\n        : await campaignApplication.saveCampaign(input);\n      setCurrentCampaignId(saved.campaignId);\n      setLibrary(await campaignApplication.listCampaigns());\n      dispatchCampaign({\n        type: "MARK_SAVED",\n        payload: { savedAt, sourceFingerprint: currentSourceSnapshot.fingerprint },\n      });\n      setMessage({\n        type: "success",\n        text: asCopy\n          ? "Saved as a separate local campaign copy. The original remains unchanged."\n          : "Campaign saved to your local library.",\n      });\n    } catch (error) {\n      setMessage({\n        type: "error",\n        text: \`The browser could not save this campaign${error?.name === "QuotaExceededError" ? " because local storage is full" : ""}. Export Markdown or JSON now before leaving this page.\`,\n      });\n    }\n  }\n\n  async function saveCampaign() {\n    await persistCampaign();\n  }\n\n  async function saveCampaignAsCopy() {\n    await persistCampaign({ asCopy: true });\n  }\n\n  function openCampaign(item) {`,
  "campaign save operations",
);

page = replaceOnce(
  page,
  `          posts: restored.posts,\n          result: restored.result,\n          generationRun: restored.generationRun,\n          activeChannel: restored.channels[0] || "linkedin",`,
  `          posts: restored.posts,\n          generatedPosts: restored.generatedPosts,\n          channelStates: restored.channelStates,\n          archives: restored.archives,\n          result: restored.result,\n          generationRun: restored.generationRun,\n          revision: restored.revision,\n          savedRevision: restored.savedRevision,\n          exportedRevision: restored.exportedRevision,\n          lastSavedAt: restored.lastSavedAt,\n          lastExportedAt: restored.lastExportedAt,\n          savedSourceFingerprint: restored.savedSourceFingerprint,\n          activeChannel: restored.channels[0] || "linkedin",`,
  "campaign restore payload",
);

page = replaceOnce(
  page,
  `      navigateSection("studio");\n    } catch {`,
  `      setVersionHistoryOpen(false);\n      navigateSection("studio");\n    } catch {`,
  "campaign open UI reset",
);

page = replaceBetween(
  page,
  "  function exportMarkdown() {",
  "  function exportJson() {",
  `  function exportMarkdown() {\n    if (campaignStatus.exportBlockedReason) {\n      setMessage({ type: "warning", text: campaignStatus.exportBlockedReason });\n      return;\n    }\n    try {\n      const projection = campaignApplication.projectMarkdown(currentCampaignInput());\n      downloadText(projection.filename, projection.content, projection.mimeType);\n      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt: new Date().toISOString() } });\n      setMessage({ type: "success", text: "Current campaign revision exported as Markdown." });\n    } catch {\n      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into Markdown." });\n    }\n  }\n\n  function exportJson() {`,
  "Markdown export state",
);

page = replaceBetween(
  page,
  "  function exportJson() {",
  "  async function publishCurrentPost() {",
  `  function exportJson() {\n    if (campaignStatus.exportBlockedReason) {\n      setMessage({ type: "warning", text: campaignStatus.exportBlockedReason });\n      return;\n    }\n    try {\n      const projection = campaignApplication.projectJson(currentCampaignInput());\n      downloadText(projection.filename, projection.content, projection.mimeType);\n      dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt: new Date().toISOString() } });\n      setMessage({ type: "success", text: "Current campaign revision exported as versioned JSON." });\n    } catch {\n      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into JSON." });\n    }\n  }\n\n  async function publishCurrentPost() {`,
  "JSON export state",
);

page = replaceBetween(
  page,
  "  async function publishCurrentPost() {",
  "    if (isOverLimit) {",
  `  async function publishCurrentPost() {\n    if (!publishAvailability.ready) {\n      setMessage({ type: "warning", text: publishAvailability.reason });\n      return;\n    }\n    if (!canPublishCurrent) {\n      await copyAndOpenCurrent();\n      return;\n    }\n\n    if (isOverLimit) {`,
  "publish state guard",
);

page = replaceOnce(
  page,
  '                <div className={`review-workspace ${isCampaignStale ? "has-stale-campaign" : ""}`}>',
  `                <div className={\`review-workspace ${isCampaignStale ? "has-stale-campaign" : ""}\`}>\n                  <div className="campaign-status-strip" role="status" aria-live="polite">\n                    <div className="campaign-status-strip__primary">\n                      <span className={\`campaign-state-badge is-${campaignStatus.campaignKey}\`}>\n                        {campaignStatus.campaignLabel}\n                      </span>\n                      <strong>{form.projectName.trim() || "Untitled campaign"}</strong>\n                      <small>Revision {revision} · {campaignStatus.approvedCount}/{channels.length} approved · {campaignStatus.editedCount} edited</small>\n                    </div>\n                    <div className="campaign-status-strip__meta">\n                      <small>{lastSavedAt ? \`Saved ${formatDate(lastSavedAt)}\` : "Not saved yet"}</small>\n                      <small>{campaignStatus.isExportedCurrent ? \`Exported ${formatDate(lastExportedAt)}\` : lastExportedAt ? "Changed since last export" : "Not exported yet"}</small>\n                    </div>\n                  </div>`,
  "campaign status strip",
);

page = replaceOnce(
  page,
  `                      const meta = channelMeta(channelId);\n                      return (\n                        <button\n                          key={channelId}\n                          className={activeChannel === channelId ? "is-active" : ""}\n                          onClick={() => setActiveChannel(channelId)}\n                        >\n                          <span>\n                            <PlatformIcon platform={channelId} size={13} />\n                          </span>\n                          {meta.label}\n                        </button>\n                      );`,
  `                      const meta = channelMeta(channelId);\n                      const status = selectChannelStatus({\n                        channelState: channelStates[channelId],\n                        isStale: isCampaignStale,\n                        content: posts[channelId] || "",\n                      });\n                      return (\n                        <button\n                          key={channelId}\n                          className={activeChannel === channelId ? "is-active" : ""}\n                          onClick={() => setActiveChannel(channelId)}\n                          aria-label={\`${meta.label}: ${status.label}\`}\n                        >\n                          <span>\n                            <PlatformIcon platform={channelId} size={13} />\n                          </span>\n                          <span className="review-tab__copy">\n                            <strong>{meta.label}</strong>\n                            <small className="review-tab__status">{status.label}</small>\n                          </span>\n                        </button>\n                      );`,
  "channel status tabs",
);

page = replaceBetween(
  page,
  "                      <span\n                        className={`connection-badge ${",
  "                      </span>\n                    </header>",
  `                      <span className={\`draft-state-badge is-${activeChannelStatus.key}\`}>\n                        {activeChannelStatus.label}\n                      </span>\n                    </header>`,
  "active draft status badge",
);

page = replaceOnce(
  page,
  `                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>\n                    </dl>`,
  `                      <div><dt>Campaign context</dt><dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {files.length} attached file{files.length === 1 ? "" : "s"}</dd></div>\n                      <div><dt>Draft state</dt><dd>{activeChannelStatus.label}{activeChannelStatus.isEdited && activeChannelStatus.isApproved ? " · edited and approved" : ""}</dd></div>\n                      <div><dt>Generation run</dt><dd>{channelStates[activeChannel]?.generationRunId || generationRun?.generationRunId || "Not tracked"}</dd></div>\n                    </dl>\n\n                    <div className="draft-state-actions" aria-label={`${activeMeta.label} draft state actions`}>\n                      <button\n                        type="button"\n                        className={channelStates[activeChannel]?.approved ? "is-approved" : ""}\n                        onClick={() => dispatchCampaign({\n                          type: channelStates[activeChannel]?.approved ? "MARK_CHANNEL_NEEDS_REVIEW" : "MARK_CHANNEL_APPROVED",\n                          channel: activeChannel,\n                        })}\n                        disabled={!currentPost || isCampaignStale}\n                      >\n                        {channelStates[activeChannel]?.approved ? "Return to review" : "Mark approved"}\n                      </button>\n                      <button\n                        type="button"\n                        onClick={() => void performRegeneration(REGENERATION_POLICIES.CHANNEL, activeChannel)}\n                        disabled={busy || !providerReadiness.ready}\n                      >\n                        Regenerate this channel\n                      </button>\n                      {channelStates[activeChannel]?.edited && generatedPosts[activeChannel] && (\n                        <button\n                          type="button"\n                          onClick={() => dispatchCampaign({ type: "RESTORE_GENERATED", channel: activeChannel })}\n                        >\n                          Restore generated copy\n                        </button>\n                      )}\n                    </div>\n\n                    <div className="version-history">\n                      <button\n                        type="button"\n                        className="version-history-toggle"\n                        onClick={() => setVersionHistoryOpen((open) => !open)}\n                        aria-expanded={versionHistoryOpen}\n                      >\n                        <span>Version history</span>\n                        <span>{archives.length}</span>\n                      </button>\n                      {versionHistoryOpen && (\n                        <div className="version-history-list">\n                          {archives.length === 0 ? (\n                            <small>No archived generation versions yet.</small>\n                          ) : archives.map((archive) => (\n                            <article className="version-history-item" key={archive.archiveId}>\n                              <header>\n                                <div>\n                                  <strong>{archive.reason === "channel" ? "Channel regeneration" : archive.reason === "unedited" ? "Unedited regeneration" : "Full campaign version"}</strong>\n                                  <small>{formatDate(archive.createdAt)} · revision {archive.revision}</small>\n                                </div>\n                              </header>\n                              <div className="version-history-item__actions">\n                                <button type="button" onClick={() => restoreArchivedVersion(archive.archiveId)}>Restore</button>\n                                <button type="button" onClick={() => discardArchivedVersion(archive.archiveId)}>Discard</button>\n                              </div>\n                            </article>\n                          ))}\n                        </div>\n                      )}\n                    </div>`,
  "draft state and version controls",
);

page = replaceBetween(
  page,
  '                  <div className="review-actions">',
  "                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (",
  `                  <div className="review-actions">\n                    <button\n                      className="button button--outline"\n                      onClick={() => copyCurrentPost()}\n                      disabled={Boolean(campaignStatus.copyBlockedReason) || !currentPost}\n                      title={campaignStatus.copyBlockedReason || undefined}\n                    >\n                      <CopyIcon /> Copy draft\n                    </button>\n                    <div className="save-action-group">\n                      <button className="button button--outline" onClick={saveCampaign} disabled={busy}>\n                        {currentCampaignId ? "Save changes" : "Save locally"}\n                      </button>\n                      <button className="button button--outline" onClick={saveCampaignAsCopy} disabled={busy}>\n                        Save as copy\n                      </button>\n                    </div>\n                    <button\n                      className="button button--dark"\n                      onClick={publishCurrentPost}\n                      disabled={busy || !publishAvailability.ready}\n                      title={publishAvailability.reason || undefined}\n                    >\n                      {!publishAvailability.ready\n                        ? channelStates[activeChannel]?.approved\n                          ? "Action unavailable"\n                          : "Approve to continue"\n                        : canPublishCurrent\n                          ? "Publish approved draft"\n                          : activeMeta.openUrl\n                            ? \`Copy & open ${activeMeta.label}\`\n                            : "Copy approved draft"}\n                      <ArrowIcon />\n                    </button>\n                    {!publishAvailability.ready && (\n                      <p className="review-action-reason" role="status">{publishAvailability.reason}</p>\n                    )}\n                  </div>\n\n                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (`,
  "review actions",
);

page = replaceOnce(
  page,
  '                    <button onClick={exportMarkdown} disabled={isCampaignStale}>Markdown</button>\n                    <button onClick={exportJson} disabled={isCampaignStale}>JSON</button>',
  '                    <button onClick={exportMarkdown} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>Markdown</button>\n                    <button onClick={exportJson} disabled={Boolean(campaignStatus.exportBlockedReason)} title={campaignStatus.exportBlockedReason || undefined}>JSON</button>',
  "export action availability",
);

page = replaceOnce(
  page,
  "                  onClick={generateCampaign}",
  "                  onClick={handleGenerationAction}",
  "generation action button",
);

page = replaceOnce(
  page,
  '      {section === "library" && (',
  `      {regenerationDialogOpen && (\n        <div\n          className="regeneration-dialog-backdrop"\n          onMouseDown={() => setRegenerationDialogOpen(false)}\n        >\n          <section\n            className="regeneration-dialog"\n            role="dialog"\n            aria-modal="true"\n            aria-labelledby="regeneration-dialog-title"\n            aria-describedby="regeneration-dialog-description"\n            onMouseDown={(event) => event.stopPropagation()}\n          >\n            <div className="regeneration-dialog__eyebrow">Protect manual work</div>\n            <h2 id="regeneration-dialog-title">Choose how to regenerate.</h2>\n            <p id="regeneration-dialog-description">\n              {editedDraftChannels.length} destination{editedDraftChannels.length === 1 ? " has" : "s have"} manual edits. SignalFlow will never replace them without a deliberate choice.\n            </p>\n            <div className="regeneration-dialog__options">\n              <button\n                type="button"\n                className="regeneration-option"\n                autoFocus\n                onClick={() => void performRegeneration(REGENERATION_POLICIES.UNEDITED)}\n                disabled={uneditedRegenerationTargets.length === 0}\n              >\n                <strong>Regenerate only unedited destinations</strong>\n                <span>Keep all {editedDraftChannels.length} edited drafts byte-for-byte unchanged and regenerate {uneditedRegenerationTargets.length} other destinations.</span>\n              </button>\n              <button\n                type="button"\n                className="regeneration-option"\n                onClick={() => void performRegeneration(REGENERATION_POLICIES.ARCHIVE_ALL)}\n              >\n                <strong>Archive edits and regenerate everything</strong>\n                <span>Save the complete current campaign in Version history, then regenerate all {channels.length} selected destinations.</span>\n              </button>\n            </div>\n            <div className="regeneration-dialog__footer">\n              <button type="button" onClick={() => setRegenerationDialogOpen(false)}>Cancel</button>\n            </div>\n          </section>\n        </div>\n      )}\n\n      {section === "library" && (`,
  "regeneration policy dialog",
);

fs.writeFileSync(pagePath, page);

const layoutPath = "frontend/app/layout.js";
let layout = fs.readFileSync(layoutPath, "utf8");
layout = replaceOnce(
  layout,
  'import "../app/campaign-freshness.css";',
  'import "../app/campaign-freshness.css";\nimport "../app/campaign-versioning.css";',
  "campaign versioning stylesheet import",
);
fs.writeFileSync(layoutPath, layout);

const cssPath = "frontend/app/campaign-versioning.css";
let css = fs.readFileSync(cssPath, "utf8");
css = replaceOnce(
  css,
  `.app-shell .review-tab__copy {\n  min-width: 0;\n  flex: 1;\n  display: grid;\n  gap: 0.18rem;\n}`,
  `.app-shell .review-tabs button .review-tab__copy {\n  width: auto;\n  height: auto;\n  min-width: 0;\n  flex: 1;\n  border: 0;\n  border-radius: 0;\n  display: grid;\n  place-items: initial;\n  gap: 0.18rem;\n  background: transparent;\n}`,
  "review tab copy reset",
);
fs.writeFileSync(cssPath, css);
