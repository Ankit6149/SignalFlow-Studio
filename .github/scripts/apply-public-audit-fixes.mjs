import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const pagePath = path.join(root, "frontend/app/page.js");
let page = fs.readFileSync(pagePath, "utf8");

function replaceRequired(search, replacement, label) {
  if (!page.includes(search)) throw new Error(`Missing page block: ${label}`);
  page = page.replace(search, replacement);
}

function replaceBetween(startMarker, endMarker, replacement, label) {
  const start = page.indexOf(startMarker);
  const end = page.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing page section: ${label}`);
  page = `${page.slice(0, start)}${replacement}${page.slice(end)}`;
}

replaceRequired(
  `import PlatformIcon from "../components/PlatformIcon";`,
  `import PlatformIcon from "../components/PlatformIcon";\nimport {\n  createSourceSnapshot,\n  resolveStudioStage,\n  restoreSourceSnapshot,\n  selectAcceptedFiles,\n} from "../lib/studio/clientReliability.mjs";`,
  "client reliability import",
);

replaceRequired(
  `const ACCESS_TOKEN_KEY = "signalflow_owner_token";`,
  `const LEGACY_ACCESS_TOKEN_KEY = "signalflow_owner_token";`,
  "legacy owner token constant",
);

replaceRequired(
  `{ id: "template", label: "Local template", hint: "Works instantly. No key required." },`,
  `{ id: "template", label: "Local sample template", hint: "Deterministic sample copy for testing the workflow. Choose a model provider for production-quality content." },`,
  "template route disclosure",
);

replaceRequired(
  `function downloadText(filename, value, type = "text/plain") {`,
  `async function readJsonResponse(response, fallbackMessage) {\n  const text = await response.text();\n  const parsed = safeJsonParse(text, null);\n  if (parsed && typeof parsed === "object") return parsed;\n  throw new Error(response.ok ? fallbackMessage : \`${fallbackMessage} (HTTP \${response.status})\`);\n}\n\nfunction downloadText(filename, value, type = "text/plain") {`,
  "safe JSON response reader",
);

replaceRequired(
  `    setAccessToken(window.localStorage.getItem(ACCESS_TOKEN_KEY) || "");\n    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));`,
  `    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));\n    void syncOwnerSession();`,
  "cookie session initialization",
);

replaceBetween(
  "  function authHeaders(extra = {}) {",
  "  function enterStudio() {",
  `  async function syncOwnerSession() {\n    try {\n      const response = await fetch("/api/session");\n      const data = await readJsonResponse(response, "SignalFlow could not verify the owner session.");\n      setAccessToken(data.authenticated ? "cookie-session" : "");\n    } catch {\n      setAccessToken("");\n    }\n  }\n\n  function authHeaders(extra = {}) {\n    return { ...extra };\n  }\n\n`,
  "cookie-only owner session",
);

replaceBetween(
  "  function navigateStudioFlow(targetStage) {",
  "  function toggleChannel(channelId) {",
  `  function navigateStudioFlow(targetStage) {\n    const nextStage = resolveStudioStage(targetStage, {\n      hasSource: sourceSignals > 0,\n      hasResult: Boolean(result),\n    });\n    setStage(nextStage);\n    window.requestAnimationFrame(() => {\n      window.requestAnimationFrame(() => {\n        document.getElementById("workspace-content")?.scrollIntoView({ behavior: "smooth", block: "start" });\n      });\n    });\n  }\n\n`,
  "wizard stage guard",
);

replaceBetween(
  "  async function handleFiles(event) {",
  "  function removeFile(index) {",
  `  async function handleFiles(event) {\n    const picked = Array.from(event.target.files || []);\n    if (!picked.length) return;\n\n    const { accepted, skippedCount } = selectAcceptedFiles(picked, files.length);\n    if (!accepted.length) {\n      setMessage({ type: "warning", text: "SignalFlow accepts up to 12 source files per campaign. Remove one before adding another." });\n      event.target.value = "";\n      return;\n    }\n\n    const nextFiles = [];\n    const nextText = [];\n    let extractionFailures = 0;\n    for (const file of accepted) {\n      const isText =\n        file.type.startsWith("text/") ||\n        /\\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);\n      let extracted = false;\n      if (isText && file.size <= 500000) {\n        try {\n          const text = await file.text();\n          nextText.push(\`FILE: \${file.name}\\n\${text.slice(0, 12000)}\`);\n          extracted = true;\n        } catch {\n          extractionFailures += 1;\n        }\n      }\n      nextFiles.push({\n        name: file.name,\n        type: file.type || "file",\n        size: file.size,\n        extracted,\n        description: extracted\n          ? "Text content extracted in the browser."\n          : isText && file.size <= 500000\n            ? "Browser extraction failed; the file remains an asset reference."\n            : "Asset metadata supplied as a creative reference; visual analysis is not enabled in this route.",\n      });\n    }\n\n    setFiles((previous) => [...previous, ...nextFiles]);\n    setDocumentText((previous) => [...previous, ...nextText]);\n\n    if (skippedCount > 0) {\n      setMessage({ type: "warning", text: \`Added \${accepted.length} file\${accepted.length === 1 ? "" : "s"}; skipped \${skippedCount} because the campaign limit is 12.\` });\n    } else if (extractionFailures > 0) {\n      setMessage({ type: "warning", text: \`Added the files, but \${extractionFailures} text file\${extractionFailures === 1 ? "" : "s"} could not be extracted in this browser.\` });\n    } else if (nextText.length === 0) {\n      setMessage({ type: "warning", text: "The files were added as asset references only. Add a written brief because visual analysis is not enabled in this route yet." });\n    }\n    event.target.value = "";\n  }\n\n`,
  "consistent file ingestion",
);

function replaceInFunction(startMarker, endMarker, search, replacement, label) {
  const start = page.indexOf(startMarker);
  const end = page.indexOf(endMarker, start + startMarker.length);
  if (start < 0 || end < 0) throw new Error(`Missing function section: ${label}`);
  const section = page.slice(start, end);
  if (!section.includes(search)) throw new Error(`Missing function statement: ${label}`);
  page = `${page.slice(0, start)}${section.replace(search, replacement)}${page.slice(end)}`;
}

replaceInFunction(
  "  async function generateCampaign() {",
  "  function saveCampaign() {",
  `      const data = await response.json();`,
  `      const data = await readJsonResponse(response, "SignalFlow returned an unreadable generation response.");`,
  "generation response",
);

replaceBetween(
  "  function saveCampaign() {",
  "  function openCampaign(item) {",
  `  function saveCampaign() {\n    if (!result) return;\n    const now = new Date().toISOString();\n    const item = {\n      id: \`campaign-\${Date.now()}\`,\n      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",\n      createdAt: now,\n      updatedAt: now,\n      channels: [...channels],\n      posts: { ...posts },\n      providerUsed: result.providerUsed,\n      fallbackUsed: Boolean(result.fallbackUsed),\n      warnings: result.warnings || [],\n      markdown: result.markdown || "",\n      result,\n      brief: { ...form, apiKey: "" },\n      publishOptions,\n      ...createSourceSnapshot(files, documentText),\n    };\n    const next = [item, ...library.filter((entry) => entry.title !== item.title)].slice(0, 30);\n    try {\n      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));\n      setLibrary(next);\n      setMessage({ type: "success", text: "Campaign saved to your local library." });\n    } catch {\n      setMessage({ type: "error", text: "The browser could not save this campaign. Export it before leaving this page." });\n    }\n  }\n\n`,
  "source-preserving campaign save",
);

replaceRequired(
  `    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });\n    setActiveChannel((item.channels || ["linkedin"])[0]);`,
  `    setPublishOptions(item.publishOptions || { reddit: { subreddit: "", title: "" } });\n    const restoredSource = restoreSourceSnapshot(item);\n    setFiles(restoredSource.sourceFiles);\n    setDocumentText(restoredSource.documentText);\n    setActiveChannel((item.channels || ["linkedin"])[0]);`,
  "saved source restoration",
);

replaceBetween(
  "  function deleteCampaign(id) {",
  "  async function copyCurrentPost(showMessage = true) {",
  `  function deleteCampaign(id) {\n    if (!window.confirm("Delete this saved campaign from the current browser?")) return;\n    const next = library.filter((item) => item.id !== id);\n    try {\n      window.localStorage.setItem(LIBRARY_KEY, JSON.stringify(next));\n      setLibrary(next);\n    } catch {\n      setMessage({ type: "error", text: "The browser could not update the local campaign library." });\n    }\n  }\n\n`,
  "confirmed local deletion",
);

replaceBetween(
  "  async function copyAndOpenCurrent() {",
  "  function exportMarkdown() {",
  `  async function copyAndOpenCurrent() {\n    let openedWindow = null;\n    if (activeMeta.openUrl) {\n      openedWindow = window.open(activeMeta.openUrl, "_blank");\n      if (openedWindow) openedWindow.opener = null;\n    }\n\n    const copied = await copyCurrentPost(false);\n    if (!copied) return;\n\n    if (activeMeta.openUrl) {\n      setMessage({\n        type: openedWindow ? "success" : "warning",\n        text: openedWindow\n          ? \`\${activeMeta.label} draft copied. The platform was opened in a new tab.\`\n          : \`\${activeMeta.label} draft copied, but the browser blocked the new tab. Open the platform manually.\`,\n      });\n      return;\n    }\n\n    setMessage({ type: "success", text: \`\${activeMeta.label} draft copied. Paste it into your publishing tool.\` });\n  }\n\n`,
  "popup-safe copy and open",
);

replaceInFunction(
  "  async function publishCurrentPost() {",
  "  async function refreshConnections() {",
  `      const data = await response.json();`,
  `      const data = await readJsonResponse(response, "SignalFlow returned an unreadable publishing response.");`,
  "publishing response",
);

replaceInFunction(
  "  async function refreshConnections() {",
  "  function connectPlatform(platform) {",
  `      const data = await response.json();`,
  `      const data = await readJsonResponse(response, "SignalFlow returned an unreadable connector response.");`,
  "connector status response",
);

replaceInFunction(
  "  async function disconnectPlatform(platform) {",
  "  async function unlockOwnerSession() {",
  `      const data = await response.json();`,
  `      const data = await readJsonResponse(response, "SignalFlow returned an unreadable disconnect response.");`,
  "disconnect response",
);

replaceBetween(
  "  async function unlockOwnerSession() {",
  "  async function lockOwnerSession() {",
  `  async function unlockOwnerSession() {\n    if (!ownerKey.trim()) return;\n    setBusy(true);\n    setMessage(null);\n    try {\n      const response = await fetch("/api/session", {\n        method: "POST",\n        headers: { "Content-Type": "application/json" },\n        body: JSON.stringify({ access_key: ownerKey.trim() }),\n      });\n      const data = await readJsonResponse(response, "SignalFlow returned an unreadable session response.");\n      if (!response.ok) throw new Error(data.error || "The owner key was not accepted.");\n      setAccessToken(data.authenticated ? "cookie-session" : "");\n      window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n      window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n      setOwnerKey("");\n      setMessage({\n        type: "success",\n        text: data.locked === false ? "Access lock is disabled for this deployment." : "Owner session unlocked.",\n      });\n    } catch (error) {\n      setMessage({ type: "error", text: error.message });\n    } finally {\n      setBusy(false);\n    }\n  }\n\n`,
  "cookie-only owner unlock",
);

replaceBetween(
  "  async function lockOwnerSession() {",
  "  if (!entered) return <LandingPage onEnter={enterStudio} />;",
  `  async function lockOwnerSession() {\n    await fetch("/api/session", { method: "DELETE" }).catch(() => null);\n    window.localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    window.sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);\n    setAccessToken("");\n    setConnections({});\n    setMessage({ type: "success", text: "Owner session closed." });\n  }\n\n`,
  "cookie-only owner lock",
);

replaceRequired(
  `setStage(result ? "review" : "compose");`,
  `setStage(result ? "review" : sourceSignals > 0 ? "destinations" : "source");`,
  "invalid compose state",
);

replaceRequired(
  `                      {composeReady\n                        ? "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."\n                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}`,
  `                      {composeReady\n                        ? form.provider === "template"\n                          ? "Ready to test the workflow. Local sample mode is deterministic and intentionally limited; choose a model provider for production-quality content."\n                          : "SignalFlow has enough context to build editable drafts. You remain in control of every output and publishing step."\n                        : "Add a brief, public link, repository, or extractable text file. Keep the first run simple; advanced model controls can stay closed."}`,
  "template quality notice",
);

fs.writeFileSync(pagePath, page, "utf8");
fs.rmSync(path.join(root, ".github/scripts/apply-public-audit-fixes.mjs"), { force: true });
fs.rmSync(path.join(root, ".github/workflows/apply-public-audit-fixes.yml"), { force: true });
console.log("Applied audited client-state fixes.");
