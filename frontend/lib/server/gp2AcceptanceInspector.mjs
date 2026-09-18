const SHA_PATTERN = /^[a-f0-9]{40,64}$/i;

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function requiredWorkspace(value) {
  const workspaceId = String(value || "").trim();
  if (!workspaceId) throw new TypeError("GP2 inspector requires workspaceId.");
  return workspaceId;
}

function requiredSourceRevision(value) {
  const revision = String(value || "").trim().toLowerCase();
  if (!SHA_PATTERN.test(revision)) {
    const error = new Error("source_revision must be an exact Git commit SHA.");
    error.code = "gp2_inspector_revision_invalid";
    error.status = 400;
    throw error;
  }
  return revision;
}

function stage(id, status, details = {}) {
  return Object.freeze({ id, status, ...details });
}

function jobStage(rows) {
  if (!rows.length) return stage("opportunity_job", "missing");
  const statuses = rows.map((row) => String(row.status || ""));
  if (statuses.some((status) => ["succeeded", "partially_succeeded"].includes(status))) {
    return stage("opportunity_job", "ready", { statuses });
  }
  if (statuses.some((status) => ["queued", "scheduled", "running", "retrying", "cancel_requested"].includes(status))) {
    return stage("opportunity_job", "pending", { statuses });
  }
  return stage("opportunity_job", "failed", { statuses });
}

function safePlanningRecord(row) {
  const record = jsonValue(row.record, {});
  const output = {
    id: row.record_id,
    kind: row.record_kind,
    status: row.status,
    destination: row.destination || null,
  };
  if (row.record_kind === "NarrativeStrategy") {
    output.strategyRevision = Number(record.strategyRevision || 0) || null;
    output.screenshotRequired = Array.isArray(record.mediaRequirements)
      && record.mediaRequirements.some((item) => item?.type === "screenshot" && item?.required !== false);
  }
  if (row.record_kind === "PlatformVariant") {
    output.currentRevisionId = record.currentRevisionId || null;
  }
  if (row.record_kind === "PlatformVariantRevision") {
    output.revisionNumber = Number(record.revisionNumber || 0) || null;
    output.origin = record.origin || null;
    output.mediaBindingCount = Array.isArray(record.mediaBindings) ? record.mediaBindings.length : 0;
  }
  return output;
}

function mediaBindingRefs(rows, currentRevisionIds) {
  const current = new Set(currentRevisionIds);
  const bindings = [];
  for (const row of rows) {
    if (row.record_kind !== "PlatformVariantRevision" || !current.has(row.record_id)) continue;
    const record = jsonValue(row.record, {});
    for (const binding of Array.isArray(record.mediaBindings) ? record.mediaBindings : []) {
      bindings.push({
        revisionId: row.record_id,
        assetId: binding.assetId || null,
        assetVersionId: binding.assetVersionId || null,
        screenshotQualityReviewId: binding.screenshotQualityReviewId || null,
        imageDerivativePlanId: binding.imageDerivativePlanId || null,
        imageDerivativeVariantId: binding.imageDerivativeVariantId || null,
      });
    }
  }
  return bindings;
}

function stoppedAt(stages) {
  const terminalReady = new Set(["ready", "not_required"]);
  return stages.find((item) => !terminalReady.has(item.status))?.id || null;
}

export async function inspectGp2Acceptance({
  database,
  workspaceId,
  sourceRevision,
} = {}) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("GP2 inspector requires a database query executor.");
  }
  const owner = requiredWorkspace(workspaceId);
  const revision = requiredSourceRevision(sourceRevision);

  const stages = [];
  const signalRows = resultRows(await database.query(
    `SELECT signal_id, project_id, source_connection_id, source_revision, status, created_at, updated_at
     FROM sf_content_signals
     WHERE workspace_id = $1 AND lower(source_revision) = $2
     ORDER BY created_at DESC, signal_id
     LIMIT 2`,
    [owner, revision],
  ));

  if (!signalRows.length) {
    stages.push(stage("signal", "missing"));
    return Object.freeze({ sourceRevision: revision, stoppedAt: "signal", stages, signal: null });
  }
  if (signalRows.length > 1) {
    stages.push(stage("signal", "blocked", {
      reason: "ambiguous_source_revision",
      signalIds: signalRows.map((row) => row.signal_id),
    }));
    return Object.freeze({ sourceRevision: revision, stoppedAt: "signal", stages, signal: null });
  }

  const signalRow = signalRows[0];
  const signal = Object.freeze({
    signalId: signalRow.signal_id,
    projectId: signalRow.project_id || null,
    sourceConnectionId: signalRow.source_connection_id || null,
    sourceRevision: signalRow.source_revision,
    status: signalRow.status,
  });
  stages.push(stage("signal", "ready", { signalId: signal.signalId }));

  const signalJobRows = resultRows(await database.query(
    `SELECT job_id, job_type, resource_type, resource_id, status, attempt_count, created_at, updated_at, completed_at
     FROM sf_durable_jobs
     WHERE workspace_id = $1
       AND resource_id = $2
       AND job_type = 'opportunity_evaluation'
     ORDER BY created_at DESC, job_id
     LIMIT 10`,
    [owner, signal.signalId],
  ));
  stages.push(jobStage(signalJobRows));

  const opportunityRows = resultRows(await database.query(
    `SELECT
       o.opportunity_id, o.project_context_snapshot_id, o.status, o.recommendation, o.score,
       o.created_at, o.updated_at,
       c.repository_ref,
       cardinality(c.source_artifact_ids) AS source_artifact_count
     FROM sf_content_opportunities o
     LEFT JOIN sf_project_context_snapshots c
       ON c.workspace_id = o.workspace_id
      AND c.project_context_snapshot_id = o.project_context_snapshot_id
     WHERE o.workspace_id = $1 AND $2 = ANY(o.signal_ids)
     ORDER BY o.updated_at DESC, o.opportunity_id
     LIMIT 10`,
    [owner, signal.signalId],
  ));

  if (!opportunityRows.length) {
    stages.push(stage("opportunity", "missing"));
    return Object.freeze({
      sourceRevision: revision,
      stoppedAt: stoppedAt(stages),
      stages,
      signal,
      jobs: signalJobRows.map((row) => ({ jobId: row.job_id, status: row.status, attempts: Number(row.attempt_count || 0) })),
      opportunity: null,
    });
  }

  const exactCandidates = opportunityRows.filter((row) => {
    const repositoryRef = jsonValue(row.repository_ref, null);
    return String(repositoryRef?.revision || "").toLowerCase() === revision;
  });
  const selectedOpportunity = exactCandidates[0] || opportunityRows[0];
  const opportunity = Object.freeze({
    opportunityId: selectedOpportunity.opportunity_id,
    projectContextSnapshotId: selectedOpportunity.project_context_snapshot_id || null,
    status: selectedOpportunity.status,
    recommendation: selectedOpportunity.recommendation,
    score: Number(selectedOpportunity.score || 0),
  });
  stages.push(stage("opportunity", "ready", { opportunityId: opportunity.opportunityId }));

  if (exactCandidates.length !== 1) {
    stages.push(stage("exact_context", "blocked", {
      reason: exactCandidates.length ? "ambiguous_exact_context" : "exact_revision_context_missing",
      candidateCount: exactCandidates.length,
    }));
    return Object.freeze({
      sourceRevision: revision,
      stoppedAt: stoppedAt(stages),
      stages,
      signal,
      jobs: signalJobRows.map((row) => ({ jobId: row.job_id, status: row.status, attempts: Number(row.attempt_count || 0) })),
      opportunity,
    });
  }

  const repositoryRef = jsonValue(selectedOpportunity.repository_ref, null);
  const context = Object.freeze({
    projectContextSnapshotId: opportunity.projectContextSnapshotId,
    repositoryRevision: repositoryRef?.revision || null,
    sourceArtifactCount: Number(selectedOpportunity.source_artifact_count || 0),
  });
  stages.push(stage("exact_context", "ready", {
    projectContextSnapshotId: context.projectContextSnapshotId,
    sourceArtifactCount: context.sourceArtifactCount,
  }));

  const planningBaseRows = resultRows(await database.query(
    `SELECT record_id, record_kind, opportunity_id, narrative_strategy_id, content_piece_id,
            destination, status, record, created_at, updated_at
     FROM sf_content_planning_records
     WHERE workspace_id = $1 AND opportunity_id = $2
     ORDER BY created_at, record_id`,
    [owner, opportunity.opportunityId],
  ));
  const strategyIds = planningBaseRows
    .filter((row) => row.record_kind === "NarrativeStrategy")
    .map((row) => row.record_id);
  const contentPieceIds = planningBaseRows
    .filter((row) => row.record_kind === "ContentPiece")
    .map((row) => row.record_id);

  const planningChildRows = (strategyIds.length || contentPieceIds.length)
    ? resultRows(await database.query(
        `SELECT record_id, record_kind, opportunity_id, narrative_strategy_id, content_piece_id,
                destination, status, record, created_at, updated_at
         FROM sf_content_planning_records
         WHERE workspace_id = $1
           AND (
             narrative_strategy_id = ANY($2::text[])
             OR content_piece_id = ANY($3::text[])
           )
         ORDER BY created_at, record_id`,
        [owner, strategyIds, contentPieceIds],
      ))
    : [];
  const planningRows = [...planningBaseRows, ...planningChildRows]
    .filter((row, index, all) => all.findIndex((candidate) => candidate.record_id === row.record_id) === index);
  const planning = planningRows.map(safePlanningRecord);
  const variants = planning.filter((item) => item.kind === "PlatformVariant");
  const currentRevisionIds = variants.map((item) => item.currentRevisionId).filter(Boolean);
  const currentRevisionSet = new Set(currentRevisionIds);
  const currentRevisions = planning.filter((item) => item.kind === "PlatformVariantRevision" && currentRevisionSet.has(item.id));
  const screenshotRequired = planning.some((item) => item.kind === "NarrativeStrategy" && item.screenshotRequired === true);

  if (!planningRows.length) stages.push(stage("planning", "missing"));
  else if (!currentRevisions.length) stages.push(stage("planning", "pending", { recordCount: planningRows.length }));
  else stages.push(stage("planning", "ready", {
    recordCount: planningRows.length,
    currentRevisionIds,
    destinations: [...new Set(currentRevisions.map((item) => item.destination).filter(Boolean))].sort(),
  }));

  const bindings = mediaBindingRefs(planningRows, currentRevisionIds);
  const mediaRecordIds = [...new Set(bindings.flatMap((binding) => [
    binding.assetId,
    binding.screenshotQualityReviewId,
    binding.imageDerivativePlanId,
  ]).filter(Boolean))];
  const mediaRows = mediaRecordIds.length
    ? resultRows(await database.query(
        `SELECT record_id, record_kind, status, destination, revision, created_at, updated_at
         FROM sf_media_records
         WHERE workspace_id = $1 AND record_id = ANY($2::text[])
         ORDER BY updated_at DESC, record_id`,
        [owner, mediaRecordIds],
      ))
    : [];

  const captureDurableRows = currentRevisionIds.length
    ? resultRows(await database.query(
        `SELECT job_id, status, attempt_count, resource_id, record, created_at, updated_at, completed_at
         FROM sf_durable_jobs
         WHERE workspace_id = $1
           AND job_type = 'capture_screenshot'
           AND record->>'correlationId' = ANY($2::text[])
         ORDER BY created_at DESC, job_id`,
        [owner, currentRevisionIds],
      ))
    : [];
  const captureJobIds = captureDurableRows.map((row) => row.resource_id).filter(Boolean);
  const captureRows = captureJobIds.length
    ? resultRows(await database.query(
        `SELECT capture_job_id, durable_job_id, capture_recipe_id, capture_recipe_version,
                capture_kind, status, record, created_at, updated_at, completed_at
         FROM sf_capture_jobs
         WHERE workspace_id = $1 AND capture_job_id = ANY($2::text[])
         ORDER BY created_at DESC, capture_job_id`,
        [owner, captureJobIds],
      ))
    : [];

  if (!screenshotRequired) {
    stages.push(stage("media", "not_required"));
  } else if (bindings.length) {
    stages.push(stage("media", "ready", {
      bindingCount: bindings.length,
      mediaRecordCount: mediaRows.length,
    }));
  } else if (captureDurableRows.some((row) => ["queued", "scheduled", "running", "retrying"].includes(row.status))) {
    stages.push(stage("media", "pending", { captureJobCount: captureDurableRows.length }));
  } else if (captureDurableRows.some((row) => ["failed", "cancelled", "expired", "dead_lettered"].includes(row.status))) {
    stages.push(stage("media", "failed", { captureJobCount: captureDurableRows.length }));
  } else {
    stages.push(stage("media", "missing", { captureJobCount: captureDurableRows.length }));
  }

  const reviewRows = currentRevisionIds.length
    ? resultRows(await database.query(
        `SELECT record_id, record_kind, platform_variant_id, platform_variant_revision_id,
                destination, status, created_at, updated_at
         FROM sf_content_review_records
         WHERE workspace_id = $1
           AND platform_variant_revision_id = ANY($2::text[])
         ORDER BY created_at, record_id`,
        [owner, currentRevisionIds],
      ))
    : [];
  const reviewedRevisionIds = new Set(
    reviewRows.filter((row) => row.record_kind === "PlatformVariantReview")
      .map((row) => row.platform_variant_revision_id),
  );
  const approvedRevisionIds = new Set(
    reviewRows.filter((row) => row.record_kind === "PlatformVariantApproval" && row.status === "approved")
      .map((row) => row.platform_variant_revision_id),
  );
  const allCurrentReviewed = currentRevisionIds.length > 0
    && currentRevisionIds.every((id) => reviewedRevisionIds.has(id));
  const allCurrentApproved = currentRevisionIds.length > 0
    && currentRevisionIds.every((id) => approvedRevisionIds.has(id));

  stages.push(stage("review", allCurrentReviewed ? "ready" : currentRevisionIds.length ? "pending" : "missing", {
    reviewedRevisionIds: [...reviewedRevisionIds],
  }));
  stages.push(stage("approval", allCurrentApproved ? "ready" : currentRevisionIds.length ? "pending" : "missing", {
    approvedRevisionIds: [...approvedRevisionIds],
  }));

  return Object.freeze({
    sourceRevision: revision,
    stoppedAt: stoppedAt(stages),
    stages,
    signal,
    jobs: signalJobRows.map((row) => ({
      jobId: row.job_id,
      status: row.status,
      attempts: Number(row.attempt_count || 0),
    })),
    opportunity,
    context,
    planning,
    media: {
      screenshotRequired,
      bindings,
      records: mediaRows.map((row) => ({
        id: row.record_id,
        kind: row.record_kind,
        status: row.status,
        destination: row.destination || null,
      })),
      captureJobs: captureDurableRows.map((row) => ({
        jobId: row.job_id,
        captureJobId: row.resource_id,
        status: row.status,
        attempts: Number(row.attempt_count || 0),
      })),
      captures: captureRows.map((row) => ({
        captureJobId: row.capture_job_id,
        durableJobId: row.durable_job_id,
        captureRecipeId: row.capture_recipe_id,
        captureRecipeVersion: Number(row.capture_recipe_version),
        status: row.status,
      })),
    },
    reviews: reviewRows.map((row) => ({
      id: row.record_id,
      kind: row.record_kind,
      revisionId: row.platform_variant_revision_id,
      destination: row.destination,
      status: row.status,
    })),
  });
}

export const __testables = Object.freeze({
  requiredSourceRevision,
  safePlanningRecord,
  stoppedAt,
});
