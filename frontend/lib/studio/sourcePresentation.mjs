export const SOURCE_STATE_PRESENTATION = Object.freeze({
  usable_evidence: { label: "Usable evidence", description: "Verified extracted content can contribute to generation." },
  reference_only: { label: "Reference only", description: "Retained as context but not counted as extracted evidence." },
  processing: { label: "Processing", description: "This source is not ready for generation yet." },
  failed: { label: "Failed", description: "Ingestion or extraction failed; review or replace this source." },
  unsupported: { label: "Unsupported", description: "The current deployment cannot process this source type." },
});

export function sourceFilePresentation(file) {
  const state = file?.sourceArtifact?.usability?.state
    || (file?.extracted ? "usable_evidence" : "reference_only");
  const presentation = SOURCE_STATE_PRESENTATION[state] || SOURCE_STATE_PRESENTATION.reference_only;
  const evidenceState = file?.sourceArtifact?.usability?.evidenceState || (file?.extracted ? "verified" : "unverified");

  return {
    state,
    label: presentation.label,
    description: presentation.description,
    evidenceLabel: evidenceState === "verified"
      ? "Verified evidence"
      : evidenceState === "not_applicable"
        ? "Evidence not applicable"
        : "Unverified evidence",
    versionId: file?.sourceArtifact?.sourceArtifactVersionId || "Legacy source",
  };
}
