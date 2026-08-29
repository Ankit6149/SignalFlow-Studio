import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const page = read("components/LandingPage.js");
const styles = read("components/LandingPage.module.css");

test("landing exposes durable semantic navigation and current workspace entry points", () => {
  assert.match(page, /<header/);
  assert.match(page, /<nav aria-label="Public navigation">/);
  assert.match(page, /<main id="main-content">/);
  assert.match(page, /<footer>/);
  assert.match(page, /href="\/signals"/);
  assert.match(page, /href="\/today"/);
  assert.match(page, /href="\/plan"/);
});

test("landing states the work-to-judgment product thesis and canonical operating flow", () => {
  assert.match(page, /CONTENT OPERATING SYSTEM/);
  assert.match(page, /You do the work/);
  assert.match(page, /SignalFlow finds what’s worth saying/);
  assert.match(page, /Content should be a consequence of the work/);
  assert.match(page, /NOT A POST GENERATOR/);
  for (const stage of ["Capture", "Shape", "Create", "Review", "Publish"]) {
    assert.ok(page.includes(`\"${stage}\"`), `missing canonical stage ${stage}`);
  }
});

test("landing keeps approval privacy and silence as explicit product boundaries", () => {
  assert.match(page, /Exact revision/);
  assert.match(page, /Changes require approval again/);
  assert.match(page, /Request change/);
  assert.match(page, /Approve/);
  assert.match(page, /privacy should fail closed by design/);
  assert.match(page, /Silence remains a valid outcome/);
  assert.match(page, /Automation everywhere except the judgment/);
});

test("landing describes only the currently demonstrated source narrative and review capabilities", () => {
  assert.match(page, /Manual \+ GitHub signals/);
  assert.match(page, /LinkedIn \+ X narratives/);
  assert.match(page, /source evidence/);
  assert.match(page, /voice applied/);
  assert.match(page, /Evidence-bound review/);
  assert.doesNotMatch(page, /auto[- ]?publish|fully autonomous|publishes without approval/i);
});

test("landing has no external runtime asset dependency", () => {
  assert.doesNotMatch(page, /https?:\/\//);
  assert.match(page, /src="\/icon\.svg"/);
  assert.match(page, /import PlatformIcon from "\.\/PlatformIcon"/);
  assert.match(page, /import BrandMark from "\.\/BrandMark"/);
});

test("landing keeps the approved editorial structure responsive and motion-safe", () => {
  for (const section of ["hero", "statementSection", "flowSection", "systemSection", "controlSection", "finalSection"]) {
    assert.match(page, new RegExp(`styles\\.${section}`));
  }
  assert.match(styles, /@media\(max-width:1120px\)/);
  assert.match(styles, /@media\(max-width:900px\)/);
  assert.match(styles, /@media\(max-width:620px\)/);
  assert.match(styles, /@media\(prefers-reduced-motion:reduce\)/);
}
);

test("landing closes with a direct judgment-oriented SignalFlow entry point", () => {
  assert.match(page, /BUILD FIRST\. CONTENT FOLLOWS\./);
  assert.match(page, /Keep doing the work/);
  assert.match(page, /Open SignalFlow Studio/);
  assert.match(page, /Signal → story → judgment\./);
});
