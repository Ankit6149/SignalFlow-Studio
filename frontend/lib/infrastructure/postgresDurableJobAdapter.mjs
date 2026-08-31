import { assertPort } from "../domain/ports.mjs";
import { normalizeDurableJob } from "../domain/durableJobs.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres durable job repository requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function iso(value, fallback = null) {
  const candidate = value || fallback;
  if (!candidate) return null;
  const parsed = Date.parse(candidate);
  if (!Number.isFinite(parsed)) throw new TypeError("Durable job repository requires an ISO timestamp.");
  return new Date(parsed).toISOString();
}

function claimInputs({ leaseOwner, leaseSeconds = 60, now = new Date().toISOString(), jobTypes = [] } = {}) {
  const owner = String(leaseOwner || "").trim();
  if (!owner) throw new TypeError("Durable job claim requires a leaseOwner.");
  const claimedAt = iso(now);
  const expiresAt = new Date(Date.parse(claimedAt) + Math.max(5, Math.min(3600, Math.round(Number(leaseSeconds) || 60))) * 1000).toISOString();
  const normalizedTypes = Array.isArray(jobTypes) ? [...new Set(jobTypes.map((item) => String(item || "").trim()).filter(Boolean))] : [];
  return { owner, claimedAt, expiresAt, normalizedTypes };
}

export function durableJobFromRow(row = {}) {
  const job = normalizeDurableJob(jsonValue(row.record, {}));
  if (
    job.jobId !== row.job_id
    || job.workspaceId !== row.workspace_id
    || job.jobType !== row.job_type
    || job.resourceType !== row.resource_type
    || job.resourceId !== row.resource_id
    || job.inputVersion !== Number(row.input_version)
    || job.idempotencyKey !== row.idempotency_key
    || job.priority !== Number(row.priority)
    || job.status !== row.status
    || job.attemptCount !== Number(row.attempt_count)
    || (job.leaseOwner || null) !== (row.lease_owner || null)
  ) {
    const error = new Error("Stored durable job metadata does not match its canonical record.");
    error.code = "durable_job_storage_integrity_error";
    throw error;
  }
  return job;
}

export function createPostgresDurableJobRepository({ database, workspaceId = null } = {}) {
  const db = requireDatabase(database);
  const scope = String(workspaceId || "").trim();
  if (!scope) {
    const error = new Error("Postgres durable job repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }

  function assertOwned(input) {
    const job = normalizeDurableJob(input);
    if (job.workspaceId !== scope) {
      const error = new Error("Cross-workspace durable job repository access is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return job;
  }

  async function list() {
    return resultRows(await db.query(
      `SELECT * FROM sf_durable_jobs
       WHERE workspace_id = $1
       ORDER BY created_at DESC, job_id`,
      [scope],
    )).map(durableJobFromRow);
  }

  async function get(jobId) {
    const normalizedId = String(jobId || "").trim();
    if (!normalizedId) return null;
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_durable_jobs
       WHERE job_id = $1 AND workspace_id = $2
       LIMIT 1`,
      [normalizedId, scope],
    ));
    return rows[0] ? durableJobFromRow(rows[0]) : null;
  }

  async function findByIdempotency(workspace, jobType, idempotencyKey) {
    if (String(workspace || "").trim() !== scope) {
      const error = new Error("Cross-workspace durable job idempotency lookup is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    const rows = resultRows(await db.query(
      `SELECT * FROM sf_durable_jobs
       WHERE workspace_id = $1 AND job_type = $2 AND idempotency_key = $3
       LIMIT 1`,
      [scope, String(jobType || "").trim(), String(idempotencyKey || "").trim()],
    ));
    return rows[0] ? durableJobFromRow(rows[0]) : null;
  }

  async function upsert(input) {
    const job = assertOwned(input);
    const rows = resultRows(await db.query(`
INSERT INTO sf_durable_jobs (
  job_id, workspace_id, job_type, resource_type, resource_id, input_version,
  idempotency_key, priority, status, attempt_count, scheduled_at, next_attempt_at,
  lease_owner, lease_expires_at, heartbeat_at, cancellation_requested_at,
  schema_version, record, created_at, updated_at, completed_at
) VALUES (
  $1, $2, $3, $4, $5, $6,
  $7, $8, $9, $10, $11::timestamptz, $12::timestamptz,
  $13, $14::timestamptz, $15::timestamptz, $16::timestamptz,
  $17, $18::jsonb, $19::timestamptz, $20::timestamptz, $21::timestamptz
)
ON CONFLICT (job_id) DO UPDATE SET
  resource_type = EXCLUDED.resource_type,
  resource_id = EXCLUDED.resource_id,
  input_version = EXCLUDED.input_version,
  priority = EXCLUDED.priority,
  status = EXCLUDED.status,
  attempt_count = EXCLUDED.attempt_count,
  scheduled_at = EXCLUDED.scheduled_at,
  next_attempt_at = EXCLUDED.next_attempt_at,
  lease_owner = EXCLUDED.lease_owner,
  lease_expires_at = EXCLUDED.lease_expires_at,
  heartbeat_at = EXCLUDED.heartbeat_at,
  cancellation_requested_at = EXCLUDED.cancellation_requested_at,
  schema_version = EXCLUDED.schema_version,
  record = EXCLUDED.record,
  updated_at = EXCLUDED.updated_at,
  completed_at = EXCLUDED.completed_at
WHERE sf_durable_jobs.workspace_id = EXCLUDED.workspace_id
  AND sf_durable_jobs.job_type = EXCLUDED.job_type
  AND sf_durable_jobs.idempotency_key = EXCLUDED.idempotency_key
RETURNING *`, [
      job.jobId,
      scope,
      job.jobType,
      job.resourceType,
      job.resourceId,
      job.inputVersion,
      job.idempotencyKey,
      job.priority,
      job.status,
      job.attemptCount,
      job.scheduledAt,
      job.nextAttemptAt,
      job.leaseOwner,
      job.leaseExpiresAt,
      job.heartbeatAt,
      job.cancellationRequestedAt,
      Number(job.schemaVersion || job.durableJobSchemaVersion || 1),
      JSON.stringify(job),
      job.createdAt,
      job.updatedAt,
      job.completedAt,
    ]));
    if (rows.length !== 1) {
      const error = new Error(`Durable job ${job.jobId} could not be persisted.`);
      error.code = "durable_job_persistence_failed";
      throw error;
    }
    return durableJobFromRow(rows[0]);
  }

  async function claimById(jobId, options = {}) {
    const normalizedId = String(jobId || "").trim();
    if (!normalizedId) throw new TypeError("claimById requires jobId.");
    const { owner, claimedAt, expiresAt, normalizedTypes } = claimInputs(options);
    const rows = resultRows(await db.query(`
UPDATE sf_durable_jobs AS jobs
SET status = 'running',
    attempt_count = jobs.attempt_count + 1,
    lease_owner = $3,
    lease_expires_at = $4::timestamptz,
    heartbeat_at = $2::timestamptz,
    next_attempt_at = NULL,
    updated_at = $2::timestamptz,
    record = jobs.record || jsonb_build_object(
      'status', 'running',
      'attemptCount', jobs.attempt_count + 1,
      'leaseOwner', $3,
      'leaseExpiresAt', $4,
      'heartbeatAt', $2,
      'nextAttemptAt', NULL,
      'updatedAt', $2,
      'startedAt', COALESCE(jobs.record->>'startedAt', $2),
      'progress', COALESCE(jobs.record->'progress', '{}'::jsonb) || jsonb_build_object('stage', 'running')
    )
WHERE jobs.workspace_id = $1
  AND jobs.job_id = $6
  AND jobs.status IN ('queued', 'scheduled', 'retrying')
  AND jobs.cancellation_requested_at IS NULL
  AND COALESCE(jobs.next_attempt_at, jobs.scheduled_at, jobs.created_at) <= $2::timestamptz
  AND (cardinality($5::text[]) = 0 OR jobs.job_type = ANY($5::text[]))
RETURNING jobs.*`, [scope, claimedAt, owner, expiresAt, normalizedTypes, normalizedId]));
    return rows[0] ? durableJobFromRow(rows[0]) : null;
  }

  async function claimNext(options = {}) {
    const { owner, claimedAt, expiresAt, normalizedTypes } = claimInputs(options);
    const rows = resultRows(await db.query(`
WITH candidate AS (
  SELECT job_id
  FROM sf_durable_jobs
  WHERE workspace_id = $1
    AND status IN ('queued', 'scheduled', 'retrying')
    AND cancellation_requested_at IS NULL
    AND COALESCE(next_attempt_at, scheduled_at, created_at) <= $2::timestamptz
    AND (cardinality($5::text[]) = 0 OR job_type = ANY($5::text[]))
  ORDER BY priority DESC, COALESCE(next_attempt_at, scheduled_at, created_at), created_at, job_id
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE sf_durable_jobs AS jobs
SET status = 'running',
    attempt_count = jobs.attempt_count + 1,
    lease_owner = $3,
    lease_expires_at = $4::timestamptz,
    heartbeat_at = $2::timestamptz,
    next_attempt_at = NULL,
    updated_at = $2::timestamptz,
    record = jobs.record || jsonb_build_object(
      'status', 'running',
      'attemptCount', jobs.attempt_count + 1,
      'leaseOwner', $3,
      'leaseExpiresAt', $4,
      'heartbeatAt', $2,
      'nextAttemptAt', NULL,
      'updatedAt', $2,
      'startedAt', COALESCE(jobs.record->>'startedAt', $2),
      'progress', COALESCE(jobs.record->'progress', '{}'::jsonb) || jsonb_build_object('stage', 'running')
    )
FROM candidate
WHERE jobs.job_id = candidate.job_id
RETURNING jobs.*`, [scope, claimedAt, owner, expiresAt, normalizedTypes]));
    return rows[0] ? durableJobFromRow(rows[0]) : null;
  }

  async function remove(jobId) {
    const rows = resultRows(await db.query(
      `DELETE FROM sf_durable_jobs WHERE job_id = $1 AND workspace_id = $2 RETURNING job_id`,
      [String(jobId || "").trim(), scope],
    ));
    return rows.length === 1;
  }

  return assertPort("durableJobRepository", { list, get, upsert, remove, findByIdempotency, claimById, claimNext });
}
