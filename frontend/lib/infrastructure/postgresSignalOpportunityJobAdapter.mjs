const JOB_TYPE = "opportunity_evaluation";
const JOB_STATUSES = new Set(["pending", "processing", "completed", "dead"]);

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Signal opportunity job repository requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function required(value, field) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

function iso(value, field) {
  const parsed = new Date(value);
  if (!Number.isFinite(parsed.getTime())) throw new TypeError(`${field} must be a valid timestamp.`);
  return parsed.toISOString();
}

function jobFromRow(row = {}) {
  const status = String(row.status || "").trim();
  if (!JOB_STATUSES.has(status)) throw new TypeError("Stored signal opportunity job has an unsupported status.");
  return Object.freeze({
    jobId: required(row.job_id, "jobId"),
    workspaceId: required(row.workspace_id, "workspaceId"),
    signalId: required(row.signal_id, "signalId"),
    jobType: String(row.job_type || JOB_TYPE),
    status,
    attemptCount: Number(row.attempt_count || 0),
    availableAt: iso(row.available_at, "availableAt"),
    leaseUntil: row.lease_until ? iso(row.lease_until, "leaseUntil") : null,
    opportunityId: row.opportunity_id ? required(row.opportunity_id, "opportunityId") : null,
    lastErrorCode: row.last_error_code ? String(row.last_error_code) : null,
    createdAt: iso(row.created_at, "createdAt"),
    updatedAt: iso(row.updated_at, "updatedAt"),
    completedAt: row.completed_at ? iso(row.completed_at, "completedAt") : null,
  });
}

function stableJobId(signalId) {
  return `signal-opportunity:${required(signalId, "signalId")}`;
}

export function createPostgresSignalOpportunityJobRepository({ database } = {}) {
  const db = requireDatabase(database);

  async function enqueue({ workspaceId, signalId, now } = {}) {
    const owner = required(workspaceId, "workspaceId");
    const normalizedSignalId = required(signalId, "signalId");
    const at = iso(now, "now");
    const rows = resultRows(await db.query(`
INSERT INTO sf_signal_opportunity_jobs (
  job_id, workspace_id, signal_id, job_type, status, attempt_count,
  available_at, lease_until, opportunity_id, last_error_code,
  created_at, updated_at, completed_at
) VALUES (
  $1, $2, $3, $4, 'pending', 0,
  $5::timestamptz, NULL, NULL, NULL,
  $5::timestamptz, $5::timestamptz, NULL
)
ON CONFLICT (workspace_id, signal_id, job_type) DO UPDATE SET
  updated_at = sf_signal_opportunity_jobs.updated_at
RETURNING *`, [stableJobId(normalizedSignalId), owner, normalizedSignalId, JOB_TYPE, at]));
    if (rows.length !== 1) throw new Error("Signal opportunity job could not be enqueued.");
    return jobFromRow(rows[0]);
  }

  async function get(jobId) {
    const normalizedId = required(jobId, "jobId");
    const rows = resultRows(await db.query(
      "SELECT * FROM sf_signal_opportunity_jobs WHERE job_id = $1 LIMIT 1",
      [normalizedId],
    ));
    return rows[0] ? jobFromRow(rows[0]) : null;
  }

  async function claimNext({ now, leaseSeconds = 90 } = {}) {
    const at = iso(now, "now");
    const lease = Math.max(15, Math.min(300, Number(leaseSeconds) || 90));
    const rows = resultRows(await db.query(`
WITH candidate AS (
  SELECT job_id
  FROM sf_signal_opportunity_jobs
  WHERE (
      status = 'pending' AND available_at <= $1::timestamptz
    ) OR (
      status = 'processing' AND lease_until <= $1::timestamptz
    )
  ORDER BY available_at ASC, created_at ASC, job_id ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE sf_signal_opportunity_jobs jobs
SET
  status = 'processing',
  attempt_count = jobs.attempt_count + 1,
  lease_until = $1::timestamptz + ($2::integer * interval '1 second'),
  updated_at = $1::timestamptz
FROM candidate
WHERE jobs.job_id = candidate.job_id
RETURNING jobs.*`, [at, lease]));
    return rows[0] ? jobFromRow(rows[0]) : null;
  }

  async function complete(jobId, { opportunityId, now } = {}) {
    const normalizedId = required(jobId, "jobId");
    const normalizedOpportunityId = required(opportunityId, "opportunityId");
    const at = iso(now, "now");
    const rows = resultRows(await db.query(`
UPDATE sf_signal_opportunity_jobs
SET status = 'completed', opportunity_id = $2, completed_at = $3::timestamptz,
    lease_until = NULL, last_error_code = NULL, updated_at = $3::timestamptz
WHERE job_id = $1 AND status = 'processing'
RETURNING *`, [normalizedId, normalizedOpportunityId, at]));
    if (rows.length !== 1) throw new Error(`Signal opportunity job ${normalizedId} is not claimable for completion.`);
    return jobFromRow(rows[0]);
  }

  async function fail(jobId, {
    errorCode = "opportunity_evaluation_failed",
    now,
    retryDelaySeconds = 60,
    maxAttempts = 5,
  } = {}) {
    const normalizedId = required(jobId, "jobId");
    const at = iso(now, "now");
    const delayMs = Math.max(15, Math.min(3600, Number(retryDelaySeconds) || 60)) * 1000;
    const retryAt = new Date(Date.parse(at) + delayMs).toISOString();
    const attempts = Math.max(1, Math.min(20, Number(maxAttempts) || 5));
    const code = String(errorCode || "opportunity_evaluation_failed").trim().slice(0, 160);
    const rows = resultRows(await db.query(`
UPDATE sf_signal_opportunity_jobs
SET
  status = CASE WHEN attempt_count >= $4::integer THEN 'dead' ELSE 'pending' END,
  available_at = CASE WHEN attempt_count >= $4::integer THEN available_at ELSE $3::timestamptz END,
  lease_until = NULL,
  last_error_code = $2,
  updated_at = $5::timestamptz
WHERE job_id = $1 AND status = 'processing'
RETURNING *`, [normalizedId, code, retryAt, attempts, at]));
    if (rows.length !== 1) throw new Error(`Signal opportunity job ${normalizedId} is not claimable for failure handling.`);
    return jobFromRow(rows[0]);
  }

  return Object.freeze({ enqueue, get, claimNext, complete, fail });
}

export { JOB_TYPE as SIGNAL_OPPORTUNITY_JOB_TYPE, jobFromRow as signalOpportunityJobFromRow };
