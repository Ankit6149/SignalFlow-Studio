from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    target = ROOT / path
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return content.replace(old, new, 1)


def patch_runtime() -> None:
    path = "frontend/app/layout.js"
    content = read(path)
    content = replace_once(
        content,
        'import SessionBridge from "../components/SessionBridge";',
        'import WorkspaceAccessibility from "../components/WorkspaceAccessibility";',
        "layout runtime import",
    )
    content = replace_once(content, "<SessionBridge />", "<WorkspaceAccessibility />", "layout runtime mount")
    write(path, content)

    path = "frontend/app/page.js"
    content = read(path)
    content = replace_once(content, 'const LEGACY_ACCESS_TOKEN_KEY = "signalflow_owner_token";\n', "", "legacy token constant")
    local_removal = "    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n"
    session_removal = "    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n"
    if content.count(local_removal) != 3:
        raise RuntimeError(f"legacy localStorage cleanup count: {content.count(local_removal)}")
    if content.count(session_removal) != 3:
        raise RuntimeError(f"legacy sessionStorage cleanup count: {content.count(session_removal)}")
    content = content.replace(local_removal, "")
    content = content.replace(session_removal, "")
    write(path, content)

    path = "frontend/components/ContentPackageCreationFlow.js"
    content = read(path)
    old = '''      const token = typeof window !== "undefined" ? window.localStorage.getItem("signalflow_owner_token") || "" : "";
      const authHeaders = token ? { "Authorization": `Bearer ${token}` } : {};
      const resp = await fetch("/api/launch_kit", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders },'''
    new = '''      const resp = await fetch("/api/launch_kit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },'''
    content = replace_once(content, old, new, "legacy bearer caller")
    write(path, content)


def remove_playwright_capture() -> None:
    path = "frontend/lib/capture/types.js"
    content = read(path)
    old = '''  },
  playwright: {
    id: "playwright",
    label: "Remote Playwright Screenshot (Experimental)",
    description: "Automated headless browser screenshot of the live app URL.",
    requiresBrowserMedia: false,
    requiresServerSide: true
  }
};
'''
    new = '''  }
};
'''
    content = replace_once(content, old, new, "Playwright capture provider")
    write(path, content)

    for path in [
        "frontend/components/SessionBridge.js",
        "frontend/lib/capture/appCapture.js",
        "frontend/app/api/capture/app/route.js",
    ]:
        target = ROOT / path
        if not target.exists():
            raise RuntimeError(f"missing cleanup target: {path}")
        target.unlink()


def fix_markdown() -> None:
    path = "frontend/lib/export/markdown.js"
    content = read(path)
    block = '''  if (Array.isArray(media.screenshotPlan) && media.screenshotPlan.length) {
    md += `### Screenshot Plan\\n`;
    media.screenshotPlan.forEach(sp => { md += `- [ ] ${sp}\\n`; });
    md += `\\n`;
  }

'''
    if content.count(block) != 2:
        raise RuntimeError(f"duplicate Screenshot Plan block count: {content.count(block)}")
    first = content.find(block)
    second = content.find(block, first + len(block))
    content = content[:second] + content[second + len(block):]
    if content.count(block) != 1:
        raise RuntimeError("Screenshot Plan must remain exactly once")
    write(path, content)


def write_tests() -> None:
    write("frontend/tests/productionCleanup.test.mjs", r'''import assert from "node:assert/strict";
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
  assert.match(page, /async function handleFiles\(event\)/);
  assert.match(legacyFlow, /useRecorder/);
  assert.match(legacyFlow, /fetch\("\/api\/launch_kit"/);
});
''')

    write("frontend/tests/markdownExportIntegrity.test.mjs", r'''import assert from "node:assert/strict";
import test from "node:test";

import { buildMarkdown } from "../lib/export/markdown.js";
import { projectCampaignMarkdown } from "../lib/export/campaignExport.mjs";
import { campaignInput } from "./campaignFixtures.mjs";

function occurrences(value, pattern) {
  return [...value.matchAll(pattern)].length;
}

function packageFixture(media = {}) {
  return {
    project: { name: "SignalFlow", description: "Review-first campaign studio", audience: "builders" },
    context: {},
    strategy: {},
    posts: {
      linkedin: { body: "Edited launch draft" },
      x: { posts: ["Edited thread draft"] },
    },
    media,
    publishing: {},
  };
}

test("legacy Markdown emits Screenshot Plan exactly once when present", () => {
  const markdown = buildMarkdown({
    projectName: "SignalFlow",
    package: packageFixture({ screenshotPlan: ["Capture the Review workspace"] }),
  });
  assert.equal(occurrences(markdown, /^### Screenshot Plan$/gm), 1);
  assert.equal(occurrences(markdown, /^- \[ \] Capture the Review workspace$/gm), 1);
});

test("legacy Markdown omits an empty Screenshot Plan cleanly", () => {
  const markdown = buildMarkdown({ projectName: "SignalFlow", package: packageFixture({ screenshotPlan: [] }) });
  assert.equal(occurrences(markdown, /^### Screenshot Plan$/gm), 0);
});

test("canonical Markdown is deterministic and uses current edited drafts once", () => {
  const input = campaignInput();
  const first = projectCampaignMarkdown(input).content;
  const second = projectCampaignMarkdown(input).content;
  assert.equal(first, second);
  assert.equal(occurrences(first, /^### Screenshot plan$/gm), 1);
  assert.equal(occurrences(first, /Edited LinkedIn draft — authoritative\./g), 1);
  assert.equal(occurrences(first, /Edited X draft — authoritative\./g), 1);
  assert.equal(occurrences(first, /Edited blog draft — authoritative\./g), 1);
  assert.doesNotMatch(first, /Original structured duplicate\./);
});
''')

    path = "frontend/tests/workspaceAccessibility.test.mjs"
    content = read(path)
    content = replace_once(
        content,
        'const runtimeUrl = new URL("../components/SessionBridge.js", import.meta.url);',
        'const runtimeUrl = new URL("../app/layout.js", import.meta.url);',
        "accessibility runtime path",
    )
    content = replace_once(
        content,
        '  assert.match(runtime, /import WorkspaceAccessibility from "\\.\\/WorkspaceAccessibility"/);\n  assert.match(runtime, /return <WorkspaceAccessibility \\/>/);',
        '  assert.match(runtime, /import WorkspaceAccessibility from "\\.\\.\\/components\\/WorkspaceAccessibility"/);\n  assert.match(runtime, /<WorkspaceAccessibility \\/>/);\n  assert.doesNotMatch(runtime, /SessionBridge/);',
        "accessibility direct runtime assertions",
    )
    write(path, content)


def main() -> None:
    patch_runtime()
    remove_playwright_capture()
    fix_markdown()
    write_tests()


if __name__ == "__main__":
    main()
