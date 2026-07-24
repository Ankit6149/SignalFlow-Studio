const TEXT_KEYS = [
  "text",
  "content",
  "document_text",
  "documentText",
  "body",
  "value",
  "chunks",
  "documents",
];

/**
 * Convert a request value into a safe trimmed string without ever calling
 * string methods on arrays or structured upload payloads.
 */
export function normalizeTextInput(value) {
  if (typeof value === "string") return value.trim();
  if (["number", "boolean", "bigint"].includes(typeof value)) {
    return String(value).trim();
  }
  if (Array.isArray(value)) {
    return normalizeDocumentText(value).join("\n\n");
  }
  if (value && typeof value === "object") {
    for (const key of TEXT_KEYS) {
      if (!Object.prototype.hasOwnProperty.call(value, key)) continue;
      const normalized = normalizeTextInput(value[key]);
      if (normalized) return normalized;
    }
  }
  return "";
}

/**
 * Normalize pasted/uploaded document content into a flat string array.
 * Supports the current browser payload as well as structured future clients.
 */
export function normalizeDocumentText(value) {
  const items = Array.isArray(value) ? value : [value];
  const normalized = [];

  for (const item of items) {
    if (Array.isArray(item)) {
      normalized.push(...normalizeDocumentText(item));
      continue;
    }

    if (item && typeof item === "object") {
      const nestedValues = TEXT_KEYS
        .filter((key) => Object.prototype.hasOwnProperty.call(item, key))
        .map((key) => item[key]);

      if (nestedValues.length) {
        normalized.push(...normalizeDocumentText(nestedValues));
      }
      continue;
    }

    const text = normalizeTextInput(item);
    if (text) normalized.push(text);
  }

  return normalized;
}
