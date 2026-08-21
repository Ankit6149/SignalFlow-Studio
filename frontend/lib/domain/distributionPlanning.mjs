import { createDomainRecord, parseDomainRecord, portableClone, stableStringify } from "./contracts.mjs";

export const DISTRIBUTION_PLAN_SCHEMA_VERSION = 1;
export const DISTRIBUTION_REGISTRY_VERSION = 1;

export const DISTRIBUTION_DECISIONS = Object.freeze({
  INCLUDE: "include",
  OPTIONAL: "optional",
  EXCLUDE: "exclude",
  DO_NOT_POST: "do_not_post",
});

export const DISTRIBUTION_PLAN_STATUSES = Object.freeze({
  PLANNED: "planned",
  APPROVED: "approved",
  SUPERSEDED: "superseded",
});

export const CONNECTOR_STATES = Object.freeze({
  NOT_APPLICABLE: "not_applicable",
  NOT_CONFIGURED: "not_configured",
  CONFIGURED: "configured",
  AUTHORIZED: "authorized",
  VERIFIED: "verified",
});

const DECISION_VALUES = new Set(Object.values(DISTRIBUTION_DECISIONS));
const STATUS_VALUES = new Set(Object.values(DISTRIBUTION_PLAN_STATUSES));
const CONNECTOR_STATE_VALUES = new Set(Object.values(CONNECTOR_STATES));

function text(value, fallback = "", maxLength = 4000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`Distribution planning text exceeds ${maxLength} characters.`);
  return resolved;
}

function id(value, field, { required = true } = {}) {
  const normalized = text(value, "", 120).toLowerCase();
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`DistributionPlan.${field} is required.`);
  if (!/^[a-z0-9][a-z0-9._-]{0,119}$/.test(normalized)) {
    throw new TypeError(`DistributionPlan.${field} must be a portable identifier.`);
  }
  return normalized;
}

function opaque(value, field, { required = true } = {}) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`DistributionPlan.${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`DistributionPlan.${field} must be an opaque identifier.`);
  return normalized;
}

function iso(value, fallback = null, field = "timestamp") {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError(`DistributionPlan.${field} must be an ISO-compatible timestamp.`);
  return new Date(parsed).toISOString();
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!allowed.has(normalized)) throw new TypeError(`DistributionPlan.${field} contains an unsupported value: ${normalized}.`);
  return normalized;
}

function bool(value, fallback = false) {
  return value === undefined || value === null ? fallback : value === true;
}

function uniqueIds(values, field) {
  if (!Array.isArray(values)) return [];
  return Array.from(new Set(values.map((value) => id(value, field))));
}

function normalizeCapabilitySnapshot(value = {}) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  return portableClone({
    generate: bool(source.generate),
    review: bool(source.review),
    media: bool(source.media),
    manualExport: bool(source.manualExport),
    schedule: bool(source.schedule),
    publish: bool(source.publish),
    connectorState: enumValue(source.connectorState, CONNECTOR_STATE_VALUES, CONNECTOR_STATES.NOT_CONFIGURED, "capability.connectorState"),
  });
}

function normalizeForm(value = {}) {
  const formId = id(value.formId || value.id, "contentForm.formId");
  return portableClone({
    formId,
    label: text(value.label, formId, 120),
    category: id(value.category || "text", "contentForm.category"),
    mediaKind: id(value.mediaKind || "text", "contentForm.mediaKind"),
  });
}

function normalizeDestination(value = {}) {
  const destinationId = id(value.destinationId || value.id, "destination.destinationId");
  const defaultFormId = id(value.defaultFormId, "destination.defaultFormId");
  const supportedFormIds = uniqueIds(value.supportedFormIds || [defaultFormId], "destination.supportedFormIds");
  if (!supportedFormIds.includes(defaultFormId)) supportedFormIds.unshift(defaultFormId);
  return portableClone({
    destinationId,
    label: text(value.label, destinationId, 120),
    defaultFormId,
    supportedFormIds,
    defaultCadenceHours: Math.max(0, Math.min(24 * 30, Number(value.defaultCadenceHours ?? 24))),
  });
}

function normalizeMatrixEntry(value = {}) {
  const destinationId = id(value.destinationId, "matrix.destinationId");
  const contentFormId = id(value.contentFormId, "matrix.contentFormId");
  return portableClone({
    destinationId,
    contentFormId,
    ...normalizeCapabilitySnapshot(value),
  });
}

export function createDistributionCapabilityRegistry({
  version = DISTRIBUTION_REGISTRY_VERSION,
  destinations = [],
  contentForms = [],
  matrix = [],
} = {}) {
  const normalizedDestinations = destinations.map(normalizeDestination);
  const normalizedForms = contentForms.map(normalizeForm);
  const destinationIds = new Set(normalizedDestinations.map((item) => item.destinationId));
  const formIds = new Set(normalizedForms.map((item) => item.formId));
  const normalizedMatrix = matrix.map(normalizeMatrixEntry).filter((entry) => destinationIds.has(entry.destinationId) && formIds.has(entry.contentFormId));
  const duplicateDestination = normalizedDestinations.find((item, index) => normalizedDestinations.findIndex((candidate) => candidate.destinationId === item.destinationId) !== index);
  const duplicateForm = normalizedForms.find((item, index) => normalizedForms.findIndex((candidate) => candidate.formId === item.formId) !== index);
  if (duplicateDestination || duplicateForm) throw new TypeError("Distribution capability registry IDs must be unique.");
  return Object.freeze({
    kind: "DistributionCapabilityRegistry",
    version: Number(version) || DISTRIBUTION_REGISTRY_VERSION,
    destinations: portableClone(normalizedDestinations),
    contentForms: portableClone(normalizedForms),
    matrix: portableClone(normalizedMatrix),
  });
}

export function capabilityFor(registryInput, destinationInput, formInput, accountState = null) {
  const registry = registryInput?.kind === "DistributionCapabilityRegistry"
    ? registryInput
    : createDistributionCapabilityRegistry(registryInput);
  const destinationId = id(destinationInput, "destinationId");
  const contentFormId = id(formInput, "contentFormId");
  const destination = registry.destinations.find((item) => item.destinationId === destinationId);
  const form = registry.contentForms.find((item) => item.formId === contentFormId);
  if (!destination || !form || !destination.supportedFormIds.includes(contentFormId)) {
    return normalizeCapabilitySnapshot({ connectorState: CONNECTOR_STATES.NOT_CONFIGURED });
  }
  const entry = registry.matrix.find((item) => item.destinationId === destinationId && item.contentFormId === contentFormId);
  const base = normalizeCapabilitySnapshot(entry || {});
  const runtime = accountState && typeof accountState === "object" && !Array.isArray(accountState) ? accountState : {};
  const connectorState = runtime.connectorState
    ? enumValue(runtime.connectorState, CONNECTOR_STATE_VALUES, base.connectorState, "account.connectorState")
    : base.connectorState;
  return portableClone({
    ...base,
    schedule: base.schedule && bool(runtime.scheduleEnabled, true),
    publish: base.publish && bool(runtime.publishEnabled, true) && connectorState === CONNECTOR_STATES.VERIFIED,
    connectorState,
  });
}

function formAlias(value) {
  const normalized = text(value, "", 160).toLowerCase();
  if (!normalized) return null;
  if (/carousel|slides|swipe/.test(normalized)) return "carousel";
  if (/reel|short video|short-form video|tiktok|shorts/.test(normalized)) return "short_video";
  if (/long video|youtube video/.test(normalized)) return "long_video";
  if (/thread/.test(normalized)) return "thread";
  if (/newsletter/.test(normalized)) return "newsletter";
  if (/article|blog/.test(normalized)) return "article";
  if (/diagram|infographic/.test(normalized)) return "diagram";
  if (/image|visual/.test(normalized)) return "image";
  if (/release note|changelog/.test(normalized)) return "release_update";
  if (/long|narrative|thoughtful/.test(normalized)) return "long_post";
  if (/short|single post|concise/.test(normalized)) return "short_post";
  return null;
}

function accountMap(values = []) {
  return new Map((Array.isArray(values) ? values : []).map((item) => [id(item.destinationId, "account.destinationId"), item]));
}

function lastScheduledAt(calendar, destinationId) {
  const timestamps = (Array.isArray(calendar) ? calendar : [])
    .filter((item) => String(item?.destinationId || "").trim().toLowerCase() === destinationId)
    .map((item) => Date.parse(item.scheduledFor || item.startAt || ""))
    .filter(Number.isFinite);
  return timestamps.length ? Math.max(...timestamps) : null;
}

function nextTiming({ now, calendar, destination, cadenceOverrideHours = null }) {
  const nowMs = Date.parse(now);
  const last = lastScheduledAt(calendar, destination.destinationId);
  const cadenceHours = cadenceOverrideHours === null
    ? destination.defaultCadenceHours
    : Math.max(0, Math.min(24 * 30, Number(cadenceOverrideHours) || 0));
  if (!last || last + cadenceHours * 60 * 60 * 1000 <= nowMs) return now;
  return new Date(last + cadenceHours * 60 * 60 * 1000).toISOString();
}

function preferenceMap(values = []) {
  return new Map((Array.isArray(values) ? values : []).map((item) => [id(item.destinationId, "preference.destinationId"), item]));
}

function strategyDestinationHints(strategy = {}) {
  return Array.isArray(strategy.destinationPlan)
    ? strategy.destinationPlan.filter((item) => item && typeof item === "object" && !Array.isArray(item))
    : [];
}

export function buildDistributionPlan({
  distributionPlanId,
  workspaceId,
  contentPieceId,
  narrativeStrategyId,
  strategy = {},
  registry,
  ownerPreferences = [],
  accountStates = [],
  calendar = [],
  createdAt,
} = {}) {
  const normalizedRegistry = registry?.kind === "DistributionCapabilityRegistry"
    ? registry
    : createDistributionCapabilityRegistry(registry);
  const preferences = preferenceMap(ownerPreferences);
  const accounts = accountMap(accountStates);
  const hints = strategyDestinationHints(strategy);
  const hintedIds = hints.map((item) => String(item.destination || item.destinationId || "").trim().toLowerCase()).filter(Boolean);
  const preferredIds = [...preferences.entries()].filter(([, item]) => item.enabled !== false).map(([destinationId]) => destinationId);
  const candidateIds = Array.from(new Set([...hintedIds, ...preferredIds]));
  const entries = [];

  for (const destinationId of candidateIds) {
    const destination = normalizedRegistry.destinations.find((item) => item.destinationId === destinationId);
    if (!destination) {
      entries.push({
        destinationId,
        contentFormId: "unsupported",
        decision: DISTRIBUTION_DECISIONS.EXCLUDE,
        reason: "This destination is not present in the active capability registry.",
        scheduledFor: null,
        capability: normalizeCapabilitySnapshot({}),
      });
      continue;
    }
    const hint = hints.find((item) => String(item.destination || item.destinationId || "").trim().toLowerCase() === destinationId) || {};
    const preference = preferences.get(destinationId) || {};
    const requestedFormId = preference.contentFormId
      ? id(preference.contentFormId, "preference.contentFormId")
      : formAlias(hint.format) || destination.defaultFormId;
    const contentFormId = destination.supportedFormIds.includes(requestedFormId) ? requestedFormId : destination.defaultFormId;
    const capability = capabilityFor(normalizedRegistry, destinationId, contentFormId, accounts.get(destinationId));
    const sourceDecision = String(hint.decision || "").trim().toLowerCase();
    const decision = preference.enabled === false
      ? DISTRIBUTION_DECISIONS.EXCLUDE
      : sourceDecision === DISTRIBUTION_DECISIONS.EXCLUDE
        ? DISTRIBUTION_DECISIONS.EXCLUDE
        : sourceDecision === DISTRIBUTION_DECISIONS.OPTIONAL
          ? DISTRIBUTION_DECISIONS.OPTIONAL
          : capability.generate
            ? DISTRIBUTION_DECISIONS.INCLUDE
            : DISTRIBUTION_DECISIONS.EXCLUDE;
    entries.push({
      destinationId,
      contentFormId,
      decision,
      reason: text(
        preference.reason || hint.reason,
        decision === DISTRIBUTION_DECISIONS.EXCLUDE
          ? "SignalFlow cannot currently produce this destination/form combination safely."
          : "This destination and content form fit the approved story direction and current capability state.",
        1200,
      ),
      scheduledFor: decision === DISTRIBUTION_DECISIONS.INCLUDE || decision === DISTRIBUTION_DECISIONS.OPTIONAL
        ? nextTiming({ now: createdAt, calendar, destination, cadenceOverrideHours: preference.cadenceHours ?? null })
        : null,
      adaptationNotes: Array.isArray(hint.adaptationNotes) ? hint.adaptationNotes.map((item) => text(item, "", 500)).filter(Boolean).slice(0, 12) : [],
      capability,
    });
  }

  if (!entries.some((item) => [DISTRIBUTION_DECISIONS.INCLUDE, DISTRIBUTION_DECISIONS.OPTIONAL].includes(item.decision))) {
    entries.push({
      destinationId: "none",
      contentFormId: "none",
      decision: DISTRIBUTION_DECISIONS.DO_NOT_POST,
      reason: "No currently supported destination/form combination is worth scheduling for this story.",
      scheduledFor: null,
      adaptationNotes: [],
      capability: normalizeCapabilitySnapshot({ connectorState: CONNECTOR_STATES.NOT_APPLICABLE }),
    });
  }

  return normalizeDistributionPlan({
    distributionPlanId,
    workspaceId,
    contentPieceId,
    narrativeStrategyId,
    capabilityRegistryVersion: normalizedRegistry.version,
    status: DISTRIBUTION_PLAN_STATUSES.PLANNED,
    entries,
    createdAt,
    updatedAt: createdAt,
  });
}

function normalizeEntry(value = {}) {
  const decision = enumValue(value.decision, DECISION_VALUES, DISTRIBUTION_DECISIONS.EXCLUDE, "entry.decision");
  const none = decision === DISTRIBUTION_DECISIONS.DO_NOT_POST;
  return portableClone({
    destinationId: none ? "none" : id(value.destinationId, "entry.destinationId"),
    contentFormId: none ? "none" : id(value.contentFormId, "entry.contentFormId"),
    decision,
    reason: text(value.reason, "Editorial decision recorded.", 1200),
    scheduledFor: decision === DISTRIBUTION_DECISIONS.INCLUDE || decision === DISTRIBUTION_DECISIONS.OPTIONAL
      ? iso(value.scheduledFor, null, "entry.scheduledFor")
      : null,
    adaptationNotes: Array.isArray(value.adaptationNotes) ? value.adaptationNotes.map((item) => text(item, "", 500)).filter(Boolean).slice(0, 12) : [],
    capability: normalizeCapabilitySnapshot(value.capability),
  });
}

export function normalizeDistributionPlan(input = {}) {
  const parsed = input?.kind === "DistributionPlan" ? parseDomainRecord(input, "DistributionPlan") : input;
  const createdAt = iso(parsed.createdAt, null, "createdAt");
  if (!createdAt) throw new TypeError("DistributionPlan.createdAt is required.");
  const entries = Array.isArray(parsed.entries) ? parsed.entries.map(normalizeEntry) : [];
  if (!entries.length) throw new TypeError("DistributionPlan requires at least one distribution decision.");
  return createDomainRecord("DistributionPlan", {
    distributionPlanSchemaVersion: DISTRIBUTION_PLAN_SCHEMA_VERSION,
    distributionPlanId: opaque(parsed.distributionPlanId, "distributionPlanId"),
    workspaceId: opaque(parsed.workspaceId, "workspaceId"),
    contentPieceId: opaque(parsed.contentPieceId, "contentPieceId"),
    narrativeStrategyId: opaque(parsed.narrativeStrategyId, "narrativeStrategyId"),
    capabilityRegistryVersion: Math.max(1, Number(parsed.capabilityRegistryVersion || DISTRIBUTION_REGISTRY_VERSION)),
    status: enumValue(parsed.status, STATUS_VALUES, DISTRIBUTION_PLAN_STATUSES.PLANNED, "status"),
    entries,
    createdAt,
    updatedAt: iso(parsed.updatedAt, createdAt, "updatedAt"),
    approvedAt: iso(parsed.approvedAt, null, "approvedAt"),
  });
}

export function approveDistributionPlan(input, approvedAt) {
  const plan = normalizeDistributionPlan(input);
  return normalizeDistributionPlan({
    ...plan,
    status: DISTRIBUTION_PLAN_STATUSES.APPROVED,
    approvedAt,
    updatedAt: approvedAt,
  });
}

export function distributionPlanFingerprint(input) {
  const plan = normalizeDistributionPlan(input);
  const serialized = stableStringify({
    contentPieceId: plan.contentPieceId,
    narrativeStrategyId: plan.narrativeStrategyId,
    capabilityRegistryVersion: plan.capabilityRegistryVersion,
    entries: plan.entries.map((item) => ({
      destinationId: item.destinationId,
      contentFormId: item.contentFormId,
      decision: item.decision,
      scheduledFor: item.scheduledFor,
      capability: item.capability,
    })),
  });
  let hash = 2166136261;
  for (let index = 0; index < serialized.length; index += 1) {
    hash ^= serialized.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `fnv1a:${(hash >>> 0).toString(16).padStart(8, "0")}`;
}

const FORMS = Object.freeze([
  { formId: "short_post", label: "Short post", category: "text", mediaKind: "text" },
  { formId: "long_post", label: "Long post", category: "text", mediaKind: "text" },
  { formId: "thread", label: "Thread", category: "text", mediaKind: "text" },
  { formId: "article", label: "Article", category: "text", mediaKind: "text" },
  { formId: "newsletter", label: "Newsletter", category: "text", mediaKind: "text" },
  { formId: "carousel", label: "Carousel", category: "visual", mediaKind: "carousel" },
  { formId: "image", label: "Image", category: "visual", mediaKind: "image" },
  { formId: "diagram", label: "Diagram", category: "visual", mediaKind: "diagram" },
  { formId: "screenshot_story", label: "Screenshot story", category: "visual", mediaKind: "screenshot" },
  { formId: "short_video", label: "Short video", category: "video", mediaKind: "video" },
  { formId: "long_video", label: "Long video", category: "video", mediaKind: "video" },
  { formId: "demo_gif", label: "Product demo / GIF", category: "video", mediaKind: "video" },
  { formId: "audio", label: "Audio", category: "audio", mediaKind: "audio" },
  { formId: "release_update", label: "Release update", category: "text", mediaKind: "text" },
]);

const DESTINATIONS = Object.freeze([
  ["linkedin", "LinkedIn", "long_post", ["long_post", "short_post", "carousel", "image", "diagram", "short_video"]],
  ["x", "X", "short_post", ["short_post", "thread", "image", "diagram", "short_video"]],
  ["threads", "Threads", "short_post", ["short_post", "thread", "image", "short_video"]],
  ["instagram", "Instagram", "carousel", ["carousel", "image", "short_video", "screenshot_story"]],
  ["facebook", "Facebook", "long_post", ["long_post", "short_post", "image", "short_video"]],
  ["reddit", "Reddit", "long_post", ["long_post", "image", "screenshot_story"]],
  ["hackernews", "Hacker News", "short_post", ["short_post", "article"]],
  ["bluesky", "Bluesky", "short_post", ["short_post", "thread", "image"]],
  ["mastodon", "Mastodon", "short_post", ["short_post", "thread", "image"]],
  ["youtube", "YouTube", "long_video", ["long_video", "short_video"]],
  ["tiktok", "TikTok", "short_video", ["short_video"]],
  ["pinterest", "Pinterest", "image", ["image", "carousel", "diagram"]],
  ["newsletter", "Newsletter", "newsletter", ["newsletter"]],
  ["blog", "Blog", "article", ["article"]],
  ["website", "Website", "article", ["article", "release_update"]],
  ["community", "Community", "short_post", ["short_post", "long_post", "image"]],
  ["product_update", "Product update", "release_update", ["release_update", "image", "demo_gif"]],
  ["release_notes", "Release notes", "release_update", ["release_update"]],
]);

export const DEFAULT_DISTRIBUTION_REGISTRY = createDistributionCapabilityRegistry({
  version: DISTRIBUTION_REGISTRY_VERSION,
  contentForms: FORMS,
  destinations: DESTINATIONS.map(([destinationId, label, defaultFormId, supportedFormIds]) => ({
    destinationId,
    label,
    defaultFormId,
    supportedFormIds,
    defaultCadenceHours: ["x", "threads", "bluesky", "mastodon"].includes(destinationId) ? 12 : 24,
  })),
  matrix: DESTINATIONS.flatMap(([destinationId, , , supportedFormIds]) => supportedFormIds.map((contentFormId) => {
    const form = FORMS.find((item) => item.formId === contentFormId);
    return {
      destinationId,
      contentFormId,
      generate: true,
      review: true,
      media: form?.mediaKind !== "text",
      manualExport: true,
      schedule: false,
      publish: false,
      connectorState: CONNECTOR_STATES.NOT_CONFIGURED,
    };
  })),
});
