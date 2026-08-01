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

# Temporary diagnostic: this file is removed before the verified product commit.
test_path = ROOT / "frontend/tests/portableTransferApplication.test.mjs"
test_content = test_path.read_text(encoding="utf-8")
diagnostic_anchor = '''  const hostedAssets = await createStoreBackedAssetRepository({ store: hosted.store }).list();
  assert.equal(hostedAssets[0].transferProvenance.sourceAssetId, "asset-transfer-1");
'''
diagnostic_replacement = '''  const hostedAssets = await createStoreBackedAssetRepository({ store: hosted.store }).list();
  console.error("CANONICAL_ASSET_DIAGNOSTIC", JSON.stringify(hostedAssets[0], null, 2));
  assert.equal(hostedAssets[0].transferProvenance.sourceAssetId, "asset-transfer-1");
'''
if test_content.count(diagnostic_anchor) != 1:
    raise RuntimeError(f"asset diagnostic anchor count: {test_content.count(diagnostic_anchor)}")
test_path.write_text(test_content.replace(diagnostic_anchor, diagnostic_replacement, 1), encoding="utf-8")
