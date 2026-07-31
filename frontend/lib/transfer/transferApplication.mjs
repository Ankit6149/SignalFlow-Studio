import {
  assertPort,
  createSystemClock,
  createSystemIdService,
} from "../domain/ports.mjs";
import {
  createDomainRecord,
  portableClone,
  stableStringify,
} from "../domain/contracts.mjs";
import {
  campaignToEditorState,
  createCampaignAggregate,
  migrateLegacyCampaign,
} from "../domain/campaign.mjs";
import {
  createPortableArchive,
  decodeBlobPayload,
  encodeBlobPayload,
  sha256Hex,
  validatePortableArchive,
} from "./portableArchive.mjs";

export const TRANSFER_CONFLICT_POLICIES = Object.freeze({
  SKIP: "skip",
  COPY: "copy",
  REPLACE: "replace",
});

export const TRANSFER_STATUSES = Object.freeze({
  PREPARING: "preparing",
  VALIDATING: "validating",
  WARNINGS_FOUND: "warnings_found",
  BLOCKED: "blocked",
  SELECTING_DESTINATION: "selecting_destination",
  UPLOADING: "uploading",
  IMPORTING: "importing",
  PARTIALLY_IMPORTED: "partially_imported",
  COMPLETE: "complete",
  CANCELLED: "cancelled",
  FAILED: "failed",
  ROLLED_BACK: "rolled_back",
});

const RECORD_CONFIG = Object.freeze({
  campaign: { repository: "campaignRepository", idField: "campaignId", kind: "Campaign", provenanceField: "sourceCampaignId" },
  asset: { repository: "assetRepository", idField: "assetId", kind: "Asset", provenanceField: "sourceAssetId" },
  sourceArtifact: { repository: "sourceArtifactRepository", idField: "sourceArtifactId", kind: "SourceArtifact", provenanceField: "sourceArtifactId" },
  approval: { repository: "approvalRepository", idField: "approvalId", kind: "Approval", provenanceField: "sourceApprovalId" },
  export: { repository: "exportRepository", idField: "exportId", kind: "Export", provenanceField: "sourceExportId" },
});

function text(value) {
  return String(value ?? "").trim();
}

function safeArchiveSegment(value) {
  const safe = text(value).replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^[-.]+|[-.]+$/g, "");
  return safe || "blob";
}

function unique(values) {
  return Array.from(new Set(values.filter(Boolean)));
}

function approvedDraftRecords(campaigns, clock) {
  const records = [];
  for (const campaign of campaigns) {
    for (const [channel, draft] of Object.entries(campaign.drafts || {})) {
      if (!draft?.approved) continue;
      records.push(createDomainRecord("Approval", {
        approvalId: `approval-${campaign.campaignId}-${channel}-${draft.current?.revisionId || "current"}`,
        campaignId: campaign.campaignId,
        draftId: draft.draftId,
        channel,
        revisionId: draft.current?.revisionId || null,
        status: "approved",
        historical: true,
        createdAt: draft.updatedAt || campaign.updatedAt || clock.now(),
      }));
    }
  }
  return records;
}

async function selectRecords(repository, ids = []) {
  if (!ids.length) return repository.list();
  const records = await Promise.all(ids.map((id) => repository.get(id)));
  return records.filter(Boolean);
}

function recordKey(kind, id) {
  return `${kind}:${id}`;
}

function provenanceMatch(record, archive, sourceId, field) {
  const provenance = record?.transferProvenance;
  return Boolean(
    provenance
      && provenance.archiveId === archive.archiveId
      && provenance[field] === sourceId,
  );
}

function sourceFieldFor(kind) {
  const field = RECORD_CONFIG[kind]?.provenanceField;
  if (!field) throw new TypeError(`Unknown transfer provenance kind: ${kind}.`);
  return field;
}

function conflictTarget(existing, archive, source, kind, idField) {
  const sourceId = source[idField];
  const provenanceField = sourceFieldFor(kind);
  return existing.find((record) => provenanceMatch(record, archive, sourceId, provenanceField))
    || existing.find((record) => record[idField] === sourceId)
    || null;
}

function conflictSummary({ existing, archive, sourceRecords, kind, idField }) {
  return sourceRecords.map((source) => {
    const target = conflictTarget(existing, archive, source, kind, idField);
    if (!target) return null;
    const sameImport = provenanceMatch(target, archive, source[idField], sourceFieldFor(kind));
    return {
      kind,
      sourceId: source[idField],
      targetId: target[idField],
      type: sameImport ? "already_imported" : "id_collision",
      availablePolicies: Object.values(TRANSFER_CONFLICT_POLICIES),
      recommendedPolicy: "skip",
    };
  }).filter(Boolean);
}

function transferProvenance({ archive, sourceId, kind, importedAt, destinationWorkspaceId }) {
  return {
    archiveId: archive.archiveId,
    archiveSchemaVersion: archive.schemaVersion,
    sourceDeployment: portableClone(archive.sourceDeployment || {}),
    [sourceFieldFor(kind)]: sourceId,
    importedAt,
    destinationWorkspaceId,
    historical: true,
  };
}

function reportRecord({
  transferReportId,
  archive,
  status,
  destinationWorkspaceId = null,
  conflictPolicy = "skip",
  startedAt,
  updatedAt,
  completedAt = null,
  validation = null,
  summary = {},
  items = [],
  journal = [],
  warnings = [],
  errors = [],
  rollback = null,
} = {}) {
  return createDomainRecord("TransferReport", {
    transferReportId,
    archiveId: archive.archiveId,
    archiveDigest: archive.integrity?.digest || null,
    archiveSchemaVersion: archive.schemaVersion,
    status,
    destinationWorkspaceId,
    conflictPolicy,
    startedAt,
    updatedAt,
    completedAt,
    validation: validation ? portableClone(validation) : null,
    summary: portableClone(summary),
    items: portableClone(items),
    journal: portableClone(journal),
    warnings: portableClone(warnings),
    errors: portableClone(errors),
    rollback: rollback ? portableClone(rollback) : null,
  });
}

function importedRecordId({ source, target, policy, idField, idService, kind }) {
  if (!target) return source[idField];
  if (policy === TRANSFER_CONFLICT_POLICIES.COPY) return idService.create(kind);
  return target[idField];
}

function updateReferences(value, idMaps) {
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

function rebuildCampaign({ source, targetId, destinationWorkspaceId, provenance, idMaps }) {
  const canonical = migrateLegacyCampaign(source);
  const editor = campaignToEditorState(canonical);
  const campaign = createCampaignAggregate({
    ...editor,
    campaignId: targetId,
    workspaceId: destinationWorkspaceId,
    projectId: canonical.projectId,
    title: canonical.title,
    status: canonical.status,
    createdAt: canonical.createdAt,
    updatedAt: canonical.updatedAt,
    existingDrafts: canonical.drafts,
    existingArchives: canonical.archives,
    transferProvenance: provenance,
  });
  for (const [channel, originalDraft] of Object.entries(canonical.drafts || {})) {
    const importedDraft = campaign.drafts?.[channel];
    if (originalDraft?.draftId && importedDraft?.draftId) idMaps.draft.set(originalDraft.draftId, importedDraft.draftId);
  }
  return campaign;
}

function buildMetadataRecord({ source, kind, idField, targetId, destinationWorkspaceId, provenance, idMaps }) {
  const mapped = updateReferences(source, idMaps);
  return createDomainRecord(kind, {
    ...mapped,
    [idField]: targetId,
    workspaceId: destinationWorkspaceId,
    transferProvenance: provenance,
    importedHistoricalRecord: true,
  });
}

async function restoreJournalEntry(entry, repositories, blobStorage) {
  if (entry.kind === "blob") {
    if (entry.previous === null) await blobStorage.remove(entry.id);
    else await blobStorage.put(entry.id, decodeBlobPayload(entry.previous));
    return;
  }
  const config = RECORD_CONFIG[entry.kind];
  const repository = repositories[config.repository];
  if (entry.previous === null) await repository.remove(entry.id);
  else await repository.upsert(entry.previous);
}

export function createTransferApplication({
  campaignRepository,
  assetRepository,
  sourceArtifactRepository,
  approvalRepository,
  exportRepository,
  blobStorage,
  transferReportRepository,
  signer = null,
  clock = createSystemClock(),
  idService = createSystemIdService("signalflow-transfer"),
} = {}) {
  const repositories = {
    campaignRepository: assertPort("campaignRepository", campaignRepository),
    assetRepository: assertPort("assetRepository", assetRepository),
    sourceArtifactRepository: assertPort("sourceArtifactRepository", sourceArtifactRepository),
    approvalRepository: assertPort("approvalRepository", approvalRepository),
    exportRepository: assertPort("exportRepository", exportRepository),
  };
  const blobs = assertPort("blobStorage", blobStorage);
  const reports = assertPort("transferReportRepository", transferReportRepository);
  const applicationClock = assertPort("clock", clock);
  const applicationIds = assertPort("idService", idService);
  if (signer) assertPort("archiveSigner", signer);

  async function exportSelection({
    campaignIds = [],
    assetIds = [],
    sourceArtifactIds = [],
    approvalIds = [],
    exportIds = [],
    sourceDeployment = {},
  } = {}) {
    const createdAt = applicationClock.now();
    const campaigns = (await selectRecords(repositories.campaignRepository, campaignIds)).map(migrateLegacyCampaign);
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
    const approvals = [...explicitApprovals];
    const approvalIdsSeen = new Set(approvals.map((approval) => approval.approvalId));
    for (const approval of derivedApprovals) {
      if (!approvalIdsSeen.has(approval.approvalId)) approvals.push(approval);
    }

    const blobEntries = [];
    for (const asset of assets) {
      if (!asset.blobId) continue;
      const value = await blobs.get(asset.blobId);
      if (value === null || value === undefined) continue;
      const encoded = encodeBlobPayload(value);
      blobEntries.push({
        blobId: asset.blobId,
        assetId: asset.assetId,
        archivePath: `blobs/${safeArchiveSegment(asset.blobId)}.bin`,
        contentType: asset.contentType || "application/octet-stream",
        ...encoded,
      });
    }

    return createPortableArchive({
      archiveId: applicationIds.create("archive"),
      createdAt,
      sourceDeployment,
      campaigns,
      assets,
      sourceArtifacts,
      approvals,
      exports,
      blobEntries,
      signer,
    });
  }

  async function previewImport(archive, {
    destinationWorkspaceId = "",
    conflictPolicy = TRANSFER_CONFLICT_POLICIES.SKIP,
    maxBytes,
    requireSignature = false,
  } = {}) {
    const validation = await validatePortableArchive(archive, { maxBytes, signer, requireSignature });
    if (validation.blocked) {
      return {
        status: TRANSFER_STATUSES.BLOCKED,
        validation,
        destinationWorkspaceId: destinationWorkspaceId || null,
        conflictPolicy,
        conflicts: [],
        exclusions: archive?.manifest?.exclusions || [],
      };
    }
    if (!text(destinationWorkspaceId)) {
      return {
        status: TRANSFER_STATUSES.SELECTING_DESTINATION,
        validation,
        destinationWorkspaceId: null,
        conflictPolicy,
        conflicts: [],
        exclusions: archive.manifest?.exclusions || [],
      };
    }
    if (!Object.values(TRANSFER_CONFLICT_POLICIES).includes(conflictPolicy)) {
      throw new TypeError(`Unsupported transfer conflict policy: ${conflictPolicy}.`);
    }

    const existing = {
      campaign: await repositories.campaignRepository.list(),
      asset: await repositories.assetRepository.list(),
      sourceArtifact: await repositories.sourceArtifactRepository.list(),
      approval: await repositories.approvalRepository.list(),
      export: await repositories.exportRepository.list(),
    };
    const source = {
      campaign: archive.payload?.campaigns || [],
      asset: archive.payload?.assets || [],
      sourceArtifact: archive.payload?.sourceArtifacts || [],
      approval: archive.payload?.approvals || [],
      export: archive.payload?.exports || [],
    };
    const conflicts = Object.entries(RECORD_CONFIG).flatMap(([kind, config]) => conflictSummary({
      existing: existing[kind],
      archive,
      sourceRecords: source[kind],
      kind,
      idField: config.idField,
    }));
    const warnings = [
      ...(validation.warnings || []),
      ...((archive.manifest?.exclusions || []).length
        ? [{ code: "excluded_private_data", message: `${archive.manifest.exclusions.length} private or unsupported fields were excluded during export.` }]
        : []),
      ...(conflicts.length
        ? [{ code: "conflicts_found", message: `${conflicts.length} existing record conflict${conflicts.length === 1 ? " was" : "s were"} found.` }]
        : []),
    ];

    return {
      status: warnings.length ? TRANSFER_STATUSES.WARNINGS_FOUND : "ready",
      validation,
      destinationWorkspaceId,
      conflictPolicy,
      conflicts,
      warnings,
      exclusions: archive.manifest?.exclusions || [],
      estimatedAssetBytes: validation.estimatedAssetBytes,
      counts: validation.counts,
    };
  }

  async function persistReport(report) {
    return reports.upsert(report);
  }

  async function rollbackJournal(journal) {
    const errors = [];
    for (const entry of [...journal].reverse()) {
      try {
        await restoreJournalEntry(entry, repositories, blobs);
      } catch (error) {
        errors.push({ kind: entry.kind, id: entry.id, message: error.message });
      }
    }
    return { complete: errors.length === 0, errors };
  }

  async function importArchive(archive, {
    destinationWorkspaceId,
    conflictPolicy = TRANSFER_CONFLICT_POLICIES.SKIP,
    atomic = true,
    signal = null,
    maxBytes,
    requireSignature = false,
    resumeReportId = null,
  } = {}) {
    const preview = await previewImport(archive, {
      destinationWorkspaceId,
      conflictPolicy,
      maxBytes,
      requireSignature,
    });
    const now = applicationClock.now();
    let existingReport = resumeReportId ? await reports.get(resumeReportId) : null;
    if (existingReport && existingReport.archiveDigest !== archive.integrity?.digest) {
      throw new Error("The resume report belongs to a different archive payload.");
    }
    const transferReportId = existingReport?.transferReportId || applicationIds.create("report");
    const startedAt = existingReport?.startedAt || now;
    let items = portableClone(existingReport?.items || []);
    let journal = portableClone(existingReport?.journal || []);
    let warnings = unique([...(existingReport?.warnings || []).map((item) => stableStringify(item)), ...(preview.warnings || []).map((item) => stableStringify(item))])
      .map((item) => JSON.parse(item));
    let errors = portableClone(existingReport?.errors || []);

    if ([TRANSFER_STATUSES.BLOCKED, TRANSFER_STATUSES.SELECTING_DESTINATION].includes(preview.status)) {
      const blocked = reportRecord({
        transferReportId,
        archive,
        status: preview.status,
        destinationWorkspaceId: destinationWorkspaceId || null,
        conflictPolicy,
        startedAt,
        updatedAt: now,
        validation: preview.validation,
        summary: { preview },
        items,
        journal,
        warnings,
        errors: preview.validation.errors || [],
      });
      return persistReport(blocked);
    }

    const completedKeys = new Set(items.filter((item) => ["imported", "replaced", "copied", "skipped"].includes(item.status)).map((item) => item.key));
    const idMaps = {
      campaign: new Map(),
      asset: new Map(),
      sourceArtifact: new Map(),
      approval: new Map(),
      export: new Map(),
      draft: new Map(),
      blob: new Map(),
    };
    const sourceCollections = {
      campaign: archive.payload?.campaigns || [],
      asset: archive.payload?.assets || [],
      sourceArtifact: archive.payload?.sourceArtifacts || [],
      approval: archive.payload?.approvals || [],
      export: archive.payload?.exports || [],
    };
    const existingCollections = {
      campaign: await repositories.campaignRepository.list(),
      asset: await repositories.assetRepository.list(),
      sourceArtifact: await repositories.sourceArtifactRepository.list(),
      approval: await repositories.approvalRepository.list(),
      export: await repositories.exportRepository.list(),
    };

    const reportInProgress = () => reportRecord({
      transferReportId,
      archive,
      status: TRANSFER_STATUSES.IMPORTING,
      destinationWorkspaceId,
      conflictPolicy,
      startedAt,
      updatedAt: applicationClock.now(),
      validation: preview.validation,
      summary: { preview },
      items,
      journal,
      warnings,
      errors,
    });
    await persistReport(reportInProgress());

    async function processRecord(kind, source) {
      const config = RECORD_CONFIG[kind];
      const sourceId = source[config.idField];
      const key = recordKey(kind, sourceId);
      if (completedKeys.has(key)) return;
      if (signal?.aborted) throw Object.assign(new Error("Transfer cancelled by the user."), { code: "transfer_cancelled" });
      const target = conflictTarget(existingCollections[kind], archive, source, kind, config.idField);
      if (target && conflictPolicy === TRANSFER_CONFLICT_POLICIES.SKIP) {
        idMaps[kind].set(sourceId, target[config.idField]);
        items.push({ key, kind, sourceId, targetId: target[config.idField], status: "skipped", reason: "existing_record" });
        completedKeys.add(key);
        await persistReport(reportInProgress());
        return;
      }
      const targetId = importedRecordId({ source, target, policy: conflictPolicy, idField: config.idField, idService: applicationIds, kind });
      idMaps[kind].set(sourceId, targetId);
      const previous = await repositories[config.repository].get(targetId);
      const provenance = transferProvenance({ archive, sourceId, kind, importedAt: applicationClock.now(), destinationWorkspaceId });
      const imported = kind === "campaign"
        ? rebuildCampaign({ source, targetId, destinationWorkspaceId, provenance, idMaps })
        : buildMetadataRecord({ source, kind: config.kind, idField: config.idField, targetId, destinationWorkspaceId, provenance, idMaps });
      await repositories[config.repository].upsert(imported);
      journal.push({ kind, id: targetId, previous: previous ? portableClone(previous) : null });
      items.push({
        key,
        kind,
        sourceId,
        targetId,
        status: target ? (conflictPolicy === "copy" ? "copied" : "replaced") : "imported",
      });
      completedKeys.add(key);
      await persistReport(reportInProgress());
    }

    async function processAsset(source) {
      const key = recordKey("asset", source.assetId);
      if (completedKeys.has(key)) return;
      if (signal?.aborted) throw Object.assign(new Error("Transfer cancelled by the user."), { code: "transfer_cancelled" });
      const target = conflictTarget(existingCollections.asset, archive, source, "asset", "assetId");
      if (target && conflictPolicy === TRANSFER_CONFLICT_POLICIES.SKIP) {
        idMaps.asset.set(source.assetId, target.assetId);
        if (source.blobId && target.blobId) idMaps.blob.set(source.blobId, target.blobId);
        items.push({ key, kind: "asset", sourceId: source.assetId, targetId: target.assetId, status: "skipped", reason: "existing_record" });
        completedKeys.add(key);
        await persistReport(reportInProgress());
        return;
      }

      const targetAssetId = importedRecordId({ source, target, policy: conflictPolicy, idField: "assetId", idService: applicationIds, kind: "asset" });
      const targetBlobId = source.blobId
        ? target && conflictPolicy === TRANSFER_CONFLICT_POLICIES.COPY
          ? applicationIds.create("blob")
          : source.blobId
        : null;
      idMaps.asset.set(source.assetId, targetAssetId);
      if (source.blobId) idMaps.blob.set(source.blobId, targetBlobId);
      const previousAsset = await repositories.assetRepository.get(targetAssetId);
      const previousBlobValue = targetBlobId ? await blobs.get(targetBlobId) : null;
      const previousBlob = previousBlobValue === null || previousBlobValue === undefined ? null : encodeBlobPayload(previousBlobValue);
      const blobEntry = (archive.payload?.blobEntries || []).find((entry) => entry.blobId === source.blobId);
      const localJournal = [];
      try {
        let availability = source.availability || "available";
        if (targetBlobId && blobEntry) {
          await blobs.put(targetBlobId, decodeBlobPayload(blobEntry));
          localJournal.push({ kind: "blob", id: targetBlobId, previous: previousBlob });
        } else if (targetBlobId && !blobEntry) {
          availability = "missing_payload";
          warnings.push({ code: "asset_metadata_only", assetId: source.assetId, message: `Asset ${source.assetId} imported without blob payload.` });
        }
        const importedAsset = createDomainRecord("Asset", {
          ...updateReferences(source, idMaps),
          assetId: targetAssetId,
          blobId: targetBlobId,
          workspaceId: destinationWorkspaceId,
          availability,
          transferProvenance: transferProvenance({
            archive,
            sourceId: source.assetId,
            kind: "asset",
            importedAt: applicationClock.now(),
            destinationWorkspaceId,
          }),
          importedHistoricalRecord: true,
        });
        await repositories.assetRepository.upsert(importedAsset);
        localJournal.push({ kind: "asset", id: targetAssetId, previous: previousAsset ? portableClone(previousAsset) : null });
        journal.push(...localJournal);
        items.push({
          key,
          kind: "asset",
          sourceId: source.assetId,
          targetId: targetAssetId,
          status: target ? (conflictPolicy === "copy" ? "copied" : "replaced") : "imported",
          availability,
        });
        completedKeys.add(key);
        await persistReport(reportInProgress());
      } catch (error) {
        await rollbackJournal(localJournal);
        throw error;
      }
    }

    try {
      for (const source of sourceCollections.campaign) await processRecord("campaign", source);
      for (const source of sourceCollections.asset) await processAsset(source);
      for (const source of sourceCollections.sourceArtifact) await processRecord("sourceArtifact", source);
      for (const source of sourceCollections.approval) await processRecord("approval", source);
      for (const source of sourceCollections.export) await processRecord("export", source);

      const completedAt = applicationClock.now();
      const complete = reportRecord({
        transferReportId,
        archive,
        status: TRANSFER_STATUSES.COMPLETE,
        destinationWorkspaceId,
        conflictPolicy,
        startedAt,
        updatedAt: completedAt,
        completedAt,
        validation: preview.validation,
        summary: {
          imported: items.filter((item) => ["imported", "replaced", "copied"].includes(item.status)).length,
          skipped: items.filter((item) => item.status === "skipped").length,
          warnings: warnings.length,
        },
        items,
        journal,
        warnings,
        errors,
      });
      return persistReport(complete);
    } catch (error) {
      const cancelled = error.code === "transfer_cancelled";
      errors.push({ code: error.code || "import_failed", message: error.message });
      if (atomic && !cancelled) {
        const rollback = await rollbackJournal(journal);
        const failed = reportRecord({
          transferReportId,
          archive,
          status: TRANSFER_STATUSES.FAILED,
          destinationWorkspaceId,
          conflictPolicy,
          startedAt,
          updatedAt: applicationClock.now(),
          validation: preview.validation,
          summary: { importedBeforeFailure: items.length, rolledBack: rollback.complete },
          items,
          journal,
          warnings,
          errors,
          rollback,
        });
        return persistReport(failed);
      }
      const status = cancelled
        ? TRANSFER_STATUSES.CANCELLED
        : items.some((item) => ["imported", "replaced", "copied"].includes(item.status))
          ? TRANSFER_STATUSES.PARTIALLY_IMPORTED
          : TRANSFER_STATUSES.FAILED;
      const partial = reportRecord({
        transferReportId,
        archive,
        status,
        destinationWorkspaceId,
        conflictPolicy,
        startedAt,
        updatedAt: applicationClock.now(),
        validation: preview.validation,
        summary: {
          completed: items.length,
          canResume: status === TRANSFER_STATUSES.PARTIALLY_IMPORTED || status === TRANSFER_STATUSES.CANCELLED,
        },
        items,
        journal,
        warnings,
        errors,
      });
      return persistReport(partial);
    }
  }

  async function resumeImport(archive, transferReportId, options = {}) {
    const report = await reports.get(transferReportId);
    if (!report) throw new Error(`Transfer report ${transferReportId} was not found.`);
    if (![TRANSFER_STATUSES.PARTIALLY_IMPORTED, TRANSFER_STATUSES.CANCELLED, TRANSFER_STATUSES.FAILED].includes(report.status)) {
      throw new Error(`Transfer report ${transferReportId} cannot be resumed from status ${report.status}.`);
    }
    return importArchive(archive, {
      ...options,
      destinationWorkspaceId: options.destinationWorkspaceId || report.destinationWorkspaceId,
      conflictPolicy: options.conflictPolicy || report.conflictPolicy,
      resumeReportId: transferReportId,
      atomic: options.atomic ?? false,
    });
  }

  async function rollbackImport(transferReportId) {
    const report = await reports.get(transferReportId);
    if (!report) throw new Error(`Transfer report ${transferReportId} was not found.`);
    if (report.status === TRANSFER_STATUSES.ROLLED_BACK) return report;
    const rollback = await rollbackJournal(report.journal || []);
    const updatedAt = applicationClock.now();
    const rolledBack = createDomainRecord("TransferReport", {
      ...report,
      status: rollback.complete ? TRANSFER_STATUSES.ROLLED_BACK : TRANSFER_STATUSES.FAILED,
      updatedAt,
      completedAt: rollback.complete ? updatedAt : report.completedAt,
      rollback,
      errors: [...(report.errors || []), ...rollback.errors.map((error) => ({ code: "rollback_failed", ...error }))],
    });
    return persistReport(rolledBack);
  }

  async function exportReport(transferReportId) {
    return reports.get(transferReportId);
  }

  async function listReports() {
    return reports.list();
  }

  async function archiveFingerprint(archive) {
    return sha256Hex(stableStringify(archive));
  }

  return {
    exportSelection,
    previewImport,
    importArchive,
    resumeImport,
    rollbackImport,
    exportReport,
    listReports,
    archiveFingerprint,
  };
}
