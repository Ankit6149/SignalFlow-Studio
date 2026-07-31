from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return content.replace(old, new, 1)


def patch_source_contract() -> None:
    path = "frontend/lib/domain/sourceArtifacts.mjs"
    content = read(path)
    content = replace_once(
        content,
        '''  return portableClone({
    state,
    textHash: contentHash(input.textHash),
    charCount,
''',
        '''  return portableClone({
    state,
    textHash: contentHash(input.textHash),
    textFingerprint: text(input.textFingerprint) || null,
    charCount,
''',
        "extraction text fingerprint",
    )
    content = replace_once(
        content,
        '''  const textValue = text(extractedText);
  const textHash = textValue ? `sha256:${fnv1a64(textValue).padEnd(64, "0")}` : null;
''',
        '''  const textValue = text(extractedText);
  const textFingerprint = textValue ? `sftext1-${fnv1a64(textValue)}` : null;
''',
        "upload extraction fingerprint",
    )
    content = replace_once(
        content,
        '''      textHash,
      charCount: textValue.length,
''',
        '''      textHash: file.textHash || null,
      textFingerprint,
      charCount: textValue.length,
''',
        "upload extraction fingerprint field",
    )
    content = replace_once(
        content,
        '''    for (const parentId of asset.parentAssetIds) {
      const parent = assetsById.get(parentId);
      if (parent && parent.workspaceId !== asset.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Derived assets cannot reference another workspace.", { assetId: asset.assetId, parentId });
      }
    }
''',
        '''    for (const parentId of asset.parentAssetIds) {
      const parent = assetsById.get(parentId);
      if (!parent) {
        throw new SourceContractError("missing_asset_reference", "Derived asset references a missing parent asset.", { assetId: asset.assetId, parentId });
      }
      if (parent.workspaceId !== asset.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Derived assets cannot reference another workspace.", { assetId: asset.assetId, parentId });
      }
    }
    for (const derivedId of asset.derivedAssetIds) {
      const derived = assetsById.get(derivedId);
      if (!derived) {
        throw new SourceContractError("missing_asset_reference", "Asset references a missing derived asset.", { assetId: asset.assetId, derivedId });
      }
      if (derived.workspaceId !== asset.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Asset derivation links cannot cross workspaces.", { assetId: asset.assetId, derivedId });
      }
    }
''',
        "asset graph completeness",
    )
    content = replace_once(
        content,
        '''    for (const assetId of artifact.assetIds) {
      const asset = assetsById.get(assetId);
      if (!asset) throw new SourceContractError("missing_asset_reference", "Source artifact references a missing asset.", { sourceArtifactId: artifact.sourceArtifactId, assetId });
      if (asset.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source artifact and asset must share a workspace.", { sourceArtifactId: artifact.sourceArtifactId, assetId });
      }
    }
''',
        '''    for (const assetId of artifact.assetIds) {
      const asset = assetsById.get(assetId);
      if (!asset) throw new SourceContractError("missing_asset_reference", "Source artifact references a missing asset.", { sourceArtifactId: artifact.sourceArtifactId, assetId });
      if (asset.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source artifact and asset must share a workspace.", { sourceArtifactId: artifact.sourceArtifactId, assetId });
      }
    }
    for (const parentId of artifact.parentSourceArtifactIds) {
      const parent = artifactsById.get(parentId);
      if (!parent) {
        throw new SourceContractError("missing_source_artifact", "Source artifact references a missing parent artifact.", { sourceArtifactId: artifact.sourceArtifactId, parentId });
      }
      if (parent.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source provenance cannot cross workspaces.", { sourceArtifactId: artifact.sourceArtifactId, parentId });
      }
    }
    for (const derivedId of artifact.derivedSourceArtifactIds) {
      const derived = artifactsById.get(derivedId);
      if (!derived) {
        throw new SourceContractError("missing_source_artifact", "Source artifact references a missing derived artifact.", { sourceArtifactId: artifact.sourceArtifactId, derivedId });
      }
      if (derived.workspaceId !== artifact.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Source derivation links cannot cross workspaces.", { sourceArtifactId: artifact.sourceArtifactId, derivedId });
      }
    }
''',
        "source graph completeness",
    )
    content = replace_once(
        content,
        '''    for (const assetId of [...record.inputAssetIds, ...record.outputAssetIds]) {
      const asset = assetsById.get(assetId);
      if (!asset) throw new SourceContractError("missing_asset_reference", "Processing record references a missing asset.", { processingId: record.processingId, assetId });
      if (asset.workspaceId !== record.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Processing record cannot reference another workspace.", { processingId: record.processingId, assetId });
      }
    }
''',
        '''    for (const assetId of [...record.inputAssetIds, ...record.outputAssetIds]) {
      const asset = assetsById.get(assetId);
      if (!asset) throw new SourceContractError("missing_asset_reference", "Processing record references a missing asset.", { processingId: record.processingId, assetId });
      if (asset.workspaceId !== record.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Processing record cannot reference another workspace.", { processingId: record.processingId, assetId });
      }
    }
    for (const artifactId of record.outputSourceArtifactIds) {
      const output = artifactsById.get(artifactId);
      if (!output) {
        throw new SourceContractError("missing_source_artifact", "Processing record references a missing output source artifact.", { processingId: record.processingId, artifactId });
      }
      if (output.workspaceId !== record.workspaceId) {
        throw new SourceContractError("cross_workspace_reference", "Processing output cannot cross workspaces.", { processingId: record.processingId, artifactId });
      }
    }
''',
        "processing graph completeness",
    )
    write(path, content)


def patch_repositories() -> None:
    path = "frontend/lib/infrastructure/transferAdapters.mjs"
    content = read(path)
    content = replace_once(
        content,
        '''    async list() {
      const keys = await store.list(prefix);
      const values = await Promise.all(keys.map((key) => store.get(key)));
      return sortByUpdated(values.filter(Boolean).map((value) => normalizeRecord(kind, idField, value))).map(clone);
    },
    async get(id) {
      const value = await store.get(keyFor(id));
      return value ? clone(normalizeRecord(kind, idField, value)) : null;
    },
''',
        '''    async list() {
      const keys = await store.list(prefix);
      const entries = await Promise.all(keys.map(async (key) => ({ key, value: await store.get(key) })));
      const normalized = [];
      for (const { key, value } of entries) {
        if (!value) continue;
        const record = normalizeRecord(kind, idField, value);
        normalized.push(record);
        if (stableStringify(value) !== stableStringify(record)) await store.set(key, record);
      }
      return sortByUpdated(normalized).map(clone);
    },
    async get(id) {
      const key = keyFor(id);
      const value = await store.get(key);
      if (!value) return null;
      const record = normalizeRecord(kind, idField, value);
      if (stableStringify(value) !== stableStringify(record)) await store.set(key, record);
      return clone(record);
    },
''',
        "store migration writeback",
    )
    content = replace_once(
        content,
        '''  async function list() {
    return sortByUpdated(read().map((value) => normalizeRecord(kind, idField, value))).map(clone);
  }
''',
        '''  async function list() {
    const raw = read();
    const normalized = sortByUpdated(raw.map((value) => normalizeRecord(kind, idField, value)));
    if (stableStringify(raw) !== stableStringify(normalized)) write(normalized);
    return normalized.map(clone);
  }
''',
        "browser migration writeback",
    )
    write(path, content)


def patch_archive_exclusions() -> None:
    path = "frontend/lib/transfer/portableArchive.mjs"
    content = read(path)
    content = replace_once(
        content,
        '''  blobEntries = [],
  signer = null,
} = {}) {
''',
        '''  blobEntries = [],
  preflightExclusions = [],
  signer = null,
} = {}) {
''',
        "archive preflight exclusions input",
    )
    content = replace_once(
        content,
        '''      exclusions,
    },
''',
        '''      exclusions: [...portableClone(preflightExclusions || []), ...exclusions],
    },
''',
        "archive preflight exclusions manifest",
    )
    write(path, content)


def patch_transfer_privacy() -> None:
    path = "frontend/lib/transfer/transferApplication.mjs"
    content = read(path)
    content = replace_once(
        content,
        '''    const sourceArtifacts = Array.from(sourceArtifactsById.values());

    const selectedProcessingRecords = await selectRecords(repositories.assetProcessingRepository, processingIds);
''',
        '''    let sourceArtifacts = Array.from(sourceArtifactsById.values());
    const preflightExclusions = [];
    const privateSourceIds = new Set(
      sourceArtifacts
        .filter((artifact) => artifact.privacy?.exportAllowed === false)
        .map((artifact) => artifact.sourceArtifactId),
    );
    for (const sourceArtifactId of privateSourceIds) {
      preflightExclusions.push({
        path: `payload.sourceArtifacts.${sourceArtifactId}`,
        reason: "source artifact export disabled by privacy policy",
      });
    }
    sourceArtifacts = sourceArtifacts.filter((artifact) => !privateSourceIds.has(artifact.sourceArtifactId));

    const selectedProcessingRecords = await selectRecords(repositories.assetProcessingRepository, processingIds);
''',
        "source privacy exclusions",
    )
    content = replace_once(
        content,
        '''    const processingRecords = campaignIds.length && !processingIds.length
      ? selectedProcessingRecords.filter((record) =>
        selectedCampaignIdSet.has(record.campaignId)
          || selectedSourceArtifactIdSet.has(record.sourceArtifactId))
      : selectedProcessingRecords;
''',
        '''    let processingRecords = campaignIds.length && !processingIds.length
      ? selectedProcessingRecords.filter((record) =>
        selectedCampaignIdSet.has(record.campaignId)
          || selectedSourceArtifactIdSet.has(record.sourceArtifactId))
      : selectedProcessingRecords;
    processingRecords = processingRecords.filter((record) => !privateSourceIds.has(record.sourceArtifactId));
''',
        "processing privacy filtering",
    )
    content = replace_once(
        content,
        '''    const assets = Array.from(assetsById.values());

    const derivedApprovals = approvedDraftRecords(campaigns, applicationClock);
''',
        '''    let assets = Array.from(assetsById.values());
    const privateAssetIds = new Set(
      assets
        .filter((asset) => asset.privacy?.exportAllowed === false)
        .map((asset) => asset.assetId),
    );
    for (const assetId of privateAssetIds) {
      preflightExclusions.push({
        path: `payload.assets.${assetId}`,
        reason: "asset export disabled by privacy policy",
      });
    }
    assets = assets.filter((asset) => !privateAssetIds.has(asset.assetId));
    sourceArtifacts = sourceArtifacts.filter((artifact) => {
      const blocked = (artifact.assetIds || []).some((assetId) => privateAssetIds.has(assetId));
      if (blocked) {
        preflightExclusions.push({
          path: `payload.sourceArtifacts.${artifact.sourceArtifactId}`,
          reason: "source artifact references a non-exportable asset",
        });
      }
      return !blocked;
    });
    const exportableSourceIds = new Set(sourceArtifacts.map((artifact) => artifact.sourceArtifactId));
    const exportableAssetIds = new Set(assets.map((asset) => asset.assetId));
    processingRecords = processingRecords.filter((record) => {
      const blocked = !exportableSourceIds.has(record.sourceArtifactId)
        || [...(record.inputAssetIds || []), ...(record.outputAssetIds || [])]
          .some((assetId) => !exportableAssetIds.has(assetId));
      if (blocked) {
        preflightExclusions.push({
          path: `payload.processingRecords.${record.processingId}`,
          reason: "processing record references excluded source or asset data",
        });
      }
      return !blocked;
    });

    const derivedApprovals = approvedDraftRecords(campaigns, applicationClock);
''',
        "asset privacy exclusions",
    )
    content = replace_once(
        content,
        '''      blobEntries,
      signer,
    });
''',
        '''      blobEntries,
      preflightExclusions,
      signer,
    });
''',
        "archive preflight exclusions output",
    )
    write(path, content)


def main() -> None:
    patch_source_contract()
    patch_repositories()
    patch_archive_exclusions()
    patch_transfer_privacy()


if __name__ == "__main__":
    main()
