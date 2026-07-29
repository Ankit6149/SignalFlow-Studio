import fs from "node:fs";

const path = "frontend/app/page.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(from, to, label) {
  const count = source.split(from).length - 1;
  if (count !== 1) {
    throw new Error(`${label}: expected exactly one match, found ${count}.`);
  }
  source = source.replace(from, to);
}

replaceOnce(
  'import { useEffect, useMemo, useRef, useState } from "react";',
  'import { useEffect, useMemo, useReducer, useRef, useState } from "react";',
  "React useReducer import",
);

replaceOnce(
  `import {
  createGenerationRun,
  createGenerationSourceSnapshot,
  getCampaignFreshness,
  getGenerationSourceChanges,
  restoreGenerationRun,
} from "../lib/studio/campaignFreshness.mjs";`,
  `import {
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
import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";`,
  "Studio reliability imports",
);

replaceOnce(
  `  const [section, setSection] = useState("studio");
  const [stage, setStage] = useState("source");`,
  `  const [section, setSection] = useState("studio");
  const [campaignState, dispatchCampaign] = useReducer(
    campaignReducer,
    undefined,
    createInitialCampaignState,
  );
  const { stage, result, generationRun, posts, activeChannel } = campaignState;`,
  "campaign reducer state",
);

for (const line of [
  '  const [result, setResult] = useState(null);\n',
  '  const [generationRun, setGenerationRun] = useState(null);\n',
  '  const [posts, setPosts] = useState({});\n',
  '  const [activeChannel, setActiveChannel] = useState("linkedin");\n',
]) {
  replaceOnce(line, "", `remove legacy state ${line.trim()}`);
}

replaceOnce(
  `  const [providerStatuses, setProviderStatuses] = useState({});
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);`,
  `  const [providerStatuses, setProviderStatuses] = useState({});
  const [capabilitySnapshot, setCapabilitySnapshot] = useState(null);
  const [providerStatusLoading, setProviderStatusLoading] = useState(true);`,
  "capability state",
);

replaceOnce(
  `  const provider = useMemo(
    () => PROVIDERS.find((item) => item.id === form.provider) || PROVIDERS[0],
    [form.provider],
  );`,
  `  const availableProviders = useMemo(
    () => PROVIDERS.filter(
      (item) => providerStatusLoading || providerStatuses[item.id]?.available !== false,
    ),
    [providerStatusLoading, providerStatuses],
  );
  const provider = useMemo(
    () => availableProviders.find((item) => item.id === form.provider) || availableProviders[0] || PROVIDERS[0],
    [availableProviders, form.provider],
  );`,
  "available providers",
);

replaceOnce(
  `  const providerReadiness = evaluateProviderReadiness({
    provider: form.provider,
    apiKey: form.apiKey,
    baseUrl: form.baseUrl,
    status: providerStatuses[form.provider],
  });`,
  `  const providerReadiness = evaluateProviderReadiness({
    provider: form.provider,
    apiKey: form.apiKey,
    baseUrl: form.baseUrl,
    status: providerStatusLoading
      ? { available: false, reason: "Checking deployment capabilities…" }
      : providerStatuses[form.provider],
  });`,
  "fail-closed provider readiness",
);

replaceOnce(
  `    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));
    void syncOwnerSession();`,
  `    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));
    void syncOwnerSession();
    void refreshProviderStatus();`,
  "initial capability refresh",
);

replaceOnce(
  `  useEffect(() => {
    if (!entered) return;
    refreshConnections();
    refreshProviderStatus();
  }, [entered, accessToken]);`,
  `  useEffect(() => {
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
  }, [capabilitySnapshot]);`,
  "browser capability handshake",
);

replaceOnce(
  `  async function refreshProviderStatus() {
    setProviderStatusLoading(true);
    try {
      const response = await fetch("/api/provider_status");
      const data = await readJsonResponse(response, "SignalFlow could not read model provider status.");
      const statuses = data.providers || {};
      setProviderStatuses(statuses);
      const recommended = pickRecommendedProvider({
        defaultProvider: data.defaultProvider,
        statuses,
        fallback: form.provider,
      });
      setForm((previous) => {
        if (previous.apiKey.trim() || previous.baseUrl.trim() || statuses[previous.provider]?.configured) return previous;
        return previous.provider === recommended ? previous : { ...previous, provider: recommended };
      });
    } catch {
      setProviderStatuses({});
    } finally {
      setProviderStatusLoading(false);
    }
  }`,
  `  async function refreshProviderStatus() {
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
  }`,
  "capability-backed provider refresh",
);

replaceOnce(
  `  function authHeaders(extra = {}) {
    return { ...extra };
  }`,
  `  function authHeaders(extra = {}) {
    return { ...extra };
  }

  function setStage(nextStage) {
    dispatchCampaign({ type: "SET_STAGE", stage: nextStage });
  }

  function setActiveChannel(channel) {
    dispatchCampaign({ type: "SET_ACTIVE_CHANNEL", channel });
  }`,
  "campaign dispatch helpers",
);

replaceOnce(
  `      const generatedPosts = data.posts || {};
      const nextGenerationRun = createGenerationRun({
        sourceSnapshot: requestedSourceSnapshot,
        response: data,
        provider: form.provider,
        model: form.model.trim(),
      });
      setGenerationRun(nextGenerationRun);
      setResult(data);
      setPosts(generatedPosts);
      setActiveChannel(channels.find((channel) => generatedPosts[channel]) || channels[0]);
      setStage("review");
      if (data.fallbackUsed) {
        throw new Error("SignalFlow refused the response because it contained retired template fallback content.");
      }
      const failedChannels = Object.entries(data.generation_status || {})
        .filter(([, item]) => item?.status === "failed")
        .map(([channel]) => channel);`,
  `      const accepted = acceptGenerationResponse({
        response: data,
        requestedChannels: channels,
      });
      const nextGenerationRun = createGenerationRun({
        sourceSnapshot: requestedSourceSnapshot,
        response: accepted.result,
        provider: form.provider,
        model: form.model.trim(),
      });
      dispatchCampaign({
        type: "ACCEPT_GENERATION",
        payload: {
          result: accepted.result,
          generationRun: nextGenerationRun,
          posts: accepted.posts,
          activeChannel: accepted.activeChannel,
        },
      });
      const failedChannels = accepted.failedChannels;`,
  "atomic generation acceptance",
);

replaceOnce(
  `    setChannels(item.channels || ["linkedin"]);
    setPosts(item.posts || {});
    setResult(item.result || { markdown: item.markdown, warnings: item.warnings || [] });
    setGenerationRun(restoredRun);
    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });
    setFiles(restoredSource.sourceFiles);
    setDocumentText(restoredSource.documentText);
    setActiveChannel((item.channels || ["linkedin"])[0]);
    setStage("review");`,
  `    const restoredChannels = item.channels || ["linkedin"];
    setChannels(restoredChannels);
    dispatchCampaign({
      type: "RESTORE_CAMPAIGN",
      payload: {
        posts: item.posts || {},
        result: item.result || { markdown: item.markdown, warnings: item.warnings || [] },
        generationRun: restoredRun,
        activeChannel: restoredChannels[0],
      },
    });
    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });
    setFiles(restoredSource.sourceFiles);
    setDocumentText(restoredSource.documentText);`,
  "atomic campaign restore",
);

replaceOnce(
  `                  {PROVIDERS.map((item) => {`,
  `                  {availableProviders.map((item) => {`,
  "capability-filtered provider list",
);

replaceOnce(
  `                      onChange={(event) =>
                        setPosts((previous) => ({
                          ...previous,
                          [activeChannel]: event.target.value,
                        }))
                      }`,
  `                      onChange={(event) =>
                        dispatchCampaign({
                          type: "EDIT_POST",
                          channel: activeChannel,
                          text: event.target.value,
                        })
                      }`,
  "authoritative draft edit",
);

fs.writeFileSync(path, source);
