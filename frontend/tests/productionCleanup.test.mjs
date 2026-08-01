import assert from "node:assert/strict";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const frontendRoot = fileURLToPath(new URL("..", import.meta.url));

async function sourceFiles(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(fullPath));
    else if (/\.(?:js|mjs)$/.test(entry.name)) files.push(fullPath);
  }
  return files;
}

async function exists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

test("legacy bearer-token migration is fully retired in favor of the HTTP-only session", async () => {
  const layout = await readFile(path.join(frontendRoot, "app/layout.js"), "utf8");
  const page = await readFile(path.join(frontendRoot, "app/page.js"), "utf8");
  const sessionRoute = await readFile(path.join(frontendRoot, "app/api/session/route.js"), "utf8");
  const activeFiles = [
    ...await sourceFiles(path.join(frontendRoot, "app")),
    ...await sourceFiles(path.join(frontendRoot, "components")),
    ...await sourceFiles(path.join(frontendRoot, "lib")),
  ];
  const activeSource = (await Promise.all(activeFiles.map((file) => readFile(file, "utf8")))).join("\n");

  assert.equal(await exists(path.join(frontendRoot, "components/SessionBridge.js")), false);
  assert.match(layout, /import WorkspaceAccessibility from "\.\.\/components\/WorkspaceAccessibility";/);
  assert.match(layout, /<WorkspaceAccessibility \/>/);
  assert.doesNotMatch(layout, /SessionBridge/);
  assert.doesNotMatch(activeSource, /signalflow_owner_token|signalflow_owner_cookie_synced|data\.token/);
  assert.match(sessionRoute, /Set-Cookie/);
  assert.doesNotMatch(sessionRoute, /JSON\.stringify\(\{\s*token\s*:/s);
  assert.match(page, /body:\s*JSON\.stringify\(\{\s*access_key:\s*ownerKey\.trim\(\)/s);
  assert.match(page, /function authHeaders\(extra = \{\}\) \{\s*return \{ \.\.\.extra \};\s*\}/s);
});

test("unsupported Playwright capture is absent from the production graph", async () => {
  const routePath = path.join(frontendRoot, "app/api/capture/app/route.js");
  const helperPath = path.join(frontendRoot, "lib/capture/appCapture.js");
  const captureTypes = await import("../lib/capture/types.js");
  const packageManifest = JSON.parse(await readFile(path.join(frontendRoot, "package.json"), "utf8"));
  const packageLock = JSON.parse(await readFile(path.join(frontendRoot, "package-lock.json"), "utf8"));
  const page = await readFile(path.join(frontendRoot, "app/page.js"), "utf8");
  const legacyFlow = await readFile(path.join(frontendRoot, "components/ContentPackageCreationFlow.js"), "utf8");
  const activeFiles = [
    ...await sourceFiles(path.join(frontendRoot, "app")),
    ...await sourceFiles(path.join(frontendRoot, "components")),
    ...await sourceFiles(path.join(frontendRoot, "lib")),
  ];
  const activeSource = (await Promise.all(activeFiles.map((file) => readFile(file, "utf8")))).join("\n");

  assert.equal(await exists(routePath), false);
  assert.equal(await exists(helperPath), false);
  assert.deepEqual(Object.keys(captureTypes.CAPTURE_PROVIDERS), ["manual", "browser"]);
  assert.equal(packageManifest.dependencies?.playwright, undefined);
  assert.equal(packageManifest.devDependencies?.playwright, undefined);
  assert.equal(packageLock.packages?.[""]?.dependencies?.playwright, undefined);
  assert.equal(packageLock.packages?.[""]?.devDependencies?.playwright, undefined);
  assert.doesNotMatch(activeSource, /captureAppScreenshot|\/api\/capture\/app|from\s+["']playwright["']/);
  assert.doesNotMatch(activeSource, /Remote Playwright Screenshot|Screenshot capture skipped/i);
  assert.match(page, /async function handleFiles\(event\)/);
  assert.match(legacyFlow, /useRecorder/);
  assert.match(legacyFlow, /fetch\("\/api\/launch_kit"/);
});
