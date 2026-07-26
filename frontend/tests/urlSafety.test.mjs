import test from "node:test";
import assert from "node:assert/strict";

import {
  assertSafeRemoteUrl,
  isBlockedHostname,
  isPrivateAddress,
  normalizeHttpUrl,
} from "../lib/context/urlSafety.mjs";

test("URL normalization accepts public web URLs and rejects credentials", () => {
  assert.equal(normalizeHttpUrl("example.com/docs").toString(), "https://example.com/docs");
  assert.throws(() => normalizeHttpUrl("https://user:pass@example.com"), /credentials/i);
});

test("private and reserved network targets are recognized", () => {
  for (const address of ["127.0.0.1", "10.0.0.2", "169.254.169.254", "172.16.0.1", "192.168.1.4", "::1", "fd00::1", "fe80::1"]) {
    assert.equal(isPrivateAddress(address), true, address);
  }
  assert.equal(isPrivateAddress("8.8.8.8"), false);
});

test("internal hostname patterns are blocked", () => {
  assert.equal(isBlockedHostname("localhost"), true);
  assert.equal(isBlockedHostname("service.internal"), true);
  assert.equal(isBlockedHostname("example.com"), false);
});

test("direct private URLs fail before network access", async () => {
  await assert.rejects(
    assertSafeRemoteUrl("http://127.0.0.1/admin", { resolveDns: false, forceHostedSafety: true }),
    /private or reserved/i,
  );
  await assert.rejects(
    assertSafeRemoteUrl("http://example.com:8080", { resolveDns: false, forceHostedSafety: true }),
    /ports/i,
  );
});
