import { assertPort } from "../domain/ports.mjs";
import { normalizeSourceArtifact } from "../domain/sourceArtifacts.mjs";
import { stableStringify } from "../domain/contracts.mjs";

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres SourceArtifact repository requires a database query executor.");
  }
  return database;
}

function rows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function workspace(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error("A workspace-scoped Postgres SourceArtifact repository requires workspace context.");
    error.code = "postgres_workspace_scope_required";
    throw error;
  }
  return normalized;
}

function artifactFromRow(row) {
  const record = typeof row.record === "string" ? JSON.parse(row.record) : row.record;
  return normalizeSourceArtifact(record || {});
}

function immutableEvidenceIdentity(input) {
  const artifact = normalizeSourceArtifact(input);
  return {
    sourceArtifactId: artifact.sourceArtifactId,
    workspaceId: artifact.workspaceId,
    projectId: artifact.projectId,
    campaignId: artifact.campaignId,
    sourceKind: artifact.sourceKind,
    ingestionMethod: artifact.ingestionMethod,
    sourceReference: artifact.sourceReference,
    originalName: artifact.originalName,
    mimeType: artifact.mimeType,
    byteSize: artifact.byteSize,
    contentHash: artifact.contentHash,
    assetIds: artifact.assetIds,
    extraction: artifact.extraction,
    usability: artifact.usability,
    privacy: artifact.privacy,
    parentSourceArtifactIds: artifact.parentSourceArtifactIds,
  };
}

function sameImmutableEvidence(left, right) {
  return stableStringify(immutableEvidenceIdentity(left)) === stableStringify(immutableEvidenceIdentity(right));
}

export function createPostgresSourceArtifactRepository({ database, workspaceId } = {}) {
  const db = requireDatabase(database);
  const owner = workspace(workspaceId);

  function assertOwned(input) {
    const artifact = normalizeSourceArtifact(input);
    if (artifact.workspaceId !== owner) {
      const error = new Error("Cross-workspace SourceArtifact persistence is forbidden.");
      error.code = "postgres_workspace_scope_mismatch";
      throw error;
    }
    return artifact;
  }

  async function list() {
    return rows(await db.query(
      `SELECT record FROM sf_source_artifacts WHERE workspace_id = $1 ORDER BY created_at DESC, source_artifact_id`,
      [owner],
    )).map(artifactFromRow);
  }

  async function get(sourceArtifactId) {
    const id = String(sourceArtifactId || "").trim();
    if (!id) return null;
    const result = rows(await db.query(
      `SELECT record FROM sf_source_artifacts WHERE workspace_id = $1 AND source_artifact_id = $2 LIMIT 1`,
      [owner, id],
    ));
    return result[0] ? artifactFromRow(result[0]) : null;
  }

  async function upsert(input) {
    const artifact = assertOwned(input);
    const serialized = JSON.stringify(artifact);
    const inserted = rows(await db.query(`
      INSERT INTO sf_source_artifacts (
        source_artifact_id, workspace_id, source_kind, content_hash,
        source_reference, record, schema_version, created_at
      ) VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8::timestamptz)
      ON CONFLICT (source_artifact_id) DO NOTHING
      RETURNING record`, [
      artifact.sourceArtifactId,
      owner,
      artifact.sourceKind,
      artifact.contentHash,
      JSON.stringify(artifact.sourceReference),
      serialized,
      artifact.schemaVersion,
      artifact.createdAt,
    ]));
    if (inserted[0]) return artifactFromRow(inserted[0]);

    const existing = await get(artifact.sourceArtifactId);
    if (!existing || !sameImmutableEvidence(existing, artifact)) {
      const error = new Error(`SourceArtifact ${artifact.sourceArtifactId} conflicts with existing immutable evidence metadata.`);
      error.code = "source_artifact_immutable_conflict";
      throw error;
    }
    return existing;
  }

  async function remove() {
    const error = new Error("Hosted SourceArtifacts are immutable evidence history. Use an explicit retention/deletion workflow rather than generic removal.");
    error.code = "source_artifact_immutable_delete_forbidden";
    throw error;
  }

  return assertPort("sourceArtifactRepository", { list, get, upsert, remove });
}
