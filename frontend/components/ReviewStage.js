"use client";

import PlatformIcon from "./PlatformIcon";
import { OFFICIAL_CONNECTORS, channelMeta } from "../lib/studio/studioCatalog.mjs";
import { selectChannelStatus } from "../lib/studio/campaignStatus.mjs";

function formatDate(value) {
  if (!value) return "Just now";
  return new Intl.DateTimeFormat("en", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function CopyIcon() {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <rect x="6.5" y="6.5" width="9" height="9" rx="2" fill="none" stroke="currentColor" strokeWidth="1.5" />
      <path d="M4.5 12.5h-.2a1.8 1.8 0 0 1-1.8-1.8V4.3a1.8 1.8 0 0 1 1.8-1.8h6.4a1.8 1.8 0 0 1 1.8 1.8v.2" fill="none" stroke="currentColor" strokeWidth="1.5" />
    </svg>
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

export default function ReviewStage({
  isCampaignStale,
  campaignStatus,
  projectName,
  revision,
  channels,
  lastSavedAt,
  lastExportedAt,
  sourceChangeLabels,
  onReviewChanges,
  channelStates,
  posts,
  activeChannel,
  onSelectChannel,
  onMoveChannel,
  activeMeta,
  activeChannelStatus,
  currentPost,
  onEditPost,
  isOverLimit,
  xThreadMode,
  xThreadParts,
  xLongestPart,
  characterPercent,
  canPublishCurrent,
  sourceSignals,
  fileCount,
  generationRun,
  getProviderRecoveryMessage,
  onDraftApproval,
  onRegenerateActiveChannel,
  providerReady,
  canRestoreGenerated,
  onRestoreGenerated,
  versionHistoryOpen,
  onToggleVersionHistory,
  archives,
  onRestoreArchivedVersion,
  onDiscardArchivedVersion,
  publishOptions,
  onUpdatePublishOption,
  onCopyCurrentPost,
  onSaveCampaign,
  onSaveCampaignAsCopy,
  currentCampaignId,
  onCopyAndOpenCurrent,
  busy,
  publishAvailability,
  currentConnectionLabel,
  directPublishAvailability,
  onPublishCurrentPost,
  onConfigureConnector,
  warnings,
  onExportMarkdown,
  onExportJson,
  onExportZip,
}) {
  return (
    <div className={`review-workspace ${isCampaignStale ? "has-stale-campaign" : ""}`}>
      <div className="campaign-status-strip" role="status" aria-live="polite">
        <div className="campaign-status-strip__primary">
          <span className={`campaign-state-badge is-${campaignStatus.campaignKey}`}>
            {campaignStatus.campaignLabel}
          </span>
          <strong>{projectName.trim() || "Untitled campaign"}</strong>
          <small>
            Revision {revision} · {campaignStatus.approvedCount}/{channels.length} approved · {campaignStatus.editedCount} edited
          </small>
        </div>
        <div className="campaign-status-strip__meta">
          <small>{lastSavedAt ? `Saved ${formatDate(lastSavedAt)}` : "Not saved yet"}</small>
          <small>
            {campaignStatus.isExportedCurrent
              ? `Exported ${formatDate(lastExportedAt)}`
              : lastExportedAt
                ? "Changed since last export"
                : "Not exported yet"}
          </small>
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
          <button type="button" onClick={onReviewChanges}>
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
              onClick={() => onSelectChannel(channelId)}
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
        <button type="button" onClick={() => onMoveChannel(-1)}>← Previous</button>
        <button type="button" onClick={() => onMoveChannel(1)}>Next →</button>
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
          onChange={(event) => onEditPost(event.target.value)}
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
          <div>
            <dt>Length</dt>
            <dd>
              {xThreadMode
                ? `${xThreadParts.length} posts; longest is ${xLongestPart} of ${activeMeta.limit} characters`
                : activeMeta.limit
                  ? `${currentPost.length.toLocaleString()} of ${activeMeta.limit.toLocaleString()} characters`
                  : `${currentPost.length.toLocaleString()} characters; no fixed guide`}
            </dd>
          </div>
          <div>
            <dt>Campaign context</dt>
            <dd>{sourceSignals} source signal{sourceSignals === 1 ? "" : "s"}, {fileCount} attached file{fileCount === 1 ? "" : "s"}</dd>
          </div>
          <div>
            <dt>Draft state</dt>
            <dd>{activeChannelStatus.label}{activeChannelStatus.isEdited && activeChannelStatus.isApproved ? " · edited and approved" : ""}</dd>
          </div>
          <div>
            <dt>Generation run</dt>
            <dd>{channelStates[activeChannel]?.generationRunId || generationRun?.generationRunId || "Not tracked"}</dd>
          </div>
        </dl>

        {(channelStates[activeChannel]?.issues || []).length > 0 && (
          <div
            className="draft-quality-issues"
            role={["needs_review", "failed", "cancelled"].includes(channelStates[activeChannel]?.status) ? "alert" : "status"}
          >
            <strong>
              {channelStates[activeChannel]?.status === "failed"
                ? "Generation failed"
                : channelStates[activeChannel]?.status === "cancelled"
                  ? "Generation cancelled"
                  : channelStates[activeChannel]?.status === "needs_review"
                    ? "Unresolved quality issues"
                    : "Generation notes"}
            </strong>
            <ul>
              {channelStates[activeChannel].issues.map((issue, index) => (
                <li key={channelStates[activeChannel]?.issueCodes?.[index] || index}>
                  {channelStates[activeChannel]?.issueCodes?.[index] && (
                    <code>{channelStates[activeChannel].issueCodes[index]}</code>
                  )}
                  <span>{issue}</span>
                </li>
              ))}
            </ul>
            {channelStates[activeChannel]?.providerError && (
              <p>
                Recovery: {getProviderRecoveryMessage(channelStates[activeChannel].providerError) || "Retry deliberately or inspect provider diagnostics."}
                {channelStates[activeChannel].providerError.correlationId
                  ? ` Reference ${channelStates[activeChannel].providerError.correlationId}.`
                  : ""}
              </p>
            )}
          </div>
        )}

        <div className="draft-state-actions" aria-label={`${activeMeta.label} draft state actions`}>
          <button
            type="button"
            className={channelStates[activeChannel]?.approved ? "is-approved" : ""}
            onClick={onDraftApproval}
            disabled={!currentPost || isCampaignStale}
          >
            {channelStates[activeChannel]?.approved
              ? "Return to review"
              : channelStates[activeChannel]?.status === "needs_review"
                ? "Accept issues & approve"
                : "Mark approved"}
          </button>
          <button
            type="button"
            onClick={onRegenerateActiveChannel}
            disabled={busy || !providerReady}
          >
            {["failed", "cancelled"].includes(channelStates[activeChannel]?.status)
              ? "Retry destination"
              : "Regenerate this channel"}
          </button>
          {canRestoreGenerated && (
            <button type="button" onClick={onRestoreGenerated}>
              Restore generated copy
            </button>
          )}
        </div>

        <div className="version-history">
          <button
            type="button"
            className="version-history-toggle"
            onClick={onToggleVersionHistory}
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
                      <strong>
                        {archive.reason === "channel"
                          ? "Channel regeneration"
                          : archive.reason === "unedited"
                            ? "Unedited regeneration"
                            : "Full campaign version"}
                      </strong>
                      <small>{formatDate(archive.createdAt)} · revision {archive.revision}</small>
                    </div>
                  </header>
                  <div className="version-history-item__actions">
                    <button type="button" onClick={() => onRestoreArchivedVersion(archive.archiveId)}>Restore</button>
                    <button type="button" onClick={() => onDiscardArchivedVersion(archive.archiveId)}>Discard</button>
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
                onChange={(event) => onUpdatePublishOption("reddit", "subreddit", event.target.value)}
                placeholder="e.g. SideProject"
              />
            </label>
            <label>
              <span>Post title</span>
              <input
                value={publishOptions.reddit?.title || ""}
                onChange={(event) => onUpdatePublishOption("reddit", "title", event.target.value)}
                placeholder={projectName || "A clear, factual title"}
              />
            </label>
            <small>Required for direct Reddit publishing. Community rules still apply.</small>
          </div>
        )}
      </aside>

      <div className="review-actions">
        <button
          className="button button--outline"
          onClick={onCopyCurrentPost}
          disabled={Boolean(campaignStatus.copyBlockedReason) || !currentPost}
          title={campaignStatus.copyBlockedReason || undefined}
        >
          <CopyIcon /> Copy draft
        </button>
        <div className="save-action-group">
          <button className="button button--outline" onClick={onSaveCampaign} disabled={busy}>
            {currentCampaignId ? "Save changes" : "Save locally"}
          </button>
          <button className="button button--outline" onClick={onSaveCampaignAsCopy} disabled={busy}>
            Save as copy
          </button>
        </div>
        <button
          className="button button--dark"
          onClick={onCopyAndOpenCurrent}
          disabled={busy || !publishAvailability.ready}
          title={publishAvailability.reason || undefined}
        >
          {!publishAvailability.ready
            ? channelStates[activeChannel]?.approved
              ? "Handoff unavailable"
              : "Approve to continue"
            : activeMeta.openUrl
              ? `Copy & open ${activeMeta.label}`
              : "Copy approved draft"}
          <ArrowIcon />
        </button>
        {!publishAvailability.ready && (
          <p className="review-action-reason" role="status">{publishAvailability.reason}</p>
        )}
      </div>

      {OFFICIAL_CONNECTORS.has(activeChannel) && (
        <details className="route-note direct-publish-panel">
          <summary>Direct publishing to {activeMeta.label}</summary>
          <div className="direct-publish-panel__body">
            <div>
              <strong>{currentConnectionLabel}</strong>
              <span>Revision {revision} · exact approved draft currently shown</span>
            </div>
            <button
              type="button"
              className="button button--outline"
              onClick={onPublishCurrentPost}
              disabled={busy || !directPublishAvailability.ready}
              title={directPublishAvailability.reason || undefined}
            >
              Publish this revision
            </button>
            {!directPublishAvailability.ready && (
              <p className="review-action-reason" role="status">{directPublishAvailability.reason}</p>
            )}
          </div>
        </details>
      )}

      {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (
        <button className="publishing-route-link" onClick={onConfigureConnector}>
          Configure the official {activeMeta.label} connector
          <ArrowIcon />
        </button>
      )}

      {warnings.length > 0 && (
        <details className="route-note">
          <summary>Generation and integration notes ({warnings.length})</summary>
          <ul>
            {warnings.map((warning, index) => (
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
        <button
          onClick={onExportMarkdown}
          disabled={busy || Boolean(campaignStatus.exportBlockedReason)}
          title={campaignStatus.exportBlockedReason || undefined}
        >
          Markdown
        </button>
        <button
          onClick={onExportJson}
          disabled={busy || Boolean(campaignStatus.exportBlockedReason)}
          title={campaignStatus.exportBlockedReason || undefined}
        >
          JSON
        </button>
        <button
          onClick={onExportZip}
          disabled={busy || Boolean(campaignStatus.exportBlockedReason)}
          title={campaignStatus.exportBlockedReason || undefined}
        >
          {busy ? "Preparing…" : "ZIP"}
        </button>
      </div>
    </div>
  );
}
