import fs from "node:fs";

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not locate ${label}.`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`${label} is not unique.`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

const pagePath = "frontend/app/page.js";
let page = fs.readFileSync(pagePath, "utf8");

page = replaceOnce(
  page,
  `  function enterStudio() {
    setEntered(true);
    setSection("studio");
    setCurrentCampaignId("");
    setStage("source");
  }
`,
  `  function startNewCampaign() {
    setCurrentCampaignId("");
    dispatchCampaign({ type: "RESET_CAMPAIGN" });
    setForm({
      projectName: "",
      notes: "",
      audience: "Founders, builders, and early users",
      links: "",
      repo: "",
      provider: "gemini",
      apiKey: "",
      model: "",
      baseUrl: "",
    });
    setChannels(DEFAULT_CHANNELS);
    setFiles([]);
    setDocumentText([]);
    setPublishOptions({ reddit: { subreddit: "", title: "" } });
    setMessage(null);
    navigateSection("studio");
  }

  function enterStudio() {
    setEntered(true);
    startNewCampaign();
  }
`,
  "new campaign reset flow",
);

page = replaceOnce(
  page,
  `              onClick={() => {
                navigateSection("studio");
                setStage("source");
              }}
`,
  `              onClick={startNewCampaign}
`,
  "library new campaign action",
);

fs.writeFileSync(pagePath, page);

const campaignPath = "frontend/lib/domain/campaign.mjs";
let campaign = fs.readFileSync(campaignPath, "utf8");

campaign = replaceOnce(
  campaign,
  `function stringList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map((item) => text(item).toLowerCase())
    .filter(Boolean)));
}
`,
  `function canonicalChannel(value) {
  const channel = text(value).toLowerCase();
  if (["releasenotes", "release-notes", "release_notes"].includes(channel)) return "release_notes";
  if (["hn", "hacker-news", "hacker_news"].includes(channel)) return "hackernews";
  return channel;
}

function stringList(value) {
  return Array.from(new Set((Array.isArray(value) ? value : [])
    .map(canonicalChannel)
    .filter(Boolean)));
}
`,
  "channel canonicalization",
);

fs.writeFileSync(campaignPath, campaign);
