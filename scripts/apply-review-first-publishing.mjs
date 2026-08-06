import { readFile, writeFile } from "node:fs/promises";

const pagePath = "frontend/app/page.js";
const cssPath = "frontend/app/globals.css";

function replaceOnce(source, before, after, label) {
  if (!source.includes(before)) {
    throw new Error(`Could not find ${label}`);
  }
  return source.replace(before, after);
}

function replacePattern(source, pattern, after, label) {
  if (!pattern.test(source)) {
    throw new Error(`Could not find ${label}`);
  }
  return source.replace(pattern, after);
}

let page = await readFile(pagePath, "utf8");

page = replaceOnce(
  page,
  `import {
  selectCampaignStatus,
  selectChannelStatus,
  selectPublishAvailability,
} from "../lib/studio/campaignStatus.mjs";`,
  `import {
  selectCampaignStatus,
  selectChannelStatus,
} from "../lib/studio/campaignStatus.mjs";
import {
  buildPublishConfirmation,
  isConfirmedPublishResponse,
  selectDirectPublishAvailability,
} from "../lib/studio/publishingPolicy.mjs";`,
  "campaign status imports",
);

page = replaceOnce(
  page,
  `  const [publishOptions, setPublishOptions] = useState({
    reddit: { subreddit: "", title: "" },
  });
  const fileInputRef = useRef(null);`,
  `  const [publishOptions, setPublishOptions] = useState({
    reddit: { subreddit: "", title: "" },
  });
  const [publishDialogOpen, setPublishDialogOpen] = useState(false);
  const fileInputRef = useRef(null);
  const publishTriggerRef = useRef(null);
  const publishDialogRef = useRef(null);`,
  "publishing state",
);

page = replaceOnce(
  page,
  `  const canPublishCurrent = Boolean(
    campaignFreshness.canUseCurrentGeneration &&
      currentConnection?.connected &&
      !currentConnection?.expired &&
      !currentConnection?.manualOnly,
  );`,
  `  const connectorReadyForPublish = Boolean(
    campaignFreshness.canUseCurrentGeneration &&
      currentConnection?.connected &&
      !currentConnection?.expired &&
      !currentConnection?.manualOnly,
  );`,
  "connector readiness",
);

page = page.replaceAll("canPublishCurrent", "connectorReadyForPublish");

page = replaceOnce(
  page,
  `  const publishAvailability = selectPublishAvailability({
    channelStatus: activeChannelStatus,
    isStale: isCampaignStale,
    hasContent: Boolean(currentPost),
    isOverLimit,
    connectorReady: connectorReadyForPublish,
    manualRoute: Boolean(activeMeta.openUrl || !OFFICIAL_CONNECTORS.has(activeChannel)),
  });`,
  `  const directPublishAvailability = selectDirectPublishAvailability({
    channelStatus: activeChannelStatus,
    isStale: isCampaignStale,
    hasContent: Boolean(currentPost),
    isOverLimit,
    connection: currentConnection,
    permissionValid: Boolean(accessToken),
  });
  const publishConfirmation = buildPublishConfirmation({
    platformId: activeChannel,
    platformLabel: activeMeta.label,
    connection: currentConnection,
    revision,
    channelStatus: activeChannelStatus,
  });`,
  "publish availability selector",
);

page = replaceOnce(
  page,
  `  useEffect(() => {
    if (!regenerationDialogOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setRegenerationDialogOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [regenerationDialogOpen]);`,
  `  useEffect(() => {
    if (!regenerationDialogOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setRegenerationDialogOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [regenerationDialogOpen]);

  useEffect(() => {
    if (!publishDialogOpen) return undefined;
    window.requestAnimationFrame(() => publishDialogRef.current?.focus());
    function closeOnEscape(event) {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setPublishDialogOpen(false);
      window.requestAnimationFrame(() => publishTriggerRef.current?.focus());
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [publishDialogOpen]);`,
  "publish dialog keyboard effect",
);

page = replacePattern(
  page,
  /  async function publishCurrentPost\(\) \{[\s\S]*?\n  \}\n\n  async function refreshConnections\(\) \{/,
  `  function closePublishDialog() {
    setPublishDialogOpen(false);
    window.requestAnimationFrame(() => publishTriggerRef.current?.focus());
  }

  function reviewPublication() {
    if (!directPublishAvailability.ready) {
      setMessage({ type: "warning", text: directPublishAvailability.reason });
      return;
    }
    setPublishDialogOpen(true);
  }

  async function publishCurrentPost() {
    if (!directPublishAvailability.ready) {
      setMessage({ type: "warning", text: directPublishAvailability.reason });
      return;
    }

    let options = {};
    if (activeChannel === "reddit") {
      const subreddit = String(publishOptions.reddit?.subreddit || "")
        .trim()
        .replace(/^r\\//i, "");
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
          campaignId: currentCampaignId || null,
          draftRevision: revision,
          options,
        }),
      });
      const data = await readJsonResponse(response, "SignalFlow returned an unreadable publishing response.");
      if (!isConfirmedPublishResponse({
        responseOk: response.ok,
        data,
        expectedPlatform: activeChannel,
      })) {
        throw new Error(data.error || "The destination API did not confirm publication with a stable post reference.");
      }
      closePublishDialog();
      setMessage({
        type: "success",
        text: data.message || `Published revision ${revision} to ${activeMeta.label}.`,
      });
      await refreshConnections();
    } catch (error) {
      setMessage({ type: "error", text: error.message });
    } finally {
      setBusy(false);
    }
  }

  async function refreshConnections() {`,
  "publish handler",
);

page = replacePattern(
  page,
  /\n                  <div className="review-actions">[\s\S]*?\n                  \{result\?\.warnings\?\.length > 0 && \(/,
  `
                  <div className="review-actions review-primary-actions" aria-label="Review and handoff actions">
                    <button
                      className="button button--outline"
                      onClick={() => copyCurrentPost()}
                      disabled={Boolean(campaignStatus.copyBlockedReason) || !currentPost}
                      title={campaignStatus.copyBlockedReason || undefined}
                    >
                      <CopyIcon /> Copy draft
                    </button>
                    <button
                      className="button button--dark"
                      onClick={activeMeta.openUrl ? copyAndOpenCurrent : () => copyCurrentPost()}
                      disabled={Boolean(campaignStatus.copyBlockedReason) || !currentPost}
                      title={campaignStatus.copyBlockedReason || undefined}
                    >
                      {activeMeta.openUrl ? <>Copy & open {activeMeta.label}</> : "Copy for manual handoff"}
                      <ArrowIcon />
                    </button>
                    <div className="save-action-group">
                      <button className="button button--outline" onClick={saveCampaign} disabled={busy}>
                        {currentCampaignId ? "Save changes" : "Save locally"}
                      </button>
                      <button className="button button--outline" onClick={saveCampaignAsCopy} disabled={busy}>
                        Save as copy
                      </button>
                    </div>
                  </div>

                  {OFFICIAL_CONNECTORS.has(activeChannel) && (
                    <section className="direct-publishing-panel" aria-labelledby="direct-publishing-title">
                      <div className="direct-publishing-panel__copy">
                        <span>Optional live action</span>
                        <strong id="direct-publishing-title">Direct publishing</strong>
                        <p>
                          Review, save, copy, and export remain the primary workflow. Use this only after the
                          exact approved revision and connected destination account are confirmed.
                        </p>
                        <dl>
                          <div><dt>Connected account</dt><dd>{publishConfirmation.accountLabel}</dd></div>
                          <div><dt>Draft revision</dt><dd>{publishConfirmation.draftRevision}</dd></div>
                        </dl>
                      </div>
                      <div className="direct-publishing-panel__action">
                        <button
                          ref={publishTriggerRef}
                          type="button"
                          className="button button--outline button--small"
                          onClick={reviewPublication}
                          disabled={busy || !directPublishAvailability.ready}
                          title={directPublishAvailability.reason || undefined}
                        >
                          Review live publication <ArrowIcon />
                        </button>
                        {!directPublishAvailability.ready && (
                          <small role="status">{directPublishAvailability.reason}</small>
                        )}
                        {!connectorReadyForPublish && (
                          <button
                            type="button"
                            className="publishing-route-link"
                            onClick={() => navigateSection("connections")}
                          >
                            Configure {activeMeta.label} connector
                          </button>
                        )}
                      </div>
                    </section>
                  )}

                  {result?.warnings?.length > 0 && (`,
  "review action hierarchy",
);

page = replaceOnce(
  page,
  `      {regenerationDialogOpen && (`,
  `      {publishDialogOpen && (
        <div
          className="publish-confirmation-backdrop"
          onMouseDown={closePublishDialog}
        >
          <section
            ref={publishDialogRef}
            className="publish-confirmation-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="publish-confirmation-title"
            aria-describedby="publish-confirmation-description"
            tabIndex={-1}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="publish-confirmation-dialog__eyebrow">Live platform action</div>
            <h2 id="publish-confirmation-title">{publishConfirmation.title}</h2>
            <p id="publish-confirmation-description">{publishConfirmation.description}</p>
            <dl>
              <div><dt>Platform</dt><dd>{publishConfirmation.platformLabel}</dd></div>
              <div><dt>Connected account</dt><dd>{publishConfirmation.accountLabel}</dd></div>
              <div><dt>Draft revision</dt><dd>{publishConfirmation.draftRevision}</dd></div>
              <div><dt>Draft state</dt><dd>{publishConfirmation.draftState}</dd></div>
            </dl>
            <div className="publish-confirmation-dialog__warning">
              SignalFlow will report success only after the destination API returns a matching platform and a stable post reference.
            </div>
            <div className="publish-confirmation-dialog__actions">
              <button type="button" className="button button--outline" onClick={closePublishDialog} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="button button--dark" onClick={publishCurrentPost} disabled={busy}>
                {busy ? "Publishing…" : "Confirm and publish"}
              </button>
            </div>
          </section>
        </div>
      )}

      {regenerationDialogOpen && (`,
  "publish confirmation dialog",
);

await writeFile(pagePath, page);

let css = await readFile(cssPath, "utf8");
const styleMarker = "/* Review-first direct publishing */";
if (!css.includes(styleMarker)) {
  css += `

${styleMarker}
.review-primary-actions { align-items: center; }
.review-primary-actions .button--dark { margin-left: 0; }
.review-primary-actions .save-action-group { margin-left: auto; }
.direct-publishing-panel {
  margin-top: 14px;
  padding: 16px;
  border: 1px solid var(--line);
  border-radius: 16px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  align-items: center;
  gap: 18px;
  background: rgba(255, 253, 248, .5);
}
.direct-publishing-panel__copy > span,
.publish-confirmation-dialog__eyebrow {
  display: block;
  margin-bottom: 5px;
  color: rgba(23, 23, 20, .46);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: .12em;
  text-transform: uppercase;
}
.direct-publishing-panel__copy > strong { font-size: 13px; }
.direct-publishing-panel__copy > p {
  max-width: 680px;
  margin: 6px 0 0;
  color: rgba(23, 23, 20, .54);
  font-size: 11px;
  line-height: 1.55;
}
.direct-publishing-panel dl,
.publish-confirmation-dialog dl {
  margin: 12px 0 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}
.direct-publishing-panel dl div,
.publish-confirmation-dialog dl div {
  min-width: 0;
  padding: 9px 10px;
  border-radius: 10px;
  background: var(--paper-deep);
}
.direct-publishing-panel dt,
.publish-confirmation-dialog dt {
  color: rgba(23, 23, 20, .46);
  font-size: 8px;
  font-weight: 800;
  letter-spacing: .08em;
  text-transform: uppercase;
}
.direct-publishing-panel dd,
.publish-confirmation-dialog dd {
  margin: 4px 0 0;
  overflow-wrap: anywhere;
  font-size: 11px;
  font-weight: 700;
}
.direct-publishing-panel__action {
  width: min(290px, 100%);
  display: grid;
  justify-items: stretch;
  gap: 8px;
}
.direct-publishing-panel__action small {
  color: var(--warning);
  font-size: 10px;
  line-height: 1.45;
}
.direct-publishing-panel .publishing-route-link {
  width: 100%;
  margin: 0;
  justify-content: center;
}
.publish-confirmation-backdrop {
  position: fixed;
  inset: 0;
  z-index: 140;
  padding: 24px;
  display: grid;
  place-items: center;
  background: rgba(17, 17, 15, .64);
  backdrop-filter: blur(8px);
}
.publish-confirmation-dialog {
  width: min(620px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  padding: 28px;
  border: 1px solid var(--line-dark);
  border-radius: 22px;
  outline: 0;
  background: var(--white);
  box-shadow: 0 30px 90px rgba(17, 17, 15, .28);
}
.publish-confirmation-dialog:focus-visible { box-shadow: 0 0 0 4px rgba(216, 189, 124, .35), 0 30px 90px rgba(17, 17, 15, .28); }
.publish-confirmation-dialog h2 {
  margin: 0;
  font-family: "Playfair Display", serif;
  font-size: 34px;
  font-weight: 500;
  letter-spacing: -.035em;
}
.publish-confirmation-dialog > p {
  margin: 12px 0 0;
  color: rgba(23, 23, 20, .58);
  line-height: 1.65;
}
.publish-confirmation-dialog__warning {
  margin-top: 16px;
  padding: 12px 14px;
  border: 1px solid rgba(139, 90, 34, .24);
  border-radius: 12px;
  background: rgba(216, 189, 124, .1);
  color: var(--warning);
  font-size: 11px;
  line-height: 1.55;
}
.publish-confirmation-dialog__actions {
  margin-top: 22px;
  display: flex;
  justify-content: flex-end;
  gap: 10px;
}
@media (max-width: 760px) {
  .review-primary-actions .save-action-group { width: 100%; margin-left: 0; }
  .direct-publishing-panel { grid-template-columns: 1fr; }
  .direct-publishing-panel__action { width: 100%; }
  .direct-publishing-panel dl,
  .publish-confirmation-dialog dl { grid-template-columns: 1fr; }
  .publish-confirmation-backdrop { padding: 12px; align-items: end; }
  .publish-confirmation-dialog { max-height: calc(100vh - 24px); padding: 22px; border-radius: 20px 20px 12px 12px; }
  .publish-confirmation-dialog__actions { display: grid; }
  .publish-confirmation-dialog__actions .button { width: 100%; }
}
`;
  await writeFile(cssPath, css);
}

console.log("Applied review-first publishing patch.");
