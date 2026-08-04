import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("Review downloads the canonical ZIP through a browser-safe binary path", async () => {
  const [page, application, zipExport] = await Promise.all([
    readFile(new URL("../app/page.js", import.meta.url), "utf8"),
    readFile(new URL("../lib/application/campaignApplication.mjs", import.meta.url), "utf8"),
    readFile(new URL("../lib/export/campaignZip.mjs", import.meta.url), "utf8"),
  ]);

  assert.match(page, /function downloadBinary\(filename, value, type/);
  assert.match(page, /new Blob\(\[value\], \{ type \}\)/);
  assert.match(page, /URL\.createObjectURL\(blob\)/);
  assert.match(page, /URL\.revokeObjectURL\(url\)/);
  assert.match(page, /campaignApplication\.projectZip\(currentCampaignInput\(\)\)/);
  assert.match(page, /onClick=\{\(\) => void exportZip\(\)\}/);
  assert.match(page, /failedChannels\.map/);

  assert.match(application, /async function projectZip\(input\)/);
  assert.match(application, /buildCampaignZipExport\(aggregateInput\(input\)\)/);
  assert.match(zipExport, /type: "uint8array"/);
  assert.doesNotMatch(zipExport, /type: "nodebuffer"/);
  assert.doesNotMatch(zipExport, /Buffer\.byteLength/);
});
