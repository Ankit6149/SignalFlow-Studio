"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PlatformIcon from "../components/PlatformIcon";
import SourceStage from "../components/SourceStage";
import DestinationsStage from "../components/DestinationsStage";
import ReviewStage from "../components/ReviewStage";
import RegenerationDialog from "../components/RegenerationDialog";
import WorkspaceShell from "../components/WorkspaceShell";
import {
  resolveStudioStage,
  restoreSourceSnapshot,
} from "../lib/studio/clientReliability.mjs";
import {
  createGenerationSourceSnapshot,
  getCampaignFreshness,
  getGenerationSourceChanges,
  restoreGenerationRun,
} from "../lib/studio/campaignFreshness.mjs";
import {
  selectCampaignStatus,
  selectChannelStatus,
} from "../lib/studio/campaignStatus.mjs";
import {
  CHANNELS,
  CORE_CHANNELS,
  DEFAULT_CHANNELS,
  OFFICIAL_CONNECTORS,
  channelMeta,
} from "../lib/studio/studioCatalog.mjs";
import { useProviderRouteController } from "../lib/studio/useProviderRouteController.js";
import { useOwnerConnectionsController } from "../lib/studio/useOwnerConnectionsController.js";
import { useCampaignPersistenceController } from "../lib/studio/useCampaignPersistenceController.js";
import {
  providerRecoveryMessage,
  useCampaignGenerationController,
} from "../lib/studio/useCampaignGenerationController.js";
import { useCampaignPublishingController } from "../lib/studio/useCampaignPublishingController.js";
import { useCampaignSourceController } from "../lib/studio/useCampaignSourceController.js";
import { useCampaignReviewController } from "../lib/studio/useCampaignReviewController.js";
import {
  useCampaignEditorSession,
} from "../lib/studio/CampaignEditorSessionContext.js";

function generationProgressLabel(status) {
  const labels = {
    queued: "Queued",
    generating: "Generating",
    revising: "Revising",
    complete: "Complete",
    needs_review: "Needs review",
    failed: "Failed",
    cancelled: "Cancelled",
  };
  return labels[String(status || "")] || "Preparing";
}

function createClientId(kind) {
  const randomId = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `signalflow-${kind}-${randomId}`;
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

export default function StudioRootController() {
  const router = useRouter();
  const {
    campaignState,
    dispatchCampaign,
    form,
    setForm,
    channels,
    setChannels,
    files,
    setFiles,
    documentText,
    setDocumentText,
    strategyReview,
    setStrategyReview,
    currentCampaignId,
    setCurrentCampaignId,
    publishOptions,
    setPublishOptions,
  } = useCampaignEditorSession();
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
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const fileInputRef = useRef(null);
  const {
    availableProviders,
    provider,
    providerStatuses,
    capabilitySnapshot,
    providerStatusLoading,
    providerTest,
    providerReadiness,
    providerCredentialPlacement,
    refreshProviderStatus,
    testProviderConnection,
  } = useProviderRouteController({ form, setForm });
  const {
    connections,
    accessToken,
    syncOwnerSession,
    refreshConnections,
  } = useOwnerConnectionsController({
    setBusy,
    setMessage,
    onRequireOwnerUnlock: () => router.push("/settings"),
  });
  const activeMeta = channelMeta(activeChannel);
  const currentPost = posts[activeChannel] || "";
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
const sourceAndChannelsReady = sourceSignals > 0 && channels.length > 0;
  const composeReady = sourceAndChannelsReady && providerReadiness.ready;
  const connectedOfficialCount = Array.from(OFFICIAL_CONNECTORS).filter(
    (id) =>
      connections[id]?.connected &&
      connections[id]?.verified &&
      connections[id]?.canPublishText &&
      !connections[id]?.expired,
  ).length;

  const {
    sourceArtifactSummary,
    handleFiles,
    removeFile,
  } = useCampaignSourceController({
    files,
    setFiles,
    setDocumentText,
    currentCampaignId,
    setStrategyReview,
    setMessage,
    createClientId,
  });

  const campaignStatus = selectCampaignStatus({
    state: campaignState,
    isStale: isCampaignStale,
    currentSourceFingerprint: currentSourceSnapshot.fingerprint,
    hasCampaignId: Boolean(currentCampaignId),
  });
  const {
    saveCampaign,
    saveCampaignAsCopy,
    exportMarkdown,
    exportJson,
    exportZip,
  } = useCampaignPersistenceController({
    campaignState,
    form,
    channels,
    files,
    documentText,
    publishOptions,
    currentCampaignId,
    setCurrentCampaignId,
    currentSourceSnapshot,
    exportBlockedReason: campaignStatus.exportBlockedReason,
    dispatchCampaign,
    setBusy,
    setMessage,
  });
  const {
    generationProgress,
    regenerationDialogOpen,
    editedDraftChannels,
    uneditedRegenerationTargets,
    closeRegenerationDialog,
    cancelGeneration,
    regenerateActiveChannel,
    regenerateUnedited,
    archiveAndRegenerateAll,
    handleGenerationAction,
  } = useCampaignGenerationController({
    form,
    channels,
    files,
    documentText,
    currentCampaignId,
    providerReadiness,
    provider,
    result,
    campaignStatus,
    channelStates,
    activeChannel,
    dispatchCampaign,
    setStrategyReview,
    setStage,
    navigateStudioFlow,
    setBusy,
    setMessage,
    createArchiveId: () => createClientId("archive"),
  });
  const activeChannelStatus = selectChannelStatus({
    channelState: channelStates[activeChannel],
    isStale: isCampaignStale,
    content: currentPost,
  });
  const {
    canPublishCurrent,
    currentConnectionLabel,
    publishAvailability,
    directPublishAvailability,
    updatePublishOption,
    copyCurrentPost,
    copyAndOpenCurrent,
    publishCurrentPost,
  } = useCampaignPublishingController({
    connections,
    campaignFreshness,
    activeChannel,
    activeMeta,
    activeChannelStatus,
    currentPost,
    isOverLimit,
    xThreadMode,
    publishOptions,
    setPublishOptions,
    projectName: form.projectName,
    revision,
    setBusy,
    setMessage,
    refreshConnections,
  });
  const {
    versionHistoryOpen,
    canRestoreGenerated,
    moveReviewChannel,
    editActivePost,
    restoreActiveGeneratedPost,
    toggleVersionHistory,
    handleDraftApproval,
    restoreArchivedVersion,
    discardArchivedVersion,
  } = useCampaignReviewController({
    channels,
    activeChannel,
    channelStates,
    generatedPosts,
    dispatchCampaign,
    setActiveChannel,
    setMessage,
    createArchiveId: () => createClientId("archive"),
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    void syncOwnerSession();
    void refreshProviderStatus();

    const params = new URLSearchParams(window.location.search);
    const requestedChannel = params.get("channel");
    if (CHANNELS.some((item) => item.id === requestedChannel)) {
      setChannels((previous) => previous.includes(requestedChannel)
        ? previous
        : [...previous, requestedChannel]);
      setActiveChannel(requestedChannel);
    }
  }, []);

  useEffect(() => {
    refreshConnections();
    refreshProviderStatus();
  }, [accessToken]);

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
    if (typeof window === "undefined") return;
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, left: 0, behavior: "auto" });
    });
  }, []);

  function setStage(nextStage) {
    dispatchCampaign({ type: "SET_STAGE", stage: nextStage });
  }

  function setActiveChannel(channel) {
    dispatchCampaign({ type: "SET_ACTIVE_CHANNEL", channel });
  }

  function updateForm(key, value) {
    setStrategyReview(null);
    setForm((previous) => ({ ...previous, [key]: value }));
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
    setStrategyReview(null);
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

  function clearChannels() {
    setChannels([]);
  }

  function selectProviderRoute(providerId) {
    updateForm("provider", providerId);
    setProviderTest({ status: "idle", message: "" });
  }



  return (
    <WorkspaceShell
      activeItem="create"
      statusLabel={providerReadiness.ready ? `${provider.label} ready` : "Model setup needed"}
      statusTone={providerReadiness.ready ? "ready" : "attention"}
    >

      {message && (
        <div className={`toast toast--${message.type}`} role="status" aria-live="polite">
          <span>{message.text}</span>
          <button aria-label="Dismiss message" onClick={() => setMessage(null)}>
            ×
          </button>
        </div>
      )}

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
            <SourceStage
              hidden={stage !== "source"}
              form={form}
              onUpdateForm={updateForm}
              fileInputRef={fileInputRef}
              onFiles={handleFiles}
              files={files}
              sourceArtifactSummary={sourceArtifactSummary}
              onRemoveFile={removeFile}
            />

            <section className={`panel output-panel ${stage === "source" ? "is-step-hidden" : ""}`} id="campaign-destinations">
              <DestinationsStage
                active={stage === "destinations"}
                channels={channels}
                onUseCoreChannels={useCoreChannels}
                onSelectAllChannels={selectAllChannels}
                onClearChannels={clearChannels}
                onToggleChannel={toggleChannel}
                providerReadiness={providerReadiness}
                providerStatusLoading={providerStatusLoading}
                provider={provider}
                form={form}
                onUpdateForm={updateForm}
                providerCredentialPlacement={providerCredentialPlacement}
                availableProviders={availableProviders}
                providerStatuses={providerStatuses}
                onSelectProvider={selectProviderRoute}
                providerTest={providerTest}
                onTestProviderConnection={testProviderConnection}
                strategyReview={strategyReview}
                onReviewSource={() => setStage("source")}
                onRebuildStrategy={handleGenerationAction}
                busy={busy}
                composeReady={composeReady}
                sourceAndChannelsReady={sourceAndChannelsReady}
                sourceSignals={sourceSignals}
              />

              {stage !== "destinations" && (
                <ReviewStage
                  isCampaignStale={isCampaignStale}
                  campaignStatus={campaignStatus}
                  projectName={form.projectName}
                  revision={revision}
                  channels={channels}
                  lastSavedAt={lastSavedAt}
                  lastExportedAt={lastExportedAt}
                  sourceChangeLabels={sourceChangeLabels}
                  onReviewChanges={() => navigateStudioFlow("destinations")}
                  channelStates={channelStates}
                  posts={posts}
                  activeChannel={activeChannel}
                  onSelectChannel={setActiveChannel}
                  onMoveChannel={moveReviewChannel}
                  activeMeta={activeMeta}
                  activeChannelStatus={activeChannelStatus}
                  currentPost={currentPost}
                  onEditPost={editActivePost}
                  isOverLimit={isOverLimit}
                  xThreadMode={xThreadMode}
                  xThreadParts={xThreadParts}
                  xLongestPart={xLongestPart}
                  characterPercent={characterPercent}
                  canPublishCurrent={canPublishCurrent}
                  sourceSignals={sourceSignals}
                  fileCount={files.length}
                  generationRun={generationRun}
                  getProviderRecoveryMessage={providerRecoveryMessage}
                  onDraftApproval={handleDraftApproval}
                  onRegenerateActiveChannel={regenerateActiveChannel}
                  providerReady={providerReadiness.ready}
                  canRestoreGenerated={canRestoreGenerated}
                  onRestoreGenerated={restoreActiveGeneratedPost}
                  versionHistoryOpen={versionHistoryOpen}
                  onToggleVersionHistory={toggleVersionHistory}
                  archives={archives}
                  onRestoreArchivedVersion={restoreArchivedVersion}
                  onDiscardArchivedVersion={discardArchivedVersion}
                  publishOptions={publishOptions}
                  onUpdatePublishOption={updatePublishOption}
                  onCopyCurrentPost={copyCurrentPost}
                  onSaveCampaign={saveCampaign}
                  onSaveCampaignAsCopy={saveCampaignAsCopy}
                  currentCampaignId={currentCampaignId}
                  onCopyAndOpenCurrent={copyAndOpenCurrent}
                  busy={busy}
                  publishAvailability={publishAvailability}
                  currentConnectionLabel={currentConnectionLabel}
                  directPublishAvailability={directPublishAvailability}
                  onPublishCurrentPost={publishCurrentPost}
                  onConfigureConnector={() => router.push("/connections")}
                  warnings={result?.warnings || []}
                  onExportMarkdown={exportMarkdown}
                  onExportJson={exportJson}
                  onExportZip={() => void exportZip()}
                />
              )}
            </section>
          </div>

          <div className="studio-actionbar" id="campaign-command">
            <div
              className={`studio-actionbar__summary ${busy && generationProgress ? "has-progress" : ""}`}
              role={busy && generationProgress ? "status" : undefined}
              aria-live={busy && generationProgress ? "polite" : undefined}
              aria-atomic={busy && generationProgress ? "true" : undefined}
            >
              {busy && generationProgress ? (
                <>
                  <span>
                    {generationProgress.phase === "strategy"
                      ? `Strategy · ${generationProgressLabel(generationProgress.strategy)}`
                      : generationProgress.phase === "cancelled"
                        ? "Generation · Cancelling"
                        : `Destinations · ${generationProgress.completedDestinations || 0}/${generationProgress.totalDestinations || channels.length} complete`}
                  </span>
                  <i />
                  <span>{provider.label}</span>
                  <div className="generation-progress-list" aria-label="Destination generation progress">
                    {Object.entries(generationProgress.destinations || {}).map(([channelId, status]) => (
                      <span className={`generation-progress-chip is-${status}`} key={channelId}>
                        <PlatformIcon platform={channelId} size={13} />
                        {channelMeta(channelId).label} · {generationProgressLabel(status)}
                      </span>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <span>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}</span>
                  <i />
                  <span>{channels.length} destinations</span>
                  <i />
                  <span>{provider.label}</span>
                </>
              )}
            </div>
            <div className="studio-actionbar__actions">
              {busy && (
                <button
                  type="button"
                  className="button button--outline"
                  onClick={cancelGeneration}
                >
                  Cancel generation
                </button>
              )}
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

      <RegenerationDialog
        open={regenerationDialogOpen}
        editedCount={editedDraftChannels.length}
        uneditedCount={uneditedRegenerationTargets.length}
        channelCount={channels.length}
        onClose={closeRegenerationDialog}
        onRegenerateUnedited={regenerateUnedited}
        onArchiveAndRegenerateAll={archiveAndRegenerateAll}
      />



    </WorkspaceShell>
  );
}
