from __future__ import annotations

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


def insert_before(content: str, marker: str, addition: str, label: str) -> str:
    if addition.strip() in content:
        return content
    return replace_once(content, marker, addition + marker, label)


def patch_source_contract() -> None:
    path = "frontend/lib/domain/sourceArtifacts.mjs"
    content = read(path).replace("{ lowercase = False }", "{ lowercase = false }")
    content = insert_before(
        content,
        "function requiredId(value, field) {\n",
        '''function assertSupportedSourceSchema(input) {
  if (input?.schemaVersion === undefined || input?.schemaVersion === null) return;
  if (!Number.isInteger(input.schemaVersion)) {
    throw new SourceContractError("invalid_source_schema", "Source schema version must be an integer.");
  }
  if (input.schemaVersion > SOURCE_CONTRACT_SCHEMA_VERSION) {
    throw new SourceContractError(
      "future_source_schema",
      `Source schema ${input.schemaVersion} is newer than supported schema ${SOURCE_CONTRACT_SCHEMA_VERSION}. Upgrade SignalFlow before importing it.`,
    );
  }
}

''',
        "source schema guard",
    )
    content = replace_once(
        content,
        '''export function normalizeAsset(input = {}, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  const exclusions = [];
''',
        '''export function normalizeAsset(input = {}, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  assertSupportedSourceSchema(input);
  const exclusions = [];
''',
        "asset schema guard",
    )
    content = replace_once(
        content,
        '''    storageRef,
    userMetadata: sanitizedUserMetadata(sanitized.userMetadata || {
''',
        '''    storageRef,
    blobId: storageRef?.blobId || null,
    contentType: mimeType,
    availability: text(sanitized.availability, storageRef ? "available" : "metadata_only"),
    userMetadata: sanitizedUserMetadata(sanitized.userMetadata || {
''',
        "asset compatibility aliases",
    )
    content = replace_once(
        content,
        '''    normalizationExclusions: exclusions,
    createdAt,
    updatedAt,
  });
}

function defaultUsability''',
        '''    normalizationExclusions: exclusions,
    transferProvenance: sanitized.transferProvenance ? portableClone(sanitized.transferProvenance) : null,
    importedHistoricalRecord: Boolean(sanitized.importedHistoricalRecord),
    createdAt,
    updatedAt,
  });
}

function defaultUsability''',
        "asset transfer provenance",
    )
    content = replace_once(
        content,
        '''export function normalizeSourceArtifact(input = {}, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  const exclusions = [];
''',
        '''export function normalizeSourceArtifact(input = {}, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  assertSupportedSourceSchema(input);
  const exclusions = [];
''',
        "source artifact schema guard",
    )
    content = replace_once(
        content,
        '''    normalizationExclusions: exclusions,
    createdAt,
    updatedAt,
  });
}

export function normalizeAssetProcessing''',
        '''    normalizationExclusions: exclusions,
    transferProvenance: sanitized.transferProvenance ? portableClone(sanitized.transferProvenance) : null,
    importedHistoricalRecord: Boolean(sanitized.importedHistoricalRecord),
    createdAt,
    updatedAt,
  });
}

export function normalizeAssetProcessing''',
        "source transfer provenance",
    )
    content = replace_once(
        content,
        '''export function normalizeAssetProcessing(input = {}, {
  workspaceId,
  now = new Date().toISOString(),
} = {}) {
  const exclusions = [];
''',
        '''export function normalizeAssetProcessing(input = {}, {
  workspaceId,
  now = new Date().toISOString(),
} = {}) {
  assertSupportedSourceSchema(input);
  const exclusions = [];
''',
        "processing schema guard",
    )
    content = replace_once(
        content,
        '''    normalizationExclusions: exclusions,
    createdAt,
    updatedAt: timestamp(sanitized.updatedAt || sanitized.completedAt || createdAt),
  });
}

export function migrateLegacyAsset''',
        '''    normalizationExclusions: exclusions,
    transferProvenance: sanitized.transferProvenance ? portableClone(sanitized.transferProvenance) : null,
    importedHistoricalRecord: Boolean(sanitized.importedHistoricalRecord),
    createdAt,
    updatedAt: timestamp(sanitized.updatedAt || sanitized.completedAt || createdAt),
  });
}

export function migrateLegacyAsset''',
        "processing transfer provenance",
    )
    content = replace_once(
        content,
        '''export function migrateLegacySourceArtifact(input = {}, context = {}) {
  if (input?.kind === "SourceArtifact" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION) {
    return normalizeSourceArtifact(parseDomainRecord(input, "SourceArtifact"), context);
  }
  return normalizeSourceArtifact({
    ...input,
    sourceKind: input.sourceKind || input.artifactType || SOURCE_KINDS.UPLOAD,
''',
        '''export function migrateLegacySourceArtifact(input = {}, context = {}) {
  if (input?.kind === "SourceArtifact" && input?.schemaVersion === DOMAIN_SCHEMA_VERSION) {
    return normalizeSourceArtifact(parseDomainRecord(input, "SourceArtifact"), context);
  }
  const requestedKind = text(input.sourceKind || input.artifactType).toLowerCase();
  const legacyKind = SOURCE_KIND_VALUES.has(requestedKind)
    ? requestedKind
    : requestedKind === "note" ? SOURCE_KINDS.NOTE : SOURCE_KINDS.UPLOAD;
  return normalizeSourceArtifact({
    ...input,
    sourceKind: legacyKind,
''',
        "legacy source kind migration",
    )
    write(path, content)


def patch_contracts_and_ports() -> None:
    path = "frontend/lib/domain/contracts.mjs"
    content = read(path)
    content = replace_once(
        content,
        '  ASSET: "Asset",\n',
        '  ASSET: "Asset",\n  ASSET_PROCESSING: "AssetProcessing",\n',
        "domain kind",
    )
    content = replace_once(
        content,
        '  Asset: { idField: "assetId", owner: "workspace", required: ["assetId", "assetType"] },\n',
        '  Asset: { idField: "assetId", owner: "workspace", required: ["assetId", "assetType"] },\n  AssetProcessing: { idField: "processingId", owner: "workspace", required: ["processingId", "sourceArtifactId", "status"] },\n',
        "domain processing contract",
    )
    write(path, content)

    path = "frontend/lib/domain/ports.mjs"
    content = read(path)
    content = replace_once(
        content,
        '  sourceArtifactRepository: ["list", "get", "upsert", "remove"],\n',
        '  sourceArtifactRepository: ["list", "get", "upsert", "remove"],\n  assetProcessingRepository: ["list", "get", "upsert", "remove"],\n',
        "processing port",
    )
    write(path, content)

    path = "frontend/tests/domainContracts.test.mjs"
    content = read(path)
    content = replace_once(
        content,
        '  Asset: { assetId: "asset-1", assetType: "image" },\n',
        '  Asset: { assetId: "asset-1", assetType: "image" },\n  AssetProcessing: { processingId: "processing-1", sourceArtifactId: "artifact-1", status: "queued" },\n',
        "domain test processing fixture",
    )
    write(path, content)


def patch_transfer_adapters() -> None:
    path = "frontend/lib/infrastructure/transferAdapters.mjs"
    content = read(path)
    content = replace_once(
        content,
        'import { createDomainRecord, parseDomainRecord, portableClone, stableStringify } from "../domain/contracts.mjs";\n',
        '''import { createDomainRecord, parseDomainRecord, portableClone, stableStringify } from "../domain/contracts.mjs";
import {
  migrateLegacyAsset,
  migrateLegacySourceArtifact,
  normalizeAssetProcessing,
} from "../domain/sourceArtifacts.mjs";
''',
        "transfer adapter imports",
    )
    content = replace_once(
        content,
        '  sourceArtifact: { portName: "sourceArtifactRepository", kind: "SourceArtifact", idField: "sourceArtifactId" },\n',
        '  sourceArtifact: { portName: "sourceArtifactRepository", kind: "SourceArtifact", idField: "sourceArtifactId" },\n  assetProcessing: { portName: "assetProcessingRepository", kind: "AssetProcessing", idField: "processingId" },\n',
        "processing repository spec",
    )
    content = replace_once(
        content,
        '''function normalizeRecord(kind, idField, value) {
  if (value?.kind === kind) return parseDomainRecord(value, kind);
  return createDomainRecord(kind, { ...value, [idField]: value?.[idField] });
}
''',
        '''function normalizeRecord(kind, idField, value) {
  if (kind === "Asset") {
    return migrateLegacyAsset(value, {
      workspaceId: value?.workspaceId || "legacy-local",
      campaignId: value?.campaignId || null,
      now: value?.updatedAt || value?.createdAt || new Date(0).toISOString(),
    });
  }
  if (kind === "SourceArtifact") {
    return migrateLegacySourceArtifact(value, {
      workspaceId: value?.workspaceId || "legacy-local",
      campaignId: value?.campaignId || null,
      now: value?.updatedAt || value?.createdAt || new Date(0).toISOString(),
    });
  }
  if (kind === "AssetProcessing") {
    return normalizeAssetProcessing(value, {
      workspaceId: value?.workspaceId || "legacy-local",
      now: value?.updatedAt || value?.createdAt || new Date(0).toISOString(),
    });
  }
  if (value?.kind === kind) return parseDomainRecord(value, kind);
  return createDomainRecord(kind, { ...value, [idField]: value?.[idField] });
}
''',
        "canonical transfer normalization",
    )
    addition = '''export function createMemoryAssetProcessingRepository(initial = []) {
  return memoryRepository("assetProcessing", initial);
}

export function createStoreBackedAssetProcessingRepository({ store, prefix = "asset-processing/" } = {}) {
  return storeRepository("assetProcessing", { store, prefix });
}

export function createBrowserAssetProcessingRepository({ getStorage, key = "signalflow_asset_processing_v1", limit = 1000 } = {}) {
  return browserRepository("assetProcessing", { getStorage, key, limit });
}

'''
    content = insert_before(
        content,
        'export function createMemoryApprovalRepository(initial = []) {\n',
        addition,
        "processing repository exports",
    )
    write(path, content)


def patch_portable_archive() -> None:
    path = "frontend/lib/transfer/portableArchive.mjs"
    content = read(path)
    content = replace_once(
        content,
        '  sourceArtifacts = [],\n  approvals = [],\n',
        '  sourceArtifacts = [],\n  processingRecords = [],\n  approvals = [],\n',
        "archive processing input",
    )
    content = replace_once(
        content,
        '    sourceArtifacts,\n    approvals,\n',
        '    sourceArtifacts,\n    processingRecords,\n    approvals,\n',
        "archive processing payload",
    )
    content = replace_once(
        content,
        '      sourceArtifactCount: payload.sourceArtifacts.length,\n      approvalCount: payload.approvals.length,\n',
        '      sourceArtifactCount: payload.sourceArtifacts.length,\n      processingRecordCount: payload.processingRecords.length,\n      approvalCount: payload.approvals.length,\n',
        "archive processing manifest",
    )
    content = replace_once(
        content,
        '      sourceArtifacts: archive.payload?.sourceArtifacts?.length || 0,\n      approvals: archive.payload?.approvals?.length || 0,\n',
        '      sourceArtifacts: archive.payload?.sourceArtifacts?.length || 0,\n      processingRecords: archive.payload?.processingRecords?.length || 0,\n      approvals: archive.payload?.approvals?.length || 0,\n',
        "archive processing validation count",
    )
    write(path, content)


def patch_browser_transfer() -> None:
    path = "frontend/lib/application/browserTransferApplication.mjs"
    content = read(path)
    content = replace_once(
        content,
        '  createBrowserApprovalRepository,\n  createBrowserAssetRepository,\n',
        '  createBrowserApprovalRepository,\n  createBrowserAssetProcessingRepository,\n  createBrowserAssetRepository,\n',
        "browser transfer processing import",
    )
    content = replace_once(
        content,
        '    sourceArtifactRepository: createBrowserSourceArtifactRepository({ getStorage }),\n    approvalRepository: createBrowserApprovalRepository({ getStorage }),\n',
        '    sourceArtifactRepository: createBrowserSourceArtifactRepository({ getStorage }),\n    assetProcessingRepository: createBrowserAssetProcessingRepository({ getStorage }),\n    approvalRepository: createBrowserApprovalRepository({ getStorage }),\n',
        "browser transfer processing composition",
    )
    write(path, content)


def patch_transfer_application() -> None:
    path = "frontend/lib/transfer/transferApplication.mjs"
    content = read(path)
    content = replace_once(
        content,
        '  sourceArtifact: { repository: "sourceArtifactRepository", idField: "sourceArtifactId", kind: "SourceArtifact", provenanceField: "sourceArtifactId" },\n',
        '  sourceArtifact: { repository: "sourceArtifactRepository", idField: "sourceArtifactId", kind: "SourceArtifact", provenanceField: "sourceArtifactId" },\n  assetProcessing: { repository: "assetProcessingRepository", idField: "processingId", kind: "AssetProcessing", provenanceField: "sourceProcessingId" },\n',
        "transfer processing config",
    )
    content = replace_once(
        content,
        '  sourceArtifactRepository,\n  approvalRepository,\n',
        '  sourceArtifactRepository,\n  assetProcessingRepository,\n  approvalRepository,\n',
        "transfer processing argument",
    )
    content = replace_once(
        content,
        '    sourceArtifactRepository: assertPort("sourceArtifactRepository", sourceArtifactRepository),\n    approvalRepository: assertPort("approvalRepository", approvalRepository),\n',
        '    sourceArtifactRepository: assertPort("sourceArtifactRepository", sourceArtifactRepository),\n    assetProcessingRepository: assertPort("assetProcessingRepository", assetProcessingRepository),\n    approvalRepository: assertPort("approvalRepository", approvalRepository),\n',
        "transfer processing repository",
    )
    content = replace_once(
        content,
        '    sourceArtifactIds = [],\n    approvalIds = [],\n',
        '    sourceArtifactIds = [],\n    processingIds = [],\n    approvalIds = [],\n',
        "transfer processing selection input",
    )
    content = replace_once(
        content,
        '''    const selectedApprovals = await selectRecords(repositories.approvalRepository, approvalIds);
''',
        '''    const selectedProcessingRecords = await selectRecords(repositories.assetProcessingRepository, processingIds);
    const selectedSourceArtifactIdSet = new Set(sourceArtifacts.map((artifact) => artifact.sourceArtifactId));
    const processingRecords = campaignIds.length && !processingIds.length
      ? selectedProcessingRecords.filter((record) =>
        selectedCampaignIdSet.has(record.campaignId)
          || selectedSourceArtifactIdSet.has(record.sourceArtifactId))
      : selectedProcessingRecords;

    const selectedApprovals = await selectRecords(repositories.approvalRepository, approvalIds);
''',
        "transfer processing scoped selection",
    )
    content = replace_once(
        content,
        '''    const relatedAssetIds = new Set(
      sourceArtifacts.map((artifact) => artifact.assetId).filter(Boolean),
    );
''',
        '''    const relatedAssetIds = new Set(
      sourceArtifacts.flatMap((artifact) => [artifact.assetId, ...(artifact.assetIds || [])]).filter(Boolean),
    );
    for (const record of processingRecords) {
      for (const assetId of [...(record.inputAssetIds || []), ...(record.outputAssetIds || [])]) {
        if (assetId) relatedAssetIds.add(assetId);
      }
    }
''',
        "transfer canonical asset references",
    )
    content = replace_once(
        content,
        '''      for (const file of campaign.sourceFiles || []) {
        if (file?.assetId) relatedAssetIds.add(file.assetId);
      }
''',
        '''      for (const file of campaign.sourceFiles || []) {
        if (file?.assetId) relatedAssetIds.add(file.assetId);
        if (file?.asset?.assetId) relatedAssetIds.add(file.asset.assetId);
        for (const assetId of file?.sourceArtifact?.assetIds || []) relatedAssetIds.add(assetId);
      }
''',
        "transfer nested campaign asset references",
    )
    content = replace_once(
        content,
        '      sourceArtifacts,\n      approvals,\n',
        '      sourceArtifacts,\n      processingRecords,\n      approvals,\n',
        "transfer archive processing output",
    )
    content = replace_once(
        content,
        '      sourceArtifact: await repositories.sourceArtifactRepository.list(),\n      approval: await repositories.approvalRepository.list(),\n',
        '      sourceArtifact: await repositories.sourceArtifactRepository.list(),\n      assetProcessing: await repositories.assetProcessingRepository.list(),\n      approval: await repositories.approvalRepository.list(),\n',
        "transfer preview processing existing",
    )
    content = replace_once(
        content,
        '      sourceArtifact: archive.payload?.sourceArtifacts || [],\n      approval: archive.payload?.approvals || [],\n',
        '      sourceArtifact: archive.payload?.sourceArtifacts || [],\n      assetProcessing: archive.payload?.processingRecords || [],\n      approval: archive.payload?.approvals || [],\n',
        "transfer preview processing source",
    )
    content = replace_once(
        content,
        '      sourceArtifact: new Map(),\n      approval: new Map(),\n',
        '      sourceArtifact: new Map(),\n      assetProcessing: new Map(),\n      approval: new Map(),\n',
        "transfer processing id map",
    )
    content = replace_once(
        content,
        '      sourceArtifact: archive.payload?.sourceArtifacts || [],\n      approval: archive.payload?.approvals || [],\n',
        '      sourceArtifact: archive.payload?.sourceArtifacts || [],\n      assetProcessing: archive.payload?.processingRecords || [],\n      approval: archive.payload?.approvals || [],\n',
        "transfer import processing source",
    )
    content = replace_once(
        content,
        '      sourceArtifact: await repositories.sourceArtifactRepository.list(),\n      approval: await repositories.approvalRepository.list(),\n',
        '      sourceArtifact: await repositories.sourceArtifactRepository.list(),\n      assetProcessing: await repositories.assetProcessingRepository.list(),\n      approval: await repositories.approvalRepository.list(),\n',
        "transfer import processing existing",
    )
    content = replace_once(
        content,
        '      for (const source of sourceCollections.sourceArtifact) await processRecord("sourceArtifact", source);\n      for (const source of sourceCollections.approval) await processRecord("approval", source);\n',
        '      for (const source of sourceCollections.sourceArtifact) await processRecord("sourceArtifact", source);\n      for (const source of sourceCollections.assetProcessing) await processRecord("assetProcessing", source);\n      for (const source of sourceCollections.approval) await processRecord("approval", source);\n',
        "transfer processing import order",
    )
    write(path, content)


def patch_campaign_freshness() -> None:
    path = "frontend/lib/studio/campaignFreshness.mjs"
    content = read(path)
    content = 'import { sourceArtifactSnapshotReference } from "../domain/sourceArtifacts.mjs";\n\n' + content
    content = replace_once(
        content,
        '''  const media = sortCanonical(
    (Array.isArray(files) ? files : []).map((file) => ({
      name: normalizeText(file?.name),
      type: normalizeText(file?.type || "file").toLowerCase(),
      size: Math.max(0, Number(file?.size) || 0),
      description: normalizeText(file?.description),
    })),
  );
''',
        '''  const media = sortCanonical(
    (Array.isArray(files) ? files : []).map((file) => sourceArtifactSnapshotReference(
      file?.sourceArtifact || {
        ...file,
        assetId: file?.asset?.assetId || file?.assetId,
      },
      {
        workspaceId: file?.sourceArtifact?.workspaceId || file?.asset?.workspaceId || "browser-local",
        campaignId: file?.sourceArtifact?.campaignId || file?.asset?.campaignId || null,
        now: file?.sourceArtifact?.createdAt || file?.asset?.createdAt || file?.createdAt || new Date(0).toISOString(),
      },
    )),
  );
''',
        "freshness canonical source refs",
    )
    write(path, content)


def patch_page() -> None:
    path = "frontend/app/page.js"
    content = read(path)
    content = insert_before(
        content,
        'import { parseCapabilitySnapshot } from "../lib/capabilities/capabilityContract.mjs";\n',
        '''import {
  createUploadSourceBundle,
  projectGenerationMediaItem,
} from "../lib/domain/sourceArtifacts.mjs";
''',
        "page canonical source import",
    )
    old_loop = '''    const nextFiles = [];
    const nextText = [];
    let extractionFailures = 0;
    for (const file of accepted) {
      const isText =
        file.type.startsWith("text/") ||
        /\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);
      let extracted = false;
      if (isText && file.size <= 500000) {
        try {
          const text = await file.text();
          nextText.push(`FILE: ${file.name}\n${text.slice(0, 12000)}`);
          extracted = true;
        } catch {
          extractionFailures += 1;
        }
      }
      nextFiles.push({
        name: file.name,
        type: file.type || "file",
        size: file.size,
        extracted,
        description: extracted
          ? "Text content extracted in the browser."
          : isText && file.size <= 500000
            ? "Browser extraction failed; the file remains an asset reference."
            : "Asset metadata supplied as a creative reference; visual analysis is not enabled in this route.",
      });
    }
'''
    new_loop = '''    const nextFiles = [];
    const nextText = [];
    let extractionFailures = 0;
    for (const file of accepted) {
      const isText =
        file.type.startsWith("text/") ||
        /\.(md|txt|json|csv|log|js|jsx|ts|tsx|py|go|rs|java|cpp|c|h|html|css)$/i.test(file.name);
      let extractedText = "";
      let extractionFailed = false;
      if (isText && file.size <= 500000) {
        try {
          extractedText = (await file.text()).slice(0, 12000);
          nextText.push(`FILE: ${file.name}\n${extractedText}`);
        } catch {
          extractionFailed = true;
          extractionFailures += 1;
        }
      }
      const now = new Date().toISOString();
      const bundle = createUploadSourceBundle({
        file: {
          name: file.name,
          type: file.type || "application/octet-stream",
          size: file.size,
          clientReferenceId: createClientId("upload"),
          truncated: extractedText.length === 12000,
        },
        extractedText,
        extractionFailed,
        workspaceId: "browser-local",
        campaignId: currentCampaignId || null,
        assetId: createClientId("asset"),
        sourceArtifactId: createClientId("source-artifact"),
        now,
      });
      nextFiles.push({
        name: bundle.sourceArtifact.originalName,
        type: bundle.sourceArtifact.mimeType,
        size: bundle.sourceArtifact.byteSize,
        extracted: bundle.sourceArtifact.extraction.state === "complete",
        description: bundle.sourceArtifact.userMetadata.description,
        asset: bundle.asset,
        sourceArtifact: bundle.sourceArtifact,
        createdAt: now,
      });
    }
'''
    content = replace_once(content, old_loop, new_loop, "page canonical upload")
    content = replace_once(
        content,
        '''        media_items: files.map(({ name, type, size, description }) => ({
          name,
          type,
          size,
          description,
        })),
''',
        '''        assets: files.map((file) => file.asset).filter(Boolean),
        source_artifacts: files.map((file) => file.sourceArtifact).filter(Boolean),
        media_items: files.map((file) => projectGenerationMediaItem(
          file.sourceArtifact || {
            ...file,
            assetId: file.asset?.assetId || file.assetId,
          },
          {
            workspaceId: file.sourceArtifact?.workspaceId || file.asset?.workspaceId || "browser-local",
            campaignId: file.sourceArtifact?.campaignId || file.asset?.campaignId || currentCampaignId || null,
            now: file.sourceArtifact?.createdAt || file.asset?.createdAt || file.createdAt || new Date(0).toISOString(),
          },
        )),
''',
        "page generation source projection",
    )
    write(path, content)


def patch_api_route() -> None:
    path = "frontend/app/api/launch_kit/route.js"
    content = read(path)
    content = insert_before(
        content,
        'import { ingestGitHubRepo } from "../../../lib/context/github";\n',
        '''import {
  projectGenerationMediaItem,
  validateSourceGraph,
} from "../../../lib/domain/sourceArtifacts.mjs";
''',
        "API source contract import",
    )
    content = replace_once(
        content,
        '''    const warnings = [];
    let repoContext = null;
    const linksContext = [];
    const mediaItems = Array.isArray(body.media_items) ? [...body.media_items] : [];
    const githubToken = normalizeTextInput(body.github_token) || normalizeTextInput(body.githubToken);
''',
        '''    const warnings = [];
    let repoContext = null;
    const linksContext = [];
    let canonicalSources = { assets: [], sourceArtifacts: [], processingRecords: [] };
    const suppliedAssets = Array.isArray(body.assets) ? body.assets : [];
    const suppliedArtifacts = Array.isArray(body.source_artifacts || body.sourceArtifacts)
      ? (body.source_artifacts || body.sourceArtifacts)
      : [];
    const suppliedProcessing = Array.isArray(body.processing_records || body.processingRecords)
      ? (body.processing_records || body.processingRecords)
      : [];
    if (suppliedAssets.length || suppliedArtifacts.length || suppliedProcessing.length) {
      try {
        const declaredWorkspaces = Array.from(new Set([
          ...suppliedAssets.map((item) => normalizeTextInput(item?.workspaceId)),
          ...suppliedArtifacts.map((item) => normalizeTextInput(item?.workspaceId)),
          ...suppliedProcessing.map((item) => normalizeTextInput(item?.workspaceId)),
        ].filter(Boolean)));
        if (declaredWorkspaces.length > 1) {
          throw Object.assign(new Error("Source records from different workspaces cannot be mixed in one generation request."), {
            code: "cross_workspace_reference",
          });
        }
        canonicalSources = validateSourceGraph({
          workspaceId: declaredWorkspaces[0] || "request-workspace",
          assets: suppliedAssets,
          sourceArtifacts: suppliedArtifacts,
          processingRecords: suppliedProcessing,
        });
      } catch (error) {
        return new Response(JSON.stringify({
          ok: false,
          error: "Source contract validation failed.",
          sourceIssue: {
            code: error.code || "invalid_source_contract",
            message: error.message,
          },
        }), {
          status: 400,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    const mediaItems = canonicalSources.sourceArtifacts.length
      ? canonicalSources.sourceArtifacts.map((artifact) => projectGenerationMediaItem(artifact))
      : Array.isArray(body.media_items) ? [...body.media_items] : [];
    const githubToken = normalizeTextInput(body.github_token) || normalizeTextInput(body.githubToken);
''',
        "API source validation boundary",
    )
    write(path, content)


def patch_mcp() -> None:
    path = "mcp/lib/tools.mjs"
    content = read(path)
    content = replace_once(
        content,
        'import { parseCapabilitySnapshot } from "../../frontend/lib/capabilities/capabilityContract.mjs";\n',
        '''import { parseCapabilitySnapshot } from "../../frontend/lib/capabilities/capabilityContract.mjs";
import {
  projectGenerationMediaItem,
  validateSourceGraph,
} from "../../frontend/lib/domain/sourceArtifacts.mjs";
''',
        "MCP source contract import",
    )
    content = replace_once(
        content,
        '''        documentText: {
          type: "array",
          items: { type: "string" },
        },
''',
        '''        documentText: {
          type: "array",
          items: { type: "string" },
        },
        assets: {
          description: "Canonical SignalFlow Asset records. Runtime file objects, credentials, temporary URLs, and local paths are rejected or excluded by the shared contract.",
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        sourceArtifacts: {
          description: "Canonical SignalFlow SourceArtifact records linked to the supplied assets.",
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
        processingRecords: {
          description: "Canonical AssetProcessing records for derived outputs and extraction/transformation lineage.",
          type: "array",
          items: { type: "object", additionalProperties: true },
        },
''',
        "MCP canonical source schema",
    )
    content = replace_once(
        content,
        '''    const provider = requireProvider(args.provider);
    const channels = requireChannels(args.channels);

    const data = await signalFlowRequest("/api/launch_kit", {
''',
        '''    const provider = requireProvider(args.provider);
    const channels = requireChannels(args.channels);
    const rawAssets = Array.isArray(args.assets) ? args.assets : [];
    const rawArtifacts = Array.isArray(args.sourceArtifacts) ? args.sourceArtifacts : [];
    const rawProcessing = Array.isArray(args.processingRecords) ? args.processingRecords : [];
    const declaredWorkspaces = Array.from(new Set([
      ...rawAssets.map((item) => String(item?.workspaceId || "").trim()),
      ...rawArtifacts.map((item) => String(item?.workspaceId || "").trim()),
      ...rawProcessing.map((item) => String(item?.workspaceId || "").trim()),
    ].filter(Boolean)));
    if (declaredWorkspaces.length > 1) {
      throw new Error("Source records from different workspaces cannot be mixed in one MCP generation request.");
    }
    const canonicalSources = rawAssets.length || rawArtifacts.length || rawProcessing.length
      ? validateSourceGraph({
        workspaceId: declaredWorkspaces[0] || "mcp-workspace",
        assets: rawAssets,
        sourceArtifacts: rawArtifacts,
        processingRecords: rawProcessing,
      })
      : { assets: [], sourceArtifacts: [], processingRecords: [] };

    const data = await signalFlowRequest("/api/launch_kit", {
''',
        "MCP source validation",
    )
    content = replace_once(
        content,
        '''        document_text: Array.isArray(args.documentText) ? args.documentText : [],
        media_items: [],
''',
        '''        document_text: Array.isArray(args.documentText) ? args.documentText : [],
        assets: canonicalSources.assets,
        source_artifacts: canonicalSources.sourceArtifacts,
        processing_records: canonicalSources.processingRecords,
        media_items: canonicalSources.sourceArtifacts.map((artifact) => projectGenerationMediaItem(artifact)),
''',
        "MCP source payload",
    )
    write(path, content)


def main() -> None:
    patch_source_contract()
    patch_contracts_and_ports()
    patch_transfer_adapters()
    patch_portable_archive()
    patch_browser_transfer()
    patch_transfer_application()
    patch_campaign_freshness()
    patch_page()
    patch_api_route()
    patch_mcp()


if __name__ == "__main__":
    main()
