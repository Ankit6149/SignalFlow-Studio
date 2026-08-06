export const MAX_SOURCE_FILES = 12;

const VALID_STAGES = new Set(["source", "destinations", "review"]);
const IMAGE_EXTENSION_BY_TYPE = Object.freeze({
  "image/avif": "avif",
  "image/bmp": "bmp",
  "image/gif": "gif",
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/svg+xml": "svg",
  "image/webp": "webp",
});

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

function clipboardImageExtension(type) {
  const normalized = String(type || "").trim().toLowerCase();
  if (IMAGE_EXTENSION_BY_TYPE[normalized]) return IMAGE_EXTENSION_BY_TYPE[normalized];
  const subtype = normalized.startsWith("image/") ? normalized.slice("image/".length) : "";
  return subtype.replace(/[^a-z0-9]+/g, "") || "png";
}

function clipboardImageName(file, index, now) {
  const providedName = String(file?.name || "").trim();
  if (providedName && providedName.toLowerCase() !== "image") return providedName;
  const stamp = new Date(now).toISOString().replace(/[:.]/g, "-");
  return `pasted-image-${stamp}-${index + 1}.${clipboardImageExtension(file?.type)}`;
}

function renameClipboardImage(file, name) {
  if (String(file?.name || "").trim() === name) return file;
  if (typeof File === "function") {
    return new File([file], name, {
      type: file?.type || "image/png",
      lastModified: Number(file?.lastModified) || Date.now(),
    });
  }
  return {
    ...file,
    name,
    type: file?.type || "image/png",
    size: Number(file?.size) || 0,
    lastModified: Number(file?.lastModified) || Date.now(),
  };
}

export function extractClipboardImageFiles(clipboardData, { now = Date.now() } = {}) {
  if (!clipboardData) return [];

  const itemFiles = Array.from(clipboardData.items || [])
    .filter((item) => item?.kind === "file")
    .map((item) => item.getAsFile?.())
    .filter(Boolean);
  const candidateFiles = itemFiles.length
    ? itemFiles
    : Array.from(clipboardData.files || []);

  return candidateFiles
    .filter((file) => String(file?.type || "").toLowerCase().startsWith("image/"))
    .map((file, index) => renameClipboardImage(file, clipboardImageName(file, index, now)));
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
