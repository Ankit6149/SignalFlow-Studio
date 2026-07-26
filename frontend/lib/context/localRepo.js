import fs from "fs";
import path from "path";
import { shouldIncludeFile, getFilePriorityScore } from "./fileFilter";

const MAX_TREE_FILES = 600;
const MAX_READ_FILES = 10;
const MAX_FILE_BYTES = 100 * 1024;
const MAX_TEXT_CHARS_PER_FILE = 8000;
const HOSTED_LOCAL_SCAN_WARNING =
  "Local folder scanning is disabled in hosted and production mode. Use a public GitHub URL, uploaded files, manual notes, or explicitly enable local scanning on a trusted self-hosted machine.";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  ".next",
  "dist",
  "build",
  "coverage",
  ".turbo",
  ".vercel",
  "vendor",
  "tmp",
  "temp",
]);

const SENSITIVE_FILE_PATTERNS = [
  /^\.env(\.|$)/i,
  /secret/i,
  /credential/i,
  /private[_-]?key/i,
  /id_rsa/i,
  /token/i,
  /\.pem$/i,
  /\.p12$/i,
  /\.pfx$/i,
];

/**
 * Ingests a local workspace repository from a folder path on disk.
 *
 * Security boundary:
 * - This is intended for localhost/self-hosted development only.
 * - Vercel and explicitly public-hosted deployments always disable it.
 * - Production self-hosting requires SIGNALFLOW_ENABLE_LOCAL_REPO_SCAN=true.
 */
export async function ingestLocalRepo(dirPath) {
  const warnings = [];

  const hostedRuntime = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" || Boolean(process.env.VERCEL);
  const productionWithoutOptIn =
    process.env.NODE_ENV === "production" && process.env.SIGNALFLOW_ENABLE_LOCAL_REPO_SCAN !== "true";

  if (hostedRuntime || productionWithoutOptIn) {
    return { warnings: [HOSTED_LOCAL_SCAN_WARNING] };
  }

  if (!dirPath || typeof dirPath !== "string") {
    return { warnings: ["Local path is missing or invalid."] };
  }

  if (looksLikeCredentialUrl(dirPath)) {
    return {
      warnings: [
        "Local/repository path appears to contain embedded credentials. Remove tokens from URLs and use a dedicated token field instead.",
      ],
    };
  }

  const resolvedPath = path.resolve(dirPath);

  if (!fs.existsSync(resolvedPath)) {
    return {
      warnings: [`Local path "${redactPathForWarning(dirPath)}" does not exist.`],
    };
  }

  const stat = fs.statSync(resolvedPath);
  if (!stat.isDirectory()) {
    return {
      warnings: [`Local path "${redactPathForWarning(dirPath)}" is not a directory.`],
    };
  }

  let fileTreeSummary = [];
  let importantFiles = [];
  let readme = "";
  let packageJson = null;
  let detectedTechStack = [];
  let detectedFeatures = [];
  let skippedFileCount = 0;

  function walkDir(currentPath, relativePath = "") {
    if (fileTreeSummary.length >= MAX_TREE_FILES) {
      skippedFileCount += 1;
      return;
    }

    const entries = fs.readdirSync(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      if (fileTreeSummary.length >= MAX_TREE_FILES) {
        skippedFileCount += 1;
        break;
      }

      const relEntryPath = relativePath ? path.join(relativePath, entry.name) : entry.name;
      const normalizedPath = relEntryPath.replace(/\\/g, "/");

      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) {
          skippedFileCount += 1;
          continue;
        }
        walkDir(path.join(currentPath, entry.name), relEntryPath);
      } else {
        if (isSensitiveFile(normalizedPath)) {
          skippedFileCount += 1;
          continue;
        }
        if (shouldIncludeFile(normalizedPath)) {
          fileTreeSummary.push(normalizedPath);
        }
      }
    }
  }

  try {
    walkDir(resolvedPath);
  } catch (err) {
    return {
      warnings: [`Failed to scan local path "${redactPathForWarning(dirPath)}": ${err.message}`],
    };
  }

  if (skippedFileCount > 0) {
    warnings.push(`Skipped ${skippedFileCount} generated, ignored, oversized, or sensitive entries during local scan.`);
  }
  if (fileTreeSummary.length >= MAX_TREE_FILES) {
    warnings.push(`Local scan stopped after ${MAX_TREE_FILES} candidate files to keep the app responsive.`);
  }

  const filesWithMetadata = fileTreeSummary
    .map((filePath) => {
      const fullPath = path.join(resolvedPath, filePath);
      const size = fs.statSync(fullPath).size;
      return {
        path: filePath,
        size,
        priority: getFilePriorityScore(filePath),
      };
    })
    .filter((file) => {
      if (file.size > MAX_FILE_BYTES) {
        skippedFileCount += 1;
        return false;
      }
      return true;
    });

  const filesToFetch = filesWithMetadata
    .sort((a, b) => b.priority - a.priority)
    .slice(0, MAX_READ_FILES);

  for (const file of filesToFetch) {
    try {
      const fullPath = path.join(resolvedPath, file.path);
      let text = fs.readFileSync(fullPath, "utf-8");

      if (text.length > MAX_TEXT_CHARS_PER_FILE) {
        text = `${text.substring(0, MAX_TEXT_CHARS_PER_FILE)}\n\n... [File truncated for context limits, total size: ${file.size} bytes]`;
      }

      importantFiles.push({
        path: file.path,
        content: text,
        priority: file.priority,
      });

      if (file.path.toLowerCase() === "readme.md") {
        readme = text;
      }
      if (file.path.toLowerCase() === "package.json") {
        try {
          packageJson = JSON.parse(text);
        } catch {
          warnings.push("package.json was found but could not be parsed.");
        }
      }
    } catch (err) {
      warnings.push(`Could not read local file ${file.path}: ${err.message}`);
    }
  }

  if (packageJson) {
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
    const keywords = [
      "next",
      "react",
      "vue",
      "svelte",
      "typescript",
      "express",
      "tailwind",
      "prisma",
      "mongodb",
      "postgres",
      "redis",
      "firebase",
      "graphql",
      "fastapi",
      "django",
      "flask",
      "rust",
      "go",
    ];

    keywords.forEach((keyword) => {
      if (deps[keyword] || (packageJson.name && packageJson.name.includes(keyword))) {
        detectedTechStack.push(keyword.charAt(0).toUpperCase() + keyword.slice(1));
      }
    });

    if (packageJson.scripts) {
      detectedFeatures.push(`Configured scripts: ${Object.keys(packageJson.scripts).join(", ")}`);
    }
  }

  if (detectedTechStack.length === 0) {
    const treeStr = fileTreeSummary.join(" ").toLowerCase();
    if (treeStr.includes("requirements.txt") || treeStr.includes("pyproject.toml")) detectedTechStack.push("Python");
    if (treeStr.includes("cargo.toml")) detectedTechStack.push("Rust");
    if (treeStr.includes("go.mod")) detectedTechStack.push("Go");
    if (treeStr.includes("tsconfig.json")) detectedTechStack.push("TypeScript");
    if (treeStr.includes("next.config")) detectedTechStack.push("Next.js");
  }

  let rawContext = "=== REPOSITORY SUMMARY ===\n";
  rawContext += `Local Directory Path: ${redactPathForWarning(resolvedPath)}\n`;
  if (detectedTechStack.length) {
    rawContext += `Detected Stack: ${detectedTechStack.join(", ")}\n`;
  }
  rawContext += `File tree subset:\n${fileTreeSummary.slice(0, 60).map((p) => ` - ${p}`).join("\n")}\n`;
  if (fileTreeSummary.length > 60) {
    rawContext += ` ... and ${fileTreeSummary.length - 60} more files.\n`;
  }

  if (importantFiles.length) {
    rawContext += "\n=== CODE FILE CONTENT DETAILS ===\n";
    for (const file of importantFiles) {
      rawContext += `\n--- File: ${file.path} ---\n${file.content}\n`;
    }
  }

  return {
    repoUrl: redactPathForWarning(resolvedPath),
    owner: "local",
    repo: path.basename(resolvedPath),
    defaultBranch: "local",
    readme: readme || importantFiles.find((file) => file.path.toLowerCase().includes("readme"))?.content || "",
    packageJson,
    detectedTechStack,
    detectedFeatures,
    importantFiles: importantFiles.map((file) => file.path),
    fileTreeSummary,
    rawContext,
    warnings,
  };
}

function isSensitiveFile(filePath) {
  const baseName = path.basename(filePath);
  return SENSITIVE_FILE_PATTERNS.some((pattern) => pattern.test(baseName) || pattern.test(filePath));
}

function looksLikeCredentialUrl(value) {
  return /https?:\/\/[^\s/@]+:[^\s/@]+@/i.test(value) || /[?&](token|access_token|api_key|key)=/i.test(value);
}

function redactPathForWarning(value) {
  return String(value || "").replace(/https?:\/\/([^\s/@]+):([^\s/@]+)@/gi, "https://[redacted]@[redacted]@");
}
