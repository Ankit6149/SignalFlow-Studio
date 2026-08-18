import { portableClone } from "../domain/contracts.mjs";
import { normalizeProjectContextSynthesis } from "../domain/projectContexts.mjs";

export const PROJECT_CONTEXT_PROMPT_VERSION = "project_context_v1";
export const MAX_PROJECT_CONTEXT_EVIDENCE_ITEMS = 24;
export const MAX_PROJECT_CONTEXT_EVIDENCE_CHARS = 60000;

const SAFE_EVIDENCE_KINDS = new Set([
  "readme",
  "product_doc",
  "architecture_doc",
  "manifest",
  "changelog",
  "release_context",
  "route_inventory",
  "module_inventory",
  "representative_source",
  "owner_context",
  "other",
]);
const SENSITIVE_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth|authorization|cookie|password|client[_-]?secret|private[_-]?key|signed[_-]?url|presigned|database[_-]?url|connection[_-]?string)/i;
const LOCAL_PATH_FIELD = /(^|_)(path|filepath|filesystempath|localpath|absolutepath|workingdirectory|rootdirectory)$/i;

function text(value, fallback = "", maxLength = 12000) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  const resolved = normalized || fallback;
  if (resolved.length > maxLength) throw new TypeError(`Project-context task text exceeds ${maxLength} characters.`);
  return resolved;
}

function opaqueId(value, field) {
  const normalized = text(value, "", 240);
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque ID.`);
  return normalized;
}

function assertNoSensitiveFields(value, path = "projectContextInput") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSensitiveFields(item, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    if (SENSITIVE_FIELD.test(key) || LOCAL_PATH_FIELD.test(key)) {
      throw new TypeError(`${path}.${key} is forbidden in project-context inference input.`);
    }
    assertNoSensitiveFields(item, `${path}.${key}`);
  }
}

function normalizeEvidence(items) {
  if (!Array.isArray(items)) throw new TypeError("Project-context evidence must be an array.");
  const result = [];
  let totalChars = 0;
  for (const item of items.slice(0, MAX_PROJECT_CONTEXT_EVIDENCE_ITEMS)) {
    if (!item || typeof item !== "object" || Array.isArray(item)) throw new TypeError("Project-context evidence items must be objects.");
    assertNoSensitiveFields(item, "projectContextInput.evidence");
    const sourceArtifactId = opaqueId(item.sourceArtifactId, "projectContextInput.evidence.sourceArtifactId");
    const kind = text(item.kind, "other", 80).toLowerCase();
    if (!SAFE_EVIDENCE_KINDS.has(kind)) throw new TypeError(`Unsupported project-context evidence kind: ${kind}.`);
    const title = text(item.title, "Untitled evidence", 500);
    let excerpt = text(item.excerpt, "", 12000);
    const remaining = MAX_PROJECT_CONTEXT_EVIDENCE_CHARS - totalChars;
    if (remaining <= 0) break;
    if (excerpt.length > remaining) excerpt = excerpt.slice(0, remaining);
    totalChars += excerpt.length;
    result.push({ sourceArtifactId, kind, title, excerpt });
  }
  if (!result.length) throw new TypeError("At least one bounded project-context evidence item is required.");
  return result;
}

export function normalizeProjectContextTaskInput(input = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) throw new TypeError("Project-context inference input must be an object.");
  assertNoSensitiveFields(input);
  const workspaceId = opaqueId(input.workspaceId, "projectContextInput.workspaceId");
  const projectId = opaqueId(input.projectId, "projectContextInput.projectId");
  const evidence = normalizeEvidence(input.evidence || []);
  return portableClone({ workspaceId, projectId, evidence });
}

export function buildProjectContextSynthesisPrompt(input = {}) {
  const normalized = normalizeProjectContextTaskInput(input);
  return [
    "You are SignalFlow's project-understanding stage.",
    "Build a durable factual project-context synthesis from ONLY the bounded evidence below.",
    "Do not generate social posts, content ideas, destinations, hooks, engagement tactics, or publishing advice.",
    "Do not invent users, product maturity, architecture, metrics, capabilities, or claims that the evidence does not support.",
    "When evidence is incomplete or conflicting, record the uncertainty explicitly instead of guessing.",
    "Treat repository/product facts as project context, not as the person's identity or voice.",
    "Return JSON only with exactly these fields:",
    "projectName: string|null",
    "purpose: string|null",
    "problem: string|null",
    "capabilities: string[]",
    "audiences: string[]",
    "terminology: string[]",
    "maturityStage: string|null",
    "architectureNotes: string[]",
    "constraints: string[]",
    "safeClaims: string[]",
    "uncertainties: string[]",
    `Prompt contract: ${PROJECT_CONTEXT_PROMPT_VERSION}`,
    `Project ID: ${normalized.projectId}`,
    "Evidence:",
    JSON.stringify(normalized.evidence),
  ].join("\n");
}

export function acceptProjectContextSynthesis(output = {}) {
  const normalized = normalizeProjectContextSynthesis(output);
  const hasSubstance = Boolean(
    normalized.projectName
    || normalized.purpose
    || normalized.problem
    || normalized.capabilities.length
    || normalized.architectureNotes.length
    || normalized.safeClaims.length,
  );
  if (!hasSubstance) {
    throw new TypeError("Project-context synthesis did not contain enough evidence-backed project understanding.");
  }
  return normalized;
}
