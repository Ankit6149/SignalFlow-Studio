"use client";

import { createUploadSourceBundle } from "../domain/sourceArtifacts.mjs";
import { selectAcceptedFiles } from "./clientReliability.mjs";
import { sourceFilePresentation } from "./sourcePresentation.mjs";

export function useCampaignSourceController({
  files,
  setFiles,
  setDocumentText,
  currentCampaignId,
  setStrategyReview,
  setMessage,
  createClientId,
}) {
  const sourceArtifactSummary = files.reduce((summary, file) => {
    const state = sourceFilePresentation(file).state;
    summary[state] = (summary[state] || 0) + 1;
    return summary;
  }, {});

  async function handleFiles(event) {
    const picked = Array.from(event.target.files || []);
    if (!picked.length) return;

    const { accepted, skippedCount } = selectAcceptedFiles(picked, files.length);
    if (!accepted.length) {
      setMessage({
        type: "warning",
        text: "SignalFlow accepts up to 12 source files per campaign. Remove one before adding another.",
      });
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
          nextText.push(`FILE: ${file.name}\n${extractedText}`);
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
      setMessage({
        type: "warning",
        text: `Added ${accepted.length} file${accepted.length === 1 ? "" : "s"}; skipped ${skippedCount} because the campaign limit is 12.`,
      });
    } else if (extractionFailures > 0) {
      setMessage({
        type: "warning",
        text: `Added the files, but ${extractionFailures} text file${extractionFailures === 1 ? "" : "s"} could not be extracted in this browser.`,
      });
    } else if (nextText.length === 0) {
      setMessage({
        type: "warning",
        text: "The files were added as asset references only. Add a written brief because visual analysis is not enabled in this route yet.",
      });
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

  return {
    sourceArtifactSummary,
    handleFiles,
    removeFile,
  };
}
