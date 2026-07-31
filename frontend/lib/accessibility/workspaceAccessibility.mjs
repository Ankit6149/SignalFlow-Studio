const REVIEW_NAVIGATION_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

function slugify(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "workspace";
}

export function getAnnouncementSemantics(type) {
  if (type === "error") {
    return { role: "alert", live: "assertive", atomic: "true" };
  }
  return { role: "status", live: "polite", atomic: "true" };
}

export function getWorkspaceHeadingId({ kind, heading }) {
  const prefix = kind === "studio"
    ? "studio"
    : kind === "settings"
      ? "settings"
      : slugify(heading);
  return `${prefix}-workspace-title`;
}

export function getReviewTabTargetIndex({ key, currentIndex, count }) {
  if (!REVIEW_NAVIGATION_KEYS.has(key) || !Number.isInteger(count) || count <= 0) {
    return null;
  }
  const safeIndex = Number.isInteger(currentIndex) && currentIndex >= 0 && currentIndex < count
    ? currentIndex
    : 0;

  if (key === "Home") return 0;
  if (key === "End") return count - 1;
  if (key === "ArrowRight") return (safeIndex + 1) % count;
  return (safeIndex - 1 + count) % count;
}

export function buildReviewTabSemantics({ labels, activeIndex, panelId = "review-draft-panel" }) {
  const safeLabels = Array.isArray(labels) ? labels : [];
  const selectedIndex = Number.isInteger(activeIndex) && activeIndex >= 0 && activeIndex < safeLabels.length
    ? activeIndex
    : 0;

  return safeLabels.map((label, index) => ({
    id: `review-tab-${index + 1}-${slugify(label)}`,
    controls: panelId,
    selected: index === selectedIndex,
    tabIndex: index === selectedIndex ? 0 : -1,
  }));
}
