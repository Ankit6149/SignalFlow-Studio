import { createGithubAppJwt } from "./githubAppApi.mjs";
import { GITHUB_BOOTSTRAP_LIMITS } from "./githubRepositoryEvidence.mjs";

const API_VERSION = "2026-03-10";
const ACCEPT = "application/vnd.github+json";
const MAX_FILES_PER_READ = 16;
const GIT_SHA = /^[a-f0-9]{40,64}$/i;

function required(value, field, maxLength = 20000) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function integerId(value, field) {
  const normalized = required(value, field, 80);
  if (!/^\d+$/.test(normalized)) throw new TypeError(`${field} must be a numeric GitHub identifier.`);
  return normalized;
}

function gitSha(value, field) {
  const normalized = required(value, field, 80);
  if (!GIT_SHA.test(normalized)) throw new TypeError(`${field} must be a Git object SHA.`);
  return normalized.toLowerCase();
}

function optionalGitSha(value, field) {
  const normalized = String(value || "").trim();
  return normalized ? gitSha(normalized, field) : null;
}

function safePath(value) {
  const normalized = required(value, "repository path", 1600).replace(/^\/+/, "");
  if (!normalized || normalized.includes("\\") || /(^|\/)\.\.(\/|$)/.test(normalized) || /^[a-zA-Z]:/.test(normalized)) {
    throw new TypeError("GitHub repository reads require safe relative paths.");
  }
  return normalized;
}

function safeRepository(repo = {}) {
  const id = integerId(repo.id, "repository.id");
  const fullName = required(repo.full_name, "repository.full_name", 300);
  if (!/^([^/]+)\/([^/]+)$/.test(fullName)) throw new TypeError("GitHub repository full_name is invalid.");
  return Object.freeze({
    id,
    fullName,
    name: required(repo.name || fullName.split("/").pop(), "repository.name", 200),
    ownerLogin: String(repo.owner?.login || "").trim() || fullName.split("/")[0],
    private: Boolean(repo.private),
    visibility: String(repo.visibility || (repo.private ? "private" : "public")).trim().toLowerCase(),
    defaultBranch: String(repo.default_branch || "").trim() || null,
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled),
  });
}

function repoParts(fullName) {
  const [owner, repository] = required(fullName, "repository.fullName", 300).split("/");
  if (!owner || !repository) throw new TypeError("GitHub repository fullName must be owner/repository.");
  return {
    owner: encodeURIComponent(owner),
    repository: encodeURIComponent(repository),
  };
}

function githubError(status, code) {
  const error = new Error(`GitHub repository request failed with status ${status}.`);
  error.code = code || `github_repository_http_${status}`;
  error.status = status;
  return error;
}

function treeEntry(input = {}) {
  const type = String(input.type || "").trim().toLowerCase();
  if (!new Set(["blob", "tree"]).has(type)) return null;
  return Object.freeze({
    path: safePath(input.path),
    type,
    sha: input.sha ? gitSha(input.sha, "tree entry sha") : null,
    size: Number.isFinite(Number(input.size)) && Number(input.size) >= 0 ? Number(input.size) : null,
  });
}

export function createGithubRepositoryApiClient({
  appId,
  privateKey,
  fetchImpl = globalThis.fetch,
  apiBaseUrl = "https://api.github.com",
  now = () => Date.now(),
} = {}) {
  if (typeof fetchImpl !== "function") throw new TypeError("GitHub repository API client requires fetch().");
  const base = new URL(apiBaseUrl);
  const resolvedAppId = integerId(appId, "GitHub App ID");
  const resolvedPrivateKey = required(privateKey, "GitHub App private key", 50000).replace(/\\n/g, "\n");

  function appAuthorization() {
    return `Bearer ${createGithubAppJwt({ appId: resolvedAppId, privateKey: resolvedPrivateKey, now: now() })}`;
  }

  async function requestJson(path, { method = "GET", authorization = appAuthorization() } = {}) {
    const response = await fetchImpl(new URL(path, base), {
      method,
      headers: {
        Accept: ACCEPT,
        Authorization: authorization,
        "X-GitHub-Api-Version": API_VERSION,
      },
      cache: "no-store",
    });
    if (!response.ok) throw githubError(response.status);
    if (response.status === 204) return null;
    return response.json();
  }

  async function installationToken(installationId) {
    const id = integerId(installationId, "installationId");
    const payload = await requestJson(`/app/installations/${id}/access_tokens`, { method: "POST" });
    return required(payload?.token, "GitHub installation access token", 10000);
  }

  async function repositoryWithToken(repositoryId, token) {
    return safeRepository(await requestJson(`/repositories/${integerId(repositoryId, "repositoryId")}`, {
      authorization: `Bearer ${token}`,
    }));
  }

  async function getRepositorySnapshot(installationId, repositoryId, revisionInput = null) {
    const requestedRevision = optionalGitSha(revisionInput, "requested repository revision");
    const token = await installationToken(installationId);
    const repository = await repositoryWithToken(repositoryId, token);
    if (repository.archived || repository.disabled) {
      const error = new Error("Archived or disabled repositories cannot be bootstrapped.");
      error.code = "github_repository_not_observable";
      throw error;
    }
    if (!requestedRevision && !repository.defaultBranch) {
      const error = new Error("GitHub repository does not expose a default branch.");
      error.code = "github_repository_default_branch_missing";
      throw error;
    }
    const parts = repoParts(repository.fullName);
    const commitRef = requestedRevision || repository.defaultBranch;
    const commit = await requestJson(
      `/repos/${parts.owner}/${parts.repository}/commits/${encodeURIComponent(commitRef)}`,
      { authorization: `Bearer ${token}` },
    );
    const revision = gitSha(commit?.sha, "repository revision");
    if (requestedRevision && revision !== requestedRevision) {
      const error = new Error("GitHub repository did not resolve the exact requested evidence revision.");
      error.code = "github_repository_revision_mismatch";
      throw error;
    }
    const treeSha = gitSha(commit?.commit?.tree?.sha, "repository tree sha");
    const payload = await requestJson(
      `/repos/${parts.owner}/${parts.repository}/git/trees/${treeSha}?recursive=1`,
      { authorization: `Bearer ${token}` },
    );
    if (payload?.truncated) {
      const error = new Error("GitHub returned a truncated repository tree; SignalFlow will not infer project context from incomplete structure.");
      error.code = "github_repository_tree_truncated";
      throw error;
    }
    const rawTree = Array.isArray(payload?.tree) ? payload.tree : [];
    if (rawTree.length > GITHUB_BOOTSTRAP_LIMITS.maxTreeEntries) {
      const error = new Error("GitHub repository tree exceeds the bounded bootstrap limit.");
      error.code = "github_repository_tree_too_large";
      throw error;
    }
    const treeEntries = rawTree.map(treeEntry).filter(Boolean);
    return Object.freeze({ repository, revision, treeEntries });
  }

  async function readTextFiles(installationId, repositoryId, revisionInput, pathsInput) {
    const revision = gitSha(revisionInput, "repository revision");
    if (!Array.isArray(pathsInput) || pathsInput.length < 1 || pathsInput.length > MAX_FILES_PER_READ) {
      throw new TypeError(`GitHub repository bootstrap can read between 1 and ${MAX_FILES_PER_READ} files at once.`);
    }
    const paths = Array.from(new Set(pathsInput.map(safePath)));
    const token = await installationToken(installationId);
    const repository = await repositoryWithToken(repositoryId, token);
    const parts = repoParts(repository.fullName);
    const files = [];
    for (const path of paths) {
      const encodedPath = path.split("/").map((segment) => encodeURIComponent(segment)).join("/");
      const payload = await requestJson(
        `/repos/${parts.owner}/${parts.repository}/contents/${encodedPath}?ref=${encodeURIComponent(revision)}`,
        { authorization: `Bearer ${token}` },
      );
      if (!payload || Array.isArray(payload) || payload.type !== "file") continue;
      const size = Number(payload.size || 0);
      if (!Number.isFinite(size) || size < 0 || size > GITHUB_BOOTSTRAP_LIMITS.maxFileBytes) continue;
      if (String(payload.encoding || "").toLowerCase() !== "base64" || !payload.content) continue;
      const content = Buffer.from(String(payload.content).replace(/\s+/g, ""), "base64").toString("utf8").replace(/\r\n?/g, "\n");
      if (!content || content.includes("\u0000")) continue;
      files.push(Object.freeze({
        path,
        sha: payload.sha ? gitSha(payload.sha, "repository file sha") : null,
        size: Buffer.byteLength(content, "utf8"),
        content,
      }));
    }
    return files;
  }

  return Object.freeze({ getRepositorySnapshot, readTextFiles });
}
