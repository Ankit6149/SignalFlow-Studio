import { CONTENT_SIGNAL_KINDS, CONTENT_SIGNAL_SOURCE_TYPES } from "../../domain/contentSignals.mjs";

const MAX_TITLE = 240;
const DEPENDENCY_ACTORS = new Set(["dependabot[bot]", "dependabot-preview[bot]", "renovate[bot]"]);
const GIT_SHA = /^[a-f0-9]{40,64}$/i;

function text(value, maxLength = 4000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  return normalized.slice(0, maxLength);
}

function requiredOpaque(value, field) {
  const normalized = text(value, 300);
  if (!normalized) throw new TypeError(`GitHub event requires ${field}.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`GitHub ${field} must be an opaque identifier.`);
  return normalized;
}

function sourceRevision(value) {
  const normalized = text(value, 80).toLowerCase();
  return GIT_SHA.test(normalized) ? normalized : null;
}

function iso(value, field) {
  const parsed = Date.parse(String(value || ""));
  if (!Number.isFinite(parsed)) throw new TypeError(`GitHub ${field} must be an ISO-compatible timestamp.`);
  return new Date(parsed).toISOString();
}

function labels(pullRequest) {
  return Array.isArray(pullRequest?.labels)
    ? pullRequest.labels.map((item) => text(item?.name, 80).toLowerCase()).filter(Boolean)
    : [];
}

function classifyPullRequest(pullRequest) {
  const title = text(pullRequest?.title, MAX_TITLE).toLowerCase();
  const tagSet = new Set(labels(pullRequest));
  if (/^fix(?:\(|:|\s)|bugfix|bug fix|regression/.test(title) || tagSet.has("bug") || tagSet.has("bugfix")) {
    return CONTENT_SIGNAL_KINDS.BUGFIX;
  }
  if (/^feat(?:\(|:|\s)|feature|add(?:ed|s|ing)?\b/.test(title) || tagSet.has("feature") || tagSet.has("enhancement")) {
    return CONTENT_SIGNAL_KINDS.FEATURE;
  }
  return CONTENT_SIGNAL_KINDS.OTHER;
}

function isDependencyOnlyPullRequest(payload) {
  const actor = text(payload?.sender?.login, 120).toLowerCase();
  const author = text(payload?.pull_request?.user?.login, 120).toLowerCase();
  const title = text(payload?.pull_request?.title, MAX_TITLE).toLowerCase();
  const dependencyActor = DEPENDENCY_ACTORS.has(actor) || DEPENDENCY_ACTORS.has(author);
  const dependencyTitle = /^(bump|build\(deps|chore\(deps|deps:|dependency)/.test(title);
  return dependencyActor || dependencyTitle;
}

function pullRequestEvent({ deliveryId, payload }) {
  if (payload?.action !== "closed" || payload?.pull_request?.merged !== true) return null;
  const pullRequest = payload.pull_request;
  const number = Number(pullRequest.number || payload.number || 0);
  const title = text(pullRequest.title, MAX_TITLE);
  if (!title || !number) throw new TypeError("Merged pull request event requires a title and number.");
  const dependencyOnly = isDependencyOnlyPullRequest(payload);
  const changedFiles = Number(pullRequest.changed_files || 0);
  const additions = Number(pullRequest.additions || 0);
  const deletions = Number(pullRequest.deletions || 0);

  return {
    provider: "github",
    sourceType: CONTENT_SIGNAL_SOURCE_TYPES.GITHUB,
    deliveryId,
    eventFamily: "pull_request_merged",
    installationRef: requiredOpaque(payload?.installation?.id, "installation.id"),
    resourceRef: requiredOpaque(payload?.repository?.id, "repository.id"),
    providerResourceRef: requiredOpaque(pullRequest.id, "pull_request.id"),
    sourceRevision: sourceRevision(pullRequest.merge_commit_sha),
    occurredAt: iso(pullRequest.merged_at, "pull_request.merged_at"),
    headline: title,
    summary: `Merged pull request #${number}. Change footprint: ${changedFiles} files, ${additions} additions, ${deletions} deletions.`,
    signalKind: classifyPullRequest(pullRequest),
    importanceHints: dependencyOnly
      ? ["analysis:deprioritize", "noise:dependency_only"]
      : ["event:merged_pull_request", "work:completed"],
    noiseDecision: dependencyOnly
      ? { deprioritize: true, reason: "dependency_only_change" }
      : { deprioritize: false, reason: null },
  };
}

function releaseEvent({ deliveryId, payload }) {
  if (payload?.action !== "published") return null;
  const release = payload.release;
  const tag = text(release?.tag_name, 160);
  const name = text(release?.name, MAX_TITLE);
  const headline = name || (tag ? `Release ${tag}` : "");
  if (!headline) throw new TypeError("Published release event requires a name or tag.");
  return {
    provider: "github",
    sourceType: CONTENT_SIGNAL_SOURCE_TYPES.GITHUB,
    deliveryId,
    eventFamily: "release_published",
    installationRef: requiredOpaque(payload?.installation?.id, "installation.id"),
    resourceRef: requiredOpaque(payload?.repository?.id, "repository.id"),
    providerResourceRef: requiredOpaque(release?.id, "release.id"),
    sourceRevision: sourceRevision(release?.target_commitish),
    occurredAt: iso(release?.published_at || release?.created_at, "release.published_at"),
    headline,
    summary: tag ? `Published release ${tag}.` : "Published a repository release.",
    signalKind: CONTENT_SIGNAL_KINDS.RELEASE,
    importanceHints: ["event:published_release", "work:released"],
    noiseDecision: { deprioritize: false, reason: null },
  };
}

export function normalizeGithubWorkEvent({ eventName, deliveryId, payload } = {}) {
  const normalizedEvent = text(eventName, 80).toLowerCase();
  const normalizedDeliveryId = requiredOpaque(deliveryId, "deliveryId");
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new TypeError("GitHub webhook payload must be an object.");

  let normalized = null;
  if (normalizedEvent === "pull_request") normalized = pullRequestEvent({ deliveryId: normalizedDeliveryId, payload });
  if (normalizedEvent === "release") normalized = releaseEvent({ deliveryId: normalizedDeliveryId, payload });
  if (!normalized) return null;

  return Object.freeze({
    ...normalized,
    externalEventRef: Object.freeze({
      provider: "github",
      eventId: normalizedDeliveryId,
      idempotencyKey: `github:${normalizedDeliveryId}`,
    }),
  });
}
