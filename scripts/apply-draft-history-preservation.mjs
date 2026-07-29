import fs from "node:fs";

const path = "frontend/lib/domain/campaign.mjs";
let source = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  const index = source.indexOf(search);
  if (index < 0) throw new Error(`Could not locate ${label}.`);
  if (source.indexOf(search, index + search.length) >= 0) throw new Error(`${label} is not unique.`);
  source = `${source.slice(0, index)}${replacement}${source.slice(index + search.length)}`;
}

replaceOnce(
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

replaceOnce(
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

fs.writeFileSync(path, source);
