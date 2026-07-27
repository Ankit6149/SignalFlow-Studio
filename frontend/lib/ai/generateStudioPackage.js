import { buildUnifiedContext } from "../context/buildUnifiedContext";
import { buildCampaignBriefPrompt } from "../prompt/buildCampaignBriefPrompt.mjs";
import { generateLocalTemplatePackage } from "../package/templatePackage";
import { normalizePackage } from "../package/normalizePackage";
import { generateJSON } from "./generateJSON";
import { buildMarkdown } from "../export/markdown";
import { PROVIDERS } from "./types";
import { assertModelGenerationProvider } from "./generationPolicy.mjs";
import {
  CHANNEL_CONTRACTS,
  assessChannelDraft,
  buildChannelPrompt,
  canonicalChannel,
  packageKeyForChannel,
} from "./channelGeneration.mjs";

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

function selectedDestinationList(selectedChannels) {
  const source = selectedChannels.length ? selectedChannels : DEFAULT_CHANNELS;
  return Array.from(new Set(
    source
      .map(canonicalChannel)
      .filter((channel) => Boolean(CHANNEL_CONTRACTS[channel])),
  ));
}

function selectPosts(pkg, selectedChannels) {
  const flattened = flattenPackagePosts(pkg);
  const channels = selectedDestinationList(selectedChannels);
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

function packageDraft(pkg, channel) {
  return pkg?.posts?.[packageKeyForChannel(channel)] || null;
}

function normalizeDestinationDraft(rawDraft, channel, generationInputs) {
  const packageKey = packageKeyForChannel(channel);
  const normalized = normalizePackage({ posts: { [packageKey]: rawDraft } }, generationInputs, { allowTemplateFallback: false });
  return normalized.posts[packageKey];
}

function statusForTemplate(channels) {
  return Object.fromEntries(channels.map((channel) => [channel, {
    status: "template_fallback",
    attempts: 0,
    qualityScore: null,
    issues: ["This destination uses deterministic template copy rather than model-generated editorial work."],
  }]));
}

function emptyDestinationDraft(channel) {
  switch (channel) {
    case "linkedin": return { title: "", body: "", hashtags: [], cta: "" };
    case "x": return { mode: "post_or_thread", posts: [] };
    case "instagram": return { caption: "", hashtags: [], visualDirection: "" };
    case "reddit": return { title: "", body: "", subredditSuggestions: [] };
    case "youtube": return { title: "", description: "", tags: [] };
    case "tiktok": return { caption: "", hook: "", shotList: [] };
    case "hackernews": return { title: "", body: "" };
    case "newsletter": return { subject: "", preview: "", body: "" };
    case "blog": return { title: "", outline: [], draft: "" };
    case "release_notes": return { title: "", sections: [] };
    default: return { body: "" };
  }
}

function emptyPackagePosts() {
  return {
    linkedin: emptyDestinationDraft("linkedin"),
    x: emptyDestinationDraft("x"),
    instagram: emptyDestinationDraft("instagram"),
    reddit: emptyDestinationDraft("reddit"),
    facebook: emptyDestinationDraft("facebook"),
    threads: emptyDestinationDraft("threads"),
    youtube: emptyDestinationDraft("youtube"),
    tiktok: emptyDestinationDraft("tiktok"),
    hackernews: emptyDestinationDraft("hackernews"),
    newsletter: emptyDestinationDraft("newsletter"),
    blog: emptyDestinationDraft("blog"),
    releaseNotes: emptyDestinationDraft("release_notes"),
  };
}

async function generateDestination({
  channel,
  context,
  campaignBrief,
  generationInputs,
  provider,
  modelOverride,
  config,
}) {
  const packageKey = packageKeyForChannel(channel);
  const projectName = campaignBrief?.project?.name || generationInputs.projectName;
  let firstDraft = null;
  let firstQuality = null;

  try {
    const firstRaw = await generateJSON({
      provider,
      prompt: buildChannelPrompt({ channel, context, campaignBrief }),
      modelOverride,
      config,
    });
    firstDraft = normalizeDestinationDraft(firstRaw, channel, generationInputs);
    firstQuality = assessChannelDraft(channel, firstDraft, { projectName });

    if (firstQuality.valid) {
      return {
        channel,
        packageKey,
        draft: firstDraft,
        status: {
          status: "generated",
          attempts: 1,
          qualityScore: firstQuality.score,
          issues: [],
          metrics: firstQuality.metrics,
        },
      };
    }

    const revisedRaw = await generateJSON({
      provider,
      prompt: buildChannelPrompt({
        channel,
        context,
        campaignBrief,
        previousDraft: firstDraft,
        qualityIssues: firstQuality.issues,
      }),
      modelOverride,
      config,
    });
    const revisedDraft = normalizeDestinationDraft(revisedRaw, channel, generationInputs);
    const revisedQuality = assessChannelDraft(channel, revisedDraft, { projectName });
    const useRevision = revisedQuality.score >= firstQuality.score;
    const selectedDraft = useRevision ? revisedDraft : firstDraft;
    const selectedQuality = useRevision ? revisedQuality : firstQuality;

    return {
      channel,
      packageKey,
      draft: selectedDraft,
      status: {
        status: selectedQuality.valid ? "regenerated" : "needs_review",
        attempts: 2,
        qualityScore: selectedQuality.score,
        issues: selectedQuality.issues,
        metrics: selectedQuality.metrics,
      },
    };
  } catch (error) {
    return {
      channel,
      packageKey,
      draft: emptyDestinationDraft(channel),
      status: {
        status: "failed",
        attempts: firstDraft ? 1 : 0,
        qualityScore: firstQuality?.score ?? null,
        issues: [`Destination generation failed: ${error.message}`],
      },
    };
  }
}

function buildPromptBundle(context, localPackage, channels) {
  const briefPrompt = buildCampaignBriefPrompt(context);
  const destinationPrompts = channels.map((channel) => [
    `\n\n================ ${channel.toUpperCase()} STAGE ================\n`,
    buildChannelPrompt({ channel, context, campaignBrief: localPackage }),
  ].join(""));
  return [briefPrompt, ...destinationPrompts].join("\n");
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
    generator: requestedGenerator = "",
    model_name = "",
    appUrl = "",
    config = {},
  } = inputs;

  const generator = assertModelGenerationProvider(requestedGenerator);

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

  const channels = selectedDestinationList(selectedChannels);
  const context = buildUnifiedContext(generationInputs);
  const contextWarnings = Array.isArray(context.warnings) ? context.warnings : [];
  const campaignBriefPrompt = buildCampaignBriefPrompt(context);

  const providerMeta = PROVIDERS[generator];
  if (!providerMeta) {
    throw new Error(`Unsupported model provider: ${generator}.`);
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
    throw new Error(`${providerMeta.label} is not configured. Add ${requirement} or a temporary personal key.`);
  }

  const modelOverride = model_name || config?.modelName || providerMeta.defaultModel;

  try {
    const rawBrief = await generateJSON({
      provider: generator,
      prompt: campaignBriefPrompt,
      modelOverride,
      config,
    });

    const pkg = normalizePackage(rawBrief, generationInputs, { allowTemplateFallback: false });
    pkg.strategy.destinationAngles = rawBrief?.strategy?.destinationAngles || {};
    pkg.posts = emptyPackagePosts();

    const generatedDestinations = await Promise.all(channels.map((channel) => generateDestination({
      channel,
      context,
      campaignBrief: pkg,
      generationInputs,
      provider: generator,
      modelOverride,
      config,
    })));

    const generationStatus = {};
    const generationWarnings = [];
    for (const result of generatedDestinations) {
      if (result.status.status !== "failed") pkg.posts[result.packageKey] = result.draft;
      generationStatus[result.channel] = result.status;
      if (result.status.status === "failed") {
        generationWarnings.push(`${result.channel}: model generation failed and no substitute copy was inserted.`);
      } else if (result.status.status === "needs_review") {
        generationWarnings.push(`${result.channel}: the best draft still failed one or more editorial quality checks.`);
      }
    }

    const failedDestinations = generatedDestinations.filter((item) => item.status.status === "failed");
    if (failedDestinations.length === generatedDestinations.length) {
      throw new Error(`Every selected destination failed: ${failedDestinations.map((item) => item.channel).join(", ")}.`);
    }

    pkg.generation = {
      mode: "staged_agent",
      provider: generator,
      model: modelOverride,
      strategyStatus: "generated",
      destinations: generationStatus,
    };

    const selected = selectPosts(pkg, channels);
    const name = pkg.project.name || projectName;
    const description = pkg.project.description || notes || pkg.project.oneLine || "Review-ready campaign draft";
    const fileSlug = slug(name);
    const svgContent = buildCampaignCard(name, description);
    const partialFailureUsed = failedDestinations.length > 0;

    return {
      ok: true,
      providerUsed: generator,
      fallbackUsed: false,
      partialFailureUsed,
      generation_status: generationStatus,
      chatbot_prompt: campaignBriefPrompt,
      warnings: Array.from(new Set([...contextWarnings, ...generationWarnings])),
      package: pkg,
      posts: selected.posts,
      channels: selected.channels,
      outputs: selectedOutputs,
      markdown: buildMarkdown({ projectName: name, package: pkg, prompt: campaignBriefPrompt }),
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
    throw new Error(`${providerMeta.label} campaign generation failed: ${error.message}`);

  }
}
