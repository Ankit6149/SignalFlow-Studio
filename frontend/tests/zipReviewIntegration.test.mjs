import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Review downloads the canonical ZIP through a browser-safe binary path", async () => {
  const [page, persistence, review, application, zipExport, browserDownload] = await Promise.all([
    readFile(new URL("../app/StudioRootController.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/studio/useCampaignPersistenceController.js", import.meta.url), "utf8"),
    readFile(new URL("../components/ReviewStage.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/application/campaignApplication.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/export/campaignZip.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/browser/browserDownload.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(persistence, /downloadBinary\(/);
  assert.match(browserDownload, /export function downloadBinary\(filename, value, type/);
  assert.match(browserDownload, /new Blob\(\[value\], \{ type \}\)/);
  assert.match(browserDownload, /URL\.createObjectURL\(blob\)/);
  assert.match(browserDownload, /URL\.revokeObjectURL\(url\)/);
  assert.match(persistence, /campaignApplication\.projectZip\(currentCampaignInput\(\)\)/);
  assert.match(page, /onExportZip=\{\(\) => void exportZip\(\)\}/);
  assert.match(review, /onClick=\{onExportZip\}/);
  assert.match(persistence, /failedChannels\.map/);

  assert.match(application, /async function projectZip\(input\)/);
  assert.match(application, /buildCampaignZipExport\(aggregateInput\(input\)\)/);
  assert.match(zipExport, /type: "uint8array"/);
  assert.doesNotMatch(zipExport, /type: "nodebuffer"/);
  assert.doesNotMatch(zipExport, /Buffer\.byteLength/);
});
