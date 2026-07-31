from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "frontend/lib/transfer/transferApplication.mjs"
content = PATH.read_text(encoding="utf-8")

old = '''    const campaigns = (await selectRecords(repositories.campaignRepository, campaignIds)).map(migrateLegacyCampaign);
    const assets = await selectRecords(repositories.assetRepository, assetIds);
    const sourceArtifacts = await selectRecords(repositories.sourceArtifactRepository, sourceArtifactIds);
    const explicitApprovals = await selectRecords(repositories.approvalRepository, approvalIds);
    const exports = await selectRecords(repositories.exportRepository, exportIds);
    const derivedApprovals = approvedDraftRecords(campaigns, applicationClock);
'''

new = '''    const campaigns = (await selectRecords(repositories.campaignRepository, campaignIds)).map(migrateLegacyCampaign);
    const selectedCampaignIdSet = new Set(campaigns.map((campaign) => campaign.campaignId));

    const selectedSourceArtifacts = await selectRecords(repositories.sourceArtifactRepository, sourceArtifactIds);
    const sourceArtifacts = campaignIds.length && !sourceArtifactIds.length
      ? selectedSourceArtifacts.filter((artifact) => selectedCampaignIdSet.has(artifact.campaignId))
      : selectedSourceArtifacts;

    const selectedApprovals = await selectRecords(repositories.approvalRepository, approvalIds);
    const explicitApprovals = campaignIds.length && !approvalIds.length
      ? selectedApprovals.filter((approval) => selectedCampaignIdSet.has(approval.campaignId))
      : selectedApprovals;

    const selectedExports = await selectRecords(repositories.exportRepository, exportIds);
    const exports = campaignIds.length && !exportIds.length
      ? selectedExports.filter((item) => selectedCampaignIdSet.has(item.campaignId))
      : selectedExports;

    const relatedAssetIds = new Set(
      sourceArtifacts.map((artifact) => artifact.assetId).filter(Boolean),
    );
    for (const campaign of campaigns) {
      for (const file of campaign.sourceFiles || []) {
        if (file?.assetId) relatedAssetIds.add(file.assetId);
      }
      for (const media of campaign.sourceSnapshot?.normalizedSource?.media || []) {
        if (media?.assetId) relatedAssetIds.add(media.assetId);
      }
    }
    const selectedAssets = await selectRecords(repositories.assetRepository, assetIds);
    const assets = campaignIds.length && !assetIds.length
      ? selectedAssets.filter((asset) => relatedAssetIds.has(asset.assetId))
      : selectedAssets;

    const derivedApprovals = approvedDraftRecords(campaigns, applicationClock);
'''

if content.count(old) != 1:
    raise RuntimeError(f"campaign-scoped transfer selection anchor count: {content.count(old)}")

PATH.write_text(content.replace(old, new, 1), encoding="utf-8")
