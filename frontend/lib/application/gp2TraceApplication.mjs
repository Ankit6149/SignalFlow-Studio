function requiredPort(name, value, methods = []) {
  if (!value || typeof value !== "object") throw new TypeError(`${name} is required.`);
  for (const method of methods) {
    if (typeof value[method] !== "function") throw new TypeError(`${name}.${method}() is required.`);
  }
  return value;
}

function exactRevision(value) {
  const revision = String(value || "").trim().toLowerCase();
  if (!/^[a-f0-9]{7,64}$/.test(revision)) {
    const error = new Error("A valid Git source revision is required.");
    error.code = "gp2_trace_revision_invalid";
    throw error;
  }
  return revision;
}

function ids(values, field) {
  return [...new Set((Array.isArray(values) ? values : [])
    .map((item) => String(item?.[field] || "").trim())
    .filter(Boolean))];
}

function statusRecord(record, idField, extra = {}) {
  return Object.freeze({
    id: String(record?.[idField] || ""),
    status: String(record?.status || record?.overallVerdict || record?.decision || "unknown"),
    ...extra,
  });
}

function jobSummary(job) {
  return Object.freeze({
    id: String(job?.jobId || ""),
    type: String(job?.jobType || ""),
    status: String(job?.status || "unknown"),
    attempts: Number(job?.attemptCount || 0),
    errorCode: String(job?.error?.code || job?.lastError?.code || job?.failure?.code || "") || null,
  });
}

function mediaAssetIds(revisions) {
  const values = [];
  for (const revision of revisions) {
    for (const binding of Array.isArray(revision?.mediaBindings) ? revision.mediaBindings : []) {
      if (binding?.assetId) values.push(String(binding.assetId));
    }
  }
  return [...new Set(values)];
}

function stage({ signalCount, jobs, context, opportunity, strategies, contentPieces, revisions, reviews }) {
  if (signalCount === 0) return "signal";
  if (signalCount > 1) return "duplicate_signal";
  if (!jobs.length) return "opportunity_job";
  if (!context) return "project_context";
  if (!opportunity) return "opportunity";
  if (!opportunity.selectedAngleId) return "owner_angle";
  if (!strategies.length) return "strategy";
  if (!contentPieces.length) return "content_piece";
  if (!revisions.length) return "platform_revision";
  if (!reviews.length) return "review";
  return "complete";
}

export function createGp2TraceApplication({
  contentSignalRepository,
  durableJobRepository,
  projectContextRepository,
  contentOpportunityRepository,
  contentPlanningRepository,
  contentReviewRepository,
  captureRepository,
} = {}) {
  const signals = requiredPort("contentSignalRepository", contentSignalRepository, ["list"]);
  const jobs = requiredPort("durableJobRepository", durableJobRepository, ["list"]);
  const contexts = requiredPort("projectContextRepository", projectContextRepository, ["get"]);
  const opportunities = requiredPort("contentOpportunityRepository", contentOpportunityRepository, ["list"]);
  const planning = requiredPort("contentPlanningRepository", contentPlanningRepository, ["list"]);
  const reviewsRepo = requiredPort("contentReviewRepository", contentReviewRepository, ["list"]);
  const captures = requiredPort("captureRepository", captureRepository, ["listJobs"]);

  async function traceSourceRevision(sourceRevisionInput) {
    const sourceRevision = exactRevision(sourceRevisionInput);
    const allSignals = await signals.list();
    const matchedSignals = allSignals.filter((item) => String(item?.sourceRevision || "").toLowerCase() === sourceRevision);
    const signalIds = ids(matchedSignals, "signalId");

    const allJobs = await jobs.list();
    const matchedJobs = allJobs.filter((item) => signalIds.includes(String(item?.resourceId || "")));

    const allOpportunities = await opportunities.list();
    const matchedOpportunities = allOpportunities.filter((item) =>
      (Array.isArray(item?.signalIds) ? item.signalIds : []).some((id) => signalIds.includes(String(id))),
    );
    const opportunity = matchedOpportunities[0] || null;
    const context = opportunity?.projectContextSnapshotId
      ? await contexts.get(opportunity.projectContextSnapshotId)
      : null;

    const allPlanning = await planning.list();
    const strategies = opportunity
      ? allPlanning.filter((item) => item?.kind === "NarrativeStrategy" && item?.opportunityId === opportunity.opportunityId)
      : [];
    const strategyIds = ids(strategies, "narrativeStrategyId");
    const contentPieces = allPlanning.filter((item) =>
      item?.kind === "ContentPiece"
      && (item?.opportunityId === opportunity?.opportunityId || strategyIds.includes(String(item?.narrativeStrategyId || ""))),
    );
    const contentPieceIds = ids(contentPieces, "contentPieceId");
    const variants = allPlanning.filter((item) =>
      item?.kind === "PlatformVariant" && contentPieceIds.includes(String(item?.contentPieceId || "")),
    );
    const revisions = allPlanning.filter((item) =>
      item?.kind === "PlatformVariantRevision" && contentPieceIds.includes(String(item?.contentPieceId || "")),
    );
    const revisionIds = ids(revisions, "platformVariantRevisionId");

    const allReviews = await reviewsRepo.list();
    const matchedReviews = allReviews.filter((item) => revisionIds.includes(String(item?.platformVariantRevisionId || "")));

    const boundAssetIds = mediaAssetIds(revisions);
    const allCaptureJobs = await captures.listJobs();
    const captureJobs = allCaptureJobs.filter((item) =>
      (Array.isArray(item?.outputAssetIds) ? item.outputAssetIds : []).some((id) => boundAssetIds.includes(String(id))),
    );

    const stoppedAt = stage({
      signalCount: matchedSignals.length,
      jobs: matchedJobs,
      context,
      opportunity,
      strategies,
      contentPieces,
      revisions,
      reviews: matchedReviews,
    });

    return Object.freeze({
      sourceRevision,
      stoppedAt,
      complete: stoppedAt === "complete",
      counts: Object.freeze({
        signals: matchedSignals.length,
        jobs: matchedJobs.length,
        opportunities: matchedOpportunities.length,
        strategies: strategies.length,
        contentPieces: contentPieces.length,
        variants: variants.length,
        revisions: revisions.length,
        reviews: matchedReviews.length,
        captureJobs: captureJobs.length,
      }),
      signal: matchedSignals[0]
        ? statusRecord(matchedSignals[0], "signalId", {
            projectId: matchedSignals[0].projectId || null,
            kind: matchedSignals[0].signalKind || null,
          })
        : null,
      jobs: Object.freeze(matchedJobs.map(jobSummary)),
      projectContext: context
        ? Object.freeze({
            id: context.projectContextSnapshotId,
            projectId: context.projectId,
            revision: context.repositoryRef?.revision || null,
            sourceArtifactCount: Array.isArray(context.sourceArtifactIds) ? context.sourceArtifactIds.length : 0,
          })
        : null,
      opportunity: opportunity
        ? statusRecord(opportunity, "opportunityId", {
            recommendation: opportunity.recommendation || null,
            score: Number(opportunity.score || 0),
            selectedAngleId: opportunity.selectedAngleId || null,
            projectContextSnapshotId: opportunity.projectContextSnapshotId || null,
          })
        : null,
      strategies: Object.freeze(strategies.map((item) => statusRecord(item, "narrativeStrategyId"))),
      contentPieces: Object.freeze(contentPieces.map((item) => statusRecord(item, "contentPieceId"))),
      variants: Object.freeze(variants.map((item) => statusRecord(item, "platformVariantId", { destination: item.destination || null }))),
      revisions: Object.freeze(revisions.map((item) => Object.freeze({
        id: item.platformVariantRevisionId,
        platformVariantId: item.platformVariantId,
        destination: item.destination || null,
        mediaBindingCount: Array.isArray(item.mediaBindings) ? item.mediaBindings.length : 0,
      }))),
      reviews: Object.freeze(matchedReviews.map((item) => Object.freeze({
        id: item.platformVariantReviewId || item.platformVariantApprovalId || null,
        kind: item.kind,
        revisionId: item.platformVariantRevisionId,
        status: item.overallVerdict || item.decision || "unknown",
        destination: item.destination || null,
      }))),
      captureJobs: Object.freeze(captureJobs.map((item) => Object.freeze({
        id: item.captureJobId,
        status: item.status,
        outputAssetCount: Array.isArray(item.outputAssetIds) ? item.outputAssetIds.length : 0,
      }))),
    });
  }

  return Object.freeze({ traceSourceRevision });
}
