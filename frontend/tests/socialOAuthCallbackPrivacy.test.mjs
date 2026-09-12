import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const route = fs.readFileSync(
  path.join(here, "../app/api/social/callback/[platform]/route.js"),
  "utf8",
);

test("social OAuth callback never reflects provider bodies or profile identity into redirect URLs", () => {
  assert.doesNotMatch(route, /error_description/);
  assert.doesNotMatch(route, /errorText|err\.message/);
  assert.doesNotMatch(route, /Connected to \$\{platform\.label\} as/);
  assert.match(route, /Connected to \$\{platform\.label\}\./);
  assert.match(route, /GENERIC_CONNECTION_ERROR/);
});

test("social OAuth callback logs bounded metadata and marks redirects private", () => {
  assert.match(route, /social_token_exchange_failed/);
  assert.match(route, /code: String\(error\?\.code/);
  assert.match(route, /status: Number\.isInteger\(error\?\.status\)/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.match(route, /"Referrer-Policy": "no-referrer"/);
  assert.doesNotMatch(route, /console\.error\([^\n]*err\.message/);
});
