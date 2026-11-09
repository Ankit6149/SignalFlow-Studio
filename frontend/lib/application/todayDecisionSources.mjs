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


function normalizeOriginWorkItem(item, origin) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const workId = String(item.workId || "").trim();
  if (!workId) return null;
  return Object.freeze({ ...item, workId, origin });
}

export function mergeTodayWorkState({ local = [], hosted = [] } = {}) {
  const merged = new Map();
  for (const item of Array.isArray(local) ? local : []) {
    const normalized = normalizeOriginWorkItem(item, "local");
    if (normalized) merged.set(normalized.workId, normalized);
  }
  for (const item of Array.isArray(hosted) ? hosted : []) {
    const normalized = normalizeOriginWorkItem(item, "hosted");
    if (normalized) merged.set(normalized.workId, normalized);
  }
  return [...merged.values()].sort((left, right) => (
    (left.priority === "attention" ? 0 : 1) - (right.priority === "attention" ? 0 : 1)
    || String(right.updatedAt || "").localeCompare(String(left.updatedAt || ""))
    || left.workId.localeCompare(right.workId)
  ));
}

export function hostedTodayIsResolved(status) {
  return status === "ready";
}
