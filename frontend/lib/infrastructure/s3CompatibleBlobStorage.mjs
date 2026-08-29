import { assertPort } from "../domain/ports.mjs";

const SERVICE = "s3";
const ALGORITHM = "AWS4-HMAC-SHA256";
const EMPTY_SHA256 = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
const MAX_PREVIEW_SECONDS = 900;

export class S3BlobStorageError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = "S3BlobStorageError";
    this.code = code;
    this.details = { ...details };
  }
}

function requiredText(value, field, maxLength = 4096) {
  const normalized = String(value ?? "").trim();
  if (!normalized) throw new S3BlobStorageError("missing_s3_configuration", `${field} is required.`, { field });
  if (normalized.length > maxLength) throw new S3BlobStorageError("invalid_s3_configuration", `${field} is too long.`, { field });
  return normalized;
}

function rfc3986(value) {
  return encodeURIComponent(String(value)).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function canonicalQuery(entries = []) {
  return entries
    .map(([key, value]) => [rfc3986(key), rfc3986(value)])
    .sort(([leftKey, leftValue], [rightKey, rightValue]) => leftKey.localeCompare(rightKey) || leftValue.localeCompare(rightValue))
    .map(([key, value]) => `${key}=${value}`)
    .join("&");
}

function safeBlobId(value) {
  const normalized = requiredText(value, "blobId", 320);
  if (!/^[a-zA-Z0-9][a-zA-Z0-9._-]*$/.test(normalized)) {
    throw new S3BlobStorageError("unsafe_blob_id", "Blob IDs must be opaque URL-safe identifiers.");
  }
  return normalized;
}

function safeObjectKey(value, fallbackBlobId) {
  const normalized = String(value || `blobs/${fallbackBlobId}`).trim().replace(/^\/+/, "");
  if (!normalized || normalized.length > 1800) throw new S3BlobStorageError("unsafe_object_key", "Object storage key is invalid.");
  if (/^https?:/i.test(normalized) || /^[a-zA-Z]:|\\|[\u0000-\u001f\u007f]/.test(normalized)) {
    throw new S3BlobStorageError("unsafe_object_key", "Object storage keys cannot be URLs, filesystem paths, or control-character data.");
  }
  const segments = normalized.split("/");
  if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
    throw new S3BlobStorageError("unsafe_object_key", "Object storage keys must use non-empty traversal-safe segments.");
  }
  return segments.join("/");
}

function normalizeEndpoint(value, allowInsecureLocalhost) {
  let url;
  try {
    url = new URL(requiredText(value, "endpoint", 2000));
  } catch {
    throw new S3BlobStorageError("invalid_s3_endpoint", "S3-compatible endpoint must be an absolute URL.");
  }
  if (url.username || url.password || url.search || url.hash) {
    throw new S3BlobStorageError("invalid_s3_endpoint", "S3-compatible endpoint cannot contain credentials, query parameters, or fragments.");
  }
  const local = ["localhost", "127.0.0.1", "::1"].includes(url.hostname);
  if (url.protocol !== "https:" && !(allowInsecureLocalhost === true && local && url.protocol === "http:")) {
    throw new S3BlobStorageError("insecure_s3_endpoint", "Hosted object storage requires HTTPS.");
  }
  url.pathname = url.pathname.replace(/\/+$/, "");
  return url;
}

function normalizeBucket(value) {
  const bucket = requiredText(value, "bucket", 63).toLowerCase();
  if (!/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/.test(bucket) || /\.\./.test(bucket)) {
    throw new S3BlobStorageError("invalid_s3_bucket", "S3-compatible bucket name is invalid.");
  }
  return bucket;
}

function dateParts(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new S3BlobStorageError("invalid_signing_time", "Object-storage signing clock returned an invalid timestamp.");
  const amzDate = date.toISOString().replace(/[:-]|\.\d{3}/g, "");
  return { date, amzDate, dateStamp: amzDate.slice(0, 8) };
}

function bytes(value) {
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (value instanceof ArrayBuffer) return new Uint8Array(value.slice(0));
  if (typeof value === "string") return new TextEncoder().encode(value);
  throw new S3BlobStorageError("unsupported_s3_blob", "S3-compatible blob storage accepts bytes, ArrayBuffer, or string content.");
}

async function sha256Hex(value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new S3BlobStorageError("crypto_unavailable", "Web Crypto is required for S3 request signing.");
  const source = value instanceof Uint8Array ? value : new TextEncoder().encode(String(value));
  const digest = new Uint8Array(await subtle.digest("SHA-256", source));
  return Array.from(digest, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function hmac(key, value) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new S3BlobStorageError("crypto_unavailable", "Web Crypto is required for S3 request signing.");
  const rawKey = key instanceof Uint8Array ? key : new TextEncoder().encode(String(key));
  const cryptoKey = await subtle.importKey("raw", rawKey, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  return new Uint8Array(await subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(String(value))));
}

function hex(value) {
  return Array.from(value, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

async function signingKey(secretAccessKey, dateStamp, region) {
  const dateKey = await hmac(`AWS4${secretAccessKey}`, dateStamp);
  const regionKey = await hmac(dateKey, region);
  const serviceKey = await hmac(regionKey, SERVICE);
  return hmac(serviceKey, "aws4_request");
}

function canonicalHeaderState(headers) {
  const entries = Object.entries(headers)
    .map(([key, value]) => [key.toLowerCase(), String(value).trim().replace(/\s+/g, " ")])
    .sort(([left], [right]) => left.localeCompare(right));
  return {
    canonical: entries.map(([key, value]) => `${key}:${value}\n`).join(""),
    signed: entries.map(([key]) => key).join(";"),
  };
}

function objectUrl(endpoint, bucket, objectKey) {
  const baseSegments = endpoint.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  const rawSegments = [...baseSegments, bucket, ...objectKey.split("/")];
  const pathname = `/${rawSegments.map(rfc3986).join("/")}`;
  const url = new URL(endpoint.toString());
  url.pathname = pathname;
  url.search = "";
  url.hash = "";
  return { url, pathname };
}

function responseHeader(response, name) {
  return response?.headers?.get?.(name) || null;
}

function objectMetadata(response, descriptor) {
  const size = Number(responseHeader(response, "content-length"));
  const storedHash = responseHeader(response, "x-amz-meta-sf-sha256");
  return {
    ...descriptor,
    byteSize: Number.isFinite(size) && size >= 0 ? size : null,
    contentType: responseHeader(response, "content-type") || null,
    contentHash: storedHash ? `sha256:${storedHash.replace(/^sha256:/i, "")}` : null,
    etag: responseHeader(response, "etag")?.replace(/^"|"$/g, "") || null,
  };
}

function requestFailure(method, blobId, response) {
  return new S3BlobStorageError(
    "object_storage_request_failed",
    `Private object storage ${method} failed with status ${response?.status || "unknown"}.`,
    { method, blobId, status: response?.status || null },
  );
}

export function createS3CompatibleBlobStorage({
  endpoint,
  bucket,
  region = "auto",
  accessKeyId,
  secretAccessKey,
  sessionToken = null,
  fetchImpl = globalThis.fetch,
  clock = { now: () => new Date().toISOString() },
  allowInsecureLocalhost = false,
  provider = "s3-compatible",
} = {}) {
  const endpointUrl = normalizeEndpoint(endpoint, allowInsecureLocalhost);
  const bucketName = normalizeBucket(bucket);
  const signingRegion = requiredText(region, "region", 120);
  const accessKey = requiredText(accessKeyId, "accessKeyId", 512);
  const secretKey = requiredText(secretAccessKey, "secretAccessKey", 2048);
  const token = sessionToken ? requiredText(sessionToken, "sessionToken", 4096) : null;
  if (typeof fetchImpl !== "function") throw new S3BlobStorageError("fetch_unavailable", "S3-compatible blob storage requires fetch().");
  if (!clock || typeof clock.now !== "function") throw new S3BlobStorageError("clock_unavailable", "S3-compatible blob storage requires clock.now().");

  const publicDescriptor = Object.freeze({
    provider: requiredText(provider, "provider", 120),
    bucket: bucketName,
    region: signingRegion,
    endpointOrigin: endpointUrl.origin,
    access: "private",
  });

  function location(blobIdInput, options = {}) {
    const blobId = safeBlobId(blobIdInput);
    const objectKey = safeObjectKey(options.objectKey, blobId);
    const { url, pathname } = objectUrl(endpointUrl, bucketName, objectKey);
    return { blobId, objectKey, url, pathname };
  }

  async function signedFetch(method, blobIdInput, { body = null, objectKey = null, contentType = null, contentHash = null } = {}) {
    const target = location(blobIdInput, { objectKey });
    const bodyBytes = body === null ? null : bytes(body);
    const payloadHash = bodyBytes ? await sha256Hex(bodyBytes) : EMPTY_SHA256;
    const { amzDate, dateStamp } = dateParts(clock.now());
    const credentialScope = `${dateStamp}/${signingRegion}/${SERVICE}/aws4_request`;
    const signingHeaders = {
      host: target.url.host,
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
    };
    if (token) signingHeaders["x-amz-security-token"] = token;
    if (contentHash) signingHeaders["x-amz-meta-sf-sha256"] = String(contentHash).replace(/^sha256:/i, "").toLowerCase();
    const headerState = canonicalHeaderState(signingHeaders);
    const canonicalRequest = [
      method,
      target.pathname,
      "",
      headerState.canonical,
      headerState.signed,
      payloadHash,
    ].join("\n");
    const stringToSign = [
      ALGORITHM,
      amzDate,
      credentialScope,
      await sha256Hex(canonicalRequest),
    ].join("\n");
    const signature = hex(await hmac(await signingKey(secretKey, dateStamp, signingRegion), stringToSign));
    const headers = {
      "x-amz-content-sha256": payloadHash,
      "x-amz-date": amzDate,
      Authorization: `${ALGORITHM} Credential=${accessKey}/${credentialScope}, SignedHeaders=${headerState.signed}, Signature=${signature}`,
    };
    if (token) headers["x-amz-security-token"] = token;
    if (contentHash) headers["x-amz-meta-sf-sha256"] = String(contentHash).replace(/^sha256:/i, "").toLowerCase();
    if (contentType) headers["content-type"] = String(contentType);

    const response = await fetchImpl(target.url.toString(), {
      method,
      headers,
      body: bodyBytes,
      redirect: "error",
    });
    return { response, target };
  }

  async function head(blobId, options = {}) {
    const { response, target } = await signedFetch("HEAD", blobId, options);
    if (response.status === 404) return null;
    if (!response.ok) throw requestFailure("HEAD", target.blobId, response);
    return objectMetadata(response, {
      provider: publicDescriptor.provider,
      blobId: target.blobId,
      objectKey: target.objectKey,
      region: signingRegion,
    });
  }

  const adapter = {
    async put(blobId, value, options = {}) {
      const source = bytes(value);
      const { response, target } = await signedFetch("PUT", blobId, {
        ...options,
        body: source,
      });
      if (!response.ok) throw requestFailure("PUT", target.blobId, response);
      return {
        provider: publicDescriptor.provider,
        blobId: target.blobId,
        objectKey: target.objectKey,
        region: signingRegion,
        byteSize: source.byteLength,
        contentType: options.contentType || null,
        contentHash: options.contentHash || null,
      };
    },

    async get(blobId, options = {}) {
      const { response, target } = await signedFetch("GET", blobId, options);
      if (response.status === 404) return null;
      if (!response.ok) throw requestFailure("GET", target.blobId, response);
      return new Uint8Array(await response.arrayBuffer());
    },

    async remove(blobId, options = {}) {
      const existing = await head(blobId, options);
      if (!existing) return false;
      const { response, target } = await signedFetch("DELETE", blobId, options);
      if (!response.ok) throw requestFailure("DELETE", target.blobId, response);
      return true;
    },

    head,

    async createReadUrl(blobIdInput, options = {}) {
      const target = location(blobIdInput, options);
      const parsedTtl = Number(options.expiresInSeconds);
      const expiresInSeconds = Math.max(1, Math.min(MAX_PREVIEW_SECONDS, Number.isFinite(parsedTtl) ? Math.round(parsedTtl) : 60));
      const { date, amzDate, dateStamp } = dateParts(clock.now());
      const credentialScope = `${dateStamp}/${signingRegion}/${SERVICE}/aws4_request`;
      const queryEntries = [
        ["X-Amz-Algorithm", ALGORITHM],
        ["X-Amz-Credential", `${accessKey}/${credentialScope}`],
        ["X-Amz-Date", amzDate],
        ["X-Amz-Expires", String(expiresInSeconds)],
        ["X-Amz-SignedHeaders", "host"],
      ];
      if (token) queryEntries.push(["X-Amz-Security-Token", token]);
      const unsignedQuery = canonicalQuery(queryEntries);
      const canonicalRequest = [
        "GET",
        target.pathname,
        unsignedQuery,
        `host:${target.url.host}\n`,
        "host",
        "UNSIGNED-PAYLOAD",
      ].join("\n");
      const stringToSign = [
        ALGORITHM,
        amzDate,
        credentialScope,
        await sha256Hex(canonicalRequest),
      ].join("\n");
      const signature = hex(await hmac(await signingKey(secretKey, dateStamp, signingRegion), stringToSign));
      target.url.search = canonicalQuery([...queryEntries, ["X-Amz-Signature", signature]]);
      return {
        url: target.url.toString(),
        expiresAt: new Date(date.getTime() + expiresInSeconds * 1000).toISOString(),
      };
    },

    describe() {
      return { ...publicDescriptor };
    },
  };

  return assertPort("blobStorage", adapter);
}
