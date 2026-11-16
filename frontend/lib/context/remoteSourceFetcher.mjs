import dns from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";
import { createHash } from "node:crypto";
import {
  brotliDecompressSync,
  gunzipSync,
  inflateSync,
} from "node:zlib";

import {
  isBlockedHostname,
  isPrivateAddress,
  normalizeHttpUrl,
} from "./urlSafety.mjs";
import {
  EVIDENCE_STATES,
  INGESTION_METHODS,
  normalizeSourceArtifact,
  PROCESSING_STATES,
  SOURCE_KINDS,
  SOURCE_USABILITY_STATES,
} from "../domain/sourceArtifacts.mjs";

export const SOURCE_FETCH_RESULT_VERSION = 1;

export const SOURCE_FETCH_STATUSES = Object.freeze({
  USABLE_EVIDENCE: "usable_evidence",
  REFERENCE_ONLY: "reference_only",
  BLOCKED: "blocked_for_safety",
  TIMED_OUT: "timed_out",
  OVERSIZED: "oversized",
  UNSUPPORTED: "unsupported",
  FAILED: "failed",
  CANCELLED: "cancelled",
});

export const SOURCE_FETCH_LIMITS = Object.freeze({
  maxRedirects: 3,
  timeoutMs: 8_000,
  maxCompressedBytes: 1_000_000,
  maxDecompressedBytes: 2_000_000,
  maxExtractedChars: 20_000,
});

const ALLOWED_MIME = new Set([
  "text/html",
  "text/plain",
  "application/xhtml+xml",
  "application/xml",
  "text/xml",
]);

const SENSITIVE_QUERY = /(^|[-_])(token|key|signature|sig|credential|authorization|expires|x-amz-)/i;
const REDIRECT_CODES = new Set([301, 302, 303, 307, 308]);

export class RemoteSourceFetchError extends Error {
  constructor(code, message, { status = SOURCE_FETCH_STATUSES.FAILED } = {}) {
    super(message);
    this.name = "RemoteSourceFetchError";
    this.code = code;
    this.fetchStatus = status;
  }
}

function nowMs(clock) {
  return typeof clock?.now === "function" ? Number(new Date(clock.now()).getTime()) : Date.now();
}

function safeCanonicalUrl(input) {
  let url;
  try {
    url = input instanceof URL ? new URL(input.toString()) : normalizeHttpUrl(input);
  } catch {
    return null;
  }
  url.username = "";
  url.password = "";
  url.hash = "";
  const safe = [...url.searchParams.entries()]
    .filter(([key]) => !SENSITIVE_QUERY.test(key))
    .sort(([ak, av], [bk, bv]) => ak.localeCompare(bk) || av.localeCompare(bv));
  url.search = "";
  for (const [key, value] of safe) url.searchParams.append(key, value);
  return url.toString();
}

function assertPortableRequestUrl(input) {
  const url = input instanceof URL ? new URL(input.toString()) : normalizeHttpUrl(input);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new RemoteSourceFetchError(
      "unsupported_url_protocol",
      "Only HTTP and HTTPS remote sources are supported.",
      { status: SOURCE_FETCH_STATUSES.BLOCKED },
    );
  }
  if (url.username || url.password) {
    throw new RemoteSourceFetchError(
      "credentialed_url_forbidden",
      "URLs with embedded credentials are blocked.",
      { status: SOURCE_FETCH_STATUSES.BLOCKED },
    );
  }
  for (const key of url.searchParams.keys()) {
    if (SENSITIVE_QUERY.test(key)) {
      throw new RemoteSourceFetchError(
        "credential_query_forbidden",
        "Signed or credential-bearing URL parameters are blocked.",
        { status: SOURCE_FETCH_STATUSES.BLOCKED },
      );
    }
  }
  const allowedPort = !url.port
    || (url.protocol === "http:" && url.port === "80")
    || (url.protocol === "https:" && url.port === "443");
  if (!allowedPort) {
    throw new RemoteSourceFetchError(
      "nonstandard_port_blocked",
      "Remote source URLs must use the standard HTTP or HTTPS port.",
      { status: SOURCE_FETCH_STATUSES.BLOCKED },
    );
  }
  return url;
}

function mappedIpv4FromIpv6(address) {
  const value = String(address || "").toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  const match = value.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i);
  if (!match) return null;
  const high = Number.parseInt(match[1], 16);
  const low = Number.parseInt(match[2], 16);
  return [
    (high >>> 8) & 255,
    high & 255,
    (low >>> 8) & 255,
    low & 255,
  ].join(".");
}

function addressBlocked(address) {
  const mapped = mappedIpv4FromIpv6(address);
  if (mapped) return isPrivateAddress(mapped);
  const value = String(address || "").toLowerCase().replace(/^\[|\]$/g, "").split("%")[0];
  if (value.startsWith("64:ff9b:") || value.startsWith("2002:") || value.startsWith("3fff:")) return true;
  if (/^2001:0{0,3}:/i.test(value)) return true;
  return isPrivateAddress(value);
}

function normalizeResolvedAnswer(answer) {
  if (typeof answer === "string") {
    const family = net.isIP(answer);
    return family ? { address: answer, family } : null;
  }
  if (!answer || typeof answer !== "object") return null;
  const address = String(answer.address || "").trim();
  const family = Number(answer.family || net.isIP(address));
  return net.isIP(address) && [4, 6].includes(family) ? { address, family } : null;
}

async function vettedResolution(url, resolveHost) {
  const hostname = url.hostname.replace(/^\[|\]$/g, "").replace(/\.$/, "");
  if (isBlockedHostname(hostname)) {
    throw new RemoteSourceFetchError(
      "internal_hostname_blocked",
      "Local or internal hostnames are blocked.",
      { status: SOURCE_FETCH_STATUSES.BLOCKED },
    );
  }

  const directFamily = net.isIP(hostname);
  if (directFamily) {
    if (addressBlocked(hostname)) {
      throw new RemoteSourceFetchError(
        "private_address_blocked",
        "Private or reserved network destinations are blocked.",
        { status: SOURCE_FETCH_STATUSES.BLOCKED },
      );
    }
    return Object.freeze([{ address: hostname, family: directFamily }]);
  }

  let raw;
  try {
    raw = await resolveHost(hostname);
  } catch {
    throw new RemoteSourceFetchError("dns_resolution_failed", "The source hostname could not be resolved.");
  }
  const answers = (Array.isArray(raw) ? raw : [raw]).map(normalizeResolvedAnswer).filter(Boolean);
  if (!answers.length) {
    throw new RemoteSourceFetchError("dns_resolution_failed", "The source hostname did not resolve to a public address.");
  }
  if (answers.some(({ address }) => addressBlocked(address))) {
    throw new RemoteSourceFetchError(
      "unsafe_dns_answer",
      "The source hostname resolved to a private or reserved destination.",
      { status: SOURCE_FETCH_STATUSES.BLOCKED },
    );
  }
  return Object.freeze(answers);
}

function pinnedLookup(answer) {
  return (_hostname, _options, callback) => {
    callback(null, answer.address, answer.family);
  };
}

function headerValue(headers, name) {
  if (!headers) return "";
  if (typeof headers.get === "function") return String(headers.get(name) || "");
  const value = headers[String(name).toLowerCase()];
  return Array.isArray(value) ? value.join(", ") : String(value || "");
}

function boundedRawBody(stream, maxBytes, signal) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let total = 0;
    let settled = false;

    const fail = (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const finish = () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks, total));
    };
    const cancel = () => {
      stream.destroy();
      fail(new RemoteSourceFetchError("source_fetch_cancelled", "Remote source fetch was cancelled.", {
        status: SOURCE_FETCH_STATUSES.CANCELLED,
      }));
    };

    if (signal?.aborted) return cancel();
    signal?.addEventListener?.("abort", cancel, { once: true });

    stream.on("data", (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      total += buffer.length;
      if (total > maxBytes) {
        stream.destroy();
        fail(new RemoteSourceFetchError("compressed_size_exceeded", "Remote source response exceeded the encoded byte limit.", {
          status: SOURCE_FETCH_STATUSES.OVERSIZED,
        }));
        return;
      }
      chunks.push(buffer);
    });
    stream.on("end", finish);
    stream.on("error", (error) => {
      if (error instanceof RemoteSourceFetchError) fail(error);
      else fail(new RemoteSourceFetchError("source_stream_failed", "Remote source response could not be read."));
    });
  });
}

function decodeBody(raw, contentEncoding, maxOutputLength) {
  const encoding = String(contentEncoding || "").trim().toLowerCase();
  try {
    if (!encoding || encoding === "identity") return raw;
    if (encoding === "gzip" || encoding === "x-gzip") return gunzipSync(raw, { maxOutputLength });
    if (encoding === "deflate") return inflateSync(raw, { maxOutputLength });
    if (encoding === "br") return brotliDecompressSync(raw, { maxOutputLength });
  } catch {
    throw new RemoteSourceFetchError("decompressed_size_exceeded", "Remote source content exceeded the decoded byte limit or used invalid compression.", {
      status: SOURCE_FETCH_STATUSES.OVERSIZED,
    });
  }
  throw new RemoteSourceFetchError("unsupported_content_encoding", "Remote source used an unsupported content encoding.", {
    status: SOURCE_FETCH_STATUSES.UNSUPPORTED,
  });
}

function charsetFromContentType(contentType) {
  const match = String(contentType || "").match(/charset\s*=\s*["']?([^;"'\s]+)/i);
  return String(match?.[1] || "utf-8").trim().toLowerCase();
}

function decodeText(buffer, contentType) {
  const charset = charsetFromContentType(contentType);
  if (!["utf-8", "utf8", "us-ascii", "ascii"].includes(charset)) {
    throw new RemoteSourceFetchError("unsupported_charset", "Remote source uses an unsupported text encoding.", {
      status: SOURCE_FETCH_STATUSES.UNSUPPORTED,
    });
  }
  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    throw new RemoteSourceFetchError("malformed_text_encoding", "Remote source text encoding is malformed.", {
      status: SOURCE_FETCH_STATUSES.UNSUPPORTED,
    });
  }
}

function looksBinary(text, buffer) {
  if (buffer.includes(0)) return true;
  if (!text) return false;
  let controls = 0;
  const sample = text.slice(0, 4096);
  for (const char of sample) {
    const code = char.charCodeAt(0);
    if (code < 9 || (code > 13 && code < 32)) controls += 1;
  }
  return sample.length > 0 && controls / sample.length > 0.03;
}

function cleanText(value) {
  return decodeHtmlEntities(String(value || "").replace(/\s+/g, " ").trim());
}

function decodeHtmlEntities(value) {
  return String(value || "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

function extractText(text, mime, maxChars) {
  if (mime === "text/plain") {
    return {
      title: "",
      description: "",
      text: text.slice(0, maxChars),
      truncated: text.length > maxChars,
    };
  }
  const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const descMatch = text.match(/<meta\s+name=["']description["']\s+content=["']([\s\S]*?)["']/i)
    || text.match(/<meta\s+content=["']([\s\S]*?)["']\s+name=["']description["']/i);
  const bodyMatch = text.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  let body = bodyMatch?.[1] || text;
  body = body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<!--([\s\S]*?)-->/g, "")
    .replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi, "\n");
  const plain = decodeHtmlEntities(body.replace(/<[^>]*>/g, " "))
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .join("\n");
  return {
    title: cleanText(titleMatch?.[1] || ""),
    description: cleanText(descMatch?.[1] || ""),
    text: plain.slice(0, maxChars),
    truncated: plain.length > maxChars,
  };
}

function mimeFromContentType(contentType) {
  return String(contentType || "").split(";")[0].trim().toLowerCase();
}

function safeIssue(error) {
  if (error instanceof RemoteSourceFetchError) {
    return Object.freeze({ code: error.code, message: error.message });
  }
  return Object.freeze({ code: "remote_source_failed", message: "Remote source fetch failed safely." });
}

function failureResult({
  input,
  error,
  startedAt,
  endedAt,
  redirectCount = 0,
}) {
  return Object.freeze({
    schemaVersion: SOURCE_FETCH_RESULT_VERSION,
    status: error?.fetchStatus || SOURCE_FETCH_STATUSES.FAILED,
    canonicalUrl: safeCanonicalUrl(input),
    finalCanonicalUrl: null,
    httpStatus: null,
    mimeType: null,
    encodedBytes: 0,
    decodedBytes: 0,
    extractedChars: 0,
    extractionStatus: "not_available",
    evidenceUsable: false,
    title: "",
    description: "",
    text: "",
    contentHash: null,
    issueCodes: Object.freeze([safeIssue(error).code]),
    issues: Object.freeze([safeIssue(error)]),
    redirectCount,
    timing: Object.freeze({ durationMs: Math.max(0, endedAt - startedAt) }),
  });
}

export function sourceArtifactFromFetchResult(result, {
  workspaceId,
  projectId = null,
  campaignId = null,
  now = new Date().toISOString(),
} = {}) {
  if (!result || result.status !== SOURCE_FETCH_STATUSES.USABLE_EVIDENCE || result.evidenceUsable !== true) {
    return null;
  }
  return normalizeSourceArtifact({
    workspaceId,
    projectId,
    campaignId,
    sourceKind: SOURCE_KINDS.LINK,
    ingestionMethod: INGESTION_METHODS.REMOTE_FETCH,
    sourceReference: {
      canonicalUrl: result.finalCanonicalUrl || result.canonicalUrl,
      title: result.title,
      safetyVerification: "verified",
    },
    originalName: result.title || result.finalCanonicalUrl || result.canonicalUrl || "Remote source",
    mimeType: result.mimeType,
    byteSize: result.decodedBytes,
    contentHash: result.contentHash,
    extraction: {
      state: PROCESSING_STATES.COMPLETE,
      textHash: result.contentHash,
      charCount: result.extractedChars,
      truncated: result.extractionStatus === "truncated",
      processor: { name: "signalflow_remote_text", version: "1" },
      issueCodes: result.issueCodes,
    },
    usability: {
      state: SOURCE_USABILITY_STATES.USABLE_EVIDENCE,
      evidenceState: EVIDENCE_STATES.VERIFIED,
      issueCodes: result.issueCodes,
    },
    privacy: {
      classification: "public",
      containsPersonalData: false,
      exportAllowed: true,
      processingAllowed: true,
    },
    provenance: [{
      eventType: "ingested",
      method: INGESTION_METHODS.REMOTE_FETCH,
      actorType: "system",
      occurredAt: now,
    }],
    createdAt: now,
    updatedAt: now,
  }, { workspaceId, projectId, campaignId, now });
}

export function createPinnedNodeTransport({
  httpModule = http,
  httpsModule = https,
} = {}) {
  return Object.freeze({
    async request({ url, resolvedAddress, timeoutMs, maxCompressedBytes, signal }) {
      const client = url.protocol === "https:" ? httpsModule : httpModule;
      return new Promise((resolve, reject) => {
        let settled = false;
        const options = {
          protocol: url.protocol,
          hostname: url.hostname,
          port: url.port || undefined,
          path: `${url.pathname || "/"}${url.search || ""}`,
          method: "GET",
          lookup: pinnedLookup(resolvedAddress),
          headers: {
            "User-Agent": "SignalFlowStudio/1.0",
            Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,text/plain;q=0.8",
            "Accept-Encoding": "gzip, deflate, br, identity",
            Connection: "close",
          },
        };
        const req = client.request(options, async (response) => {
          try {
            const declaredLength = Number(response.headers?.["content-length"] || 0);
            if (Number.isFinite(declaredLength) && declaredLength > maxCompressedBytes) {
              response.destroy();
              throw new RemoteSourceFetchError("compressed_size_exceeded", "Remote source response exceeded the encoded byte limit.", {
                status: SOURCE_FETCH_STATUSES.OVERSIZED,
              });
            }
            const body = await boundedRawBody(response, maxCompressedBytes, signal);
            if (settled) return;
            settled = true;
            resolve({
              statusCode: Number(response.statusCode || 0),
              headers: response.headers,
              body,
            });
          } catch (error) {
            if (settled) return;
            settled = true;
            reject(error);
          }
        });

        req.setTimeout(timeoutMs, () => {
          req.destroy();
          if (settled) return;
          settled = true;
          reject(new RemoteSourceFetchError("source_fetch_timeout", "Remote source fetch timed out.", {
            status: SOURCE_FETCH_STATUSES.TIMED_OUT,
          }));
        });
        req.on("error", (error) => {
          if (settled) return;
          settled = true;
          if (signal?.aborted) {
            reject(new RemoteSourceFetchError("source_fetch_cancelled", "Remote source fetch was cancelled.", {
              status: SOURCE_FETCH_STATUSES.CANCELLED,
            }));
          } else if (error instanceof RemoteSourceFetchError) {
            reject(error);
          } else {
            reject(new RemoteSourceFetchError("source_connection_failed", "Remote source connection failed."));
          }
        });
        if (signal) {
          const abort = () => req.destroy(new Error("aborted"));
          if (signal.aborted) abort();
          else signal.addEventListener("abort", abort, { once: true });
        }
        req.end();
      });
    },
  });
}

export function createRemoteSourceFetcher({
  resolveHost = async (hostname) => dns.lookup(hostname, { all: true, verbatim: true }),
  transport = createPinnedNodeTransport(),
  clock = { now: () => new Date() },
  limits = SOURCE_FETCH_LIMITS,
} = {}) {
  const appliedLimits = Object.freeze({ ...SOURCE_FETCH_LIMITS, ...(limits || {}) });

  async function fetchSource(input, { signal = null } = {}) {
    const startedAt = nowMs(clock);
    let currentInput = input;
    let redirectCount = 0;
    const visited = new Set();

    try {
      for (;;) {
        if (signal?.aborted) {
          throw new RemoteSourceFetchError("source_fetch_cancelled", "Remote source fetch was cancelled.", {
            status: SOURCE_FETCH_STATUSES.CANCELLED,
          });
        }
        const url = assertPortableRequestUrl(currentInput);
        const visitKey = url.toString();
        if (visited.has(visitKey)) {
          throw new RemoteSourceFetchError("redirect_loop", "Remote source redirect loop was blocked.", {
            status: SOURCE_FETCH_STATUSES.BLOCKED,
          });
        }
        visited.add(visitKey);

        const answers = await vettedResolution(url, resolveHost);
        const selectedAddress = answers[0];
        const response = await transport.request({
          url,
          resolvedAddress: selectedAddress,
          timeoutMs: appliedLimits.timeoutMs,
          maxCompressedBytes: appliedLimits.maxCompressedBytes,
          signal,
        });
        if (!Buffer.isBuffer(response?.body)) {
          throw new RemoteSourceFetchError("source_transport_invalid", "Remote source transport returned an invalid body.");
        }
        if (response.body.length > appliedLimits.maxCompressedBytes) {
          throw new RemoteSourceFetchError("compressed_size_exceeded", "Remote source response exceeded the encoded byte limit.", {
            status: SOURCE_FETCH_STATUSES.OVERSIZED,
          });
        }

        if (REDIRECT_CODES.has(response.statusCode)) {
          const location = headerValue(response.headers, "location");
          if (!location) {
            throw new RemoteSourceFetchError("redirect_missing_location", "Remote source redirect did not include a destination.");
          }
          if (redirectCount >= appliedLimits.maxRedirects) {
            throw new RemoteSourceFetchError("redirect_limit_exceeded", "Remote source exceeded the redirect limit.", {
              status: SOURCE_FETCH_STATUSES.BLOCKED,
            });
          }
          redirectCount += 1;
          currentInput = new URL(location, url);
          continue;
        }

        const contentType = headerValue(response.headers, "content-type");
        const mimeType = mimeFromContentType(contentType);
        const contentDisposition = headerValue(response.headers, "content-disposition").toLowerCase();
        if (contentDisposition.includes("attachment")) {
          throw new RemoteSourceFetchError("download_response_blocked", "Download responses are not usable as remote text evidence.", {
            status: SOURCE_FETCH_STATUSES.UNSUPPORTED,
          });
        }
        if (!ALLOWED_MIME.has(mimeType)) {
          throw new RemoteSourceFetchError("unsupported_mime_type", "Remote source returned an unsupported content type.", {
            status: SOURCE_FETCH_STATUSES.UNSUPPORTED,
          });
        }

        const decoded = decodeBody(
          response.body,
          headerValue(response.headers, "content-encoding"),
          appliedLimits.maxDecompressedBytes,
        );
        if (decoded.length > appliedLimits.maxDecompressedBytes) {
          throw new RemoteSourceFetchError("decompressed_size_exceeded", "Remote source content exceeded the decoded byte limit.", {
            status: SOURCE_FETCH_STATUSES.OVERSIZED,
          });
        }
        const text = decodeText(decoded, contentType);
        if (looksBinary(text, decoded)) {
          throw new RemoteSourceFetchError("mime_content_mismatch", "Remote source content does not match its declared text type.", {
            status: SOURCE_FETCH_STATUSES.UNSUPPORTED,
          });
        }
        const extracted = extractText(text, mimeType, appliedLimits.maxExtractedChars);
        const usable = Boolean(extracted.text.trim()) && response.statusCode >= 200 && response.statusCode < 300;
        const finalUrl = assertPortableRequestUrl(currentInput);
        const endedAt = nowMs(clock);
        const issues = [];
        if (!usable) issues.push(Object.freeze({
          code: response.statusCode >= 200 && response.statusCode < 300 ? "empty_extraction" : "http_status_not_usable",
          message: response.statusCode >= 200 && response.statusCode < 300
            ? "Remote source did not contain extractable text."
            : "Remote source returned a non-success HTTP status.",
        }));
        if (extracted.truncated) issues.push(Object.freeze({
          code: "extraction_truncated",
          message: "Remote source text was truncated to the extraction budget.",
        }));

        return Object.freeze({
          schemaVersion: SOURCE_FETCH_RESULT_VERSION,
          status: usable ? SOURCE_FETCH_STATUSES.USABLE_EVIDENCE : SOURCE_FETCH_STATUSES.REFERENCE_ONLY,
          canonicalUrl: safeCanonicalUrl(input),
          finalCanonicalUrl: safeCanonicalUrl(finalUrl),
          httpStatus: response.statusCode,
          mimeType,
          encodedBytes: response.body.length,
          decodedBytes: decoded.length,
          extractedChars: extracted.text.length,
          extractionStatus: usable ? (extracted.truncated ? "truncated" : "complete") : "reference_only",
          evidenceUsable: usable,
          title: extracted.title,
          description: extracted.description,
          text: extracted.text,
          contentHash: usable ? createHash("sha256").update(decoded).digest("hex") : null,
          issueCodes: Object.freeze(issues.map((item) => item.code)),
          issues: Object.freeze(issues),
          redirectCount,
          timing: Object.freeze({ durationMs: Math.max(0, endedAt - startedAt) }),
        });
      }
    } catch (error) {
      return failureResult({
        input,
        error,
        startedAt,
        endedAt: nowMs(clock),
        redirectCount,
      });
    }
  }

  return Object.freeze({ fetchSource });
}

export {
  assertPortableRequestUrl,
  safeCanonicalUrl,
  vettedResolution,
};
