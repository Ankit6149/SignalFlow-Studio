import { createHash } from "node:crypto";
import {
  EVIDENCE_STATES,
  INGESTION_METHODS,
  normalizeSourceArtifact,
  PRIVACY_CLASSES,
  PROCESSING_STATES,
  SOURCE_KINDS,
  SOURCE_USABILITY_STATES,
} from "../../domain/sourceArtifacts.mjs";

export const GITHUB_BOOTSTRAP_LIMITS = Object.freeze({
  maxTreeEntries: 5000,
  maxSelectedFiles: 12,
  maxFileBytes: 96_000,
  maxEvidenceChars: 48_000,
  maxExcerptCharsPerFile: 9_000,
  maxInventoryChars: 8_000,
});

const MANIFEST_NAMES = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
  "composer.json",
  "gemfile",
]);
const SOURCE_ENTRY_NAMES = new Set([
  "page.js", "page.jsx", "page.ts", "page.tsx",
  "index.js", "index.jsx", "index.ts", "index.tsx",
  "main.js", "main.jsx", "main.ts", "main.tsx",
  "app.js", "app.jsx", "app.ts", "app.tsx",
  "main.py", "app.py", "main.go", "main.rs",
]);
const TEXT_EXTENSIONS = new Set([
  ".md", ".mdx", ".txt", ".json", ".toml", ".yaml", ".yml", ".xml",
  ".js", ".jsx", ".mjs", ".cjs", ".ts", ".tsx", ".py", ".go", ".rs", ".java",
]);
const EXCLUDED_SEGMENTS = new Set([
  "node_modules", "vendor", "dist", "build", ".next", "coverage", ".git", "tmp", "temp",
  "generated", "__generated__", "fixtures", "snapshots",
]);
const SECRETISH_NAME = /(^|[._-])(\.env|env\.local|secret|secrets|credential|credentials|token|tokens|private[_-]?key|id_rsa)([._-]|$)|\.(pem|p12|pfx|key|keystore)$/i;
const LOCKFILE = /(^|\/)(package-lock\.json|pnpm-lock\.yaml|yarn\.lock|bun\.lockb?|poetry\.lock|cargo\.lock|composer\.lock)$/i;
const MINIFIED = /\.min\.[a-z0-9]+$/i;

function text(value, field, maxLength = 500) {
  const normalized = String(value ?? "").replace(/\r\n?/g, "\n").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function safePath(value) {
  const path = text(value, "repository path", 1600).replace(/^\/+/, "");
  if (!path || path.includes("\\") || /(^|\/)\.\.(\/|$)/.test(path) || /^[a-zA-Z]:/.test(path)) {
    throw new TypeError("Repository evidence requires a safe relative path.");
  }
  return path;
}

function basename(path) {
  return path.split("/").pop() || path;
}

function extension(path) {
  const name = basename(path).toLowerCase();
  const index = name.lastIndexOf(".");
  return index >= 0 ? name.slice(index) : "";
}

function repositoryNames(repository) {
  const fullName = text(repository?.fullName, "repository.fullName", 300);
  const parts = fullName.split("/");
  if (parts.length !== 2 || parts.some((part) => !part)) throw new TypeError("GitHub repository fullName must be owner/repository.");
  return { fullName, owner: parts[0], repository: parts[1] };
}

function privacyFor(repository) {
  return repository?.private ? PRIVACY_CLASSES.WORKSPACE_PRIVATE : PRIVACY_CLASSES.PUBLIC;
}

function isExcluded(path) {
  const lower = path.toLowerCase();
  const segments = lower.split("/");
  if (segments.some((segment) => EXCLUDED_SEGMENTS.has(segment))) return true;
  if (SECRETISH_NAME.test(lower) || LOCKFILE.test(lower) || MINIFIED.test(lower)) return true;
  return false;
}

function evidenceKind(path) {
  const lower = path.toLowerCase();
  const name = basename(lower);
  if (/^readme(?:\.[a-z0-9]+)?$/i.test(name)) return "readme";
  if (MANIFEST_NAMES.has(name)) return "manifest";
  if (/changelog|release[-_ ]?notes|history\.md/.test(lower)) return "changelog";
  if (/architecture|architectural|(^|\/)adr(s)?\//.test(lower)) return "architecture_doc";
  if (/product|prd|requirements|specification|design[-_ ]?doc|overview/.test(lower) && /\.(md|mdx|txt)$/i.test(name)) return "product_doc";
  if (SOURCE_ENTRY_NAMES.has(name) || /(^|\/)(routes?|router|api)\//.test(lower)) return "representative_source";
  if (/\.(md|mdx|txt)$/i.test(name)) return "product_doc";
  return "representative_source";
}

function scorePath(path) {
  const lower = path.toLowerCase();
  const name = basename(lower);
  const depth = path.split("/").length - 1;
  let score = 0;
  if (/^readme(?:\.[a-z0-9]+)?$/i.test(name)) score = 1000;
  else if (/architecture|architectural|(^|\/)adr(s)?\//.test(lower)) score = 920;
  else if (/product|prd|requirements|specification|design[-_ ]?doc|overview/.test(lower) && /\.(md|mdx|txt)$/i.test(name)) score = 870;
  else if (MANIFEST_NAMES.has(name)) score = 830;
  else if (/changelog|release[-_ ]?notes|history\.md|roadmap/.test(lower)) score = 760;
  else if (/^docs?\//.test(lower) && /\.(md|mdx|txt)$/i.test(name)) score = 620;
  else if (SOURCE_ENTRY_NAMES.has(name)) score = 430;
  else if (/(^|\/)(routes?|router|api)\//.test(lower) && TEXT_EXTENSIONS.has(extension(name))) score = 390;
  else if (depth === 0 && /\.(md|mdx|txt)$/i.test(name)) score = 560;
  else return 0;
  return score - Math.min(depth * 12, 120);
}

function normalizeTreeEntries(treeEntries) {
  if (!Array.isArray(treeEntries)) throw new TypeError("GitHub repository tree must be an array.");
  if (treeEntries.length > GITHUB_BOOTSTRAP_LIMITS.maxTreeEntries) {
    const error = new Error("GitHub repository tree exceeds the bounded bootstrap limit.");
    error.code = "github_repository_tree_too_large";
    throw error;
  }
  return treeEntries
    .filter((entry) => entry && entry.type === "blob")
    .map((entry) => ({
      path: safePath(entry.path),
      sha: String(entry.sha || "").trim(),
      size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : null,
    }))
    .filter((entry) => !isExcluded(entry.path))
    .filter((entry) => TEXT_EXTENSIONS.has(extension(entry.path)) || MANIFEST_NAMES.has(basename(entry.path).toLowerCase()));
}

export function planGithubRepositoryEvidence({ repository, revision, treeEntries } = {}) {
  repositoryNames(repository);
  text(revision, "repository revision", 240);
  const candidates = normalizeTreeEntries(treeEntries)
    .map((entry) => ({ ...entry, kind: evidenceKind(entry.path), score: scorePath(entry.path) }))
    .filter((entry) => entry.score > 0)
    .filter((entry) => entry.size === null || entry.size <= GITHUB_BOOTSTRAP_LIMITS.maxFileBytes)
    .sort((left, right) => right.score - left.score || (left.size || 0) - (right.size || 0) || left.path.localeCompare(right.path));

  const selected = [];
  const kindCounts = new Map();
  const kindCaps = new Map([
    ["readme", 2],
    ["architecture_doc", 3],
    ["product_doc", 4],
    ["manifest", 4],
    ["changelog", 2],
    ["representative_source", 3],
  ]);
  for (const candidate of candidates) {
    const count = kindCounts.get(candidate.kind) || 0;
    const cap = kindCaps.get(candidate.kind) || 2;
    if (count >= cap) continue;
    selected.push(candidate);
    kindCounts.set(candidate.kind, count + 1);
    if (selected.length >= GITHUB_BOOTSTRAP_LIMITS.maxSelectedFiles) break;
  }

  if (!selected.length) {
    const error = new Error("SignalFlow could not find safe representative text evidence in this repository.");
    error.code = "github_repository_evidence_unavailable";
    throw error;
  }

  return Object.freeze({
    paths: selected.map((item) => item.path),
    selections: selected.map(({ path, sha, size, kind }) => ({ path, sha, size, kind })),
  });
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function artifactId(repositoryId, revision, relativePath, identitySha) {
  const digest = sha256(`${repositoryId}\n${revision}\n${relativePath}\n${identitySha}`).slice(0, 28);
  return `sf-source-github-${digest}`;
}

function canonicalGithubUrl(fullName, revision, relativePath = "") {
  const encodedPath = relativePath.split("/").filter(Boolean).map((segment) => encodeURIComponent(segment)).join("/");
  return encodedPath
    ? `https://github.com/${fullName}/blob/${encodeURIComponent(revision)}/${encodedPath}`
    : `https://github.com/${fullName}/tree/${encodeURIComponent(revision)}`;
}

function mimeTypeFor(path) {
  const ext = extension(path);
  if (ext === ".md" || ext === ".mdx") return "text/markdown";
  if (ext === ".json") return "application/json";
  if ([".yaml", ".yml"].includes(ext)) return "application/yaml";
  if (ext === ".toml") return "application/toml";
  if ([".js", ".jsx", ".mjs", ".cjs"].includes(ext)) return "text/javascript";
  if ([".ts", ".tsx"].includes(ext)) return "text/typescript";
  if (ext === ".py") return "text/x-python";
  return "text/plain";
}

function createArtifact({ workspaceId, repository, revision, relativePath, content, blobSha, now, sourceKind = SOURCE_KINDS.REPOSITORY_FILE }) {
  const names = repositoryNames(repository);
  const privacyClass = privacyFor(repository);
  const normalizedContent = String(content || "").replace(/\r\n?/g, "\n");
  const contentDigest = sha256(normalizedContent);
  return normalizeSourceArtifact({
    sourceArtifactId: artifactId(repository.id, revision, relativePath || "repository-inventory", blobSha || contentDigest),
    workspaceId,
    sourceKind,
    ingestionMethod: INGESTION_METHODS.REPOSITORY_SCAN,
    sourceReference: {
      provider: "github",
      owner: names.owner,
      repository: names.repository,
      revision,
      relativePath,
      canonicalUrl: canonicalGithubUrl(names.fullName, revision, relativePath),
    },
    originalName: relativePath ? basename(relativePath) : `${names.repository} repository inventory`,
    mimeType: relativePath ? mimeTypeFor(relativePath) : "text/plain",
    byteSize: Buffer.byteLength(normalizedContent, "utf8"),
    contentHash: `sha256:${contentDigest}`,
    extraction: {
      state: PROCESSING_STATES.COMPLETE,
      charCount: normalizedContent.length,
    },
    usability: {
      state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE,
      evidenceState: EVIDENCE_STATES.VERIFIED,
    },
    privacy: {
      classification: privacyClass,
      exportAllowed: !repository.private,
      processingAllowed: true,
    },
    createdAt: now,
    updatedAt: now,
  });
}

function inventoryExcerpt(treeEntries) {
  const safe = normalizeTreeEntries(treeEntries)
    .map((entry) => entry.path)
    .sort((left, right) => left.localeCompare(right));
  const topLevel = Array.from(new Set(safe.map((path) => path.split("/")[0]))).slice(0, 80);
  const routes = safe.filter((path) => /(^|\/)(app|pages|routes?|router|api)\//i.test(path)).slice(0, 120);
  const docs = safe.filter((path) => /(^|\/)(docs?|readme|architecture|product|prd|roadmap|changelog)/i.test(path)).slice(0, 100);
  const modules = safe.filter((path) => /(^|\/)(src|lib|frontend|backend|server|client)\//i.test(path)).slice(0, 140);
  const lines = [
    `Top-level entries: ${topLevel.join(", ") || "none detected"}`,
    routes.length ? `Route/API paths:\n${routes.join("\n")}` : "Route/API paths: none detected in bounded inventory.",
    docs.length ? `Documentation paths:\n${docs.join("\n")}` : "Documentation paths: none detected in bounded inventory.",
    modules.length ? `Representative module paths:\n${modules.join("\n")}` : "Representative module paths: none detected in bounded inventory.",
  ];
  return lines.join("\n\n").slice(0, GITHUB_BOOTSTRAP_LIMITS.maxInventoryChars);
}

export function createGithubRepositoryEvidenceBundle({
  workspaceId,
  sourceConnectionId,
  repository,
  revision,
  treeEntries,
  files,
  plan,
  now,
} = {}) {
  const names = repositoryNames(repository);
  const normalizedWorkspaceId = text(workspaceId, "workspaceId", 240);
  const normalizedSourceConnectionId = text(sourceConnectionId, "sourceConnectionId", 240);
  const normalizedRevision = text(revision, "revision", 240);
  const planned = plan || planGithubRepositoryEvidence({ repository, revision: normalizedRevision, treeEntries });
  const fileMap = new Map((Array.isArray(files) ? files : []).map((file) => [safePath(file.path), file]));
  const sourceArtifacts = [];
  const evidence = [];
  let remainingChars = GITHUB_BOOTSTRAP_LIMITS.maxEvidenceChars;

  const inventory = inventoryExcerpt(treeEntries);
  const inventoryArtifact = createArtifact({
    workspaceId: normalizedWorkspaceId,
    repository,
    revision: normalizedRevision,
    relativePath: "",
    content: inventory,
    blobSha: sha256(inventory),
    now,
    sourceKind: SOURCE_KINDS.REPOSITORY,
  });
  sourceArtifacts.push(inventoryArtifact);
  const inventoryExcerptBounded = inventory.slice(0, Math.min(remainingChars, GITHUB_BOOTSTRAP_LIMITS.maxInventoryChars));
  remainingChars -= inventoryExcerptBounded.length;
  evidence.push({
    sourceArtifactId: inventoryArtifact.sourceArtifactId,
    kind: "module_inventory",
    title: `${names.fullName} repository structure`,
    excerpt: inventoryExcerptBounded,
  });

  for (const selection of planned.selections) {
    if (remainingChars <= 0) break;
    const file = fileMap.get(selection.path);
    if (!file) continue;
    const content = String(file.content || "").replace(/\r\n?/g, "\n").trim();
    if (!content || content.includes("\u0000")) continue;
    if (Buffer.byteLength(content, "utf8") > GITHUB_BOOTSTRAP_LIMITS.maxFileBytes) continue;
    const artifact = createArtifact({
      workspaceId: normalizedWorkspaceId,
      repository,
      revision: normalizedRevision,
      relativePath: selection.path,
      content,
      blobSha: String(file.sha || selection.sha || ""),
      now,
    });
    const excerpt = content.slice(0, Math.min(
      remainingChars,
      GITHUB_BOOTSTRAP_LIMITS.maxExcerptCharsPerFile,
    ));
    if (!excerpt) continue;
    sourceArtifacts.push(artifact);
    evidence.push({
      sourceArtifactId: artifact.sourceArtifactId,
      kind: selection.kind,
      title: selection.path,
      excerpt,
    });
    remainingChars -= excerpt.length;
  }

  if (evidence.length < 2) {
    const error = new Error("Repository bootstrap did not yield enough bounded evidence to build trustworthy project context.");
    error.code = "github_repository_evidence_insufficient";
    throw error;
  }

  return Object.freeze({
    repositoryRef: {
      provider: "github",
      owner: names.owner,
      repository: names.repository,
      revision: normalizedRevision,
      sourceConnectionId: normalizedSourceConnectionId,
    },
    privacyClass: privacyFor(repository),
    sourceArtifacts,
    evidence,
  });
}
