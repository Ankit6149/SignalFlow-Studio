import { buildMarkdown } from "../export/markdown";

const DEFAULT_CHANNELS = ["linkedin", "x", "instagram", "reddit", "newsletter"];

function clean(value, fallback = "") {
  const text = String(value || "").trim();
  return text || fallback;
}

function sentence(value) {
  const text = clean(value).replace(/\s+/g, " ");
  if (!text) return "";
  return /[.!?]$/.test(text) ? text : `${text}.`;
}

function truncate(value, max = 220) {
  const text = clean(value).replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}

function slug(value) {
  return clean(value, "signalflow-campaign")
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

function titleFromDescription(name, description) {
  const firstLine = clean(description).split(/[\n.!?]/).find(Boolean);
  return truncate(firstLine || `${name} product update`, 76);
}

function renderReleaseNotes(releaseNotes) {
  return [
    `# ${releaseNotes.title}`,
    ...releaseNotes.sections.map((section) => [
      `## ${section.title}`,
      ...section.items.map((item) => `- ${item}`),
    ].join("\n")),
  ].join("\n\n");
}

function flattenPosts(pkg) {
  return {
    linkedin: pkg.posts.linkedin.body,
    x: pkg.posts.x.posts.join("\n\n"),
    instagram: pkg.posts.instagram.caption,
    reddit: `${pkg.posts.reddit.title}\n\n${pkg.posts.reddit.body}`,
    facebook: pkg.posts.facebook.body,
    threads: pkg.posts.threads.body,
    youtube: `${pkg.posts.youtube.title}\n\n${pkg.posts.youtube.description}`,
    tiktok: pkg.posts.tiktok.caption,
    hackernews: `${pkg.posts.hackernews.title}\n\n${pkg.posts.hackernews.body}`,
    hn: `${pkg.posts.hackernews.title}\n\n${pkg.posts.hackernews.body}`,
    newsletter: `${pkg.posts.newsletter.subject}\n\n${pkg.posts.newsletter.body}`,
    blog: pkg.posts.blog.draft,
    release_notes: renderReleaseNotes(pkg.posts.releaseNotes),
  };
}

/**
 * Deterministic, no-key campaign generation. The copy is intentionally plain,
 * editable, and grounded only in the supplied context.
 */
export function generateLocalTemplatePackage({
  projectName = "My Project",
  notes = "",
  audience = "developers and builders",
  repoUrl = "",
  repoContext = null,
  linksContext = [],
  fileNames = [],
  mediaItems = [],
  selectedChannels = [],
  selectedOutputs = [],
  appUrl = "",
}) {
  const name = clean(projectName, repoContext?.repo || "SignalFlow campaign");
  const description = clean(
    notes,
    repoContext?.readme
      ? truncate(repoContext.readme, 520)
      : `${name} is a product update prepared for a public launch or progress announcement.`,
  );
  const audienceText = clean(audience, "builders, founders, and early users");
  const oneLine = titleFromDescription(name, description);

  const detectedStack = Array.isArray(repoContext?.detectedTechStack)
    ? repoContext.detectedTechStack.filter(Boolean)
    : [];
  const techStack = detectedStack.length ? detectedStack : ["Web application"];

  const detectedFeatures = Array.isArray(repoContext?.detectedFeatures)
    ? repoContext.detectedFeatures.filter(Boolean)
    : [];
  const features = detectedFeatures.length
    ? detectedFeatures.slice(0, 8)
    : [
        "Turns one source brief into channel-specific drafts",
        "Keeps every draft editable before export or publishing",
        "Supports local templates and bring-your-own-model routes",
        "Stores saved campaign packages in the current browser",
      ];

  const confirmedFacts = [
    `The campaign is for ${name}.`,
    `The intended audience is ${audienceText}.`,
  ];
  if (description) confirmedFacts.push(`The supplied product context says: ${truncate(description, 240)}`);
  if (appUrl) confirmedFacts.push(`A live product URL was supplied: ${appUrl}`);
  if (repoUrl) confirmedFacts.push(`A repository reference was supplied: ${repoUrl}`);
  if (detectedStack.length) confirmedFacts.push(`Detected technology: ${detectedStack.join(", ")}.`);
  if (linksContext.length) confirmedFacts.push(`${linksContext.length} public link${linksContext.length === 1 ? " was" : "s were"} available as source context.`);
  if (fileNames.length) confirmedFacts.push(`${fileNames.length} text source${fileNames.length === 1 ? " was" : "s were"} included.`);

  const missingContext = [];
  if (!notes) missingContext.push("A detailed first-person product story was not provided.");
  if (!appUrl) missingContext.push("No canonical product URL was supplied for the call to action.");
  if (!mediaItems.length) missingContext.push("No visual assets were supplied; add screenshots before publishing visual posts.");

  const proofLines = features.slice(0, 4).map((feature) => `• ${feature}`);
  const featureSentence = features.slice(0, 3).map((feature) => sentence(feature)).join(" ");
  const productUrl = appUrl || repoUrl || "your product link";

  const linkedinBody = [
    `I have been working on ${name}.`,
    "",
    sentence(description),
    "",
    `It is built for ${audienceText}. The useful part is straightforward:`,
    ...proofLines,
    "",
    detectedStack.length ? `The current stack includes ${detectedStack.slice(0, 5).join(", ")}.` : "",
    "",
    `I am sharing it now to get specific feedback on the workflow, the output quality, and what should be improved next.`,
    appUrl || repoUrl ? `\n${productUrl}` : "",
  ].filter(Boolean).join("\n");

  const xPosts = [
    `${name}: ${truncate(oneLine, 190)}\n\nBuilt for ${audienceText}.`,
    `${features.slice(0, 3).map((feature) => `• ${truncate(feature, 76)}`).join("\n")}\n\nEvery output stays editable before it leaves the workspace.`,
    `${appUrl || repoUrl ? `See it here: ${productUrl}` : "I am looking for direct feedback from people who ship product updates regularly."}`,
  ];

  const instagramCaption = [
    `${name}.`,
    "",
    truncate(description, 650),
    "",
    features.slice(0, 4).map((feature) => `— ${feature}`).join("\n"),
    "",
    "Built to make the gap between shipping and explaining the work smaller.",
    appUrl || repoUrl ? `\n${productUrl}` : "",
    "",
    "#buildinpublic #productdesign #creatortools #indiedev",
  ].filter(Boolean).join("\n");

  const redditTitle = `I built ${name} to make product updates easier to turn into channel-specific drafts`;
  const redditBody = [
    `I have been working on ${name} for ${audienceText}.`,
    "",
    sentence(description),
    "",
    "The current workflow:",
    ...features.slice(0, 5).map((feature) => `- ${feature}`),
    "",
    detectedStack.length ? `Current stack: ${detectedStack.slice(0, 6).join(", ")}.` : "",
    "",
    "The important limitation is that template mode is deterministic rather than deeply personalized. Every draft is intended to be reviewed and edited before use.",
    "",
    "I would value feedback on the workflow, the channels that matter most, and where the generated copy still feels generic.",
  ].filter(Boolean).join("\n");

  const facebookBody = [
    `${name} is now ready for a closer look.`,
    "",
    sentence(description),
    "",
    featureSentence,
    "",
    `It is designed for ${audienceText}, with a review-first workflow so nothing is treated as published until the person using it approves the final draft.`,
    appUrl || repoUrl ? `\nLearn more: ${productUrl}` : "",
  ].filter(Boolean).join("\n");

  const threadsBody = truncate(
    `${name} is the tool I wanted after repeatedly finishing a product update and then losing another hour rewriting it for every channel. ${oneLine} Every draft stays editable, and unsupported publishing routes stay honest and manual.`,
    500,
  );

  const youtubeTitle = truncate(`${name}: turning one product brief into a complete campaign`, 100);
  const youtubeDescription = [
    sentence(description),
    "",
    "In this walkthrough:",
    "00:00 The problem",
    "00:20 Adding product context",
    "01:05 Choosing channels and a model route",
    "01:45 Reviewing each draft",
    "02:35 Exporting or using an official connector",
    "",
    `Built for ${audienceText}.`,
    appUrl || repoUrl ? `\nProject: ${productUrl}` : "",
  ].filter(Boolean).join("\n");

  const tiktokCaption = truncate(
    `Built ${name} because shipping the product was not the end of the work. One brief now becomes editable drafts for every channel, with review before action. #buildinpublic #saas #productivity`,
    2200,
  );

  const hackerNewsTitle = truncate(`Show HN: ${name} – ${oneLine}`, 80);
  const hackerNewsBody = [
    sentence(description),
    "",
    `It is intended for ${audienceText}. The current implementation accepts notes, public links, repository context, and text files, then creates editable channel-specific drafts and export packages.`,
    "",
    `The implementation currently uses ${techStack.slice(0, 6).join(", ")}.`,
    "",
    "Direct publishing is limited to official connectors that are actually configured. Other destinations use copy/export workflows. Saved campaigns remain in the browser.",
    "",
    "I would appreciate feedback on the context ingestion, the usefulness of the generated formats, and the local-first trade-offs.",
  ].join("\n");

  const newsletterSubject = truncate(`${name}: the latest product update`, 72);
  const newsletterBody = [
    `Hello,`,
    "",
    `I have been working on ${name}.`,
    "",
    sentence(description),
    "",
    "What is included in the current version:",
    ...features.slice(0, 6).map((feature) => `- ${feature}`),
    "",
    `It is designed for ${audienceText}. The next step is to collect focused feedback and improve the parts that still create friction.`,
    appUrl || repoUrl ? `\nExplore the project: ${productUrl}` : "",
    "",
    `— The ${name} team`,
  ].filter(Boolean).join("\n");

  const blogTitle = `Why we built ${name}`;
  const blogDraft = [
    `# ${blogTitle}`,
    "",
    `Finishing a product does not automatically make it easy to explain. The context is spread across notes, links, repositories, screenshots, and decisions that never made it into a public page.`,
    "",
    `That is the gap ${name} is meant to close. ${sentence(description)}`,
    "",
    `## Who it is for`,
    "",
    `${name} is designed for ${audienceText}.`,
    "",
    `## What the current workflow does`,
    "",
    ...features.slice(0, 6).map((feature) => `- ${feature}`),
    "",
    `## Why review comes before publishing`,
    "",
    `Generated content is a draft, not a fact. SignalFlow keeps each output editable and only offers direct publishing when an official connector is configured and the destination confirms success.`,
    "",
    `## What comes next`,
    "",
    `The next improvements will come from real campaigns: better source understanding, stronger platform-specific editing, and clearer publishing handoffs.`,
  ].join("\n");

  const releaseNotes = {
    title: `${name} — current release notes`,
    sections: [
      { title: "What is included", items: features.slice(0, 8) },
      {
        title: "Source context",
        items: [
          notes ? "Product notes were included." : "No detailed product notes were included.",
          repoUrl ? "Repository context was requested." : "No repository URL was supplied.",
          linksContext.length ? `${linksContext.length} public link source${linksContext.length === 1 ? "" : "s"} were processed.` : "No public links were supplied.",
        ],
      },
      {
        title: "Known limitations",
        items: [
          "Template mode uses deterministic copy and should be edited for the exact launch voice.",
          "Image uploads are references in this route; visual content is not interpreted automatically.",
          "Direct publishing depends on configured official platform connectors.",
        ],
      },
    ],
  };

  const pkg = {
    project: {
      name,
      oneLine,
      description,
      audience: audienceText,
      category: "Content workflow / product marketing",
      stage: "Campaign draft",
    },
    context: {
      confirmedFacts,
      inferredFacts: [],
      missingContext,
      features,
      techStack,
      repoInsights: repoContext?.fileTreeSummary?.length
        ? [`Repository context includes ${repoContext.fileTreeSummary.length} indexed nodes.`]
        : [],
      docsInsights: linksContext.slice(0, 5).map((link) => `Source checked: ${link.title || link.url || "public link"}`),
      linkInsights: linksContext.length ? [`${linksContext.length} public source link${linksContext.length === 1 ? "" : "s"} supplied.`] : [],
      mediaInsights: mediaItems.length ? [`${mediaItems.length} media reference${mediaItems.length === 1 ? "" : "s"} supplied.`] : [],
    },
    strategy: {
      coreAngle: `${name} helps ${audienceText} explain product work without rebuilding the campaign separately for every destination.`,
      positioning: `${name} is a review-first campaign workspace that keeps source context, channel drafts, exports, and supported publishing paths together.`,
      hooks: [
        `The product was finished. Explaining it everywhere was still another project.`,
        `One source brief should not become twelve disconnected writing tasks.`,
        `Generated content should stay a draft until a person approves it.`,
      ],
      proofPoints: features.slice(0, 5),
      risks: missingContext,
      safeClaims: [
        "Creates editable channel-specific drafts from supplied context.",
        "Offers deterministic generation without requiring an API key.",
        "Keeps direct publishing behind review and official connectors.",
      ],
      avoidClaims: [
        "Do not claim visual understanding for image-only uploads.",
        "Do not claim a post succeeded unless the platform API confirms it.",
        "Do not present deterministic template output as deeply personalized AI writing.",
      ],
    },
    posts: {
      linkedin: {
        title: `${name} product update`,
        body: linkedinBody,
        hashtags: ["buildinpublic", "productdevelopment", "creatortools"],
        cta: appUrl || repoUrl ? `Explore ${productUrl}` : "Share specific workflow feedback.",
      },
      x: { mode: "thread", posts: xPosts },
      instagram: {
        caption: instagramCaption,
        hashtags: ["buildinpublic", "productdesign", "creatortools", "indiedev"],
        visualDirection: "Use one clear product screenshot, one workflow detail, and one final outcome. Avoid decorative screenshots that do not prove the product claim.",
      },
      reddit: {
        title: redditTitle,
        body: redditBody,
        subredditSuggestions: ["r/SideProject", "r/indiehackers", "r/webdev", "r/selfhosted"],
      },
      facebook: { body: facebookBody, cta: appUrl || repoUrl ? productUrl : "Ask for feedback." },
      threads: { body: threadsBody },
      youtube: {
        title: youtubeTitle,
        description: youtubeDescription,
        tags: ["product demo", "build in public", "creator tools", name],
      },
      tiktok: {
        caption: tiktokCaption,
        hook: "Shipping the feature was only half the work.",
        shotList: [
          "Show the raw product brief.",
          "Show channel selection and generation.",
          "Show editing one draft and the honest publishing route.",
        ],
      },
      hackernews: { title: hackerNewsTitle, body: hackerNewsBody },
      blog: {
        title: blogTitle,
        outline: [
          "The gap between shipping and explaining",
          `Who ${name} is for`,
          "How the review-first workflow works",
          "Limits and next steps",
        ],
        draft: blogDraft,
      },
      newsletter: {
        subject: newsletterSubject,
        preview: truncate(oneLine, 100),
        body: newsletterBody,
      },
      releaseNotes,
    },
    media: {
      screenshotPlan: [
        "The source brief with sensitive details removed.",
        "The selected destination grid.",
        "A platform-specific review preview.",
        "The honest direct-publish or export route.",
      ],
      videoScript: [
        "0:00–0:03 — Show the finished product and the problem of rewriting the announcement.",
        "0:03–0:10 — Add product notes, links, repository context, or text files.",
        "0:10–0:18 — Select destinations and generate the campaign.",
        "0:18–0:28 — Edit two contrasting channel drafts.",
        "0:28–0:34 — Export or use a configured official connector.",
      ],
      voiceoverScript: [
        `I built ${name} because finishing the product did not finish the work of explaining it.`,
        "One source brief becomes editable drafts for every destination.",
        "Nothing is treated as published until I approve it and the destination confirms it.",
      ],
      shotList: [
        "Raw notes or repository context",
        "Channel selector",
        "Editable review preview",
        "Export or connector status",
      ],
      recordingGuide: [
        "Use a real campaign rather than placeholder copy.",
        "Keep private keys and account data outside the recording.",
        "Show one correction to prove that drafts remain editable.",
      ],
      carouselPlan: [
        "Slide 1 — The context is already there",
        "Slide 2 — One brief, multiple destination formats",
        "Slide 3 — Review the copy beside the route",
        "Slide 4 — Direct when official, manual when it is not",
        "Slide 5 — Export the complete campaign",
      ],
      thumbnailIdeas: [
        "A refined split between raw product context and finished channel drafts.",
        "One central campaign card surrounded by recognizable destination icons.",
      ],
      videoTimeline: [
        "0:00 Problem",
        "0:03 Context",
        "0:10 Generation",
        "0:18 Review",
        "0:28 Route and export",
      ],
      altText: [
        `${name} campaign brief and channel selector.`,
        `${name} editable campaign review preview.`,
      ],
      assetChecklist: [
        "One uncluttered product hero screenshot",
        "Two workflow screenshots",
        "One short product walkthrough",
        "One square or portrait social crop",
      ],
      thumbnailPrompt: `Premium editorial product image for ${name}, showing one source brief becoming multiple clean channel drafts. Warm off-white paper, dark ink interface, subtle champagne accents, restrained depth, no neon, no fake metrics.`,
    },
    publishing: {
      platformChecklist: [
        "Verify every factual claim against the supplied source context.",
        "Edit each draft for the account and audience actually publishing it.",
        "Add accessible alt text to visual assets.",
        "Use direct publishing only through a configured official connector.",
      ],
      manualPostingSteps: [
        "Copy the approved draft or export the campaign package.",
        "Open the destination in a separate tab.",
        "Attach the reviewed visual assets.",
        "Check the final platform preview before publishing.",
      ],
      apiPublishingNotes: "LinkedIn, X, and Reddit have official connector paths in the current product. Other destinations remain review, copy, export, and open-platform workflows.",
      warnings: [
        "Template mode is deterministic and should be edited for the exact voice and facts of the campaign.",
      ],
    },
  };

  const allPosts = flattenPosts(pkg);
  const channels = selectedChannels.length ? selectedChannels : DEFAULT_CHANNELS;
  const selectedPosts = Object.fromEntries(channels.map((channel) => [channel, allPosts[channel] || ""]));
  const fileSlug = slug(name);
  const svgContent = `
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#11110f"/>
  <circle cx="1020" cy="80" r="330" fill="#d8bd7c" opacity="0.13"/>
  <rect x="58" y="58" width="1084" height="514" rx="34" fill="#191914" stroke="#ffffff" stroke-opacity="0.12"/>
  <text x="96" y="132" fill="#d8bd7c" font-family="Arial, sans-serif" font-size="25" font-weight="700" letter-spacing="5">SIGNALFLOW CAMPAIGN</text>
  <text x="96" y="236" fill="#fffdf8" font-family="Georgia, serif" font-size="66" font-weight="500">${escapeXml(truncate(name, 30))}</text>
  <foreignObject x="96" y="278" width="920" height="150">
    <div xmlns="http://www.w3.org/1999/xhtml" style="font-family:Arial,sans-serif;color:rgba(255,253,248,.62);font-size:30px;line-height:1.45">${escapeXml(truncate(oneLine, 150))}</div>
  </foreignObject>
  <rect x="96" y="492" width="260" height="48" rx="24" fill="#d8bd7c"/>
  <text x="134" y="524" fill="#171714" font-family="Arial, sans-serif" font-size="19" font-weight="700">REVIEW-READY DRAFT</text>
</svg>`;

  return {
    ok: true,
    providerUsed: "template",
    fallbackUsed: true,
    warnings: [
      "Local template mode created a deterministic campaign without an external model call. Review and personalize every draft.",
    ],
    package: pkg,
    posts: selectedPosts,
    channels,
    outputs: selectedOutputs.length ? selectedOutputs : ["posts", "media_plan", "markdown", "json"],
    markdown: buildMarkdown({ projectName: name, package: pkg, prompt: "Deterministic local template route" }),
    json: pkg,
    media_plan: pkg.media.assetChecklist.map((item, index) => ({
      type: /video|walkthrough|recording/i.test(item) ? "video" : "screenshot",
      title: item,
      summary: `Campaign asset ${index + 1}.`,
    })),
    documents: [
      { title: "Campaign strategy", summary: pkg.strategy.positioning },
      { title: "Release notes", summary: pkg.posts.releaseNotes.title },
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
}
