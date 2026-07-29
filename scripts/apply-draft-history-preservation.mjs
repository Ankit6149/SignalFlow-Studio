import fs from "node:fs";

function replaceOnce(source, search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not locate ${label}.`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`${label} is not unique.`);
  return `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

const campaignPath = "frontend/lib/domain/campaign.mjs";
let campaign = fs.readFileSync(campaignPath, "utf8");

campaign = replaceOnce(
  campaign,
  `function createDraft({ campaignId, channel, currentContent, generatedContent, qualityState, updatedAt }) {
  const generated = text(generatedContent);
  const current = text(currentContent);
  const edited = Boolean(generated && generated !== current);
  const history = edited
    ? [createRevision({
        campaignId,
        channel,
        content: generated,
        origin: "generated",
        createdAt: updatedAt,
      })]
    : [];

  return createDomainRecord("ChannelDraft", {
`,
  `function createDraft({
  campaignId,
  channel,
  currentContent,
  generatedContent,
  qualityState,
  updatedAt,
  existingDraft = null,
}) {
  const generated = text(generatedContent);
  const current = text(currentContent);
  const edited = Boolean(generated && generated !== current);
  const history = Array.isArray(existingDraft?.history)
    ? portableClone(existingDraft.history)
    : [];

  if (edited && !history.some((revision) => revision?.content === generated && revision?.origin === "generated")) {
    history.push(createRevision({
      campaignId,
      channel,
      content: generated,
      origin: "generated",
      createdAt: updatedAt,
    }));
  }

  return createDomainRecord("ChannelDraft", {
`,
  "draft history merge",
);

campaign = replaceOnce(
  campaign,
  `      qualityState: statuses[channel]?.status,
      updatedAt,
    });
`,
  `      qualityState: statuses[channel]?.status || input.existingDrafts?.[channel]?.qualityState,
      updatedAt,
      existingDraft: input.existingDrafts?.[channel] || null,
    });
`,
  "existing draft input",
);

fs.writeFileSync(campaignPath, campaign);

const testPath = "frontend/tests/campaignExport.test.mjs";
let tests = fs.readFileSync(testPath, "utf8");

tests = replaceOnce(
  tests,
  `  assert.equal(JSON.parse(reexported.content).campaign.currentDrafts.linkedin.content, campaignInput().posts.linkedin);
});
`,
  `  assert.equal(JSON.parse(reexported.content).campaign.currentDrafts.linkedin.content, campaignInput().posts.linkedin);

  const resaved = await application.saveCampaign({
    ...campaignInput(),
    campaignId: listed.campaignId,
    posts: restored.posts,
    result: restored.result,
    generationRun: restored.generationRun,
    updatedAt: "2026-07-30T02:00:00.000Z",
  });
  assert.equal(resaved.drafts.linkedin.current.content, campaignInput().posts.linkedin);
  assert.equal(resaved.drafts.linkedin.history[0].content, campaignInput().result.posts.linkedin);
});
`,
  "re-save history regression",
);

fs.writeFileSync(testPath, tests);
