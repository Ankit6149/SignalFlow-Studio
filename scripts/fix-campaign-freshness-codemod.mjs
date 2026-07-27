import { readFileSync, writeFileSync } from "node:fs";

const path = "scripts/apply-campaign-freshness.mjs";
const source = readFileSync(path, "utf8");
const invalid = 'sourceChangeLabels.join(\\", ")';
const corrected = 'sourceChangeLabels.join(\\", \\")';

if (!source.includes(invalid)) {
  throw new Error("The expected campaign freshness codemod escape sequence was not found.");
}

writeFileSync(path, source.replace(invalid, corrected));
