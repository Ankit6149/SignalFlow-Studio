import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  ownerAccessConfigurationStatus,
  verifyConfiguredOwnerAccessKey,
} from "../lib/server/ownerAccessPolicy.mjs";

const here = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(here, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("public hosted deployments fail closed when the owner access key is missing", () => {
  for (const enabled of ["true", "1", "yes", "on", " TRUE "]) {
    const status = ownerAccessConfigurationStatus({ SIGNALFLOW_PUBLIC_HOSTED: enabled });
    assert.equal(status.publicHosted, true);
    assert.equal(status.configured, false);
    assert.equal(status.locked, true);
  }

  assert.equal(verifyConfiguredOwnerAccessKey("anything", { SIGNALFLOW_PUBLIC_HOSTED: "true" }), false);
});

test("local and self-hosted deployments can intentionally remain unlocked without an owner key", () => {
  const local = ownerAccessConfigurationStatus({});
  assert.deepEqual(local, { publicHosted: false, configured: false, locked: false });

  const selfHosted = ownerAccessConfigurationStatus({ SIGNALFLOW_SELF_HOSTED: "true" });
  assert.deepEqual(selfHosted, { publicHosted: false, configured: false, locked: false });
});

test("configured owner keys are verified exactly through the constant-time policy path", () => {
  const env = {
    SIGNALFLOW_PUBLIC_HOSTED: "true",
    SIGNALFLOW_ACCESS_KEY: "correct-owner-key",
  };
  const status = ownerAccessConfigurationStatus(env);
  assert.deepEqual(status, { publicHosted: true, configured: true, locked: true });
  assert.equal(verifyConfiguredOwnerAccessKey("correct-owner-key", env), true);
  assert.equal(verifyConfiguredOwnerAccessKey("wrong-owner-key", env), false);
  assert.equal(verifyConfiguredOwnerAccessKey("correct-owner-key ", env), false);
});

test("shared owner auth adapter uses fail-closed policy and constant-time key verification", () => {
  const auth = read("app/api/_auth.js");
  assert.match(auth, /ownerAccessConfigurationStatus\(process\.env\)/);
  assert.match(auth, /verifyConfiguredOwnerAccessKey\(value, process\.env\)/);
  assert.match(auth, /configuration\.publicHosted \? ownerAccessUnavailableResponse\(\) : null/);
  assert.match(auth, /code: "owner_access_unconfigured"/);
  assert.match(auth, /verifyOwnerAccessKey\(provided\)/);
  assert.doesNotMatch(auth, /provided\s*===\s*expected/);
});

test("owner session route reports hosted lock misconfiguration instead of authenticating anonymously", () => {
  const session = read("app/api/session/route.js");
  assert.match(session, /getOwnerAccessConfiguration/);
  assert.match(session, /misconfigured: configuration\.publicHosted && !configuration\.configured/);
  assert.match(session, /configuration\.publicHosted/);
  assert.match(session, /code: "owner_access_unconfigured"/);
  assert.match(session, /\}, 503\)/);
  assert.match(session, /verifyOwnerAccessKey\(body\?\.access_key\)/);
  assert.match(session, /local or self-hosted deployment/);
  assert.doesNotMatch(session, /body\?\.access_key\s*===/);
});
