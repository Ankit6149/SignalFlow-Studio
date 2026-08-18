import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");
const read = (relative) => fs.readFileSync(path.join(frontendRoot, relative), "utf8");

test("project context stays a source-neutral domain record rather than a second identity or destination model", () => {
  const domain = read("lib/domain/projectContexts.mjs");
  assert.match(domain, /ProjectContextSnapshot/);
  assert.match(domain, /repositoryRef/);
  assert.match(domain, /sourceArtifactIds/);
  assert.match(domain, /safeClaims/);
  assert.match(domain, /uncertainties/);
  assert.doesNotMatch(domain, /linkedin|instagram|tiktok|youtube|twitter/i);
  assert.doesNotMatch(domain, /VoiceProfile|IdentityProfile|PlatformVariant/);
});

test("project context application owns persistence and inference while UI routes remain absent from the core slice", () => {
  const application = read("lib/application/projectContextApplication.mjs");
  assert.match(application, /projectContextRepository/);
  assert.match(application, /synthesizeAndBootstrapProjectContext/);
  assert.match(application, /resolveLatestForSignal/);
  assert.match(application, /PROJECT_CONTEXT_SYNTHESIS/);
  assert.doesNotMatch(application, /React|next\/|localStorage|\/api\/intelligence/);
});

test("project context does not create approval publication or campaign state", () => {
  for (const relative of [
    "lib/domain/projectContexts.mjs",
    "lib/application/projectContextApplication.mjs",
    "lib/infrastructure/projectContextAdapters.mjs",
  ]) {
    const source = read(relative);
    assert.doesNotMatch(source, /createCampaign|PublicationRequest|publishCampaign|approveRevision|PlatformVariantApproval/);
  }
});
