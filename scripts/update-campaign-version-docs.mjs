import fs from "node:fs";

function replaceOnce(source, before, after, label) {
  const first = source.indexOf(before);
  if (first < 0) throw new Error(`Missing ${label}`);
  if (source.indexOf(before, first + before.length) >= 0) throw new Error(`Ambiguous ${label}`);
  return `${source.slice(0, first)}${after}${source.slice(first + before.length)}`;
}

const architecturePath = "docs/DOMAIN_ARCHITECTURE.md";
let architecture = fs.readFileSync(architecturePath, "utf8");
architecture = replaceOnce(
  architecture,
  `- one \`ChannelDraft\` per channel;\n- one authoritative \`current\` revision inside each draft;\n- optional generated revision history when the current text was edited;\n- source snapshot and generation run metadata;`,
  `- one \`ChannelDraft\` per channel;\n- one authoritative \`current\` revision and one generated baseline inside each draft;\n- optional generated/edited revision history;\n- explicit edited and approval state owned by the current revision;\n- generation-run ownership for every channel baseline;\n- bounded campaign archives for reversible regeneration;\n- editor revision, saved revision, exported revision, timestamps, and saved-source fingerprint;\n- source snapshot and generation run metadata;`,
  "Campaign aggregate version fields",
);
architecture = replaceOnce(
  architecture,
  `The current edited draft is authoritative. Generated copy is never stored as a second active draft.`,
  `The current edited draft is authoritative. Generated copy is a baseline/history record, never a second active draft. Editing clears approval. Regeneration policies and campaign/channel status selectors are pure modules under \`frontend/lib/studio/\`.`,
  "authoritative draft rule",
);
architecture = replaceOnce(
  architecture,
  `- list and migrate saved campaigns;\n- save/upsert a canonical campaign;\n- open a campaign into editor state;\n- delete a saved campaign;`,
  `- list and migrate saved campaigns;\n- read one campaign by stable ID;\n- create a campaign with an injected opaque ID;\n- update only an existing campaign ID;\n- save as a new copy without modifying the original;\n- open a campaign into editor state;\n- delete a saved campaign by ID;`,
  "application service operations",
);
architecture = replaceOnce(
  architecture,
  `JSON:\n\n- uses \`CampaignExport\` schema version \`1\`;\n- separates \`currentDrafts\` from optional \`history\`;\n- includes campaign ID, generation run, source snapshot, provider/model, snapshot timestamp, warnings, and quality states;`,
  `JSON:\n\n- uses \`CampaignExport\` schema version \`1\`;\n- separates \`currentDrafts\` from optional \`history\`;\n- includes generated baselines, edited/approval state, and per-channel generation-run ownership;\n- includes campaign ID, generation run, source snapshot, provider/model, snapshot timestamp, editor revision, save/export timestamps, warnings, and quality states;`,
  "export version metadata",
);
architecture += `\n\n## Edit-safe regeneration and editor state\n\nThe editor reducer schema is version \`2\`, while the additive outer domain schema remains version \`1\`. The reducer owns generated baselines, current posts, channel statuses, approvals, archives, editor revision, saved/exported revisions, timestamps, and the source fingerprint represented by the saved record.\n\nFull regeneration with edited drafts requires an explicit policy: regenerate unedited destinations, archive and regenerate all destinations, or cancel. Per-channel regeneration targets only the active destination. Invalid and all-failed responses are rejected before reducer mutation.\n\nCampaign titles are not identity. The ID service allocates campaign IDs; create, update, save-as-copy, read, list, and delete operate by ID.\n\nSee [CAMPAIGN_EDITING_AND_VERSIONING.md](CAMPAIGN_EDITING_AND_VERSIONING.md) and [CAMPAIGN_SCHEMA_MIGRATION.md](CAMPAIGN_SCHEMA_MIGRATION.md).\n`;
fs.writeFileSync(architecturePath, architecture);

const migrationPath = "docs/CAMPAIGN_SCHEMA_MIGRATION.md";
let migration = fs.readFileSync(migrationPath, "utf8");
migration = replaceOnce(
  migration,
  `# Campaign schema v1 migration and rollback`,
  `# Campaign schema v1 and editor-state v2 migration and rollback`,
  "migration title",
);
migration = replaceOnce(
  migration,
  `- optional \`ChannelDraft.history\` for different original generated copy;\n- portable source snapshot and generation run metadata;`,
  `- one generated baseline, one authoritative current revision, and optional \`ChannelDraft.history\`;\n- edited, approval, quality, and per-channel generation-run state;\n- bounded regeneration archives;\n- editor revision, saved/exported revisions, save/export timestamps, and saved-source fingerprint;\n- portable source snapshot and generation run metadata;`,
  "migration canonical fields",
);
migration = replaceOnce(
  migration,
  `7. Duplicate generated payload fields are removed.\n8. The canonical record is written back to browser storage.`,
  `7. Missing generated baselines are reconstructed from generated history or the authoritative current draft.\n8. Missing editor version state defaults to a saved revision using the record timestamp and generation fingerprint.\n9. Missing archives default to an empty list; existing archives and draft history are preserved and deduplicated.\n10. Duplicate generated payload fields are removed.\n11. The canonical record is written back to browser storage.`,
  "migration steps",
);
migration = replaceOnce(
  migration,
  `- preserves existing generated-history revisions;\n- does not duplicate an identical generated revision;\n- keeps current edited drafts authoritative;`,
  `- preserves generated baselines, approvals, channel state, archives, and existing history;\n- does not duplicate an identical generated or edited revision;\n- keeps current edited drafts authoritative;\n- updates only the stable current ID; Save as copy allocates a new ID and preserves the original;`,
  "resave behavior",
);
migration = replaceOnce(
  migration,
  `- save → reopen → re-save history preservation;\n- deterministic Markdown/JSON;`,
  `- save → reopen → re-save generated baseline, approval, archive, and editor-state preservation;\n- duplicate-title create/update/copy/read/delete behavior;\n- browser quota failure propagation and export-recovery messaging;\n- deterministic Markdown/JSON;`,
  "migration verification",
);
migration += `\n\n## Additive editor-state compatibility\n\nThe outer domain record remains schema version \`1\`. ChannelDraft and Campaign gained additive fields that older schema-v1 fixtures may omit. The canonical reader reconstructs safe defaults and rewrites the complete record on the next repository read/save.\n\nThe in-memory editor reducer uses schema version \`2\`; it is not serialized as an independent domain record. A future incompatible domain change must increment \`DOMAIN_SCHEMA_VERSION\` rather than overloading this additive migration.\n`;
fs.writeFileSync(migrationPath, migration);
