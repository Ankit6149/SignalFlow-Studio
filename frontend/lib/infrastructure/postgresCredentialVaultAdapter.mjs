import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const SCHEMA_VERSION = 1;
const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;
const MAX_SECRET_BYTES = 96 * 1024;
const SAFE_KIND = /^[a-z0-9]+(?:[._-][a-z0-9]+)*$/;

function required(value, field, maxLength = 4000) {
  const normalized = String(value || "").trim();
  if (!normalized) throw new TypeError(`${field} is required.`);
  if (normalized.length > maxLength) throw new TypeError(`${field} is too long.`);
  return normalized;
}

function requireDatabase(database) {
  if (!database || typeof database.query !== "function") {
    throw new TypeError("Credential vault requires a database query executor.");
  }
  return database;
}

function resultRows(result) {
  if (Array.isArray(result)) return result;
  if (Array.isArray(result?.rows)) return result.rows;
  return [];
}

function jsonValue(value) {
  if (!value) return null;
  return typeof value === "string" ? JSON.parse(value) : value;
}

function keyFromSecret(secret) {
  const root = required(secret, "credential vault secret", 10000);
  if (root.length < 32) {
    const error = new Error("Credential vault secret must be at least 32 characters.");
    error.code = "credential_vault_unconfigured";
    throw error;
  }
  return createHash("sha256").update(root, "utf8").digest();
}

function opaque(value, field, maxLength = 180) {
  const normalized = required(value, field, maxLength);
  if (/[/\\]|^[a-zA-Z]:/.test(normalized)) throw new TypeError(`${field} must be an opaque identifier.`);
  return normalized;
}

function kindValue(value) {
  const normalized = required(value, "secret kind", 120).toLowerCase();
  if (!SAFE_KIND.test(normalized)) throw new TypeError("Secret kind is invalid.");
  return normalized;
}

function aad({ workspaceId, secretRecordId, secretKind }) {
  return Buffer.from(`signalflow-secret:v1:${workspaceId}:${secretKind}:${secretRecordId}`, "utf8");
}

function encode(value) {
  return Buffer.from(value).toString("base64url");
}

function decode(value, field) {
  try {
    return Buffer.from(required(value, field, 200000), "base64url");
  } catch {
    const error = new Error(`Credential vault ${field} is invalid.`);
    error.code = "credential_vault_corrupt";
    throw error;
  }
}

function encrypt({ key, workspaceId, secretRecordId, secretKind, value }) {
  const plaintext = Buffer.from(JSON.stringify(value), "utf8");
  if (!plaintext.byteLength || plaintext.byteLength > MAX_SECRET_BYTES) {
    const error = new Error("Credential payload exceeds the safe encrypted-record bound.");
    error.code = "credential_vault_payload_invalid";
    throw error;
  }
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  cipher.setAAD(aad({ workspaceId, secretRecordId, secretKind }));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return Object.freeze({
    version: SCHEMA_VERSION,
    algorithm: ALGORITHM,
    iv: encode(iv),
    tag: encode(cipher.getAuthTag()),
    ciphertext: encode(ciphertext),
  });
}

function decrypt({ key, workspaceId, secretRecordId, secretKind, envelope }) {
  if (!envelope || envelope.version !== SCHEMA_VERSION || envelope.algorithm !== ALGORITHM) {
    const error = new Error("Credential vault envelope version is unsupported.");
    error.code = "credential_vault_corrupt";
    throw error;
  }
  try {
    const decipher = createDecipheriv(ALGORITHM, key, decode(envelope.iv, "iv"));
    decipher.setAAD(aad({ workspaceId, secretRecordId, secretKind }));
    decipher.setAuthTag(decode(envelope.tag, "tag"));
    const plaintext = Buffer.concat([
      decipher.update(decode(envelope.ciphertext, "ciphertext")),
      decipher.final(),
    ]);
    return JSON.parse(plaintext.toString("utf8"));
  } catch (cause) {
    const error = new Error("Credential vault envelope could not be authenticated.");
    error.code = "credential_vault_authentication_failed";
    error.cause = cause;
    throw error;
  }
}

export function createPostgresCredentialVault({
  database,
  workspaceId,
  vaultSecret,
  clock = { now: () => new Date().toISOString() },
} = {}) {
  const db = requireDatabase(database);
  const owner = opaque(workspaceId, "workspaceId", 240);
  const key = keyFromSecret(vaultSecret);

  async function put({ secretRecordId, secretKind, value } = {}) {
    const id = opaque(secretRecordId, "secretRecordId");
    const kind = kindValue(secretKind);
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new TypeError("Credential vault value must be an object.");
    }
    const now = clock.now();
    const envelope = encrypt({ key, workspaceId: owner, secretRecordId: id, secretKind: kind, value });
    const rows = resultRows(await db.query(`
      INSERT INTO sf_secret_records (
        secret_record_id, workspace_id, secret_kind, envelope, schema_version, created_at, updated_at
      ) VALUES ($1, $2, $3, $4::jsonb, $5, $6::timestamptz, $6::timestamptz)
      ON CONFLICT (secret_record_id) DO NOTHING
      RETURNING secret_record_id
    `, [id, owner, kind, JSON.stringify(envelope), SCHEMA_VERSION, now]));
    if (rows.length !== 1) {
      const error = new Error("Credential record identity already exists; immutable secrets are not overwritten.");
      error.code = "credential_vault_identity_conflict";
      throw error;
    }
    return id;
  }

  async function get(secretRecordId, expectedKind = null) {
    const id = opaque(secretRecordId, "secretRecordId");
    const rows = resultRows(await db.query(`
      SELECT secret_record_id, workspace_id, secret_kind, envelope
      FROM sf_secret_records
      WHERE secret_record_id = $1 AND workspace_id = $2
      LIMIT 1
    `, [id, owner]));
    if (!rows[0]) return null;
    const kind = kindValue(rows[0].secret_kind);
    if (expectedKind && kind !== kindValue(expectedKind)) {
      const error = new Error("Credential record kind does not match the requested authority.");
      error.code = "credential_vault_kind_mismatch";
      throw error;
    }
    return decrypt({
      key,
      workspaceId: owner,
      secretRecordId: id,
      secretKind: kind,
      envelope: jsonValue(rows[0].envelope),
    });
  }

  async function remove(secretRecordId) {
    const id = opaque(secretRecordId, "secretRecordId");
    const rows = resultRows(await db.query(
      "DELETE FROM sf_secret_records WHERE secret_record_id = $1 AND workspace_id = $2 RETURNING secret_record_id",
      [id, owner],
    ));
    return rows.length === 1;
  }

  return Object.freeze({ put, get, remove });
}
