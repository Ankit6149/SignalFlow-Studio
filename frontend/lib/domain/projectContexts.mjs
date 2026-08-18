import {
  createDomainRecord,
  parseDomainRecord,
  portableClone,
  stableStringify,
} from "./contracts.mjs";
import { PRIVACY_CLASSES } from "./sourceArtifacts.mjs";

export const PROJECT_CONTEXT_SCHEMA_VERSION = 1;

const PRIVACY_VALUES = new Set(Object.values(PRIVACY_CLASSES));
const SYNTHESIS_MODES = new Set(["deterministic", "model", "owner_supplied", "hybrid"]);
const SENSITIVE_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth|authorization|cookie|password|client[_-]?secret|private[_-]?key|signed[_-]?url|presigned|database[_-]?url|connection[_-]?string)/i;
const LOCAL_PATH_FIELD = /(^|_)(path|filepath|filesystempath|localpath|absolutepath|workingdirectory|rootdirectory)$/i;

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`Project context text exceeds ${maxLength} characters.`);
  return resolved;
}

function optionalText(value, maxLength = 12000) {
  const normalized = text(value, "", maxLength);
  return normalized || null;
}

function opaqueId(value, field, required = true) {
  const normalized = text(value, "", 240);
  if (!normalized && !required) return null;
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function opaqueIdList(values, field, maxItems) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError(`${field} must be an array.`);
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = opaqueId(value, field);
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function timestamp(value, field) {
  const parsed = Date.parse(value || "");
  if (!Number.isFinite(parsed)) throw new TypeError(`${field} must be an ISO timestamp.`);
  return new Date(parsed).toISOString();
}

function positiveInteger(value, field) {
  const resolved = Number(value);
  if (!Number.isInteger(resolved) || resolved < 1) throw new TypeError(`${field} must be a positive integer.`);
  return resolved;
}

function stringList(values, { maxItems = 80, maxLength = 1600 } = {}) {
  if (values === undefined || values === null) return [];
  if (!Array.isArray(values)) throw new TypeError("Project context list fields must be arrays.");
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const normalized = text(value, "", maxLength);
    const key = normalized.toLowerCase();
    if (!normalized || seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= maxItems) break;
  }
  return result;
}

function enumValue(value, allowed, fallback, field) {
  const normalized = text(value, fallback, 80).toLowerCase();
  if (!allowed.has(normalized)) throw new TypeError(`${field} contains an unsupported value: ${normalized}.`);
  return normalized;
}

function assertNoSensitiveFields(value, path = "ProjectContextSnapshot") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_FIELD.test(key) || LOCAL_PATH_FIELD.test(key)) {
      throw new TypeError(`${path}.${key} is forbidden in project-context input.`);
    }
    assertNoSensitiveFields(item, `${path}.${key}`);
  }
}

function safeRepositoryToken(value, field) {
  const normalized = text(value, "", 240);
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (!/^[a-zA-Z0-9._-]+$/.test(normalized)) throw new TypeError(`${field} must be a safe repository token.`);
  return normalized;
}

function safeRevision(value) {
  const normalized = text(value, "", 240);
  if (!normalized) throw new TypeError("ProjectContextSnapshot.repositoryRef.revision is required.");
  if (/[:?\\/]|\.\./.test(normalized) || /^https?:/i.test(normalized)) {
    throw new TypeError("ProjectContextSnapshot.repositoryRef.revision must be a safe revision identifier, not a URL or path.");
  }
  return normalized;
}

function normalizeRepositoryRef(input) {
  if (input === undefined || input === null) return null;
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("ProjectContextSnapshot.repositoryRef must be an object.");
  }
  assertNoSensitiveFields(input, "ProjectContextSnapshot.repositoryRef");
  return portableClone({
    provider: safeRepositoryToken(input.provider, "ProjectContextSnapshot.repositoryRef.provider").toLowerCase(),
    owner: safeRepositoryToken(input.owner, "ProjectContextSnapshot.repositoryRef.owner"),
    repository: safeRepositoryToken(input.repository, "ProjectContextSnapshot.repositoryRef.repository"),
    revision: safeRevision(input.revision),
    sourceConnectionId: opaqueId(input.sourceConnectionId, "ProjectContextSnapshot.repositoryRef.sourceConnectionId", false),
  });
}

function normalizeSynthesis(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("ProjectContextSnapshot.synthesis must be an object.");
  }
  assertNoSensitiveFields(input, "ProjectContextSnapshot.synthesis");
  return portableClone({
    projectName: optionalText(input.projectName, 500),
    purpose: optionalText(input.purpose, 4000),
    problem: optionalText(input.problem, 4000),
    capabilities: stringList(input.capabilities, { maxItems: 80, maxLength: 1200 }),
    audiences: stringList(input.audiences, { maxItems: 50, maxLength: 1000 }),
    terminology: stringList(input.terminology, { maxItems: 100, maxLength: 500 }),
    maturityStage: optionalText(input.maturityStage, 800),
    architectureNotes: stringList(input.architectureNotes, { maxItems: 80, maxLength: 1800 }),
    constraints: stringList(input.constraints, { maxItems: 80, maxLength: 1800 }),
    safeClaims: stringList(input.safeClaims, { maxItems: 120, maxLength: 1800 }),
    uncertainties: stringList(input.uncertainties, { maxItems: 80, maxLength: 1800 }),
  });
}

function normalizeSynthesisProvenance(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("ProjectContextSnapshot.synthesisProvenance must be an object.");
  }
  assertNoSensitiveFields(input, "ProjectContextSnapshot.synthesisProvenance");
  return portableClone({
    mode: enumValue(input.mode, SYNTHESIS_MODES, "deterministic", "ProjectContextSnapshot.synthesisProvenance.mode"),
    taskId: opaqueId(input.taskId, "ProjectContextSnapshot.synthesisProvenance.taskId", false),
    provider: optionalText(input.provider, 120),
    model: optionalText(input.model, 240),
    routeKind: optionalText(input.routeKind, 120),
    promptVersion: optionalText(input.promptVersion, 120),
    generatedAt: input.generatedAt ? timestamp(input.generatedAt, "ProjectContextSnapshot.synthesisProvenance.generatedAt") : null,
  });
}

function fnv1a64(value) {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= BigInt(value.charCodeAt(index));
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash.toString(16).padStart(16, "0");
}

export function createProjectContextFingerprint(input = {}) {
  assertNoSensitiveFields(input, "ProjectContextFingerprint");
  const canonical = {
    projectId: opaqueId(input.projectId, "ProjectContextFingerprint.projectId"),
    repositoryRef: normalizeRepositoryRef(input.repositoryRef),
    sourceArtifactIds: opaqueIdList(input.sourceArtifactIds, "ProjectContextFingerprint.sourceArtifactIds", 300).sort(),
    supplementalSourceArtifactIds: opaqueIdList(input.supplementalSourceArtifactIds, "ProjectContextFingerprint.supplementalSourceArtifactIds", 200).sort(),
    assetIds: opaqueIdList(input.assetIds, "ProjectContextFingerprint.assetIds", 200).sort(),
  };
  return `sf-project-context-v1-${fnv1a64(stableStringify(canonical))}`;
}

export function normalizeProjectContextSnapshot(input = {}) {
  const parsed = input?.kind === "ProjectContextSnapshot" && input?.schemaVersion
    ? parseDomainRecord(input, "ProjectContextSnapshot")
    : input;
  assertNoSensitiveFields(parsed, "ProjectContextSnapshot");

  if (parsed?.projectContextSchemaVersion && parsed.projectContextSchemaVersion > PROJECT_CONTEXT_SCHEMA_VERSION) {
    throw new TypeError(`ProjectContextSnapshot schema ${parsed.projectContextSchemaVersion} is newer than supported schema ${PROJECT_CONTEXT_SCHEMA_VERSION}.`);
  }

  const synthesis = normalizeSynthesis(parsed.synthesis || {});
  const repositoryRef = normalizeRepositoryRef(parsed.repositoryRef);
  const sourceArtifactIds = opaqueIdList(parsed.sourceArtifactIds, "ProjectContextSnapshot.sourceArtifactIds", 300);
  const supplementalSourceArtifactIds = opaqueIdList(parsed.supplementalSourceArtifactIds, "ProjectContextSnapshot.supplementalSourceArtifactIds", 200);
  const assetIds = opaqueIdList(parsed.assetIds, "ProjectContextSnapshot.assetIds", 200);
  const projectId = opaqueId(parsed.projectId, "ProjectContextSnapshot.projectId");
  const fingerprint = text(parsed.fingerprint, "", 240);
  if (!/^sf-project-context-v1-[a-f0-9]{16}$/.test(fingerprint)) {
    throw new TypeError("ProjectContextSnapshot.fingerprint is invalid.");
  }

  const expectedFingerprint = createProjectContextFingerprint({
    projectId,
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds,
    assetIds,
  });
  if (fingerprint !== expectedFingerprint) {
    throw new TypeError("ProjectContextSnapshot.fingerprint does not match its exact evidence identity.");
  }

  return createDomainRecord("ProjectContextSnapshot", {
    projectContextSchemaVersion: PROJECT_CONTEXT_SCHEMA_VERSION,
    projectContextSnapshotId: opaqueId(parsed.projectContextSnapshotId, "ProjectContextSnapshot.projectContextSnapshotId"),
    workspaceId: opaqueId(parsed.workspaceId, "ProjectContextSnapshot.workspaceId"),
    projectId,
    version: positiveInteger(parsed.version, "ProjectContextSnapshot.version"),
    supersedesId: opaqueId(parsed.supersedesId, "ProjectContextSnapshot.supersedesId", false),
    fingerprint,
    repositoryRef,
    sourceArtifactIds,
    supplementalSourceArtifactIds,
    assetIds,
    privacyClass: enumValue(parsed.privacyClass, PRIVACY_VALUES, PRIVACY_CLASSES.WORKSPACE_PRIVATE, "ProjectContextSnapshot.privacyClass"),
    synthesis,
    synthesisProvenance: normalizeSynthesisProvenance(parsed.synthesisProvenance || {}),
    createdAt: timestamp(parsed.createdAt, "ProjectContextSnapshot.createdAt"),
  });
}

export function projectContextFingerprintInput(snapshotInput) {
  const snapshot = normalizeProjectContextSnapshot(snapshotInput);
  return {
    projectId: snapshot.projectId,
    repositoryRef: snapshot.repositoryRef,
    sourceArtifactIds: snapshot.sourceArtifactIds,
    supplementalSourceArtifactIds: snapshot.supplementalSourceArtifactIds,
    assetIds: snapshot.assetIds,
  };
}
