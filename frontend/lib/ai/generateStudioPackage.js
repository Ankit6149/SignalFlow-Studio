import { buildUnifiedContext } from "../context/buildUnifiedContext";
import { buildStudioPrompt } from "../prompt/buildStudioPrompt";
import { generateLocalTemplatePackage } from "../package/templatePackage";
import { normalizePackage } from "../package/normalizePackage";
import { generateJSON } from "./generateJSON";
import { buildMarkdown } from "../export/markdown";
import { PROVIDERS } from "./types";

const DEFAULT_CHANNELS = ["linkedin", "x", "instagram", "reddit", "newsletter"];

function slug(value) {
  return String(value || "signalflow-campaign")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "") || "signalflow-campaign";
}

function escapeXml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderReleaseNotes(releaseNotes) {
  if (!releaseNotes) return "";
  const title = releaseNotes.title ? `# ${releaseNotes.title}\n\n` : "";
  const sections = Array.isArray(releaseNotes.sections)
    ? releaseNotes.sections.map((section) => {
        const items = Array.isArray(section.items)
          ? section.items.map((item) => `- ${item}`).join("\n")
          : String(section.items || section.body || "");
        return `## ${section.title || "Update"}\n${items}`;
      }).join("\n\n")
    : "";
  return `${title}${sections}`.trim();
}

function flattenPackagePosts(pkg) {
  return {
    linkedin: pkg?.posts?.linkedin?.body || "",
    x: Array.isArray(pkg?.posts?.x?.posts) ? pkg.posts.x.posts.join("\n\n") : pkg?.posts?.x?.body || "",
    instagram: pkg?.posts?.instagram?.caption || "",
    reddit: [pkg?.posts?.reddit?.title, pkg?.posts?.reddit?.body].filter(Boolean).join("\n\n"),
    facebook: pkg?.posts?.facebook?.body || "",
    threads: pkg?.posts?.threads?.body || "",
    youtube: [pkg?.posts?.youtube?.title, pkg?.posts?.youtube?.description].filter(Boolean).join("\n\n"),
    tiktok: [pkg?.posts?.tiktok?.hook, pkg?.posts?.tiktok?.caption].filter(Boolean).join("\n\n"),
    hackernews: [pkg?.posts?.hackernews?.title, pkg?.posts?.hackernews?.body].filter(Boolean).join("\n\n"),
    hn: [pkg?.posts?.hackernews?.title, pkg?.posts?.hackernews?.body].filter(Boolean).join("\n\n"),
    newsletter: [pkg?.posts?.newsletter?.subject, pkg?.posts?.newsletter?.body].filter(Boolean).join("\n\n"),
    blog: pkg?.posts?.blog?.draft || "",
    release_notes: renderReleaseNotes(pkg?.posts?.releaseNotes),
  };
}

function selectPosts(pkg, selectedChannels) {
  const flattened = flattenPackagePosts(pkg);
  const channels = selectedChannels.length ? selectedChannels : DEFAULT_CHANNELS;
  return {
    channels,
    posts: Object.fromEntries(channels.map((channel) => [channel, flattened[channel] || ""])),
  };
}

function buildCampaignCard(name, description) {
  return `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#11110f"/>
  <circle cx="1030" cy="50" r="350" fill="#d8bd7c" opacity="0.14"/>
  <rect x="58" y="58" width="1084" height="514" rx="34" fill="#191914" stroke="#fffdf8" stroke-opacity="0.13"/>
  <text x="96" y="132" fill="#d8bd7c" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="5">SIGNALFLOW CAMPAIGN</text>
  <text x="96" y="236" fill="#fffdf8" font-family="Georgia, serif" font-size="66">${escapeXml(String(name || "Campaign").slice(0, 34))}</text>
  <foreignObject x="96" y="278" width="930" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:rgba(255,253,248,.64);font-size:30px;line-height:1.45">${escapeXml(String(description || "Review-ready campaign draft").slice(0, 170))}</div>
  </foreignObject>
  <rect x="96" y="492" width="260" height="48" rx="24" fill="#d8bd7c"/>
  <text x="134" y="524" fill="#171714" font-family="Arial, sans-serif" font-size="19" font-weight="700">REVIEW-READY DRAFT</text>
</svg>`;
}

function templateResult(inputs, warning, contextWarnings = []) {
  const local = generateLocalTemplatePackage(inputs);
  return {
    ...local,
    warnings: Array.from(new Set([warning, ...(local.warnings || []), ...contextWarnings].filter(Boolean))),
  };
}

/** Main campaign generation orchestration across local and configured model routes. */
export async function generateStudioPackage(inputs) {
  const {
    projectName = "SignalFlow campaign",
    notes = "",
    audience = "builders, founders, and early users",
    repoContext = null,
    linksContext = [],
    fileNames = [],
    mediaItems = [],
    selectedChannels = [],
    selectedOutputs = [],
    generator = "template",
    model_name = "",
    appUrl = "",
    config = {},
  } = inputs;

  const generationInputs = {
    projectName,
    notes,
    audience,
    repoContext,
    linksContext,
    fileNames,
    mediaItems,
    selectedChannels,
    selectedOutputs,
    appUrl,
  };

  const context = buildUnifiedContext(generationInputs);
  const contextWarnings = Array.isArray(context.warnings) ? context.warnings : [];
  const studioPrompt = buildStudioPrompt(context);

  if (generator === "prompt") {
    const result = templateResult(
      generationInputs,
      "Prompt route selected. A complete deterministic campaign is shown while the structured prompt remains available for an external model.",
      contextWarnings,
    );
    return {
      ...result,
      providerUsed: "prompt",
      fallbackUsed: true,
      chatbot_prompt: studioPrompt,
    };
  }

  if (generator === "template" || generator === "offline") {
    const result = templateResult(
      generationInputs,
      "Local template route created the campaign without an external model call.",
      contextWarnings,
    );
    return {
      ...result,
      providerUsed: "template",
      fallbackUsed: true,
      chatbot_prompt: studioPrompt,
    };
  }

  const providerMeta = PROVIDERS[generator];
  if (!providerMeta) {
    const result = templateResult(
      generationInputs,
      `Unknown provider "${generator}". The local template route was used instead.`,
      contextWarnings,
    );
    return {
      ...result,
      providerUsed: "template",
      fallbackUsed: true,
      chatbot_prompt: studioPrompt,
    };
  }

  const temporaryKey = Boolean(config?.apiKey);
  const temporaryBaseUrl = Boolean(config?.baseUrl);
  const localProvider = Boolean(providerMeta.isLocal);
  const environmentConfigured = providerMeta.isConfigured();
  const configured = localProvider
    ? true
    : generator === "custom"
      ? Boolean(process.env.CUSTOM_OPENAI_BASE_URL) || temporaryBaseUrl
      : environmentConfigured || temporaryKey;

  if (!configured) {
    const requirement = generator === "custom"
      ? "an OpenAI-compatible base URL"
      : (providerMeta.requiredEnv || []).join(" or ") || "provider credentials";
    const result = templateResult(
      generationInputs,
      `${providerMeta.label} is not configured. Add ${requirement} or a temporary personal key; the local template route was used for this campaign.`,
      contextWarnings,
    );
    return {
      ...result,
      providerUsed: generator,
      fallbackUsed: true,
      chatbot_prompt: studioPrompt,
    };
  }

  const modelOverride = model_name || config?.modelName || providerMeta.defaultModel;

  try {
    const rawPackage = await generateJSON({
      provider: generator,
      prompt: studioPrompt,
      modelOverride,
      config,
    });

    const pkg = normalizePackage(rawPackage, generationInputs);
    const { channels, posts } = selectPosts(pkg, selectedChannels);
    const name = pkg.project.name || projectName;
    const description = pkg.project.description || notes || pkg.project.oneLine || "Review-ready campaign draft";
    const fileSlug = slug(name);
    const svgContent = buildCampaignCard(name, description);

    return {
      ok: true,
      providerUsed: generator,
      fallbackUsed: false,
      chatbot_prompt: studioPrompt,
      warnings: Array.from(new Set(contextWarnings)),
      package: pkg,
      posts,
      channels,
      outputs: selectedOutputs,
      markdown: buildMarkdown({ projectName: name, package: pkg, prompt: studioPrompt }),
      json: pkg,
      media_plan: (pkg.media.assetChecklist || []).map((item, index) => ({
        type: /video|recording|walkthrough/i.test(String(item)) ? "video" : "screenshot",
        title: String(item),
        summary: `Campaign asset ${index + 1}.`,
      })),
      documents: [
        { title: "Campaign strategy", summary: pkg.strategy.positioning },
        { title: "Release notes", summary: pkg.posts.releaseNotes?.title || "Release notes" },
      ],
      assets: {
        markdown: `${fileSlug}-campaign.md`,
        summary: `${fileSlug}-campaign.json`,
        code_image: `${fileSlug}-campaign-card.svg`,
      },
      image_mime: "image/svg+xml",
      image_base64: Buffer.from(svgContent.trim()).toString("base64"),
      integration_config: {
        mode: "review_first",
        officialApisOnly: true,
        directPlatforms: ["linkedin", "x", "reddit"],
        manualPlatforms: ["instagram", "facebook", "threads", "youtube", "tiktok", "hackernews", "newsletter", "blog", "release_notes"],
      },
    };
  } catch (error) {
    const result = templateResult(
      generationInputs,
      `${providerMeta.label} generation failed: ${error.message}. A complete local template campaign was created instead.`,
      contextWarnings,
    );
    return {
      ...result,
      providerUsed: generator,
      fallbackUsed: true,
      chatbot_prompt: studioPrompt,
    };
  }
}
