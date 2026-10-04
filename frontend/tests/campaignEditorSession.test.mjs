import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const layoutUrl = new URL("../app/layout.js", import.meta.url);
const pageUrl = new URL("../app/StudioRootController.js", import.meta.url);
const sessionUrl = new URL("../lib/studio/CampaignEditorSessionContext.js", import.meta.url);
const generationUrl = new URL("../lib/studio/useCampaignGenerationController.js", import.meta.url);
const reviewUrl = new URL("../lib/studio/useCampaignReviewController.js", import.meta.url);

test("campaign editor state survives route navigation through a side-effect-free root session", async () => {
  const [layout, page, session] = await Promise.all([
    readFile(layoutUrl, "utf8"),
    readFile(pageUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
  ]);

  assert.match(layout, /<CampaignEditorSessionProvider>/);
  assert.match(page, /useCampaignEditorSession\(\)/);
  assert.doesNotMatch(page, /useReducer\(\s*campaignReducer/);
  assert.doesNotMatch(page, /const \[form, setForm\] = useState/);
  assert.doesNotMatch(page, /const \[channels, setChannels\] = useState/);
  assert.doesNotMatch(page, /const \[files, setFiles\] = useState/);
  assert.doesNotMatch(page, /const \[documentText, setDocumentText\] = useState/);

  assert.match(session, /campaignReducer/);
  assert.match(session, /currentCampaignId/);
  assert.match(session, /publishOptions/);
  assert.match(session, /strategyReview/);
  assert.doesNotMatch(session, /fetch\s*\(/);
  assert.doesNotMatch(session, /localStorage|sessionStorage|indexedDB/);
  assert.doesNotMatch(session, /generateStudioCampaign|publishStudioPost|studioApiClient/);
  assert.doesNotMatch(session, /useEffect|AbortController/);
});

test("route-surviving editor session does not globalize transient UI/process state", async () => {
  const [page, session, generation, review] = await Promise.all([
    readFile(pageUrl, "utf8"),
    readFile(sessionUrl, "utf8"),
    readFile(generationUrl, "utf8"),
    readFile(reviewUrl, "utf8"),
  ]);

  for (const localState of ["busy", "message"]) {
    assert.ok(page.includes(`const [${localState},`), `${localState} must stay local to the Create route`);
    assert.equal(session.includes(localState), false, `${localState} must not move into the route-surviving session`);
  }
  for (const generationState of ["generationProgress", "regenerationDialogOpen"]) {
    assert.ok(generation.includes(`const [${generationState},`), `${generationState} must stay inside Create generation execution`);
    assert.equal(session.includes(generationState), false, `${generationState} must not move into the route-surviving session`);
  }
  assert.ok(review.includes("const [versionHistoryOpen,"), "versionHistoryOpen must stay inside Create review coordination");
  assert.equal(session.includes("versionHistoryOpen"), false, "versionHistoryOpen must not move into the route-surviving session");

  assert.equal(session.includes("library"), false, "browser-library listing state must not move into the route-surviving editor session");
});
