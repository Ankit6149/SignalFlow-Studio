import { planRepositoryFiles, shouldIncludeFile } from "./fileFilter";
import { parseGitHubUrl } from "./githubUrl.mjs";

export { parseGitHubUrl } from "./githubUrl.mjs";

function encodeRepositoryPath(path) {
  return String(path || "")
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
}

async function fetchRepositoryTree({ owner, repo, branch, headers }) {
  const treeUrl = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branch)}?recursive=1`;
  const response = await fetch(treeUrl, { headers });
  if (!response.ok) {
    throw new Error(`Failed to fetch file tree (HTTP ${response.status})`);
  }
  return response.json();
}

/**
 * Ingests a public GitHub repository through one canonical repository identity.
 * Returns bounded implementation context plus visible selection diagnostics.
 */
export async function ingestGitHubRepo(repoUrl, customToken = null) {
  const parsed = parseGitHubUrl(repoUrl);
  if (!parsed) {
    return {
      warnings: ["Invalid GitHub repository. Use https://github.com/owner/repo."],
      sourceDiagnostics: {
        selected: [],
        skipped: [],
        truncated: [],
        failed: [],
      },
    };
  }

  const { owner, repo, branch: urlBranch, canonicalUrl } = parsed;
  const warnings = [];
  const headers = {
    "User-Agent": "SignalFlow-Studio-V1",
    Accept: "application/vnd.github.v3+json",
  };

  const token = customToken || process.env.GITHUB_TOKEN;
  if (token) headers.Authorization = `token ${token}`;

  let defaultBranch = urlBranch;
  if (!defaultBranch) {
    try {
      const infoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
      if (infoResponse.status === 403 || infoResponse.status === 429) {
        warnings.push("GitHub API rate limited or forbidden. Trying the common main and master branches.");
      } else if (!infoResponse.ok) {
        throw new Error(`Repo not found or inaccessible (HTTP ${infoResponse.status})`);
      } else {
        const info = await infoResponse.json();
        defaultBranch = info.default_branch || "main";
      }
    } catch (error) {
      warnings.push(`Could not fetch repository metadata: ${error.message}. Trying common branches.`);
    }
  }

  let treeData = null;
  const branchCandidates = Array.from(new Set([defaultBranch, "main", "master"].filter(Boolean)));
  let lastTreeError = null;
  for (const candidate of branchCandidates) {
    try {
      treeData = await fetchRepositoryTree({ owner, repo, branch: candidate, headers });
      defaultBranch = candidate;
      break;
    } catch (error) {
      lastTreeError = error;
    }
  }

  if (!treeData) {
    return {
      repoUrl: canonicalUrl,
      owner,
      repo,
      defaultBranch: defaultBranch || null,
      fileTreeSummary: [],
      importantFiles: [],
      rawContext: "",
      warnings: [...warnings, `Could not load repository files: ${lastTreeError?.message || "unknown error"}.`],
      sourceDiagnostics: {
        selected: [],
        skipped: [],
        truncated: [],
        failed: [],
      },
    };
  }

  if (treeData.truncated) {
    warnings.push("Large repository tree was truncated by GitHub before SignalFlow planning.");
  }

  const files = (treeData.tree || [])
    .filter((node) => node.type === "blob")
    .map((node) => ({ path: node.path, size: Number(node.size) || 0 }));

  const fileTreeSummary = files
    .filter((file) => shouldIncludeFile(file.path))
    .map((file) => file.path);

  const plan = planRepositoryFiles(files, {
    maxFiles: 12,
    maxFileBytes: 100 * 1024,
    maxTotalBytes: 720 * 1024,
  });
  const diagnostics = {
    ...plan.diagnostics,
    truncated: [...plan.diagnostics.truncated],
    failed: [],
  };

  const importantFiles = [];
  let readme = "";
  let packageJson = null;

  for (const file of plan.files) {
    try {
      const path = encodeRepositoryPath(file.path);
      const rawUrl = `https://raw.githubusercontent.com/${encodeURIComponent(owner)}/${encodeURIComponent(repo)}/${encodeURIComponent(defaultBranch)}/${path}`;
      const response = await fetch(rawUrl, { headers: { "User-Agent": "SignalFlow-Studio-V1" } });
      if (!response.ok) {
        diagnostics.failed.push({ path: file.path, reason: `http_${response.status}` });
        continue;
      }

      let content = await response.text();
      if (content.length > 8000) {
        diagnostics.truncated.push({ path: file.path, originalCharacters: content.length, keptCharacters: 8000 });
        content = `${content.slice(0, 8000)}\n\n... [File truncated by SignalFlow's repository context budget]`;
      }

      importantFiles.push({
        path: file.path,
        content,
        category: file.category,
        priority: file.priority,
      });

      if (file.path.toLowerCase().endsWith("readme.md") && !readme) readme = content;
      if (file.path.toLowerCase().endsWith("package.json") && !packageJson) {
        try {
          packageJson = JSON.parse(content);
        } catch {
          diagnostics.failed.push({ path: file.path, reason: "invalid_package_json" });
        }
      }
    } catch (error) {
      diagnostics.failed.push({ path: file.path, reason: "fetch_failed" });
      warnings.push(`Could not fetch ${file.path}: ${error.message}`);
    }
  }

  const detectedTechStack = [];
  const detectedFeatures = [];
  if (packageJson) {
    const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const keywords = [
      "next", "react", "vue", "svelte", "typescript", "express", "tailwind",
      "prisma", "mongodb", "postgres", "redis", "firebase", "graphql",
      "fastapi", "django", "flask", "rust", "go",
    ];
    for (const keyword of keywords) {
      if (dependencies[keyword] || String(packageJson.name || "").includes(keyword)) {
        detectedTechStack.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    }
    if (packageJson.scripts) {
      detectedFeatures.push(`Configured scripts: ${Object.keys(packageJson.scripts).join(", ")}`);
    }
  }

  if (!detectedTechStack.length) {
    const tree = fileTreeSummary.join(" ").toLowerCase();
    if (tree.includes("requirements.txt") || tree.includes("pyproject.toml")) detectedTechStack.push("Python");
    if (tree.includes("cargo.toml")) detectedTechStack.push("Rust");
    if (tree.includes("go.mod")) detectedTechStack.push("Go");
    if (tree.includes("tsconfig.json")) detectedTechStack.push("TypeScript");
    if (tree.includes("next.config")) detectedTechStack.push("Next.js");
  }

  let rawContext = "=== REPOSITORY SUMMARY ===\n";
  rawContext += `URL: ${canonicalUrl}\n`;
  rawContext += `Default Branch: ${defaultBranch}\n`;
  if (detectedTechStack.length) rawContext += `Detected Stack: ${detectedTechStack.join(", ")}\n`;
  rawContext += `Selected implementation evidence: ${importantFiles.length} files\n`;
  rawContext += importantFiles.map((file) => ` - ${file.path} [${file.category}]`).join("\n");
  rawContext += "\n";

  if (importantFiles.length) {
    rawContext += "\n=== SELECTED FILE CONTENT ===\n";
    for (const file of importantFiles) {
      rawContext += `\n--- File: ${file.path} ---\n${file.content}\n`;
    }
  }

  return {
    repoUrl: canonicalUrl,
    owner,
    repo,
    defaultBranch,
    readme: readme || importantFiles.find((file) => file.path.toLowerCase().includes("readme"))?.content || "",
    packageJson,
    detectedTechStack,
    detectedFeatures,
    importantFiles: importantFiles.map((file) => file.path),
    fileTreeSummary,
    rawContext,
    warnings,
    sourceDiagnostics: diagnostics,
  };
}
