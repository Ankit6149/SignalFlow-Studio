export const MAX_SOURCE_FILES = 12;

const VALID_STAGES = new Set(["source", "destinations", "review"]);

export function resolveStudioStage(requestedStage, { hasSource = false, hasResult = false } = {}) {
  if (!VALID_STAGES.has(requestedStage)) {
    return hasResult ? "review" : hasSource ? "destinations" : "source";
  }
  if (requestedStage === "destinations" && !hasSource) {
    return "source";
  }
  if (requestedStage === "review" && !hasResult) {
    return hasSource ? "destinations" : "source";
  }
  return requestedStage;
}

export function selectAcceptedFiles(pickedFiles, existingCount, maximum = MAX_SOURCE_FILES) {
  const picked = Array.from(pickedFiles || []);
  const remaining = Math.max(0, maximum - Math.max(0, Number(existingCount) || 0));
  return {
    accepted: picked.slice(0, remaining),
    skippedCount: Math.max(0, picked.length - remaining),
    remaining,
  };
}

export function createSourceSnapshot(files, documentText) {
  return {
    sourceFiles: Array.isArray(files)
      ? files.map(({ name, type, size, extracted, description }) => ({
          name: String(name || ""),
          type: String(type || "file"),
          size: Number(size) || 0,
          extracted: Boolean(extracted),
          description: String(description || ""),
        }))
      : [],
    documentText: Array.isArray(documentText)
      ? documentText.map((value) => String(value || "")).filter(Boolean)
      : [],
  };
}

export function restoreSourceSnapshot(item) {
  const sourceFiles = Array.isArray(item?.sourceFiles)
    ? item.sourceFiles
    : Array.isArray(item?.files)
      ? item.files
      : [];
  const documentText = Array.isArray(item?.documentText) ? item.documentText : [];
  return createSourceSnapshot(sourceFiles, documentText);
}
