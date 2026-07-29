import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const testDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(testDir, "..");

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const absolute = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(absolute) : [absolute];
  });
}

function sourceFiles(directory) {
  return walk(directory).filter((file) => /\.(?:js|mjs)$/.test(file));
}

test("UI and route modules do not import infrastructure adapters directly", () => {
  for (const file of sourceFiles(path.join(frontendRoot, "app"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(
      source,
      /(?:from\s+["'][^"']*lib\/infrastructure|import\(["'][^"']*lib\/infrastructure)/,
      `${path.relative(frontendRoot, file)} reaches infrastructure directly`,
    );
  }
});

test("domain modules stay pure and framework independent", () => {
  for (const file of sourceFiles(path.join(frontendRoot, "lib/domain"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:react|next\/|lib\/infrastructure|lib\/application|app\/)/i);
  }
});

test("application modules do not import React, Next routes, or UI components", () => {
  for (const file of sourceFiles(path.join(frontendRoot, "lib/application"))) {
    const source = fs.readFileSync(file, "utf8");
    assert.doesNotMatch(source, /(?:from\s+["']react|from\s+["']next|app\/|components\/)/i);
  }
});

test("campaign UI delegates library persistence and export projection to the application service", () => {
  const page = fs.readFileSync(path.join(frontendRoot, "app/page.js"), "utf8");
  assert.match(page, /createBrowserCampaignApplication/);
  assert.match(page, /campaignApplication\.saveCampaign/);
  assert.match(page, /campaignApplication\.projectMarkdown/);
  assert.match(page, /campaignApplication\.projectJson/);
  assert.doesNotMatch(page, /localStorage\.setItem\(LIBRARY_KEY/);
  assert.doesNotMatch(page, /JSON\.stringify\(\{ campaign: form\.projectName, channels, posts/);
});
