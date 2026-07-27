import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const root = process.cwd();

function replaceLiteral(relativePath, search, replacement) {
  const path = resolve(root, relativePath);
  const source = readFileSync(path, "utf8");
  const occurrences = source.split(search).length - 1;
  if (occurrences !== 1) {
    throw new Error(`${relativePath}: expected one matching block, found ${occurrences}`);
  }
  writeFileSync(path, source.replace(search, replacement));
}

const operations = [
  {
    "path": "frontend/app/page.js",
    "search": "import {\n  evaluateProviderReadiness,\n  pickRecommendedProvider,\n} from \"../lib/studio/providerReadiness.mjs\";",
    "replacement": "import {\n  evaluateProviderReadiness,\n  pickRecommendedProvider,\n} from \"../lib/studio/providerReadiness.mjs\";\nimport {\n  createGenerationRun,\n  createGenerationSourceSnapshot,\n  getCampaignFreshness,\n  getGenerationSourceChanges,\n  restoreGenerationRun,\n} from \"../lib/studio/campaignFreshness.mjs\";"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  const [result, setResult] = useState(null);\n  const [posts, setPosts] = useState({});",
    "replacement": "  const [result, setResult] = useState(null);\n  const [generationRun, setGenerationRun] = useState(null);\n  const [posts, setPosts] = useState({});"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  const currentPost = posts[activeChannel] || \"\";\n  const currentConnection = connections[activeChannel] || null;\n  const canPublishCurrent = Boolean(\n    currentConnection?.connected && !currentConnection?.expired && !currentConnection?.manualOnly,\n  );",
    "replacement": "  const currentPost = posts[activeChannel] || \"\";\n  const currentConnection = connections[activeChannel] || null;\n  const currentSourceSnapshot = useMemo(\n    () =>\n      createGenerationSourceSnapshot(\n        { form, channels, files, documentText },\n        { createdAt: null },\n      ),\n    [form, channels, files, documentText],\n  );\n  const campaignFreshness = getCampaignFreshness({\n    hasResult: Boolean(result),\n    currentSourceFingerprint: currentSourceSnapshot.fingerprint,\n    generationRun,\n  });\n  const isCampaignStale = campaignFreshness.isStale;\n  const sourceChangeLabels = isCampaignStale\n    ? getGenerationSourceChanges(generationRun?.sourceSnapshot, currentSourceSnapshot)\n    : [];\n  const canPublishCurrent = Boolean(\n    campaignFreshness.canUseCurrentGeneration &&\n      currentConnection?.connected &&\n      !currentConnection?.expired &&\n      !currentConnection?.manualOnly,\n  );"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  function updatePublishOption(platform, key, value) {\n    setPublishOptions((previous) => ({\n      ...previous,\n      [platform]: { ...(previous[platform] || {}), [key]: value },\n    }));\n  }\n\n  function navigateStudioFlow(targetStage) {",
    "replacement": "  function updatePublishOption(platform, key, value) {\n    setPublishOptions((previous) => ({\n      ...previous,\n      [platform]: { ...(previous[platform] || {}), [key]: value },\n    }));\n  }\n\n  function reportStaleCampaign() {\n    setMessage({\n      type: \"warning\",\n      text: \"Source inputs changed after generation. Regenerate the campaign before copying, exporting, or publishing these drafts.\",\n    });\n  }\n\n  function navigateStudioFlow(targetStage) {"
  },
  {
    "path": "frontend/app/page.js",
    "search": "    setBusy(true);\n    setMessage(null);\n    try {\n      const response = await fetch(\"/api/launch_kit\", {",
    "replacement": "    const requestedSourceSnapshot = createGenerationSourceSnapshot({\n      form,\n      channels,\n      files,\n      documentText,\n    });\n\n    setBusy(true);\n    setMessage(null);\n    try {\n      const response = await fetch(\"/api/launch_kit\", {"
  },
  {
    "path": "frontend/app/page.js",
    "search": "      const generatedPosts = data.posts || {};\n      setResult(data);\n      setPosts(generatedPosts);",
    "replacement": "      const generatedPosts = data.posts || {};\n      const nextGenerationRun = createGenerationRun({\n        sourceSnapshot: requestedSourceSnapshot,\n        response: data,\n        provider: form.provider,\n        model: form.model.trim(),\n      });\n      setGenerationRun(nextGenerationRun);\n      setResult(data);\n      setPosts(generatedPosts);"
  },
  {
    "path": "frontend/app/page.js",
    "search": "      markdown: result.markdown || \"\",\n      result,\n      brief: { ...form, apiKey: \"\" },",
    "replacement": "      markdown: result.markdown || \"\",\n      result,\n      generationRun,\n      brief: { ...form, apiKey: \"\" },"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  function openCampaign(item) {\n    setForm((previous) => ({ ...previous, ...(item.brief || {}), apiKey: \"\" }));\n    setChannels(item.channels || [\"linkedin\"]);\n    setPosts(item.posts || {});\n    setResult(item.result || { markdown: item.markdown, warnings: item.warnings || [] });\n    setPublishOptions(item.publishOptions || { reddit: { subreddit: \"\", title: \"\" } });\n    const restoredSource = restoreSourceSnapshot(item);\n    setFiles(restoredSource.sourceFiles);\n    setDocumentText(restoredSource.documentText);\n    setActiveChannel((item.channels || [\"linkedin\"])[0]);\n    setStage(\"review\");\n    navigateSection(\"studio\");\n  }",
    "replacement": "  function openCampaign(item) {\n    const restoredSource = restoreSourceSnapshot(item);\n    const restoredRun = restoreGenerationRun({\n      ...item,\n      sourceFiles: restoredSource.sourceFiles,\n      documentText: restoredSource.documentText,\n    });\n    setForm((previous) => ({ ...previous, ...(item.brief || {}), apiKey: \"\" }));\n    setChannels(item.channels || [\"linkedin\"]);\n    setPosts(item.posts || {});\n    setResult(item.result || { markdown: item.markdown, warnings: item.warnings || [] });\n    setGenerationRun(restoredRun);\n    setPublishOptions(item.publishOptions || { reddit: { subreddit: \"\", title: \"\" } });\n    setFiles(restoredSource.sourceFiles);\n    setDocumentText(restoredSource.documentText);\n    setActiveChannel((item.channels || [\"linkedin\"])[0]);\n    setStage(\"review\");\n    navigateSection(\"studio\");\n  }"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  async function copyCurrentPost(showMessage = true) {\n    if (!currentPost) return false;",
    "replacement": "  async function copyCurrentPost(showMessage = true) {\n    if (isCampaignStale) {\n      reportStaleCampaign();\n      return false;\n    }\n    if (!currentPost) return false;"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  async function copyAndOpenCurrent() {\n    let openedWindow = null;",
    "replacement": "  async function copyAndOpenCurrent() {\n    if (isCampaignStale) {\n      reportStaleCampaign();\n      return;\n    }\n    let openedWindow = null;"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  function exportMarkdown() {\n    const name = (form.projectName || \"signalflow-campaign\")",
    "replacement": "  function exportMarkdown() {\n    if (isCampaignStale) {\n      reportStaleCampaign();\n      return;\n    }\n    const name = (form.projectName || \"signalflow-campaign\")"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  function exportJson() {\n    const name = (form.projectName || \"signalflow-campaign\")",
    "replacement": "  function exportJson() {\n    if (isCampaignStale) {\n      reportStaleCampaign();\n      return;\n    }\n    const name = (form.projectName || \"signalflow-campaign\")"
  },
  {
    "path": "frontend/app/page.js",
    "search": "  async function publishCurrentPost() {\n    if (!currentPost) return;",
    "replacement": "  async function publishCurrentPost() {\n    if (isCampaignStale) {\n      reportStaleCampaign();\n      return;\n    }\n    if (!currentPost) return;"
  },
  {
    "path": "frontend/app/page.js",
    "search": "        <main className=\"studio-page\" id=\"workspace-content\" data-stage={stage}>",
    "replacement": "        <main\n          className=\"studio-page\"\n          id=\"workspace-content\"\n          data-stage={stage}\n          data-freshness={campaignFreshness.status}\n        >"
  },
  {
    "path": "frontend/app/page.js",
    "search": "                <div className=\"review-workspace\">\n                  <div className=\"review-tabs\" aria-label=\"Campaign channels\">",
    "replacement": "                <div className={`review-workspace ${isCampaignStale ? \"has-stale-campaign\" : \"\"}`}>\n                  {isCampaignStale && (\n                    <div className=\"campaign-stale-banner\" role=\"alert\" aria-live=\"assertive\">\n                      <div className=\"campaign-stale-banner__copy\">\n                        <span className=\"campaign-stale-banner__label\">Source changed</span>\n                        <strong>These drafts belong to an earlier campaign snapshot.</strong>\n                      </div>\n                      <p>\n                        Review remains available, but SignalFlow blocks copy, export, and publishing until the\n                        campaign is regenerated from the current source.\n                      </p>\n                      {sourceChangeLabels.length > 0 && (\n                        <small>Changed: {sourceChangeLabels.join(\", ")}.</small>\n                      )}\n                      <button type=\"button\" onClick={() => navigateStudioFlow(\"destinations\")}>\n                        Review changes\n                      </button>\n                    </div>\n                  )}\n                  <div className=\"review-tabs\" aria-label=\"Campaign channels\">"
  },
  {
    "path": "frontend/app/page.js",
    "search": "                      <span className={`connection-badge ${canPublishCurrent ? \"connection-badge--ready\" : \"\"}`}>\n                        {canPublishCurrent\n                          ? \"Direct publishing\"\n                          : OFFICIAL_CONNECTORS.has(activeChannel)\n                            ? \"Connector optional\"\n                            : \"Export ready\"}\n                      </span>",
    "replacement": "                      <span\n                        className={`connection-badge ${\n                          isCampaignStale\n                            ? \"connection-badge--stale\"\n                            : canPublishCurrent\n                              ? \"connection-badge--ready\"\n                              : \"\"\n                        }`}\n                      >\n                        {isCampaignStale\n                          ? \"Source changed\"\n                          : canPublishCurrent\n                            ? \"Direct publishing\"\n                            : OFFICIAL_CONNECTORS.has(activeChannel)\n                              ? \"Connector optional\"\n                              : \"Export ready\"}\n                      </span>"
  },
  {
    "path": "frontend/app/page.js",
    "search": "                      <div><dt>Route</dt><dd>{canPublishCurrent ? \"Connected official API\" : OFFICIAL_CONNECTORS.has(activeChannel) ? \"Official connector available; manual handoff remains available\" : \"Review, copy, export, and open-platform handoff\"}</dd></div>",
    "replacement": "                      <div>\n                        <dt>Route</dt>\n                        <dd>\n                          {isCampaignStale\n                            ? \"Blocked until regeneration from the current source\"\n                            : canPublishCurrent\n                              ? \"Connected official API\"\n                              : OFFICIAL_CONNECTORS.has(activeChannel)\n                                ? \"Official connector available; manual handoff remains available\"\n                                : \"Review, copy, export, and open-platform handoff\"}\n                        </dd>\n                      </div>"
  },
  {
    "path": "frontend/app/page.js",
    "search": "                    <button className=\"button button--outline\" onClick={() => copyCurrentPost()}>\n                      <CopyIcon /> Copy draft\n                    </button>",
    "replacement": "                    <button\n                      className=\"button button--outline\"\n                      onClick={() => copyCurrentPost()}\n                      disabled={isCampaignStale || !currentPost}\n                    >\n                      <CopyIcon /> Copy draft\n                    </button>"
  },
  {
    "path": "frontend/app/page.js",
    "search": "                    <button\n                      className=\"button button--dark\"\n                      onClick={canPublishCurrent ? publishCurrentPost : copyAndOpenCurrent}\n                      disabled={busy || !currentPost}\n                    >\n                      {canPublishCurrent\n                        ? \"Publish approved draft\"\n                        : activeMeta.openUrl\n                          ? `Copy & open ${activeMeta.label}`\n                          : \"Copy approved draft\"}\n                      <ArrowIcon />\n                    </button>",
    "replacement": "                    <button\n                      className=\"button button--dark\"\n                      onClick={canPublishCurrent ? publishCurrentPost : copyAndOpenCurrent}\n                      disabled={busy || !currentPost || isCampaignStale}\n                    >\n                      {isCampaignStale\n                        ? \"Regenerate to continue\"\n                        : canPublishCurrent\n                          ? \"Publish approved draft\"\n                          : activeMeta.openUrl\n                            ? `Copy & open ${activeMeta.label}`\n                            : \"Copy approved draft\"}\n                      <ArrowIcon />\n                    </button>"
  },
  {
    "path": "frontend/app/page.js",
    "search": "                    <button onClick={exportMarkdown}>Markdown</button>\n                    <button onClick={exportJson}>JSON</button>",
    "replacement": "                    <button onClick={exportMarkdown} disabled={isCampaignStale}>Markdown</button>\n                    <button onClick={exportJson} disabled={isCampaignStale}>JSON</button>"
  },
  {
    "path": "frontend/app/layout.js",
    "search": "import \"../app/studio-product.css\";",
    "replacement": "import \"../app/studio-product.css\";\nimport \"../app/campaign-freshness.css\";"
  }
];

for (const operation of operations) {
  replaceLiteral(operation.path, operation.search, operation.replacement);
}

console.log(`Applied ${operations.length} campaign freshness transformations.`);
