import crypto from "node:crypto";

const RECORD_KIND = "AssetBlob";
const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Postgres blob storage requires a database query executor.");
  }
  return database;
}

function required(value, field, maxLength = 4000) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    const error = new Error(`${field} is required.`);
    error.code = "postgres_blob_invalid";
    throw error;
  }
  if (normalized.length > maxLength) {
    const error = new Error(`${field} is too long.`);
    error.code = "postgres_blob_invalid";
    throw error;
  }
  return normalized;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value) {
  if (!value) return {};
  return typeof value === "string" ? JSON.parse(value) : value;
}

function normalizeBytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer.slice(value.byteOffset, value.byteOffset + value.byteLength));
  }
  throw new TypeError("Postgres blob storage requires binary bytes.");
}

function sha256(bytes) {
  return `sha256:${crypto.createHash("sha256").update(bytes).digest("hex")}`;
}

function normalizeHash(value) {
  const normalized = required(value, "contentHash", 160).toLowerCase();
  if (!/^sha256:[a-f0-9]{64}$/.test(normalized)) {
    const error = new Error("contentHash must be a SHA-256 digest.");
    error.code = "postgres_blob_invalid";
    throw error;
  }
  return normalized;
}

function descriptor(record) {
  return Object.freeze({
    provider: "postgres",
    blobId: record.blobId,
    objectKey: record.objectKey,
    byteSize: record.byteSize,
    contentHash: record.contentHash,
    contentType: record.contentType,
    region: null,
  });
}

export function createPostgresBlobStorage({
  database,
  workspaceId,
  clock = { now: () => new Date().toISOString() },
  maxBytes = DEFAULT_MAX_BYTES,
} = {}) {
  const db = requireDatabase(database);
  const owner = required(workspaceId, "workspaceId", 240);
  const byteLimit = Number(maxBytes);
  if (!Number.isInteger(byteLimit) || byteLimit < 1024 || byteLimit > 32 * 1024 * 1024) {
    throw new TypeError("Postgres blob storage maxBytes must be between 1 KiB and 32 MiB.");
  }

  async function readRecord(blobIdInput) {
    const blobId = required(blobIdInput, "blobId", 320);
    const rows = resultRows(await db.query(
      `SELECT record_id, workspace_id, record_kind, record
       FROM sf_media_records
       WHERE workspace_id = $1 AND record_kind = $2 AND record_id = $3
       LIMIT 1`,
      [owner, RECORD_KIND, blobId],
    ));
    if (!rows[0]) return null;
    const row = rows[0];
    const record = jsonValue(row.record);
    if (
      row.workspace_id !== owner
      || row.record_kind !== RECORD_KIND
      || row.record_id !== record.blobId
      || record.workspaceId !== owner
    ) {
      const error = new Error("Stored blob metadata failed workspace or identity validation.");
      error.code = "postgres_blob_integrity_error";
      throw error;
    }
    return record;
  }

  async function head(blobIdInput, options = {}) {
    const record = await readRecord(blobIdInput);
    if (!record) return null;
    const requestedObjectKey = String(options.objectKey || "").trim();
    if (requestedObjectKey && requestedObjectKey !== record.objectKey) {
      const error = new Error("Stored blob object key does not match the immutable request.");
      error.code = "postgres_blob_identity_mismatch";
      throw error;
    }
    return descriptor(record);
  }

  async function put(blobIdInput, value, options = {}) {
    const blobId = required(blobIdInput, "blobId", 320);
    const objectKey = required(options.objectKey, "objectKey", 1200);
    const contentType = required(options.contentType || "application/octet-stream", "contentType", 300);
    const expectedHash = normalizeHash(options.contentHash);
    const bytes = normalizeBytes(value);
    if (!bytes.byteLength) {
      const error = new Error("Zero-byte blobs are not stored.");
      error.code = "postgres_blob_empty";
      throw error;
    }
    if (bytes.byteLength > byteLimit) {
      const error = new Error(`Private asset exceeds the Postgres alpha storage limit of ${byteLimit} bytes.`);
      error.code = "postgres_blob_too_large";
      error.status = 413;
      throw error;
    }
    if (Number(options.byteSize) !== bytes.byteLength || sha256(bytes) !== expectedHash) {
      const error = new Error("Blob bytes do not match the immutable size/hash contract.");
      error.code = "postgres_blob_integrity_error";
      throw error;
    }

    const existing = await readRecord(blobId);
    if (existing) {
      if (
        existing.objectKey !== objectKey
        || Number(existing.byteSize) !== bytes.byteLength
        || String(existing.contentHash).toLowerCase() !== expectedHash
      ) {
        const error = new Error("Existing immutable Postgres blob conflicts with this content identity.");
        error.code = "immutable_blob_collision";
        throw error;
      }
      return descriptor(existing);
    }

    const now = String(clock.now());
    const record = {
      kind: RECORD_KIND,
      schemaVersion: 1,
      workspaceId: owner,
      blobId,
      objectKey,
      contentType,
      byteSize: bytes.byteLength,
      contentHash: expectedHash,
      encoding: "base64",
      data: Buffer.from(bytes).toString("base64"),
      createdAt: now,
      updatedAt: now,
    };

    await db.query(
      `INSERT INTO sf_media_records (
         record_id, workspace_id, record_kind, scope_type, scope_id, content_piece_id,
         asset_id, destination, status, revision, schema_version, record, created_at, updated_at
       ) VALUES (
         $1, $2, $3, 'blob', $1, NULL,
         NULL, NULL, 'available', 1, 1, $4::jsonb, $5::timestamptz, $5::timestamptz
       )
       ON CONFLICT (record_id) DO NOTHING`,
      [blobId, owner, RECORD_KIND, JSON.stringify(record), now],
    );

    const persisted = await readRecord(blobId);
    if (!persisted) {
      const error = new Error("Private blob could not be persisted.");
      error.code = "postgres_blob_persistence_failed";
      throw error;
    }
    if (
      persisted.objectKey !== objectKey
      || Number(persisted.byteSize) !== bytes.byteLength
      || String(persisted.contentHash).toLowerCase() !== expectedHash
    ) {
      const error = new Error("Concurrent immutable blob persistence produced conflicting content.");
      error.code = "immutable_blob_collision";
      throw error;
    }
    return descriptor(persisted);
  }

  async function get(blobIdInput, options = {}) {
    const record = await readRecord(blobIdInput);
    if (!record) return null;
    const requestedObjectKey = String(options.objectKey || "").trim();
    if (requestedObjectKey && requestedObjectKey !== record.objectKey) {
      const error = new Error("Stored blob object key does not match the immutable request.");
      error.code = "postgres_blob_identity_mismatch";
      throw error;
    }
    if (record.encoding !== "base64" || typeof record.data !== "string") {
      const error = new Error("Stored Postgres blob has an unsupported encoding.");
      error.code = "postgres_blob_integrity_error";
      throw error;
    }
    const bytes = new Uint8Array(Buffer.from(record.data, "base64"));
    if (bytes.byteLength !== Number(record.byteSize) || sha256(bytes) !== String(record.contentHash).toLowerCase()) {
      const error = new Error("Stored Postgres blob failed immutable byte verification.");
      error.code = "postgres_blob_integrity_error";
      throw error;
    }
    return bytes;
  }

  async function remove(blobIdInput, options = {}) {
    const blobId = required(blobIdInput, "blobId", 320);
    const existing = await head(blobId, options);
    if (!existing) return false;
    const rows = resultRows(await db.query(
      `DELETE FROM sf_media_records
       WHERE workspace_id = $1 AND record_kind = $2 AND record_id = $3
       RETURNING record_id`,
      [owner, RECORD_KIND, blobId],
    ));
    return rows.length === 1;
  }

  return Object.freeze({ put, head, get, remove });
}
