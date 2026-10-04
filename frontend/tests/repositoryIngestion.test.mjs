import assert from "node:assert/strict";
import test from "node:test";

import { parseGitHubUrl } from "../lib/context/githubUrl.mjs";
import {
  classifyRepositoryFile,
  getFilePriorityScore,
  planRepositoryFiles,
  shouldIncludeFile,
} from "../lib/context/fileFilter.js";
import { validateGenerationInputs } from "../lib/package/validatePackage.js";

const validVariants = [
  "https://github.com/owner/repo",
  "https://www.github.com/owner/repo/",
  "github.com/owner/repo.git",
  "https://github.com/owner/repo/tree/main",
  "https://github.com/owner/repo/blob/main/package.json",
];

test("GitHub repository variants share one canonical identity", () => {
  for (const value of validVariants) {
    const parsed = parseGitHubUrl(value);
    assert.ok(parsed, value);
    assert.equal(parsed.owner, "owner");
    assert.equal(parsed.repo, "repo");
    assert.equal(parsed.canonicalUrl, "https://github.com/owner/repo");
  }

  assert.equal(parseGitHubUrl(validVariants[3]).branch, "main");
  assert.equal(parseGitHubUrl(validVariants[4]).path, "package.json");
});

test("GitHub repository parsing rejects unsafe and incomplete inputs", () => {
  for (const value of [
    "https://gitlab.com/owner/repo",
    "https://github.com/owner",
    "https://user:secret@github.com/owner/repo",
    "https://github.com:8443/owner/repo",
    "https://github.com/owner/repo/issues/1",
  ]) {
    assert.equal(parseGitHubUrl(value), null, value);
  }
});

test("generation validation uses the canonical GitHub parser", () => {
  assert.equal(validateGenerationInputs({ repo: "https://www.github.com/owner/repo" }).valid, true);
  const invalid = validateGenerationInputs({ repo: "https://example.com/owner/repo" });
  assert.equal(invalid.valid, false);
  assert.match(invalid.errors.join("\n"), /public repository/i);
});

test("nested application roots outrank documentation", () => {
  assert.equal(classifyRepositoryFile("frontend/app/api/generate/route.js"), "entrypoint");
  assert.equal(classifyRepositoryFile("web/src/components/Editor.tsx"), "source");
  assert.ok(getFilePriorityScore("frontend/app/page.js") > getFilePriorityScore("docs/architecture.md"));
  assert.equal(shouldIncludeFile("frontend/public/logo.png"), false);
});

test("repository planning is deterministic, representative, and bounded", () => {
  const files = [
    { path: "README.md", size: 2000 },
    { path: "docs/architecture.md", size: 4000 },
    { path: "docs/product.md", size: 4000 },
    { path: "frontend/package.json", size: 1000 },
    { path: "frontend/app/page.js", size: 9000 },
    { path: "frontend/app/api/generate/route.js", size: 7000 },
    { path: "frontend/src/components/Editor.tsx", size: 6000 },
    { path: "frontend/src/lib/export.ts", size: 5000 },
    { path: "backend/src/server.py", size: 5000 },
    { path: "frontend/tests/editor.test.mjs", size: 3000 },
    { path: "frontend/public/hero.png", size: 20000 },
    { path: "frontend/src/huge.ts", size: 120000 },
  ];

  const first = planRepositoryFiles(files, { maxFiles: 8, maxFileBytes: 100000, maxTotalBytes: 50000 });
  const second = planRepositoryFiles([...files].reverse(), { maxFiles: 8, maxFileBytes: 100000, maxTotalBytes: 50000 });
  const selected = first.files.map((file) => file.path);

  assert.deepEqual(selected, second.files.map((file) => file.path));
  assert.ok(selected.includes("frontend/app/page.js"));
  assert.ok(selected.includes("frontend/app/api/generate/route.js"));
  assert.ok(selected.includes("frontend/src/components/Editor.tsx"));
  assert.ok(first.diagnostics.selectedBytes <= 50000);
  assert.ok(first.diagnostics.skipped.some((item) => item.path.endsWith("hero.png")));
  assert.ok(first.diagnostics.skipped.some((item) => item.path.endsWith("huge.ts") && item.reason === "file_budget"));
});
