import assert from "node:assert/strict";
import test from "node:test";

import {
  extractClipboardImageFiles,
  selectAcceptedFiles,
} from "../lib/studio/clientReliability.mjs";

function imageFile({ name = "", type = "image/png", size = 128 } = {}) {
  return {
    name,
    type,
    size,
    lastModified: 1,
  };
}

function clipboardItem(file) {
  return {
    kind: "file",
    type: file.type,
    getAsFile: () => file,
  };
}

test("clipboard ingestion keeps only images and assigns deterministic names", () => {
  const now = Date.parse("2026-08-07T00:00:00.000Z");
  const png = imageFile();
  const jpeg = imageFile({ type: "image/jpeg" });
  const text = { name: "notes.txt", type: "text/plain", size: 20 };

  const images = extractClipboardImageFiles({
    items: [clipboardItem(png), clipboardItem(text), clipboardItem(jpeg)],
  }, { now });

  assert.equal(images.length, 2);
  assert.equal(images[0].name, "pasted-image-2026-08-07T00-00-00-000Z-1.png");
  assert.equal(images[1].name, "pasted-image-2026-08-07T00-00-00-000Z-2.jpg");
  assert.equal(images[0].type, "image/png");
  assert.equal(images[1].type, "image/jpeg");
});

test("clipboard ingestion preserves a meaningful provided filename", () => {
  const screenshot = imageFile({ name: "launch-dashboard.webp", type: "image/webp" });
  const [image] = extractClipboardImageFiles({ files: [screenshot] }, { now: 0 });

  assert.equal(image.name, "launch-dashboard.webp");
  assert.equal(image.type, "image/webp");
});

test("clipboard ingestion ignores text-only paste data", () => {
  const images = extractClipboardImageFiles({
    items: [{ kind: "string", type: "text/plain", getAsFile: () => null }],
    files: [],
  });

  assert.deepEqual(images, []);
});

test("pasted images reuse the existing twelve-source limit", () => {
  const picked = Array.from({ length: 4 }, (_, index) => imageFile({ name: `image-${index + 1}.png` }));
  const selection = selectAcceptedFiles(picked, 10);

  assert.equal(selection.accepted.length, 2);
  assert.equal(selection.skippedCount, 2);
  assert.equal(selection.remaining, 2);
});
