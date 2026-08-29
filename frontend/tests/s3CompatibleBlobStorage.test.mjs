import test from "node:test";
import assert from "node:assert/strict";

import { createS3CompatibleBlobStorage } from "../lib/infrastructure/s3CompatibleBlobStorage.mjs";

const NOW = "2026-08-30T12:34:56.000Z";

function headers(values = {}) {
  const map = new Map(Object.entries(values).map(([key, value]) => [key.toLowerCase(), String(value)]));
  return {
    get(name) {
      return map.get(String(name).toLowerCase()) || null;
    },
  };
}

function fakeResponse(status, { body = new Uint8Array(), headers: responseHeaders = {} } = {}) {
  const payload = body instanceof Uint8Array ? body : new Uint8Array(body);
  return {
    status,
    ok: status >= 200 && status < 300,
    headers: headers(responseHeaders),
    async arrayBuffer() {
      return payload.buffer.slice(payload.byteOffset, payload.byteOffset + payload.byteLength);
    },
  };
}

function fakeS3() {
  const objects = new Map();
  const requests = [];
  async function fetchImpl(urlValue, options = {}) {
    const url = new URL(urlValue);
    const method = String(options.method || "GET").toUpperCase();
    const key = url.pathname;
    const requestHeaders = Object.fromEntries(Object.entries(options.headers || {}).map(([name, value]) => [name.toLowerCase(), String(value)]));
    requests.push({ url: url.toString(), pathname: key, method, headers: requestHeaders, body: options.body || null });

    if (method === "HEAD") {
      const object = objects.get(key);
      if (!object) return fakeResponse(404);
      return fakeResponse(200, {
        headers: {
          "content-length": object.bytes.byteLength,
          "content-type": object.contentType || "application/octet-stream",
          "x-amz-meta-sf-sha256": object.contentHash || "",
          etag: `"etag-${object.bytes.byteLength}"`,
        },
      });
    }

    if (method === "PUT") {
      const bytes = options.body instanceof Uint8Array ? new Uint8Array(options.body) : new Uint8Array(options.body || []);
      objects.set(key, {
        bytes,
        contentType: requestHeaders["content-type"] || null,
        contentHash: requestHeaders["x-amz-meta-sf-sha256"] || null,
      });
      return fakeResponse(200, { headers: { etag: `"etag-${bytes.byteLength}"` } });
    }

    if (method === "GET") {
      const object = objects.get(key);
      if (!object) return fakeResponse(404);
      return fakeResponse(200, {
        body: object.bytes,
        headers: {
          "content-length": object.bytes.byteLength,
          "content-type": object.contentType || "application/octet-stream",
        },
      });
    }

    if (method === "DELETE") {
      objects.delete(key);
      return fakeResponse(204);
    }

    return fakeResponse(405);
  }
  return { fetchImpl, objects, requests };
}

function adapter(fake, overrides = {}) {
  return createS3CompatibleBlobStorage({
    endpoint: overrides.endpoint || "https://storage.example.test",
    bucket: overrides.bucket || "signalflow-private",
    region: overrides.region || "auto",
    accessKeyId: overrides.accessKeyId || "TESTACCESS123",
    secretAccessKey: overrides.secretAccessKey || "super-secret-signing-key",
    sessionToken: overrides.sessionToken || null,
    fetchImpl: overrides.fetchImpl || fake.fetchImpl,
    clock: { now: () => NOW },
  });
}

test("adapter description exposes deployment metadata but never credentials", () => {
  const fake = fakeS3();
  const storage = adapter(fake);
  const description = storage.describe();
  const serialized = JSON.stringify(description);

  assert.deepEqual(description, {
    provider: "s3-compatible",
    bucket: "signalflow-private",
    region: "auto",
    endpointOrigin: "https://storage.example.test",
    access: "private",
  });
  assert.doesNotMatch(serialized, /TESTACCESS123|super-secret-signing-key|authorization/i);
});

test("PUT HEAD GET and DELETE use signed private requests and preserve metadata", async () => {
  const fake = fakeS3();
  const storage = adapter(fake);
  const value = new TextEncoder().encode("private screenshot bytes");
  const objectKey = "workspaces/abc123/assets/sha256/0123456789abcdef";
  const expectedHash = "sha256:1111111111111111111111111111111111111111111111111111111111111111";

  const stored = await storage.put("blob-abc-123", value, {
    objectKey,
    contentType: "image/png",
    contentHash: expectedHash,
  });

  assert.deepEqual(stored, {
    provider: "s3-compatible",
    blobId: "blob-abc-123",
    objectKey,
    region: "auto",
    byteSize: value.byteLength,
    contentType: "image/png",
    contentHash: expectedHash,
  });

  const put = fake.requests.find((request) => request.method === "PUT");
  assert.ok(put);
  assert.equal(put.pathname, `/signalflow-private/${objectKey}`);
  assert.match(put.headers.authorization, /^AWS4-HMAC-SHA256 Credential=TESTACCESS123\/20260830\/auto\/s3\/aws4_request, SignedHeaders=/);
  assert.match(put.headers.authorization, /Signature=[a-f0-9]{64}$/);
  assert.equal(put.headers["x-amz-date"], "20260830T123456Z");
  assert.match(put.headers["x-amz-content-sha256"], /^[a-f0-9]{64}$/);
  assert.equal(put.headers["x-amz-meta-sf-sha256"], expectedHash.replace("sha256:", ""));
  assert.doesNotMatch(put.headers.authorization, /super-secret-signing-key/);

  const metadata = await storage.head("blob-abc-123", { objectKey });
  assert.equal(metadata.byteSize, value.byteLength);
  assert.equal(metadata.contentType, "image/png");
  assert.equal(metadata.contentHash, expectedHash);
  assert.equal(metadata.objectKey, objectKey);

  const restored = await storage.get("blob-abc-123", { objectKey });
  assert.equal(new TextDecoder().decode(restored), "private screenshot bytes");

  assert.equal(await storage.remove("blob-abc-123", { objectKey }), true);
  assert.equal(await storage.get("blob-abc-123", { objectKey }), null);
  assert.equal(await storage.remove("blob-abc-123", { objectKey }), false);
  assert.ok(fake.requests.some((request) => request.method === "DELETE"));
});

test("signatures are deterministic for the same request and signing instant", async () => {
  const leftFake = fakeS3();
  const rightFake = fakeS3();
  const left = adapter(leftFake);
  const right = adapter(rightFake);
  const value = new TextEncoder().encode("same request");
  const options = {
    objectKey: "workspaces/test/assets/sha256/deterministic",
    contentType: "application/octet-stream",
  };

  await left.put("blob-deterministic", value, options);
  await right.put("blob-deterministic", value, options);

  const leftAuthorization = leftFake.requests.find((request) => request.method === "PUT").headers.authorization;
  const rightAuthorization = rightFake.requests.find((request) => request.method === "PUT").headers.authorization;
  assert.equal(leftAuthorization, rightAuthorization);
});

test("presigned GET authorization is HTTPS bounded and does not expose the secret key", async () => {
  const fake = fakeS3();
  const storage = adapter(fake);
  const preview = await storage.createReadUrl("blob-preview", {
    objectKey: "workspaces/test/assets/sha256/preview",
    expiresInSeconds: 10_000,
  });
  const url = new URL(preview.url);

  assert.equal(url.protocol, "https:");
  assert.equal(url.searchParams.get("X-Amz-Algorithm"), "AWS4-HMAC-SHA256");
  assert.equal(url.searchParams.get("X-Amz-Expires"), "900");
  assert.match(url.searchParams.get("X-Amz-Credential"), /^TESTACCESS123\/20260830\/auto\/s3\/aws4_request$/);
  assert.match(url.searchParams.get("X-Amz-Signature"), /^[a-f0-9]{64}$/);
  assert.doesNotMatch(preview.url, /super-secret-signing-key/);
  assert.equal(Date.parse(preview.expiresAt) - Date.parse(NOW), 900_000);
  assert.equal(fake.requests.length, 0, "presigning must not fetch the private object");
});

test("unsafe endpoints blob IDs and traversal keys fail before network access", async () => {
  const fake = fakeS3();
  assert.throws(
    () => createS3CompatibleBlobStorage({
      endpoint: "http://storage.example.test",
      bucket: "signalflow-private",
      accessKeyId: "key",
      secretAccessKey: "secret",
      fetchImpl: fake.fetchImpl,
    }),
    (error) => error.code === "insecure_s3_endpoint",
  );

  const storage = adapter(fake);
  await assert.rejects(
    () => storage.put("bad/blob", new Uint8Array([1]), { objectKey: "safe/key" }),
    (error) => error.code === "unsafe_blob_id",
  );
  await assert.rejects(
    () => storage.put("blob-safe", new Uint8Array([1]), { objectKey: "../private/secret" }),
    (error) => error.code === "unsafe_object_key",
  );
  assert.equal(fake.requests.length, 0);
});

test("request failures expose status and blob identity without credential leakage", async () => {
  const fake = fakeS3();
  const storage = adapter(fake, {
    fetchImpl: async () => fakeResponse(500),
  });

  await assert.rejects(
    async () => {
      try {
        await storage.get("blob-failure", { objectKey: "workspaces/test/assets/failure" });
      } catch (error) {
        const serialized = JSON.stringify({ message: error.message, details: error.details });
        assert.doesNotMatch(serialized, /TESTACCESS123|super-secret-signing-key|Authorization|X-Amz-Signature/i);
        assert.equal(error.details.status, 500);
        assert.equal(error.details.blobId, "blob-failure");
        throw error;
      }
    },
    (error) => error.code === "object_storage_request_failed",
  );
});
