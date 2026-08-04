const GITHUB_HOSTS = new Set(["github.com", "www.github.com"]);
const SUPPORTED_PATH_KINDS = new Set(["tree", "blob"]);

function ensureProtocol(value) {
  return /^https?:\/\//i.test(value) ? value : `https://${value}`;
}

function validPathSegment(value) {
  return Boolean(value) && value !== "." && value !== ".." && !/[\s\\]/.test(value);
}

/**
 * Parse every supported public GitHub repository URL into one canonical identity.
 * The canonical URL intentionally excludes query strings, fragments, credentials,
 * and file paths. Tree/blob URLs retain their revision as branch metadata.
 */
export function parseGitHubUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) return null;

  try {
    const url = new URL(ensureProtocol(raw));
    const hostname = url.hostname.toLowerCase();

    if (!GITHUB_HOSTS.has(hostname)) return null;
    if (!["http:", "https:"].includes(url.protocol)) return null;
    if (url.username || url.password || url.port) return null;

    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2 || !validPathSegment(parts[0]) || !validPathSegment(parts[1])) return null;

    const owner = parts[0];
    const repo = parts[1].replace(/\.git$/i, "");
    if (!validPathSegment(repo)) return null;

    let branch = null;
    let path = null;
    const kind = parts[2];
    if (kind) {
      if (!SUPPORTED_PATH_KINDS.has(kind) || !parts[3]) return null;
      branch = decodeURIComponent(parts[3]);
      if (!validPathSegment(branch)) return null;
      path = parts.slice(4).map(decodeURIComponent).join("/") || null;
    }

    return {
      owner,
      repo,
      branch,
      path,
      kind: kind || "repository",
      canonicalUrl: `https://github.com/${owner}/${repo}`,
    };
  } catch {
    return null;
  }
}

export function normalizeGitHubUrl(value) {
  return parseGitHubUrl(value)?.canonicalUrl || null;
}
