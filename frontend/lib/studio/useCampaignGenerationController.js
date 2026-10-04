"use client";

import { useEffect, useRef, useState } from "react";
import {
  createGenerationRun,
  createGenerationSourceSnapshot,
} from "./campaignFreshness.mjs";
import { acceptGenerationResponse } from "./generationAcceptance.mjs";
import {
  editedChannels,
  regenerationTargets,
  REGENERATION_POLICIES,
} from "./regenerationPolicy.mjs";
import { projectGenerationMediaItem } from "../domain/sourceArtifacts.mjs";
import { generateCampaign as generateStudioCampaign } from "./studioApiClient.mjs";
import { channelMeta } from "./studioCatalog.mjs";

export function providerRecoveryMessage(providerError) {
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

export function useCampaignGenerationController({
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
  createArchiveId,
}) {
  const [generationProgress, setGenerationProgress] = useState(null);
  const [regenerationDialogOpen, setRegenerationDialogOpen] = useState(false);
  const generationAbortRef = useRef(null);

  const editedDraftChannels = editedChannels({ channels, channelStates });
  const uneditedRegenerationTargets = regenerationTargets({
    policy: REGENERATION_POLICIES.UNEDITED,
    channels,
    channelStates,
    activeChannel,
  });

  useEffect(() => {
    if (!regenerationDialogOpen) return undefined;
    function closeOnEscape(event) {
      if (event.key === "Escape") setRegenerationDialogOpen(false);
    }
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [regenerationDialogOpen]);

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
          archiveId: createArchiveId(),
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

  function regenerateActiveChannel() {
    void performRegeneration(REGENERATION_POLICIES.CHANNEL, activeChannel);
  }

  function regenerateUnedited() {
    void performRegeneration(REGENERATION_POLICIES.UNEDITED);
  }

  function archiveAndRegenerateAll() {
    void performRegeneration(REGENERATION_POLICIES.ARCHIVE_ALL);
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

  return {
    generationProgress,
    regenerationDialogOpen,
    editedDraftChannels,
    uneditedRegenerationTargets,
    closeRegenerationDialog: () => setRegenerationDialogOpen(false),
    cancelGeneration,
    regenerateActiveChannel,
    regenerateUnedited,
    archiveAndRegenerateAll,
    handleGenerationAction,
  };
}
