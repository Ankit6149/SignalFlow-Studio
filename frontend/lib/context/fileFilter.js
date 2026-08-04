const IGNORED_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "out",
  "coverage",
  ".git",
  ".github",
  "__pycache__",
  ".venv",
  "vendor",
]);

const IGNORED_FILES = new Set([
  "package-lock.json",
  "pnpm-lock.yaml",
  "yarn.lock",
  "npm-debug.log",
  "yarn-error.log",
  "pnpm-debug.log",
]);

const IGNORED_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "svg", "webp", "ico", "bmp", "tiff",
  "mp4", "mov", "avi", "mkv", "webm", "mp3", "wav", "flac",
  "zip", "tar", "gz", "rar", "7z",
  "exe", "dll", "so", "dylib", "bin", "pdf", "epub",
  "woff", "woff2", "ttf", "eot", "otf",
]);

const MANIFEST_FILES = new Set([
  "package.json",
  "pyproject.toml",
  "requirements.txt",
  "cargo.toml",
  "go.mod",
  "pom.xml",
  "build.gradle",
  "build.gradle.kts",
]);

const SOURCE_DIRS = new Set([
  "app",
  "pages",
  "src",
  "server",
  "api",
  "components",
  "routes",
  "lib",
]);

function normalizePath(filepath) {
  return String(filepath || "").replace(/\\/g, "/").replace(/^\.\//, "");
}

export function shouldIncludeFile(filepath) {
  const normalized = normalizePath(filepath);
  if (!normalized) return false;

  const parts = normalized.split("/");
  for (const part of parts.slice(0, -1)) {
    if (IGNORED_DIRS.has(part.toLowerCase())) return false;
  }

  const filename = parts.at(-1);
  if (IGNORED_FILES.has(filename.toLowerCase())) return false;
  if (filename.includes(".min.")) return false;

  const extensionIndex = filename.lastIndexOf(".");
  if (extensionIndex !== -1 && IGNORED_EXTENSIONS.has(filename.slice(extensionIndex + 1).toLowerCase())) {
    return false;
  }

  return true;
}

export function classifyRepositoryFile(filepath) {
  const normalized = normalizePath(filepath).toLowerCase();
  const parts = normalized.split("/");
  const filename = parts.at(-1) || "";

  if (MANIFEST_FILES.has(filename)) return "manifest";
  if (/^(readme|contributing|changelog|roadmap)(\.|$)/.test(filename) || parts.includes("docs")) return "documentation";
  if (/(^|\/)(__tests__|tests?|specs?|fixtures?)(\/|$)/.test(normalized) || /\.(test|spec)\.[^.]+$/.test(filename)) return "test";
  if (/^(next|vite|webpack|rollup|astro|svelte|nuxt|tsconfig|jsconfig|eslint|prettier|tailwind|postcss)\./.test(filename) || /(^|\/)(config|configs)(\/|$)/.test(normalized)) return "configuration";
  if (parts.some((part) => ["api", "routes", "server"].includes(part))) return "entrypoint";
  if (parts.some((part) => ["app", "pages"].includes(part))) return "entrypoint";
  if (parts.some((part) => SOURCE_DIRS.has(part))) return "source";
  return "other";
}

export function getFilePriorityScore(filepath) {
  const normalized = normalizePath(filepath).toLowerCase();
  const filename = normalized.split("/").at(-1) || "";
  const category = classifyRepositoryFile(normalized);

  if (filename === "readme.md") return normalized.includes("/") ? 82 : 96;
  if (MANIFEST_FILES.has(filename)) return 100;
  if (category === "entrypoint") return 92;
  if (category === "source") return 84;
  if (category === "configuration") return 78;
  if (category === "test") return 70;
  if (category === "documentation") return 58;
  return 30;
}

const CATEGORY_LIMITS = {
  manifest: 2,
  entrypoint: 4,
  source: 4,
  configuration: 2,
  test: 2,
  documentation: 2,
  other: 1,
};

/**
 * Select a deterministic, bounded and representative repository context plan.
 * Nested app roots such as frontend/app and web/src are classified by path
 * segments rather than requiring app/pages/src to be the first segment.
 */
export function planRepositoryFiles(files = [], {
  maxFiles = 12,
  maxFileBytes = 100 * 1024,
  maxTotalBytes = 720 * 1024,
} = {}) {
  const diagnostics = {
    selected: [],
    skipped: [],
    truncated: [],
  };

  const candidates = files
    .map((file) => ({
      ...file,
      path: normalizePath(file?.path),
      size: Number(file?.size) || 0,
    }))
    .filter((file) => {
      if (!shouldIncludeFile(file.path)) {
        diagnostics.skipped.push({ path: file.path, reason: "unsupported_or_generated" });
        return false;
      }
      if (file.size > maxFileBytes) {
        diagnostics.skipped.push({ path: file.path, reason: "file_budget", size: file.size });
        return false;
      }
      return true;
    })
    .map((file) => ({
      ...file,
      category: classifyRepositoryFile(file.path),
      priority: getFilePriorityScore(file.path),
    }))
    .sort((left, right) => right.priority - left.priority || left.path.localeCompare(right.path));

  const categoryCounts = new Map();
  let totalBytes = 0;
  for (const file of candidates) {
    if (diagnostics.selected.length >= maxFiles) {
      diagnostics.skipped.push({ path: file.path, reason: "file_count_budget" });
      continue;
    }

    const used = categoryCounts.get(file.category) || 0;
    const limit = CATEGORY_LIMITS[file.category] || 1;
    if (used >= limit) {
      diagnostics.skipped.push({ path: file.path, reason: "category_budget", category: file.category });
      continue;
    }
    if (totalBytes + file.size > maxTotalBytes) {
      diagnostics.skipped.push({ path: file.path, reason: "total_budget", size: file.size });
      continue;
    }

    diagnostics.selected.push(file);
    categoryCounts.set(file.category, used + 1);
    totalBytes += file.size;
  }

  return {
    files: diagnostics.selected,
    diagnostics: {
      ...diagnostics,
      maxFiles,
      maxFileBytes,
      maxTotalBytes,
      selectedBytes: totalBytes,
    },
  };
}
