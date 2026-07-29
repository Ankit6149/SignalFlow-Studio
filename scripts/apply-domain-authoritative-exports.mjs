import fs from "node:fs";

const path = "frontend/app/page.js";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(input, search, replacement, label) {
  const index = input.indexOf(search);
  if (index < 0) throw new Error(`Could not locate ${label}.`);
  if (input.indexOf(search, index + search.length) >= 0) throw new Error(`${label} is not unique.`);
  return `${input.slice(0, index)}${replacement}${input.slice(index + search.length)}`;
}

function replacePattern(input, pattern, replacement, label) {
  const matches = input.match(pattern);
  if (!matches) throw new Error(`Could not locate ${label}.`);
  return input.replace(pattern, replacement);
}

source = replaceOnce(
  source,
  'import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";\n',
  'import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";\nimport { createBrowserCampaignApplication } from "../lib/application/browserCampaignApplication.mjs";\n',
  "campaign application import",
);

source = replaceOnce(
  source,
  '  const [library, setLibrary] = useState([]);\n',
  '  const [library, setLibrary] = useState([]);\n  const [currentCampaignId, setCurrentCampaignId] = useState("");\n',
  "current campaign identity state",
);

source = replaceOnce(
  source,
  '  const fileInputRef = useRef(null);\n\n',
  '  const fileInputRef = useRef(null);\n  const campaignApplication = useMemo(() => createBrowserCampaignApplication({\n    getStorage: () => window.localStorage,\n    key: LIBRARY_KEY,\n    limit: 30,\n  }), []);\n\n',
  "browser campaign application composition root",
);

source = replaceOnce(
  source,
  '    setLibrary(safeJsonParse(window.localStorage.getItem(LIBRARY_KEY), []));\n',
  '    void campaignApplication.listCampaigns()\n      .then(setLibrary)\n      .catch(() => setMessage({\n        type: "error",\n        text: "The browser could not read or migrate the local campaign library.",\n      }));\n',
  "legacy direct library read",
);

source = replaceOnce(
  source,
  '  function enterStudio() {\n    setEntered(true);\n    setSection("studio");\n    setStage("source");\n  }\n',
  '  function enterStudio() {\n    setEntered(true);\n    setSection("studio");\n    setCurrentCampaignId("");\n    setStage("source");\n  }\n',
  "enter Studio reset",
);

const campaignFunctions = `  function currentCampaignInput(overrides = {}) {
    return {
      campaignId: currentCampaignId,
      title: form.projectName.trim() || result?.package?.project?.name || "Untitled campaign",
      channels: [...channels],
      posts: { ...posts },
      result,
      generationRun,
      brief: { ...form },
      publishOptions,
      ...createSourceSnapshot(files, documentText),
      ...overrides,
    };
  }

  async function saveCampaign() {
    if (!result) return;
    try {
      const saved = await campaignApplication.saveCampaign(currentCampaignInput({
        updatedAt: new Date().toISOString(),
      }));
      setCurrentCampaignId(saved.campaignId);
      setLibrary(await campaignApplication.listCampaigns());
      setMessage({ type: "success", text: "Campaign saved to your local library." });
    } catch {
      setMessage({ type: "error", text: "The browser could not save this campaign. Export it before leaving this page." });
    }
  }

  function openCampaign(item) {
    try {
      const restored = campaignApplication.openCampaign(item);
      setCurrentCampaignId(restored.campaignId);
      setForm((previous) => ({ ...previous, ...restored.brief, apiKey: "" }));
      setChannels(restored.channels);
      dispatchCampaign({
        type: "RESTORE_CAMPAIGN",
        payload: {
          posts: restored.posts,
          result: restored.result,
          generationRun: restored.generationRun,
          activeChannel: restored.channels[0] || "linkedin",
        },
      });
      setPublishOptions(restored.publishOptions || { reddit: { subreddit: "", title: "" } });
      setFiles(restored.sourceFiles || []);
      setDocumentText(restored.documentText || []);
      navigateSection("studio");
    } catch {
      setMessage({ type: "error", text: "This saved campaign could not be migrated or opened safely." });
    }
  }

  async function deleteCampaign(campaignId) {
    if (!window.confirm("Delete this saved campaign from the current browser?")) return;
    try {
      await campaignApplication.deleteCampaign(campaignId);
      setLibrary(await campaignApplication.listCampaigns());
      if (currentCampaignId === campaignId) setCurrentCampaignId("");
    } catch {
      setMessage({ type: "error", text: "The browser could not update the local campaign library." });
    }
  }

`;

source = replacePattern(
  source,
  /  function saveCampaign\(\) \{[\s\S]*?\n  async function copyCurrentPost/,
  `${campaignFunctions}  async function copyCurrentPost`,
  "campaign save/open/delete functions",
);

const exportFunctions = `  function exportMarkdown() {
    if (isCampaignStale) {
      reportStaleCampaign();
      return;
    }
    try {
      const projection = campaignApplication.projectMarkdown(currentCampaignInput());
      downloadText(projection.filename, projection.content, projection.mimeType);
    } catch {
      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into Markdown." });
    }
  }

  function exportJson() {
    if (isCampaignStale) {
      reportStaleCampaign();
      return;
    }
    try {
      const projection = campaignApplication.projectJson(currentCampaignInput());
      downloadText(projection.filename, projection.content, projection.mimeType);
    } catch {
      setMessage({ type: "error", text: "SignalFlow could not project the current campaign into JSON." });
    }
  }

`;

source = replacePattern(
  source,
  /  function exportMarkdown\(\) \{[\s\S]*?\n  async function publishCurrentPost/,
  `${exportFunctions}  async function publishCurrentPost`,
  "campaign export functions",
);

source = replaceOnce(source, '<article key={item.id} className="library-card">', '<article key={item.campaignId} className="library-card">', "library card identity");
source = replaceOnce(source, '<span>{item.fallbackUsed ? "Fallback route" : item.providerUsed || "Generated"}</span>', '<span>{item.providerUsed || "Generated"}</span>', "library provider truth");
source = replaceOnce(
  source,
  '                    {Object.values(item.posts || {})[0]?.slice(0, 170) || "Saved campaign package"}\n                    {Object.values(item.posts || {})[0]?.length > 170 ? "…" : ""}',
  '                    {item.preview?.slice(0, 170) || "Saved campaign package"}\n                    {item.preview?.length > 170 ? "…" : ""}',
  "library authoritative preview",
);
source = replaceOnce(source, 'deleteCampaign(item.id)', 'deleteCampaign(item.campaignId)', "library delete identity");

fs.writeFileSync(path, source);
