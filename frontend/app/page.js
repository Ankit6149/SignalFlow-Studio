"use client";

import { useEffect, useMemo, useReducer, useRef, useState } from "react";
import PlatformIcon from "../components/PlatformIcon";
import LandingPage from "../components/LandingPage";
import SourceStage from "../components/SourceStage";
import DestinationsStage from "../components/DestinationsStage";
import ReviewStage from "../components/ReviewStage";
import LibraryWorkspace from "../components/LibraryWorkspace";
import ConnectionsWorkspace from "../components/ConnectionsWorkspace";
import SettingsWorkspace from "../components/SettingsWorkspace";
import WorkspaceShell from "../components/WorkspaceShell";
import {
  createSourceSnapshot,
  resolveStudioStage,
  restoreSourceSnapshot,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";
import {
  evaluateProviderReadiness,
  getProviderCredentialPlacement,
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
import {
  disconnectSocial as disconnectSocialAccount,
  generateCampaign as generateStudioCampaign,
  getCapabilities as getStudioCapabilities,
  getOwnerSession as getOwnerApiSession,
  getSocialStatus as getSocialConnectionStatus,
  lockOwnerSession as lockOwnerApiSession,
  publishPost as publishStudioPost,
  testProviderRoute as testStudioProviderRoute,
  unlockOwnerSession as unlockOwnerApiSession,
} from "../lib/studio/studioApiClient.mjs";
import {
  CHANNELS,
  CORE_CHANNELS,
  DEFAULT_CHANNELS,
  OFFICIAL_CONNECTORS,
  PROVIDERS,
  channelMeta,
} from "../lib/studio/studioCatalog.mjs";
import { sourceFilePresentation } from "../lib/studio/sourcePresentation.mjs";

const LIBRARY_KEY = "signalflow_recovery_library";
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


function downloadBinary(filename, value, type = "application/octet-stream") {
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

function providerRecoveryMessage(providerError) {
  const action = String(providerError?.recoveryAction || "");
  const messages = {
    replace_key: "Replace or re-check the provider credential, then retry.",
    check_permissions: "Check provider permissions or workspace access before retrying.",
    check_billing: "Check provider billing or credits before retrying.",
    check_quota: "The provider quota is exhausted; restore quota or choose another route.",
    wait_then_retry: "Wait for the provider rate limit to clear, then retry deliberately.",
    choose_model: "Choose a model that exists for this provider.",
    retry_destination: "Retry the affected destination; successful destinations remain unchanged.",
    reduce_destinations: "Reduce the number of destinations or retry only the affected destination.",
    retry_or_choose_model: "Retry once, then choose another model if the response contract still fails.",
    choose_provider: "Choose a supported provider route.",
    retry_or_contact_owner: "Retry once. If it persists, inspect owner/server diagnostics using the correlation ID.",
  };
  return messages[action] || "";
}

function createClientId(kind) {
  const randomId = globalThis.crypto?.randomUUID?.()
    || `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
  return `signalflow-${kind}-${randomId}`;
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
  const [generationProgress, setGenerationProgress] = useState(null);
  const [message, setMessage] = useState(null);
  const [strategyReview, setStrategyReview] = useState(null);
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
  const generationAbortRef = useRef(null);
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
  const currentConnectionLabel =
    currentConnection?.profile?.username ||
    currentConnection?.profile?.name ||
    currentConnection?.profile?.displayName ||
    "No connected account";
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
      currentConnection?.verified &&
      currentConnection?.canPublishText &&
      currentConnection?.scopeStatus === "verified" &&
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
  const providerCredentialPlacement = getProviderCredentialPlacement({
  provider: form.provider,
  status: providerStatusLoading
    ? { available: false, reason: "Checking deployment capabilities…" }
    : providerStatuses[form.provider],
});
const sourceAndChannelsReady = sourceSignals > 0 && channels.length > 0;
  const composeReady = sourceAndChannelsReady && providerReadiness.ready;
  const connectedOfficialCount = Array.from(OFFICIAL_CONNECTORS).filter(
    (id) =>
      connections[id]?.connected &&
      connections[id]?.verified &&
      connections[id]?.canPublishText &&
      !connections[id]?.expired,
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
  const directPublishAvailability = selectPublishAvailability({
    channelStatus: activeChannelStatus,
    isStale: isCampaignStale,
    hasContent: Boolean(currentPost),
    isOverLimit,
    connectorReady: canPublishCurrent,
    manualRoute: false,
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    void campaignApplication.listCampaigns()
      .then(setLibrary)
      .catch(() => setMessage({
        type: "error",
        text: "The browser could not read or migrate the local campaign library.",
      }));
    void syncOwnerSession();
    void refreshProviderStatus();

    const params = new URLSearchParams(window.location.search);
    const workspace = params.get("workspace");
    if (["create", "library", "connections", "settings"].includes(workspace)) {
      setEntered(true);
      setSection(workspace === "create" ? "studio" : workspace);
    }
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
      const { response, data: raw } = await getStudioCapabilities();
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
      const { response, data } = await testStudioProviderRoute({
        provider: form.provider,
        modelName: form.model.trim(),
        baseUrl: form.baseUrl.trim(),
        temporaryApiKey: form.apiKey.trim(),
      });
      if (!response.ok || !data.ok) throw new Error(data.error || "Model route test failed.");
      setProviderTest({ status: "success", message: data.message || "Model route connected successfully." });
      void refreshProviderStatus();
    } catch (error) {
      setProviderTest({ status: "error", message: error.message });
    }
  }

  async function syncOwnerSession() {
    try {
      const { data } = await getOwnerApiSession();
      setAccessToken(data.authenticated ? "cookie-session" : "");
    } catch {
      setAccessToken("");
    }
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
    setGenerationProgress(null);
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
    setStrategyReview(null);
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

  function moveReviewChannel(direction) {
    if (!channels.length) return;
    const nextIndex = (reviewIndex + direction + channels.length) % channels.length;
    setActiveChannel(channels[nextIndex]);
  }

  function editActivePost(text) {
    dispatchCampaign({
      type: "EDIT_POST",
      channel: activeChannel,
      text,
    });
  }

  function regenerateActiveChannel() {
    void performRegeneration(REGENERATION_POLICIES.CHANNEL, activeChannel);
  }

  function restoreActiveGeneratedPost() {
    dispatchCampaign({ type: "RESTORE_GENERATED", channel: activeChannel });
  }

  function toggleVersionHistory() {
    setVersionHistoryOpen((open) => !open);
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

    setStrategyReview(null);
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
    setStrategyReview(null);
    const target = files[index];
    setFiles((previous) => previous.filter((_, itemIndex) => itemIndex !== index));
    if (target?.extracted) {
      const extractedIndex = files.slice(0, index).filter((file) => file.extracted).length;
      setDocumentText((previous) => previous.filter((_, itemIndex) => itemIndex !== extractedIndex));
    }
  }

  async function requestGeneration(requestedChannels, signal = null) {
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
    const { response, data } = await generateStudioCampaign({
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
    }, {
      signal,
      onProgress: setGenerationProgress,
    });
    if (data.code === "strategy_quality_blocked" && data.strategy_review) {
      return { strategyBlocked: true, data };
    }
    if (!response.ok || data.ok === false) {
      const generationError = new Error(data.limitIssues?.[0]?.message || data.providerError?.message || data.error || "SignalFlow could not generate this campaign.");
      generationError.providerError = data.providerError || null;
      throw generationError;
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

  function beginGenerationRequest() {
    setGenerationProgress(null);
    const controller = new AbortController();
    generationAbortRef.current = controller;
    return controller;
  }

  function finishGenerationRequest(controller) {
    if (generationAbortRef.current === controller) generationAbortRef.current = null;
  }

  function cancelGeneration() {
    const controller = generationAbortRef.current;
    if (!controller || controller.signal.aborted) return;
    controller.abort();
    setGenerationProgress((previous) => previous
      ? { ...previous, phase: "cancelled", status: "cancelled" }
      : previous);
    setMessage({ type: "warning", text: "Cancelling generation. Existing drafts will remain unchanged." });
  }

  async function generateInitialCampaign() {
    const controller = beginGenerationRequest();
    setBusy(true);
    setMessage(null);
    try {
      const generation = await requestGeneration(channels, controller.signal);
      if (generation.strategyBlocked) {
        setStrategyReview(generation.data.strategy_review);
        setStage("destinations");
        setMessage({
          type: "warning",
          text: "Strategy needs review before any destination drafts are generated. No draft content was created or replaced.",
        });
        return;
      }
      const { accepted, nextGenerationRun, data } = generation;
      setStrategyReview(null);
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
      if (error?.name === "AbortError") {
        setMessage({ type: "warning", text: "Generation cancelled before completion. No campaign draft was replaced." });
        return;
      }
      const recovery = providerRecoveryMessage(error.providerError);
      setMessage({ type: "error", text: [error.message, recovery].filter(Boolean).join(" ") });
    } finally {
      finishGenerationRequest(controller);
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
    const controller = beginGenerationRequest();
    setBusy(true);
    setMessage(null);
    try {
      const generation = await requestGeneration(targetChannels, controller.signal);
      if (generation.strategyBlocked) {
        setStrategyReview(generation.data.strategy_review);
        setStage("destinations");
        setMessage({
          type: "warning",
          text: "The rebuilt strategy still needs review. Existing drafts and edits were left unchanged.",
        });
        return;
      }
      const { accepted, nextGenerationRun, data } = generation;
      setStrategyReview(null);
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
      if (error?.name === "AbortError") {
        dispatchCampaign({ type: "MARK_CHANNELS_CANCELLED", channels: targetChannels });
        setMessage({
          type: "warning",
          text: "Generation cancelled. Existing drafts and edits were preserved; cancelled destinations can be retried.",
        });
        return;
      }
      const recovery = providerRecoveryMessage(error.providerError);
      setMessage({
        type: "error",
        text: [error.message, recovery, "Existing drafts and edits were not changed."].filter(Boolean).join(" "),
      });
    } finally {
      finishGenerationRequest(controller);
      setBusy(false);
    }
  }

  function handleDraftApproval() {
    const current = channelStates[activeChannel] || {};
    if (current.approved) {
      dispatchCampaign({ type: "MARK_CHANNEL_NEEDS_REVIEW", channel: activeChannel });
      return;
    }

    if (current.status === "needs_review" && !current.qualityRiskAccepted) {
      const issueSummary = Array.isArray(current.issues) && current.issues.length
        ? current.issues.slice(0, 3).join("\n• ")
        : "One or more quality checks remain unresolved.";
      const accepted = window.confirm(
        `This draft still needs review:\n\n• ${issueSummary}\n\nApprove anyway and accept responsibility for these unresolved issues?`,
      );
      if (!accepted) return;
      dispatchCampaign({ type: "MARK_CHANNEL_APPROVED", channel: activeChannel, acceptRisk: true });
      return;
    }

    dispatchCampaign({ type: "MARK_CHANNEL_APPROVED", channel: activeChannel });
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


async function exportZip() {
  if (campaignStatus.exportBlockedReason) {
    setMessage({ type: "warning", text: campaignStatus.exportBlockedReason });
    return;
  }
  setBusy(true);
  setMessage(null);
  try {
    const projection = await campaignApplication.projectZip(currentCampaignInput());
    downloadBinary(projection.filename, projection.content, projection.mimeType);
    const exportedAt = new Date().toISOString();
    dispatchCampaign({ type: "MARK_EXPORTED", payload: { exportedAt } });
    const failedChannels = projection.summary?.failedChannels || [];
    setMessage({
      type: failedChannels.length ? "warning" : "success",
      text: failedChannels.length
        ? `ZIP exported with ${projection.summary.channelCount} destinations. ${failedChannels.map((channel) => channelMeta(channel).label).join(", ")} are included with explicit failure status instead of substitute content.`
        : `ZIP exported with ${projection.summary.channelCount} destinations and ${projection.summary.fileCount} files.`,
    });
  } catch (error) {
    setMessage({
      type: "error",
      text: `SignalFlow could not build the ZIP archive. Your current drafts are unchanged. ${error.message || "Try Markdown or JSON export instead."}`,
    });
  } finally {
    setBusy(false);
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

    if (!window.confirm(`Publish ${activeMeta.label} revision ${revision} to ${currentConnectionLabel}? This sends the exact approved draft currently shown.`)) return;

    setBusy(true);
    setMessage(null);
    try {
      const { data } = await publishStudioPost({
        platform: activeChannel,
        content: currentPost,
        projectName: form.projectName,
        options,
      });
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
      const { response, data } = await getSocialConnectionStatus();
      if (!response.ok) throw new Error("Owner access is required to inspect official connectors.");
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
      const { response, data } = await disconnectSocialAccount(platform);
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
      const { response, data } = await unlockOwnerApiSession(ownerKey);
      if (!response.ok) throw new Error(data.error || "The owner key was not accepted.");
      setAccessToken(data.authenticated ? "cookie-session" : "");
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
    await lockOwnerApiSession().catch(() => null);
    setAccessToken("");
    setConnections({});
    setMessage({ type: "success", text: "Owner session closed." });
  }

  async function refreshLibrary() {
    setLibrary(await campaignApplication.listCampaigns());
  }

  function useChannelInStudio(channelId) {
    navigateSection("studio");
    setStage(result ? "review" : sourceSignals > 0 ? "destinations" : "source");
    if (!channels.includes(channelId)) {
      setChannels((previous) => [...previous, channelId]);
    }
    setActiveChannel(channelId);
  }

  function exportLocalLibrary() {
    downloadText(
      "signalflow-local-library.json",
      JSON.stringify(library, null, 2),
      "application/json",
    );
  }

  function clearLocalLibrary() {
    if (!window.confirm("Clear the local campaign library?")) return;
    setLibrary([]);
    window.localStorage.removeItem(LIBRARY_KEY);
  }

  if (!entered) return <LandingPage onEnter={enterStudio} brand={<BrandMark />} />;

  const selectedDirectCount = channels.filter((id) => OFFICIAL_CONNECTORS.has(id)).length;

  return (
    <WorkspaceShell
      activeItem={section === "studio" ? "create" : section}
      onNavigate={{
        create: () => navigateSection("studio"),
        library: () => navigateSection("library"),
        connections: () => navigateSection("connections"),
        settings: () => navigateSection("settings"),
      }}
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
                  canRestoreGenerated={Boolean(channelStates[activeChannel]?.edited && generatedPosts[activeChannel])}
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
                  onConfigureConnector={() => navigateSection("connections")}
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
        <LibraryWorkspace
          campaigns={library}
          channels={CHANNELS}
          onLibraryChanged={refreshLibrary}
          onNewCampaign={startNewCampaign}
          onOpenCampaign={openCampaign}
          onDeleteCampaign={deleteCampaign}
        />
      )}

      {section === "connections" && (
        <ConnectionsWorkspace
          channels={CHANNELS}
          officialConnectorIds={Array.from(OFFICIAL_CONNECTORS)}
          connections={connections}
          ownerSessionActive={Boolean(accessToken)}
          loading={connectionsLoading}
          busy={busy}
          onRefresh={refreshConnections}
          onConnect={connectPlatform}
          onDisconnect={disconnectPlatform}
          onUseInStudio={useChannelInStudio}
        />
      )}

      {section === "settings" && (
        <SettingsWorkspace
          ownerSessionActive={Boolean(accessToken)}
          ownerKey={ownerKey}
          busy={busy}
          onOwnerKeyChange={setOwnerKey}
          onUnlockOwner={unlockOwnerSession}
          onLockOwner={lockOwnerSession}
          onExportLibrary={exportLocalLibrary}
          onClearLibrary={clearLocalLibrary}
        />
      )}
    </WorkspaceShell>
  );
}
