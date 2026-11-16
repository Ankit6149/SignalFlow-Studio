import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";

import {
  createRemoteSourceFetcher,
  SOURCE_FETCH_STATUSES,
  sourceArtifactFromFetchResult,
} from "../lib/context/remoteSourceFetcher.mjs";

const PUBLIC = Object.freeze([{ address: "93.184.216.34", family: 4 }]);
const NOW = "2026-11-17T00:00:00.000Z";

function headers(input = {}) {
  return Object.fromEntries(Object.entries(input).map(([key, value]) => [key.toLowerCase(), value]));
}

function response({
  statusCode = 200,
  body = "<html><head><title>Docs</title></head><body>Useful public evidence.</body></html>",
  contentType = "text/html; charset=utf-8",
  extraHeaders = {},
} = {}) {
  return {
    statusCode,
    headers: headers({ "content-type": contentType, ...extraHeaders }),
    body: Buffer.isBuffer(body) ? body : Buffer.from(body, "utf8"),
  };
}

function fixture({
  resolveHost = async () => PUBLIC,
  handler = async () => response(),
  limits = {},
} = {}) {
  const calls = [];
  const transport = {
    async request(input) {
      calls.push(input);
      return handler(input, calls.length);
    },
  };
  const fetcher = createRemoteSourceFetcher({
    resolveHost,
    transport,
    clock: { now: () => new Date(NOW) },
    limits,
  });
  return { fetcher, calls };
}

test("public HTML becomes verified usable evidence through one pinned DNS answer", async () => {
  let resolverCalls = 0;
  const { fetcher, calls } = fixture({
    resolveHost: async () => {
      resolverCalls += 1;
      return PUBLIC;
    },
  });
  const result = await fetcher.fetchSource("https://example.com/docs?lang=en#section");
  assert.equal(result.status, SOURCE_FETCH_STATUSES.USABLE_EVIDENCE);
  assert.equal(result.evidenceUsable, true);
  assert.equal(result.finalCanonicalUrl, "https://example.com/docs?lang=en");
  assert.equal(result.title, "Docs");
  assert.match(result.text, /Useful public evidence/);
  assert.equal(result.mimeType, "text/html");
  assert.equal(resolverCalls, 1);
  assert.deepEqual(calls[0].resolvedAddress, PUBLIC[0]);
  assert.equal(calls[0].url.hostname, "example.com");
  assert.ok(result.contentHash);
});

test("verified public fetch projects into canonical usable SourceArtifact", async () => {
  const { fetcher } = fixture();
  const result = await fetcher.fetchSource("https://example.com/docs");
  const artifact = sourceArtifactFromFetchResult(result, {
    workspaceId: "workspace-remote",
    projectId: "project-remote",
    now: NOW,
  });
  assert.ok(artifact);
  assert.equal(artifact.kind, "SourceArtifact");
  assert.equal(artifact.workspaceId, "workspace-remote");
  assert.equal(artifact.sourceKind, "link");
  assert.equal(artifact.ingestionMethod, "remote_fetch");
  assert.equal(artifact.sourceReference.safetyVerification, "verified");
  assert.equal(artifact.sourceReference.canonicalUrl, "https://example.com/docs");
  assert.equal(artifact.usability.state, "usable_evidence");
  assert.equal(artifact.usability.evidenceState, "verified");
  assert.equal(artifact.contentHash, `sha256:${result.contentHash}`);
});

test("blocked and reference-only results cannot become usable SourceArtifacts", async () => {
  const direct = fixture();
  const blocked = await direct.fetcher.fetchSource("http://127.0.0.1/private");
  assert.equal(blocked.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(blocked.evidenceUsable, false);
  assert.equal(sourceArtifactFromFetchResult(blocked, { workspaceId: "workspace-a", now: NOW }), null);

  const notFound = fixture({ handler: async () => response({ statusCode: 404, body: "Not found", contentType: "text/plain" }) });
  const reference = await notFound.fetcher.fetchSource("https://example.com/missing");
  assert.equal(reference.status, SOURCE_FETCH_STATUSES.REFERENCE_ONLY);
  assert.equal(reference.evidenceUsable, false);
  assert.equal(sourceArtifactFromFetchResult(reference, { workspaceId: "workspace-a", now: NOW }), null);
});

test("private, reserved, internal, and unsafe DNS destinations fail before transport", async () => {
  for (const url of [
    "http://127.0.0.1/admin",
    "http://169.254.169.254/latest/meta-data",
    "http://[::1]/",
    "http://[::ffff:7f00:1]/",
    "https://localhost/",
    "https://service.internal/",
  ]) {
    const { fetcher, calls } = fixture();
    const result = await fetcher.fetchSource(url);
    assert.equal(result.status, SOURCE_FETCH_STATUSES.BLOCKED, url);
    assert.equal(calls.length, 0, url);
  }

  const { fetcher, calls } = fixture({
    resolveHost: async () => [{ address: "10.0.0.9", family: 4 }],
  });
  const result = await fetcher.fetchSource("https://example.com/private-rebind");
  assert.equal(result.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(result.issueCodes[0], "unsafe_dns_answer");
  assert.equal(calls.length, 0);
});

test("DNS rebinding cannot replace the vetted address used by the actual request", async () => {
  let resolutions = 0;
  const { fetcher, calls } = fixture({
    resolveHost: async () => {
      resolutions += 1;
      return resolutions === 1
        ? [{ address: "93.184.216.34", family: 4 }]
        : [{ address: "127.0.0.1", family: 4 }];
    },
    handler: async ({ resolvedAddress }) => {
      assert.equal(resolvedAddress.address, "93.184.216.34");
      return response();
    },
  });
  const result = await fetcher.fetchSource("https://example.com/rebind");
  assert.equal(result.status, SOURCE_FETCH_STATUSES.USABLE_EVIDENCE);
  assert.equal(resolutions, 1, "the HTTP transport must use the already-vetted resolution");
  assert.equal(calls.length, 1);
});

test("every redirect hop is revalidated and unsafe redirects never receive a request", async () => {
  const { fetcher, calls } = fixture({
    handler: async ({ url }) => {
      assert.equal(url.hostname, "example.com");
      return response({
        statusCode: 302,
        body: "",
        extraHeaders: { location: "http://127.0.0.1/admin" },
      });
    },
  });
  const result = await fetcher.fetchSource("https://example.com/start");
  assert.equal(result.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(result.issueCodes[0], "private_address_blocked");
  assert.equal(calls.length, 1);
});

test("redirect loops and redirect budget exhaustion fail closed", async () => {
  const loop = fixture({
    handler: async () => response({
      statusCode: 302,
      body: "",
      extraHeaders: { location: "/same" },
    }),
  });
  const loopResult = await loop.fetcher.fetchSource("https://example.com/same");
  assert.equal(loopResult.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(loopResult.issueCodes[0], "redirect_loop");

  const budget = fixture({
    handler: async ({ url }, count) => response({
      statusCode: 302,
      body: "",
      extraHeaders: { location: `https://example.com/hop-${count + 1}` },
    }),
    limits: { maxRedirects: 2 },
  });
  const budgetResult = await budget.fetcher.fetchSource("https://example.com/hop-0");
  assert.equal(budgetResult.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(budgetResult.issueCodes[0], "redirect_limit_exceeded");
  assert.equal(budget.calls.length, 3);
});

test("signed credentials and non-standard ports are rejected without leaking secrets", async () => {
  const { fetcher, calls } = fixture();
  const signed = await fetcher.fetchSource("https://example.com/file?lang=en&X-Amz-Signature=super-secret&token=abc");
  assert.equal(signed.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(signed.issueCodes[0], "credential_query_forbidden");
  assert.equal(calls.length, 0);
  assert.equal(signed.canonicalUrl, "https://example.com/file?lang=en");
  assert.doesNotMatch(JSON.stringify(signed), /super-secret|token=abc/i);

  const port = await fetcher.fetchSource("https://example.com:8443/docs");
  assert.equal(port.status, SOURCE_FETCH_STATUSES.BLOCKED);
  assert.equal(port.issueCodes[0], "nonstandard_port_blocked");
});

test("encoded and decoded byte budgets fail closed", async () => {
  const encoded = fixture({
    handler: async () => response({ body: Buffer.alloc(101, 65), contentType: "text/plain" }),
    limits: { maxCompressedBytes: 100 },
  });
  const encodedResult = await encoded.fetcher.fetchSource("https://example.com/big");
  assert.equal(encodedResult.status, SOURCE_FETCH_STATUSES.OVERSIZED);
  assert.equal(encodedResult.issueCodes[0], "compressed_size_exceeded");

  const compressed = gzipSync(Buffer.from("x".repeat(5000)));
  const decoded = fixture({
    handler: async () => response({
      body: compressed,
      contentType: "text/plain",
      extraHeaders: { "content-encoding": "gzip" },
    }),
    limits: { maxCompressedBytes: compressed.length + 10, maxDecompressedBytes: 1000 },
  });
  const decodedResult = await decoded.fetcher.fetchSource("https://example.com/compressed");
  assert.equal(decodedResult.status, SOURCE_FETCH_STATUSES.OVERSIZED);
  assert.equal(decodedResult.issueCodes[0], "decompressed_size_exceeded");
});

test("DNS and transfer deadlines are enforced even when injected dependencies ignore abort signals", async () => {
  const dnsHang = fixture({
    resolveHost: async () => new Promise(() => {}),
    limits: { timeoutMs: 5 },
  });
  const dnsResult = await dnsHang.fetcher.fetchSource("https://example.com/hang");
  assert.equal(dnsResult.status, SOURCE_FETCH_STATUSES.TIMED_OUT);
  assert.equal(dnsResult.issueCodes[0], "source_fetch_timeout");
  assert.equal(dnsHang.calls.length, 0);

  const transferHang = fixture({
    handler: async () => new Promise(() => {}),
    limits: { timeoutMs: 5 },
  });
  const transferResult = await transferHang.fetcher.fetchSource("https://example.com/hang");
  assert.equal(transferResult.status, SOURCE_FETCH_STATUSES.TIMED_OUT);
  assert.equal(transferResult.issueCodes[0], "source_fetch_timeout");
  assert.equal(transferHang.calls.length, 1);
});

test("MIME, download, binary mismatch, malformed encoding, and unsupported compression are bounded", async () => {
  const cases = [
    {
      handler: async () => response({ contentType: "image/png", body: Buffer.from([1, 2, 3]) }),
      code: "unsupported_mime_type",
    },
    {
      handler: async () => response({ contentType: "text/plain", extraHeaders: { "content-disposition": "attachment; filename=data.txt" } }),
      code: "download_response_blocked",
    },
    {
      handler: async () => response({ contentType: "text/plain", body: Buffer.from([65, 0, 66]) }),
      code: "mime_content_mismatch",
    },
    {
      handler: async () => response({ contentType: "text/plain; charset=utf-8", body: Buffer.from([0xc3, 0x28]) }),
      code: "malformed_text_encoding",
    },
    {
      handler: async () => response({ contentType: "text/plain", extraHeaders: { "content-encoding": "compress" } }),
      code: "unsupported_content_encoding",
    },
  ];
  for (const item of cases) {
    const { fetcher } = fixture({ handler: item.handler });
    const result = await fetcher.fetchSource("https://example.com/test");
    assert.equal(result.evidenceUsable, false, item.code);
    assert.equal(result.issueCodes[0], item.code);
  }
});

test("transport timeout/cancellation failures use safe issue codes without raw network diagnostics", async () => {
  const timeout = fixture({
    handler: async () => {
      const error = new Error("connect ETIMEDOUT 10.0.0.9:443 secret=abc");
      error.code = "ETIMEDOUT";
      throw error;
    },
  });
  const timeoutResult = await timeout.fetcher.fetchSource("https://example.com/docs");
  assert.equal(timeoutResult.status, SOURCE_FETCH_STATUSES.FAILED);
  assert.equal(timeoutResult.issueCodes[0], "remote_source_failed");
  assert.doesNotMatch(JSON.stringify(timeoutResult), /10\.0\.0\.9|secret=abc|ETIMEDOUT/);
});

test("extraction budget truncates usable text explicitly instead of silently", async () => {
  const { fetcher } = fixture({
    handler: async () => response({ body: "a".repeat(200), contentType: "text/plain" }),
    limits: { maxExtractedChars: 50 },
  });
  const result = await fetcher.fetchSource("https://example.com/long");
  assert.equal(result.status, SOURCE_FETCH_STATUSES.USABLE_EVIDENCE);
  assert.equal(result.extractedChars, 50);
  assert.equal(result.extractionStatus, "truncated");
  assert.deepEqual(result.issueCodes, ["extraction_truncated"]);
});
