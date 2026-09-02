function normalizeOriginDecision(item, origin) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const decisionId = String(item.decisionId || "").trim();
  if (!decisionId) return null;
  return Object.freeze({ ...item, decisionId, origin });
}

export function mergeTodayDecisions({ local = [], hosted = [] } = {}) {
  const merged = new Map();
  for (const item of Array.isArray(local) ? local : []) {
    const normalized = normalizeOriginDecision(item, "local");
    if (normalized) merged.set(normalized.decisionId, normalized);
  }
  for (const item of Array.isArray(hosted) ? hosted : []) {
    const normalized = normalizeOriginDecision(item, "hosted");
    if (normalized) merged.set(normalized.decisionId, normalized);
  }
  return [...merged.values()].sort((left, right) => (
    String(right.reviewedAt || right.createdAt || "").localeCompare(String(left.reviewedAt || left.createdAt || ""))
    || left.decisionId.localeCompare(right.decisionId)
  ));
}

export function hostedTodayIsResolved(status) {
  return status === "ready";
}
