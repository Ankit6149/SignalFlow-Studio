from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"Expected one {label}, found {count}")
    return source.replace(before, after, 1)


campaign_path = Path("frontend/lib/domain/campaign.mjs")
campaign = campaign_path.read_text()
campaign = replace_once(
    campaign,
    '''    archives: cleanArchives(input.archives, input.existingArchives),
    editorState,
    brief: cleanBrief(input.brief || {}),''',
    '''    archives: cleanArchives(input.archives, input.existingArchives),
    editorState,
    transferProvenance: input.transferProvenance ? portableClone(input.transferProvenance) : null,
    brief: cleanBrief(input.brief || {}),''',
    "campaign transfer provenance field",
)
campaign = replace_once(
    campaign,
    '''    archives: input?.archives || [],
    editorState: input?.editorState || {''',
    '''    archives: input?.archives || [],
    transferProvenance: input?.transferProvenance || null,
    editorState: input?.editorState || {''',
    "legacy transfer provenance migration",
)
campaign = replace_once(
    campaign,
    '''    archives: portableClone(campaign.archives || []),
    revision: campaign.editorState?.revision || 1,''',
    '''    archives: portableClone(campaign.archives || []),
    transferProvenance: campaign.transferProvenance ? portableClone(campaign.transferProvenance) : null,
    revision: campaign.editorState?.revision || 1,''',
    "editor transfer provenance projection",
)
campaign_path.write_text(campaign)

application_path = Path("frontend/lib/transfer/transferApplication.mjs")
application = application_path.read_text()
application = replace_once(
    application,
    '''const RECORD_CONFIG = Object.freeze({
  campaign: { repository: "campaignRepository", idField: "campaignId", kind: "Campaign" },
  asset: { repository: "assetRepository", idField: "assetId", kind: "Asset" },
  sourceArtifact: { repository: "sourceArtifactRepository", idField: "sourceArtifactId", kind: "SourceArtifact" },
  approval: { repository: "approvalRepository", idField: "approvalId", kind: "Approval" },
  export: { repository: "exportRepository", idField: "exportId", kind: "Export" },
});''',
    '''const RECORD_CONFIG = Object.freeze({
  campaign: { repository: "campaignRepository", idField: "campaignId", kind: "Campaign", provenanceField: "sourceCampaignId" },
  asset: { repository: "assetRepository", idField: "assetId", kind: "Asset", provenanceField: "sourceAssetId" },
  sourceArtifact: { repository: "sourceArtifactRepository", idField: "sourceArtifactId", kind: "SourceArtifact", provenanceField: "sourceArtifactId" },
  approval: { repository: "approvalRepository", idField: "approvalId", kind: "Approval", provenanceField: "sourceApprovalId" },
  export: { repository: "exportRepository", idField: "exportId", kind: "Export", provenanceField: "sourceExportId" },
});''',
    "transfer provenance field map",
)
application = replace_once(
    application,
    '''function sourceFieldFor(kind) {
  return `source${kind[0].toUpperCase()}${kind.slice(1)}Id`;
}''',
    '''function sourceFieldFor(kind) {
  const field = RECORD_CONFIG[kind]?.provenanceField;
  if (!field) throw new TypeError(`Unknown transfer provenance kind: ${kind}.`);
  return field;
}''',
    "transfer provenance field selector",
)
application_path.write_text(application)
