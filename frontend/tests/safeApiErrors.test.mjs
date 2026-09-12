import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { internalErrorResponse } from "../lib/server/safeApiErrors.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

const protectedRoutes = [
  "app/api/post/prepare/route.js",
  "app/api/context/links/route.js",
  "app/api/context/github/route.js",
  "app/api/social/status/route.js",
  "app/api/social/disconnect/route.js",
  "app/api/publish/route.js",
];

test("owner API catch paths do not serialize raw exception messages", () => {
  for (const relative of protectedRoutes) {
    const source = read(relative);
    assert.doesNotMatch(source, /err\.message|error\.message/);
    assert.match(source, /internalErrorResponse/);
  }
});

test("bounded API errors never echo exception messages or unsafe codes", async () => {
  const originalError = console.error;
  const logs = [];
  console.error = (...args) => logs.push(args);
  try {
    const secret = "provider-body-with-secret-token";
    const error = new Error(secret);
    error.code = "BAD CODE containing secret-token";
    error.status = 502;
    const response = internalErrorResponse("test.route", error, { message: "Safe public message." });
    const body = await response.json();

    assert.equal(response.status, 500);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(body, { error: "Safe public message." });
    assert.equal(JSON.stringify(body).includes(secret), false);
    assert.equal(JSON.stringify(logs).includes(secret), false);
    assert.equal(JSON.stringify(logs).includes("BAD CODE"), false);
    assert.match(JSON.stringify(logs), /internal_error/);
  } finally {
    console.error = originalError;
  }
});
