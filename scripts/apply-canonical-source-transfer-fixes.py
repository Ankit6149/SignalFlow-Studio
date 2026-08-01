from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

transfer_path = ROOT / "frontend/lib/transfer/transferApplication.mjs"
transfer = transfer_path.read_text(encoding="utf-8")

privacy_prefilter = '''    processingRecords = processingRecords.filter((record) => !privateSourceIds.has(record.sourceArtifactId));
'''
if transfer.count(privacy_prefilter) != 1:
    raise RuntimeError(f"processing privacy prefilter anchor count: {transfer.count(privacy_prefilter)}")
transfer = transfer.replace(privacy_prefilter, "", 1)
transfer_path.write_text(transfer, encoding="utf-8")

source_path = ROOT / "frontend/lib/domain/sourceArtifacts.mjs"
source = source_path.read_text(encoding="utf-8")n
asset_ids_anchor = '''  const contentHashValue = contentHash(sanitized.contentHash || sanitized.hash || extraction.textHash);
  const ownership = {
'''
asset_ids_replacement = '''  const contentHashValue = contentHash(sanitized.contentHash || sanitized.hash || extraction.textHash);
  const assetIds = uniqueTextList(sanitized.assetIds || (sanitized.assetId ? [sanitized.assetId] : []));
  const ownership = {
'''
if source.count(asset_ids_anchor) != 1:
    raise RuntimeError(f"source asset IDs anchor count: {source.count(asset_ids_anchor)}")
source = source.replace(asset_ids_anchor, asset_ids_replacement, 1)

source_id_anchor = '''    assetIds: uniqueTextList(sanitized.assetIds || (sanitized.assetId ? [sanitized.assetId] : [])),
    extraction,
'''
source_id_replacement = '''    assetIds,
    assetId: assetIds[0] || null,
    extraction,
'''
if source.count(source_id_anchor) != 1:
    raise RuntimeError(f"source scalar asset compatibility anchor count: {source.count(source_id_anchor)}")
source = source.replace(source_id_anchor, source_id_replacement, 1)
source_path.write_text(source, encoding="utf-8")

# This migration helper must never survive the verified product commit.
Path(__file__).unlink()
