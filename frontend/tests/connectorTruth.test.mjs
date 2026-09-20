import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  createTokenCookie,
  createTokenSession,
  getConnectionStatus,
  normalizeGrantedScopes,
} from "../lib/social/tokenStore.js";
import { SOCIAL_PLATFORMS } from "../lib/social/socialConfig.js";

const previousEncryptionKey = process.env.SOCIAL_ENCRYPTION_KEY;
process.env.SOCIAL_ENCRYPTION_KEY = "connector-truth-test-key";

function requestWithSession(platform, session) {
  const setCookie = createTokenCookie(platform, session);
  const cookie = setCookie.split(";")[0];
  return {
    headers: {
      get(name) {
        return String(name).toLowerCase() === "cookie" ? cookie : "";
      },
    },
  };
}

test.after(() => {
  if (previousEncryptionKey === undefined) delete process.env.SOCIAL_ENCRYPTION_KEY;
  else process.env.SOCIAL_ENCRYPTION_KEY = previousEncryptionKey;
});

test("granted scopes are normalized deterministically", () => {
  assert.deepEqual(
    normalizeGrantedScopes("tweet.write tweet.read users.read tweet.write"),
    ["tweet.read", "tweet.write", "users.read"],
  );
  assert.deepEqual(
    normalizeGrantedScopes(["submit", "identity", "submit"]),
    ["identity", "submit"],
  );
});

test("verified identity plus complete scopes exposes only declared publish capabilities", () => {
  const platform = "x";
  const session = createTokenSession(platform, {
    access_token: "secret-access-token",
    refresh_token: "secret-refresh-token",
    expires_in: 3600,
    scope: SOCIAL_PLATFORMS[platform].scopes.join(" "),
  }, {
    id: "user-123",
    username: "builder",
    name: "Builder",
  });

  const status = getConnectionStatus(requestWithSession(platform, session), platform);

  assert.equal(status.connected, true);
  assert.equal(status.verified, true);
  assert.equal(status.expired, false);
  assert.equal(status.scopeStatus, "verified");
  assert.equal(status.canPublishText, true);
  assert.deepEqual(status.publishCapabilities, ["text", "thread"]);
  assert.equal(status.profile.username, "builder");
  assert.ok(status.connectionId);
  assert.ok(status.verifiedAt);
  assert.ok(status.expiresAt);
  assert.equal("access_token" in status, false);
  assert.equal("refresh_token" in status, false);
});

test("verified identity with missing publishing scope remains connected but cannot publish", () => {
  const platform = "linkedin";
  const session = createTokenSession(platform, {
    access_token: "secret-access-token",
    expires_in: 3600,
    scope: "openid profile",
  }, {
    id: "member-1",
    username: "member",
  });

  const status = getConnectionStatus(requestWithSession(platform, session), platform);

  assert.equal(status.connected, true);
  assert.equal(status.verified, true);
  assert.equal(status.scopeStatus, "insufficient");
  assert.deepEqual(status.missingScopes, ["w_member_social"]);
  assert.equal(status.canPublishText, false);
  assert.deepEqual(status.publishCapabilities, []);
});

test("expired verified session cannot advertise publishing capability", () => {
  const platform = "reddit";
  const session = createTokenSession(platform, {
    access_token: "secret-access-token",
    refresh_token: "secret-refresh-token",
    expires_in: 3600,
    scope: SOCIAL_PLATFORMS[platform].scopes.join(" "),
  }, {
    id: "reddit-user",
    username: "u/reddit-user",
  });
  session.expires_at = Date.now() - 1000;

  const status = getConnectionStatus(requestWithSession(platform, session), platform);

  assert.equal(status.connected, true);
  assert.equal(status.verified, true);
  assert.equal(status.expired, true);
  assert.equal(status.canPublishText, false);
  assert.deepEqual(status.publishCapabilities, []);
});

test("session without verified provider identity is not connected", () => {
  const platform = "x";
  const session = createTokenSession(platform, {
    access_token: "secret-access-token",
    expires_in: 3600,
    scope: SOCIAL_PLATFORMS[platform].scopes.join(" "),
  }, {
    username: "unverified",
  });

  const status = getConnectionStatus(requestWithSession(platform, session), platform);

  assert.equal(status.connected, false);
  assert.equal(status.verified, false);
  assert.equal(status.canPublishText, false);
  assert.deepEqual(status.publishCapabilities, []);
});

test("status, publish boundary, and review UI preserve connector truth", async () => {
  const [statusRoute, publishRoute, page, callbackRoute] = await Promise.all([
    readFile(new URL("../app/api/social/status/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/publish/route.js", import.meta.url), "utf8"),
    readFile(new URL("../app/page.js", import.meta.url), "utf8"),
    readFile(new URL("../app/api/social/callback/[platform]/route.js", import.meta.url), "utf8"),
  ]);

  assert.match(statusRoute, /scopeStatus:\s*connection\.scopeStatus/);
  assert.match(statusRoute, /publishCapabilities:\s*connection\.publishCapabilities/);
  assert.match(statusRoute, /canPublishText:\s*Boolean\(connection\.canPublishText\)/);
  assert.match(statusRoute, /connectionId:\s*connection\.connectionId/);
  assert.match(statusRoute, /verifiedAt:\s*connection\.verifiedAt/);
  assert.match(statusRoute, /expiresAt:\s*connection\.expiresAt/);
  assert.doesNotMatch(statusRoute, /access_token|refresh_token/);
  assert.match(statusRoute, /scopeStatus:\s*"manual_only"/);
  assert.match(statusRoute, /publishCapabilities:\s*\[\]/);
  assert.match(statusRoute, /canPublishText:\s*false/);

  assert.match(page, /currentConnection\?\.verified/);
  assert.match(page, /currentConnection\?\.canPublishText/);
  assert.match(page, /currentConnection\?\.scopeStatus === "verified"/);
  assert.match(page, /Direct capabilities:/);
  assert.match(page, /Connected · limited/);
  assert.match(page, /Verified · text/);
  assert.match(page, /Last verified:/);
  assert.match(page, /Expiry:/);

  assert.match(publishRoute, /!status\.connected \|\| !status\.verified \|\| !tokenSession/);
  assert.match(publishRoute, /if \(status\.expired\)/);
  assert.match(publishRoute, /status\.scopeStatus !== "verified" \|\| !status\.canPublishText/);
  assert.match(publishRoute, /status: "insufficient_scope"/);
  assert.match(publishRoute, /status: "expired"/);

  assert.match(callbackRoute, /throw oauthFailure\("social_identity_verification_failed"/);
  assert.match(callbackRoute, /createTokenSession\(platformId, tokenData, profile\)/);
  assert.doesNotMatch(callbackRoute, /Connected to \$\{platform\.label\} as/);
});
