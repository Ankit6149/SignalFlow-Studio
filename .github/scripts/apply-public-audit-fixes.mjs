import fs from "node:fs";
import path from "node:path";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function write(relativePath, content) {
  const target = path.join(root, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.writeFileSync(target, content, "utf8");
}

function replaceRequired(source, search, replacement, label) {
  if (!source.includes(search)) {
    throw new Error(`Could not find required block: ${label}`);
  }
  return source.replace(search, replacement);
}

function replaceBetween(source, startMarker, endMarker, replacement, label) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) {
    throw new Error(`Could not find section: ${label}`);
  }
  return `${source.slice(0, start)}${replacement}${source.slice(end)}`;
}

const clientReliability = `export const MAX_SOURCE_FILES = 12;

const VALID_STAGES = new Set(["source", "destinations", "review"]);

export function resolveStudioStage(requestedStage, { hasSource = false, hasResult = false } = {}) {
  if (!VALID_STAGES.has(requestedStage)) {
    return hasResult ? "review" : hasSource ? "destinations" : "source";
  }
  if (requestedStage === "destinations" && !hasSource) {
    return "source";
  }
  if (requestedStage === "review" && !hasResult) {
    return hasSource ? "destinations" : "source";
  }
  return requestedStage;
}

export function selectAcceptedFiles(pickedFiles, existingCount, maximum = MAX_SOURCE_FILES) {
  const picked = Array.from(pickedFiles || []);
  const remaining = Math.max(0, maximum - Math.max(0, Number(existingCount) || 0));
  return {
    accepted: picked.slice(0, remaining),
    skippedCount: Math.max(0, picked.length - remaining),
    remaining,
  };
}

export function createSourceSnapshot(files, documentText) {
  return {
    sourceFiles: Array.isArray(files)
      ? files.map(({ name, type, size, extracted, description }) => ({
          name: String(name || ""),
          type: String(type || "file"),
          size: Number(size) || 0,
          extracted: Boolean(extracted),
          description: String(description || ""),
        }))
      : [],
    documentText: Array.isArray(documentText)
      ? documentText.map((value) => String(value || "")).filter(Boolean)
      : [],
  };
}

export function restoreSourceSnapshot(item) {
  const sourceFiles = Array.isArray(item?.sourceFiles)
    ? item.sourceFiles
    : Array.isArray(item?.files)
      ? item.files
      : [];
  const documentText = Array.isArray(item?.documentText) ? item.documentText : [];
  return createSourceSnapshot(sourceFiles, documentText);
}
`;
write("frontend/lib/studio/clientReliability.mjs", clientReliability);

const reliabilityTests = `import test from "node:test";
import assert from "node:assert/strict";

import {
  createSourceSnapshot,
  resolveStudioStage,
  restoreSourceSnapshot,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";

test("unknown wizard stages never open a blank review workspace", () => {
  assert.equal(resolveStudioStage("compose"), "source");
  assert.equal(resolveStudioStage("compose", { hasSource: true }), "destinations");
  assert.equal(resolveStudioStage("compose", { hasSource: true, hasResult: true }), "review");
});

test("review and destinations remain guarded by available state", () => {
  assert.equal(resolveStudioStage("destinations"), "source");
  assert.equal(resolveStudioStage("review", { hasSource: true }), "destinations");
  assert.equal(resolveStudioStage("review", { hasSource: true, hasResult: true }), "review");
});

test("file selection keeps metadata and extracted text within one shared limit", () => {
  const picked = Array.from({ length: 5 }, (_, index) => ({ name: `file-${index}` }));
  const result = selectAcceptedFiles(picked, 10, 12);
  assert.deepEqual(result.accepted.map((file) => file.name), ["file-0", "file-1"]);
  assert.equal(result.skippedCount, 3);
});

test("saved campaigns preserve uploaded source context", () => {
  const snapshot = createSourceSnapshot(
    [{ name: "brief.md", type: "text/markdown", size: 20, extracted: true, description: "Extracted" }],
    ["FILE: brief.md\\nProduct evidence"],
  );
  const restored = restoreSourceSnapshot(snapshot);
  assert.deepEqual(restored, snapshot);
});
`;
write("frontend/tests/clientReliability.test.mjs", reliabilityTests);

const urlSafety = `import dns from "node:dns/promises";
import net from "node:net";

function privateFetchesAllowed() {
  return process.env.SIGNALFLOW_ALLOW_PRIVATE_FETCHES === "true";
}

function hostedSafetyRequired() {
  return !privateFetchesAllowed() && (
    process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" ||
    Boolean(process.env.VERCEL) ||
    process.env.NODE_ENV === "production"
  );
}

export function normalizeHttpUrl(input) {
  let normalized = String(input || "").trim();
  if (!normalized) {
    throw new Error("URL is empty.");
  }
  if (!/^https?:\\/\\//i.test(normalized)) {
    normalized = `https://${normalized}`;
  }
  const url = new URL(normalized);
  if (!['http:', 'https:'].includes(url.protocol)) {
    throw new Error("Only http and https URLs are supported.");
  }
  if (url.username || url.password) {
    throw new Error("URLs with embedded credentials are not allowed.");
  }
  return url;
}

export function isBlockedHostname(hostname) {
  const host = String(hostname || "").toLowerCase().replace(/^\\[|\\]$/g, "").replace(/\\.$/, "");
  return (
    !host ||
    host === "localhost" ||
    host.endsWith(".localhost") ||
    host.endsWith(".local") ||
    host.endsWith(".internal") ||
    host === "metadata" ||
    host.includes("metadata.google.internal")
  );
}

export function isPrivateAddress(address) {
  const value = String(address || "").toLowerCase().replace(/^\\[|\\]$/g, "").split("%")[0];
  const version = net.isIP(value);
  if (version === 4) {
    const parts = value.split(".").map(Number);
    const [a, b] = parts;
    return (
      a === 0 ||
      a === 10 ||
      a === 127 ||
      (a === 100 && b >= 64 && b <= 127) ||
      (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) ||
      (a === 192 && b === 168) ||
      (a === 198 && (b === 18 || b === 19)) ||
      a >= 224
    );
  }
  if (version === 6) {
    if (value === "::" || value === "::1") return true;
    if (value.startsWith("fc") || value.startsWith("fd")) return true;
    if (/^fe[89ab]/.test(value)) return true;
    if (value.startsWith("ff")) return true;
    const mapped = value.match(/::ffff:(\\d+\\.\\d+\\.\\d+\\.\\d+)$/);
    return mapped ? isPrivateAddress(mapped[1]) : false;
  }
  return false;
}

export async function assertSafeRemoteUrl(input, { resolveDns = true, forceHostedSafety } = {}) {
  const url = input instanceof URL ? new URL(input.toString()) : normalizeHttpUrl(input);
  const enforce = typeof forceHostedSafety === "boolean" ? forceHostedSafety : hostedSafetyRequired();
  if (!enforce) return url;

  if (url.port && !["80", "443"].includes(url.port)) {
    throw new Error("Non-standard network ports are blocked in hosted mode.");
  }
  if (isBlockedHostname(url.hostname)) {
    throw new Error("Local or internal hostnames are blocked in hosted mode.");
  }
  if (net.isIP(url.hostname.replace(/^\\[|\\]$/g, ""))) {
    if (isPrivateAddress(url.hostname)) {
      throw new Error("Private or reserved IP addresses are blocked in hosted mode.");
    }
    return url;
  }
  if (resolveDns) {
    const answers = await dns.lookup(url.hostname, { all: true, verbatim: true });
    if (!answers.length) {
      throw new Error("The hostname did not resolve to a public address.");
    }
    if (answers.some(({ address }) => isPrivateAddress(address))) {
      throw new Error("The hostname resolves to a private or reserved address.");
    }
  }
  return url;
}
`;
write("frontend/lib/context/urlSafety.mjs", urlSafety);

const urlSafetyTests = `import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSafeRemoteUrl,
  isBlockedHostname,
  isPrivateAddress,
  normalizeHttpUrl,
} from "../lib/context/urlSafety.mjs";

test("URL normalization accepts public web URLs and rejects credentials", () => {
  assert.equal(normalizeHttpUrl("example.com/docs").toString(), "https://example.com/docs");
  assert.throws(() => normalizeHttpUrl("https://user:pass@example.com"), /credentials/i);
});

test("private and reserved network targets are recognized", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "169.254.169.254", "172.16.0.1", "192.168.1.4", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false);
});

test("internal hostname patterns are blocked", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("service.internal"), true);
  assert.equal(isBlockedHostname("example.com"), false);
});

test("direct private URLs fail before network access", async () => {
  await assert.rejects(
    assertSafeRemoteUrl("http://127.0.0.1/admin", { resolveDns: false, forceHostedSafety: true }),
    /private or reserved/i,
  );
  await assert.rejects(
    assertSafeRemoteUrl("http://example.com:8080", { resolveDns: false, forceHostedSafety: true }),
    /ports/i,
  );
});
`;
write("frontend/tests/urlSafety.test.mjs", urlSafetyTests);

const linkFetcher = `import { assertSafeRemoteUrl } from "./urlSafety.mjs";

const MAX_RESPONSE_CHARS = 1_000_000;
const MAX_CONTEXT_CHARS = 10000;
const FETCH_TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = ["text/html", "text/plain", "application/xhtml+xml", "application/xml"];

export async function fetchUrlContent(urlStr) {
  if (!urlStr) return null;

  const result = { url: "", title: "", description: "", text: "", warnings: [] };

  try {
    const { response, finalUrl } = await fetchValidated(urlStr);
    result.url = finalUrl.toString();

    if (!response.ok) {
      throw new Error(`HTTP Error ${response.status}`);
    }

    const contentType = String(response.headers.get("content-type") || "").toLowerCase();
    if (contentType && !ALLOWED_CONTENT_TYPES.some((type) => contentType.includes(type))) {
      throw new Error(`Unsupported response type: ${contentType.split(";")[0]}`);
    }

    const contentLength = Number(response.headers.get("content-length") || 0);
    if (contentLength > MAX_RESPONSE_CHARS) {
      throw new Error("Response is larger than the allowed fetch limit.");
    }

    let html = await response.text();
    if (html.length > MAX_RESPONSE_CHARS) {
      result.warnings.push("Fetched content was truncated before parsing because it exceeded the fetch limit.");
      html = html.substring(0, MAX_RESPONSE_CHARS);
    }

    const titleMatch = html.match(/<title[^>]*>([\\s\\S]*?)<\\/title>/i);
    if (titleMatch?.[1]) result.title = cleanText(titleMatch[1]);

    const descMatch = html.match(/<meta\\s+name=["']description["']\\s+content=["']([\\s\\S]*?)["']/i) ||
      html.match(/<meta\\s+content=["']([\\s\\S]*?)["']\\s+name=["']description["']/i);
    if (descMatch?.[1]) result.description = cleanText(descMatch[1]);

    const bodyMatch = html.match(/<body[^>]*>([\\s\\S]*?)<\\/body>/i);
    let bodyContent = bodyMatch?.[1] || html;
    bodyContent = bodyContent.replace(/<script[^>]*>([\\s\\S]*?)<\\/script>/gi, "");
    bodyContent = bodyContent.replace(/<style[^>]*>([\\s\\S]*?)<\\/style>/gi, "");
    bodyContent = bodyContent.replace(/<!--([\\s\\S]*?)-->/g, "");
    bodyContent = bodyContent.replace(/<\\/p>|<\\/div>|<\\/h[1-6]>|<\\/li>|<\\/tr>/gi, "\\n");

    let plainText = bodyContent.replace(/<[^>]*>/g, " ");
    plainText = decodeHtmlEntities(plainText)
      .split("\\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .join("\\n");

    if (plainText.length > MAX_CONTEXT_CHARS) {
      plainText = `${plainText.substring(0, MAX_CONTEXT_CHARS)}\\n\\n... [Content truncated to fit context budget] ...`;
    }
    result.text = plainText;
  } catch (error) {
    result.url ||= String(urlStr || "").trim();
    result.warnings.push(`Failed to fetch URL content for ${result.url}: ${error.message}`);
  }

  return result;
}

async function fetchValidated(initialUrl) {
  let currentUrl = await assertSafeRemoteUrl(initialUrl);

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(currentUrl.toString(), {
        signal: controller.signal,
        redirect: "manual",
        headers: {
          "User-Agent": "SignalFlowStudio/1.0",
          Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
        },
      });
    } finally {
      clearTimeout(timeoutId);
    }

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: currentUrl };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error("Redirect response did not include a destination.");
    if (redirectCount === MAX_REDIRECTS) throw new Error("Too many redirects.");
    currentUrl = await assertSafeRemoteUrl(new URL(location, currentUrl));
  }

  throw new Error("Unable to resolve the requested URL.");
}

function cleanText(text) {
  return decodeHtmlEntities(String(text || "").replace(/\\s+/g, " ").trim());
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}
`;
write("frontend/lib/context/linkFetcher.js", linkFetcher);

let localRepo = read("frontend/lib/context/localRepo.js");
localRepo = replaceRequired(
  localRepo,
  `const HOSTED_LOCAL_SCAN_WARNING =\n  "Local folder scanning is disabled in public hosted mode. Use a public GitHub URL, uploaded files, manual notes, or local development mode instead.";`,
  `const HOSTED_LOCAL_SCAN_WARNING =\n  "Local folder scanning is disabled in hosted and production mode. Use a public GitHub URL, uploaded files, manual notes, or explicitly enable local scanning on a trusted self-hosted machine.";`,
  "local scan warning",
);
localRepo = replaceRequired(
  localRepo,
  `  if (process.env.SIGNALFLOW_PUBLIC_HOSTED === "true") {\n    return { warnings: [HOSTED_LOCAL_SCAN_WARNING] };\n  }`,
  `  const hostedRuntime = process.env.SIGNALFLOW_PUBLIC_HOSTED === "true" || Boolean(process.env.VERCEL);\n  const productionWithoutOptIn =\n    process.env.NODE_ENV === "production" && process.env.SIGNALFLOW_ENABLE_LOCAL_REPO_SCAN !== "true";\n\n  if (hostedRuntime || productionWithoutOptIn) {\n    return { warnings: [HOSTED_LOCAL_SCAN_WARNING] };\n  }`,
  "local scan fail-closed guard",
);
write("frontend/lib/context/localRepo.js", localRepo);

let tokenStore = read("frontend/lib/social/tokenStore.js");
tokenStore = replaceBetween(
  tokenStore,
  "function getEncryptionKey() {",
  "function encrypt(value) {",
  `function getEncryptionKey() {\n  const seed = process.env.SOCIAL_ENCRYPTION_KEY || process.env.SIGNALFLOW_ACCESS_KEY;\n  if (!seed) {\n    throw new Error(\n      "Social token encryption is not configured. Set SOCIAL_ENCRYPTION_KEY or SIGNALFLOW_ACCESS_KEY before enabling OAuth connectors.",\n    );\n  }\n  return crypto.createHash("sha256").update(String(seed)).digest().subarray(0, 32);\n}\n\n`,
  "social encryption key",
);
write("frontend/lib/social/tokenStore.js", tokenStore);

let socialConfig = read("frontend/lib/social/socialConfig.js");
socialConfig = replaceRequired(
  socialConfig,
  `  return requiredKeys.every((key) => Boolean(process.env[key]));`,
  `  const encryptionConfigured = Boolean(\n    process.env.SOCIAL_ENCRYPTION_KEY || process.env.SIGNALFLOW_ACCESS_KEY,\n  );\n  return encryptionConfigured && requiredKeys.every((key) => Boolean(process.env[key]));`,
  "social configuration encryption gate",
);
write("frontend/lib/social/socialConfig.js", socialConfig);

const sessionRoute = `import {
  clearSessionCookie,
  createSessionCookie,
  createSessionToken,
  requireOwnerAccess,
} from "../_auth";

export async function GET(request) {
  const locked = Boolean(process.env.SIGNALFLOW_ACCESS_KEY);
  return new Response(
    JSON.stringify({
      authenticated: requireOwnerAccess(request) === null,
      locked,
    }),
    { status: 200, headers: { "Content-Type": "application/json" } },
  );
}

export async function POST(request) {
  const expected = process.env.SIGNALFLOW_ACCESS_KEY;

  if (!expected) {
    return new Response(
      JSON.stringify({ authenticated: true, locked: false, message: "Access lock is disabled for this deployment." }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }

  const accessKeyAccepted = body?.access_key === expected;
  if (!accessKeyAccepted) {
    const accessError = requireOwnerAccess(request);
    if (accessError) {
      return new Response(JSON.stringify({ error: "Invalid or expired owner session." }), {
        status: 401,
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  const token = createSessionToken();
  return new Response(
    JSON.stringify({ authenticated: true, locked: true, expires_in_days: 30 }),
    {
      status: 200,
      headers: {
        "Content-Type": "application/json",
        "Set-Cookie": createSessionCookie(token),
      },
    },
  );
}

export async function DELETE() {
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: {
      "Content-Type": "application/json",
      "Set-Cookie": clearSessionCookie(),
    },
  });
}
`;
write("frontend/app/api/session/route.js", sessionRoute);

let page = read("frontend/app/page.js");
page = replaceRequired(
  page,
  `import PlatformIcon from "../components/PlatformIcon";`,
  `import PlatformIcon from "../components/PlatformIcon";\nimport {\n  createSourceSnapshot,\n  resolveStudioStage,\n  restoreSourceSnapshot,\n  selectAcceptedFiles,\n} from "../lib/studio/clientReliability.mjs";`,
  "client reliability import",
);
page = page.replace(`const ACCESS_TOKEN_KEY = "signalflow_owner_token";`, `const LEGACY_ACCESS_TOKEN_KEY = "signalflow_owner_token";`);
page = page.replace(
  `{ id: "template", label: "Local template", hint: "Works instantly. No key required." },`,
  `{ id: "template", label: "Local sample template", hint: "Deterministic sample copy for testing the workflow. Choose a model provider for production-quality content." },`,
);
page = replaceRequired(
  page,
  `function downloadText(filename, value, type = "text/plain") {`,
  `async function readJsonResponse(response, fallbackMessage) {\n  const text = await response.text();\n  const parsed = safeJsonParse(text, null);\n  if (parsed && typeof parsed === "object") return parsed;\n  throw new Error(response.ok ? fallbackMessage : \`${fallbackMessage} (HTTP \${response.status})\`);\n}\n\nfunction downloadText(filename, value, type = "text/plain") {`,
  "safe response parser",
);
page = replaceRequired(
  page,
  `    setAccessToken(window.localStorage.getItem(ACCESS_TOKEN_KEY) || "");\n    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));`,
  `    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));\n    void syncOwnerSession();`,
  "session initialization",
);
page = replaceBetween(
  page,
  "  function authHeaders(extra = {}) {",
  "  function enterStudio() {",
  `  async function syncOwnerSession() {\n    try {\n      const response = await fetch("/api/session");\n      const data = await readJsonResponse(response, "SignalFlow could not verify the owner session.");\n      setAccessToken(data.authenticated ? "cookie-session" : "");\n    } catch {\n      setAccessToken("");\n    }\n  }\n\n  function authHeaders(extra = {}) {\n    return { ...extra };\n  }\n\n`,
  "cookie session synchronization",
);
page = replaceBetween(
  page,
  "  function navigateStudioFlow(targetStage) {",
  "  function toggleChannel(channelId) {",
  `  function navigateStudioFlow(targetStage) {\n    const nextStage = resolveStudioStage(targetStage, {\n      hasSource: sourceSignals > 0,\n      hasResult: Boolean(result),\n    });\n    setStage(nextStage);\n    window.requestAnimationFrame(() => {\n      window.requestAnimationFrame(() => {\n        document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });\n      });\n    });\n  }\n\n`,
  "wizard stage guard",
);
page = replaceBetween(
  page,
  "  async function handleFiles(event) {",
  "  function removeFile(index) {",
  `  async function handleFiles(event) {\n    const picked = Array.from(event.target.files || []);\n    if (!picked.length) return;\n\n    const { accepted, skippedCount } = selectAcceptedFiles(picked, files.length);\n    if (!accepted.length) {\n      setMessage({ type: "warning", text: "SignalFlow accepts up to 12 source files per campaign. Remove one before adding another." });\n      event.target.value = "";\n      return;\n    }\n\n    const nextFiles = [];\n    const nextText = [];\n    for (const file of accepted) {\n      const isText =\n        file.type.startsWith("text/") ||\n        /\\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);\n      let extracted = false;\n      if (isText && file.size <= 500000) {\n        try {\n          const text = await file.text();\n          nextText.push(\`FILE: \${file.name}\\n\${text.slice(0, 12000)}\`);\n          extracted = true;\n        } catch {\n          nextText.push(\`FILE: \${file.name} (browser extraction failed)\`);\n        }\n      }\n      nextFiles.push({\n        name: file.name,\n        type: file.type || "file",\n        size: file.size,\n        extracted,\n        description: extracted\n          ? "Text content extracted in the browser."\n          : "Asset metadata supplied as a creative reference; visual analysis is not enabled in this route.",\n      });\n    }\n\n    setFiles((previous) => [...previous, ...nextFiles]);\n    setDocumentText((previous) => [...previous, ...nextText]);\n\n    if (skippedCount > 0) {\n      setMessage({ type: "warning", text: \`Added \${accepted.length} file\${accepted.length === 1 ? "" : "s"}; skipped \${skippedCount} because the campaign limit is 12.\` });\n    } else if (nextText.length === 0) {\n      setMessage({ type: "warning", text: "The files were added as asset references only. Add a written brief because visual analysis is not enabled in this route yet." });\n    }\n    event.target.value = "";\n  }\n\n`,
  "consistent file ingestion",
);

const generateStart = page.indexOf("  async function generateCampaign() {");
const generateEnd = page.indexOf("  function saveCampaign() {", generateStart);
let generateSection = page.slice(generateStart, generateEnd);
generateSection = generateSection.replace(
  "      const data = await response.json();",
  "      const data = await readJsonResponse(response, \"SignalFlow returned an unreadable generation response.\");",
);
page = `${page.slice(0, generateStart)}${generateSection}${page.slice(generateEnd)}`;

page = replaceBetween(
  page,
  "  function saveCampaign() {",
  "  function openCampaign(item) {",
  `  function saveCampaign() {\n    if (!result) return;\n    const now = new Date().toISOString();\n    const item = {\n      id: \`campaign-\${Date.now()}\`,\n      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",\n      createdAt: now,\n      updatedAt: now,\n      channels: [...channels],\n      posts: { ...posts },\n      providerUsed: result.providerUsed,\n      fallbackUsed: Boolean(result.fallbackUsed),\n      warnings: result.warnings || [],\n      markdown: result.markdown || "",\n      result,\n      brief: { ...form, apiKey: "" },\n      publishOptions,\n      ...createSourceSnapshot(files, documentText),\n    };\n    const next = [item, ...library.filter((entry) => entry.title !== item.title)].slice(0, 30);\n    try {\n      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));\n      setLibrary(next);\n      setMessage({ type: "success", text: "Campaign saved to your local library." });\n    } catch {\n      setMessage({ type: "error", text: "The browser could not save this campaign. Export it before leaving this page." });\n    }\n  }\n\n`,
  "reliable local save",
);
page = replaceRequired(
  page,
  `    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });\n    setActiveChannel((item.channels || ["linkedin"])[0]);`,
  `    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });\n    const restoredSource = restoreSourceSnapshot(item);\n    setFiles(restoredSource.sourceFiles);\n    setDocumentText(restoredSource.documentText);\n    setActiveChannel((item.channels || ["linkedin"])[0]);`,
  "restore saved sources",
);
page = replaceBetween(
  page,
  "  function deleteCampaign(id) {",
  "  async function copyCurrentPost(showMessage = true) {",
  `  function deleteCampaign(id) {\n    if (!window.confirm("Delete this saved campaign from the current browser?")) return;\n    const next = library.filter((item) => item.id !== id);\n    try {\n      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));\n      setLibrary(next);\n    } catch {\n      setMessage({ type: "error", text: "The browser could not update the local campaign library." });\n    }\n  }\n\n`,
  "confirmed campaign deletion",
);
page = replaceBetween(
  page,
  "  async function copyAndOpenCurrent() {",
  "  function exportMarkdown() {",
  `  async function copyAndOpenCurrent() {\n    let openedWindow = null;\n    if (activeMeta.openUrl) {\n      openedWindow = window.open(activeMeta.openUrl, "_blank");\n      if (openedWindow) openedWindow.opener = null;\n    }\n\n    const copied = await copyCurrentPost(false);\n    if (!copied) return;\n\n    if (activeMeta.openUrl) {\n      setMessage({\n        type: openedWindow ? "success" : "warning",\n        text: openedWindow\n          ? \`\${activeMeta.label} draft copied. The platform was opened in a new tab.\`\n          : \`\${activeMeta.label} draft copied, but the browser blocked the new tab. Open the platform manually.\`,\n      });\n      return;\n    }\n\n    setMessage({ type: "success", text: \`\${activeMeta.label} draft copied. Paste it into your publishing tool.\` });\n  }\n\n`,
  "popup-safe copy and open",
);

for (const [functionName, fallback] of [
  ["publishCurrentPost", "SignalFlow returned an unreadable publishing response."],
  ["refreshConnections", "SignalFlow returned an unreadable connector response."],
  ["disconnectPlatform", "SignalFlow returned an unreadable disconnect response."],
  ["unlockOwnerSession", "SignalFlow returned an unreadable session response."],
]) {
  const start = page.indexOf(`  async function ${functionName}(`);
  const next = page.indexOf("\n  }", start);
  const blockEnd = next >= 0 ? next + 4 : -1;
  if (start < 0 || blockEnd < 0) throw new Error(`Could not locate ${functionName}`);
  const block = page.slice(start, blockEnd).replace(
    "const data = await response.json();",
    `const data = await readJsonResponse(response, "${fallback}");`,
  );
  page = `${page.slice(0, start)}${block}${page.slice(blockEnd)}`;
}

page = replaceBetween(
  page,
  "  async function unlockOwnerSession() {",
  "  async function lockOwnerSession() {",
  `  async function unlockOwnerSession() {\n    if (!ownerKey.trim()) return;\n    setBusy(true);\n    setMessage(null);\n    try {\n      const response = await fetch("/api/session", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ access_key: ownerKey.trim() }),\n      });\n      const data = await readJsonResponse(response, "SignalFlow returned an unreadable session response.");\n      if (!response.ok) throw new Error(data.error || "The owner key was not accepted.");\n      setAccessToken(data.authenticated ? "cookie-session" : "");\n      window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n      window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n      setOwnerKey("");\n      setMessage({\n        type: "success",\n        text: data.locked === false ? "Access lock is disabled for this deployment." : "Owner session unlocked.",\n      });\n    } catch (error) {\n      setMessage({ type: "error", text: error.message });\n    } finally {\n      setBusy(false);\n    }\n  }\n\n`,
  "cookie-only owner unlock",
);
page = replaceBetween(
  page,
  "  async function lockOwnerSession() {",
  "  if (!entered) return <LandingPage onEnter={enterStudio} />;",
  `  async function lockOwnerSession() {\n    await fetch("/api/session", { method: "DELETE" }).catch(() => null);\n    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    setAccessToken("");\n    setConnections({});\n    setMessage({ type: "success", text: "Owner session closed." });\n  }\n\n`,
  "cookie-only owner lock",
);
page = page.replace(`setStage(result ? "review" : "compose");`, `setStage(result ? "review" : sourceSignals > 0 ? "destinations" : "source");`);
page = replaceRequired(
  page,
  `                      {composeReady\n                        ? "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."\n                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}`,
  `                      {composeReady\n                        ? form.provider === "template"\n                          ? "Ready to test the workflow. Local sample mode is deterministic and intentionally limited; choose a model provider for production-quality content."\n                          : "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."\n                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}`,
  "template quality disclosure",
);
write("frontend/app/page.js", page);

fs.rmSync(path.join(root, ".github/scripts/apply-public-audit-fixes.mjs"), { force: true });
fs.rmSync(path.join(root, ".github/workflows/apply-public-audit-fixes.yml"), { force: true });

console.log("Applied public product reliability and security fixes.");
