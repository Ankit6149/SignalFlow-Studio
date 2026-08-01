import { portableClone, stableStringify } from "../domain/contracts.mjs";

export const PORTABLE_ARCHIVE_SCHEMA_VERSION = 1;
export const PORTABLE_ARCHIVE_KIND = "SignalFlowPortableArchive";
export const DEFAULT_MAX_ARCHIVE_BYTES = 50 * 1024 * 1024;

const SECRET_FIELD = /(api[_-]?key|access[_-]?token|refresh[_-]?token|oauth|secret|password|authorization|cookie|private[_-]?key|session[_-]?key)/i;
const PRIVATE_REFERENCE_FIELD = /(signed[_-]?url|private[_-]?(url|ref)|provider[_-]?base[_-]?url|base[_-]?url|local[_-]?(path|url)|absolute[_-]?path|filesystem[_-]?path)/i;
const PATH_FIELD = /(^|[_-])(file|folder|directory|filesystem)?path$/i;
const WINDOWS_PATH = /^[a-z]:[\\/]/i;
const POSIX_PRIVATE_PATH = /^\/(?:Users|home|root|var\/private|private|mnt|Volumes)\//i;
const FILE_URL = /^file:\/\//i;
const PRIVATE_HOST_URL = /^https?:\/\/(?:localhost|127\.0\.0\.1|0\.0\.0\.0|\[::1\]|10\.|192\.168\.|172\.(?:1[6-9]|2\d|3[01])\.)/i;

function text(value) {
  return String(value ?? "").trim();
}

function encoder() {
  return new TextEncoder();
}

function cryptoSubtle() {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is required for portable archive integrity.");
  return subtle;
}

function bytesToHex(bytes) {
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function bytesToBase64(bytes) {
  if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function base64ToBytes(value) {
  if (typeof Buffer !== "undefined") return new Uint8Array(Buffer.from(String(value), "base64"));
  const binary = atob(String(value));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function sha256Hex(value) {
  const bytes = value instanceof Uint8Array ? value : encoder().encode(String(value));
  const digest = await cryptoSubtle().digest("SHA-256", bytes);
  return bytesToHex(new Uint8Array(digest));
}

function privateStringReason(value, key = "") {
  const candidate = text(value);
  if (!candidate) return "";
  if (SECRET_FIELD.test(key)) return "secret field";
  if (PRIVATE_REFERENCE_FIELD.test(key)) return "private deployment reference";
  if (PATH_FIELD.test(key) && (WINDOWS_PATH.test(candidate) || POSIX_PRIVATE_PATH.test(candidate) || FILE_URL.test(candidate))) {
    return "local filesystem path";
  }
  if (FILE_URL.test(candidate)) return "local file URL";
  if (/base[_-]?url|endpoint/i.test(key) && PRIVATE_HOST_URL.test(candidate)) return "private/local endpoint";
  return "";
}

export function sanitizeForPortableTransfer(value, { path = "payload", exclusions = [] } = {}) {
  function visit(current, currentPath, key = "") {
    if (current === null || typeof current === "boolean" || typeof current === "number") return current;
    if (typeof current === "string") {
      const reason = privateStringReason(current, key);
      if (reason) {
        exclusions.push({ path: currentPath, reason });
        return undefined;
      }
      return current;
    }
    if (current === undefined) return undefined;
    if (Array.isArray(current)) {
      return current
        .map((item, index) => visit(item, `${currentPath}[${index}]`))
        .filter((item) => item !== undefined);
    }
    if (!current || typeof current !== "object" || Object.getPrototypeOf(current) !== Object.prototype) {
      throw new TypeError(`${currentPath} contains a non-portable runtime object.`);
    }

    const result = {};
    for (const [childKey, childValue] of Object.entries(current)) {
      const childPath = `${currentPath}.${childKey}`;
      if (SECRET_FIELD.test(childKey)) {
        exclusions.push({ path: childPath, reason: "secret field" });
        continue;
      }
      if (PRIVATE_REFERENCE_FIELD.test(childKey)) {
        exclusions.push({ path: childPath, reason: "private deployment reference" });
        continue;
      }
      const next = visit(childValue, childPath, childKey);
      if (next !== undefined) result[childKey] = next;
    }
    return result;
  }

  return visit(value, path);
}

export function encodeBlobPayload(value) {
  if (value instanceof Uint8Array) {
    return { payloadFormat: "bytes", payloadBase64: bytesToBase64(value), byteLength: value.byteLength };
  }
  if (value instanceof ArrayBuffer) {
    const bytes = new Uint8Array(value);
    return { payloadFormat: "bytes", payloadBase64: bytesToBase64(bytes), byteLength: bytes.byteLength };
  }
  if (typeof value === "string") {
    const bytes = encoder().encode(value);
    return { payloadFormat: "text", payloadBase64: bytesToBase64(bytes), byteLength: bytes.byteLength };
  }
  const serialized = stableStringify(portableClone(value));
  const bytes = encoder().encode(serialized);
  return { payloadFormat: "json", payloadBase64: bytesToBase64(bytes), byteLength: bytes.byteLength };
}

export function decodeBlobPayload(entry) {
  const bytes = base64ToBytes(entry.payloadBase64 || "");
  if (entry.payloadFormat === "bytes") return bytes;
  const decoded = new TextDecoder().decode(bytes);
  if (entry.payloadFormat === "text") return decoded;
  if (entry.payloadFormat === "json") return JSON.parse(decoded);
  throw new TypeError(`Unsupported blob payload format: ${entry.payloadFormat || "missing"}.`);
}

export function validateArchivePath(value) {
  const archivePath = text(value);
  if (!archivePath || archivePath.startsWith("/") || archivePath.includes("\\") || archivePath.includes("\0")) return false;
  const segments = archivePath.split("/");
  return segments[0] === "blobs" && segments.every((segment) => segment && segment !== "." && segment !== "..");
}

function unsignedArchive(archive) {
  const { integrity, signature, ...unsigned } = archive;
  void integrity;
  void signature;
  return unsigned;
}

export async function createPortableArchive({
  archiveId,
  createdAt,
  sourceDeployment = {},
  campaigns = [],
  assets = [],
  sourceArtifacts = [],
  processingRecords = [],
  approvals = [],
  exports = [],
  blobEntries = [],
  preflightExclusions = [],
  signer = null,
} = {}) {
  if (!text(archiveId)) throw new TypeError("archiveId is required.");
  if (!text(createdAt)) throw new TypeError("createdAt is required.");

  const exclusions = [];
  const payload = sanitizeForPortableTransfer({
    campaigns,
    assets,
    sourceArtifacts,
    processingRecords,
    approvals,
    exports,
    blobEntries,
  }, { path: "payload", exclusions });
  const sanitizedSource = sanitizeForPortableTransfer(sourceDeployment, { path: "sourceDeployment", exclusions });
  const estimatedAssetBytes = (payload.blobEntries || []).reduce((total, entry) => total + (Number(entry.byteLength) || 0), 0);

  const archive = {
    schemaVersion: PORTABLE_ARCHIVE_SCHEMA_VERSION,
    kind: PORTABLE_ARCHIVE_KIND,
    archiveId: text(archiveId),
    createdAt: text(createdAt),
    sourceDeployment: sanitizedSource,
    manifest: {
      campaignCount: payload.campaigns.length,
      assetCount: payload.assets.length,
      sourceArtifactCount: payload.sourceArtifacts.length,
      processingRecordCount: payload.processingRecords.length,
      approvalCount: payload.approvals.length,
      exportCount: payload.exports.length,
      blobCount: payload.blobEntries.length,
      estimatedAssetBytes,
      exclusions: [...portableClone(preflightExclusions || []), ...exclusions],
    },
    payload,
  };

  const digest = await sha256Hex(stableStringify(archive));
  archive.integrity = { algorithm: "SHA-256", digest };
  if (signer) {
    const signature = await signer.sign(digest);
    archive.signature = { ...signer.describe(), value: signature };
  }
  return portableClone(archive);
}

export async function validatePortableArchive(archive, {
  maxBytes = DEFAULT_MAX_ARCHIVE_BYTES,
  signer = null,
  requireSignature = false,
} = {}) {
  const errors = [];
  const warnings = [];
  if (!archive || typeof archive !== "object" || Array.isArray(archive)) {
    return { valid: false, blocked: true, errors: [{ code: "invalid_archive", message: "Archive must be an object." }], warnings };
  }
  if (archive.kind !== PORTABLE_ARCHIVE_KIND) {
    errors.push({ code: "invalid_kind", message: `Expected ${PORTABLE_ARCHIVE_KIND}.` });
  }
  if (!Number.isInteger(archive.schemaVersion)) {
    errors.push({ code: "missing_schema", message: "Archive schema version is missing." });
  } else if (archive.schemaVersion > PORTABLE_ARCHIVE_SCHEMA_VERSION) {
    errors.push({
      code: "future_schema",
      message: `Archive schema ${archive.schemaVersion} is newer than supported schema ${PORTABLE_ARCHIVE_SCHEMA_VERSION}. Upgrade SignalFlow before importing.`,
    });
  } else if (archive.schemaVersion < PORTABLE_ARCHIVE_SCHEMA_VERSION) {
    warnings.push({ code: "legacy_archive", message: `Archive schema ${archive.schemaVersion} requires compatibility migration.` });
  }

  const serialized = stableStringify(archive);
  const byteLength = encoder().encode(serialized).byteLength;
  if (byteLength > maxBytes) {
    errors.push({ code: "archive_too_large", message: `Archive is ${byteLength} bytes; the configured limit is ${maxBytes} bytes.` });
  }

  const blobEntries = Array.isArray(archive.payload?.blobEntries) ? archive.payload.blobEntries : [];
  for (const entry of blobEntries) {
    if (!validateArchivePath(entry.archivePath)) {
      errors.push({ code: "archive_traversal", message: `Unsafe archive path: ${entry.archivePath || "missing"}.` });
    }
    try {
      const bytes = base64ToBytes(entry.payloadBase64 || "");
      if (Number(entry.byteLength) !== bytes.byteLength) {
        errors.push({ code: "blob_length_mismatch", message: `Blob ${entry.blobId || entry.archivePath} length does not match its manifest.` });
      }
    } catch {
      errors.push({ code: "invalid_blob_encoding", message: `Blob ${entry.blobId || entry.archivePath} is not valid base64.` });
    }
  }

  if (!archive.integrity?.digest || archive.integrity.algorithm !== "SHA-256") {
    errors.push({ code: "missing_integrity", message: "SHA-256 integrity metadata is required." });
  } else {
    const expected = await sha256Hex(stableStringify(unsignedArchive(archive)));
    if (expected !== archive.integrity.digest) {
      errors.push({ code: "integrity_mismatch", message: "Archive content does not match its SHA-256 digest." });
    }
  }

  if (requireSignature && !archive.signature) {
    errors.push({ code: "signature_required", message: "This destination requires a signed archive." });
  }
  if (archive.signature) {
    if (!signer) {
      warnings.push({ code: "signature_unverified", message: "Archive is signed, but no matching verifier was configured." });
      if (requireSignature) errors.push({ code: "signature_unverified", message: "The required archive signature could not be verified." });
    } else {
      const validSignature = await signer.verify(archive.integrity?.digest || "", archive.signature.value);
      if (!validSignature) errors.push({ code: "invalid_signature", message: "Archive signature verification failed." });
    }
  }

  const missingBlobAssets = (archive.payload?.assets || []).filter((asset) => {
    if (!asset.blobId) return false;
    return !blobEntries.some((entry) => entry.blobId === asset.blobId);
  });
  if (missingBlobAssets.length) {
    warnings.push({
      code: "partial_assets",
      message: `${missingBlobAssets.length} asset${missingBlobAssets.length === 1 ? " is" : "s are"} missing payload data and can import as metadata only.`,
      assetIds: missingBlobAssets.map((asset) => asset.assetId),
    });
  }

  return {
    valid: errors.length === 0,
    blocked: errors.length > 0,
    errors,
    warnings,
    byteLength,
    counts: {
      campaigns: archive.payload?.campaigns?.length || 0,
      assets: archive.payload?.assets?.length || 0,
      blobs: blobEntries.length,
      sourceArtifacts: archive.payload?.sourceArtifacts?.length || 0,
      processingRecords: archive.payload?.processingRecords?.length || 0,
      approvals: archive.payload?.approvals?.length || 0,
      exports: archive.payload?.exports?.length || 0,
    },
    estimatedAssetBytes: archive.manifest?.estimatedAssetBytes || 0,
  };
}

export function createHmacArchiveSigner({ secret, keyId = "signalflow-transfer" } = {}) {
  const secretBytes = encoder().encode(text(secret));
  if (!secretBytes.length) throw new TypeError("HMAC signer requires a secret.");

  async function key() {
    return cryptoSubtle().importKey(
      "raw",
      secretBytes,
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign", "verify"],
    );
  }

  return {
    async sign(digest) {
      const signature = await cryptoSubtle().sign("HMAC", await key(), encoder().encode(String(digest)));
      return bytesToBase64(new Uint8Array(signature));
    },
    async verify(digest, signature) {
      try {
        return cryptoSubtle().verify(
          "HMAC",
          await key(),
          base64ToBytes(signature),
          encoder().encode(String(digest)),
        );
      } catch {
        return false;
      }
    },
    describe() {
      return { algorithm: "HMAC-SHA-256", keyId: text(keyId) };
    },
  };
}
