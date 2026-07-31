from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "frontend/lib/transfer/transferApplication.mjs"
content = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global content
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    content = content.replace(old, new, 1)


replace_once(
'''function updateReferences(value, idMaps) {
  if (Array.isArray(value)) return value.map((item) => updateReferences(item, idMaps));
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === "string") {
      if (key === "campaignId" && idMaps.campaign.has(item)) result[key] = idMaps.campaign.get(item);
      else if (key === "assetId" && idMaps.asset.has(item)) result[key] = idMaps.asset.get(item);
      else if (key === "sourceArtifactId" && idMaps.sourceArtifact.has(item)) result[key] = idMaps.sourceArtifact.get(item);
      else if (key === "draftId" && idMaps.draft.has(item)) result[key] = idMaps.draft.get(item);
      else if (key === "blobId" && idMaps.blob.has(item)) result[key] = idMaps.blob.get(item);
      else result[key] = item;
    } else {
      result[key] = updateReferences(item, idMaps);
    }
  }
  return result;
}
''',
'''function mappedReference(key, value, idMaps) {
  if (typeof value !== "string") return value;
  if (key === "campaignId" && idMaps.campaign.has(value)) return idMaps.campaign.get(value);
  if (["assetId", "assetIds", "parentAssetIds", "derivedAssetIds", "inputAssetIds", "outputAssetIds"].includes(key)
    && idMaps.asset.has(value)) return idMaps.asset.get(value);
  if (["sourceArtifactId", "sourceArtifactIds", "parentSourceArtifactIds", "derivedSourceArtifactIds", "outputSourceArtifactIds"].includes(key)
    && idMaps.sourceArtifact.has(value)) return idMaps.sourceArtifact.get(value);
  if (key === "draftId" && idMaps.draft.has(value)) return idMaps.draft.get(value);
  if (key === "blobId" && idMaps.blob.has(value)) return idMaps.blob.get(value);
  return value;
}

function updateReferences(value, idMaps, parentKey = "") {
  if (Array.isArray(value)) {
    return value.map((item) => typeof item === "string"
      ? mappedReference(parentKey, item, idMaps)
      : updateReferences(item, idMaps, parentKey));
  }
  if (!value || typeof value !== "object") return value;
  const result = {};
  for (const [key, item] of Object.entries(value)) {
    result[key] = typeof item === "string"
      ? mappedReference(key, item, idMaps)
      : updateReferences(item, idMaps, key);
  }
  return result;
}
''',
"array reference remapping",
)

replace_once(
'''    const selectedSourceArtifacts = await selectRecords(repositories.sourceArtifactRepository, sourceArtifactIds);
    const sourceArtifacts = campaignIds.length && !sourceArtifactIds.length
      ? selectedSourceArtifacts.filter((artifact) => selectedCampaignIdSet.has(artifact.campaignId))
      : selectedSourceArtifacts;
''',
'''    const selectedSourceArtifacts = await selectRecords(repositories.sourceArtifactRepository, sourceArtifactIds);
    const scopedSourceArtifacts = campaignIds.length && !sourceArtifactIds.length
      ? selectedSourceArtifacts.filter((artifact) => selectedCampaignIdSet.has(artifact.campaignId))
      : selectedSourceArtifacts;
    const sourceArtifactsById = new Map(scopedSourceArtifacts.map((artifact) => [artifact.sourceArtifactId, artifact]));
    if (campaignIds.length) {
      for (const campaign of campaigns) {
        for (const file of campaign.sourceFiles || []) {
          const artifact = file?.sourceArtifact;
          if (artifact?.sourceArtifactId && !sourceArtifactsById.has(artifact.sourceArtifactId)) {
            sourceArtifactsById.set(artifact.sourceArtifactId, {
              ...artifact,
              campaignId: campaign.campaignId,
              workspaceId: artifact.workspaceId || campaign.workspaceId || "browser-local",
            });
          }
        }
      }
    }
    const sourceArtifacts = Array.from(sourceArtifactsById.values());
''',
"campaign embedded source artifacts",
)

replace_once(
'''    const selectedAssets = await selectRecords(repositories.assetRepository, assetIds);
    const assets = campaignIds.length && !assetIds.length
      ? selectedAssets.filter((asset) => relatedAssetIds.has(asset.assetId))
      : selectedAssets;
''',
'''    const selectedAssets = await selectRecords(repositories.assetRepository, assetIds);
    const scopedAssets = campaignIds.length && !assetIds.length
      ? selectedAssets.filter((asset) => relatedAssetIds.has(asset.assetId))
      : selectedAssets;
    const assetsById = new Map(scopedAssets.map((asset) => [asset.assetId, asset]));
    if (campaignIds.length) {
      for (const campaign of campaigns) {
        for (const file of campaign.sourceFiles || []) {
          const asset = file?.asset;
          if (asset?.assetId && relatedAssetIds.has(asset.assetId) && !assetsById.has(asset.assetId)) {
            assetsById.set(asset.assetId, {
              ...asset,
              campaignId: campaign.campaignId,
              workspaceId: asset.workspaceId || campaign.workspaceId || "browser-local",
            });
          }
        }
      }
    }
    const assets = Array.from(assetsById.values());
''',
"campaign embedded assets",
)

PATH.write_text(content, encoding="utf-8")
