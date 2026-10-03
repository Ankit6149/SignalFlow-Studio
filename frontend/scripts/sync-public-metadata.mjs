import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendRoot = path.resolve(currentDir, "..");
const repoRoot = path.resolve(frontendRoot, "..");
const publicRoot = path.join(frontendRoot, "public");

const MIRRORS = Object.freeze([
  "robots.txt",
  "llms.txt",
  "llms-full.txt",
  "schema.jsonld",
]);

const write = process.argv.includes("--write");
const check = process.argv.includes("--check") || !write;

const drift = [];

for (const name of MIRRORS) {
  const canonicalPath = path.join(publicRoot, name);
  const mirrorPath = path.join(repoRoot, name);
  const canonical = fs.readFileSync(canonicalPath, "utf8");

  if (write) {
    fs.writeFileSync(mirrorPath, canonical, "utf8");
  }

  if (check) {
    const mirror = fs.existsSync(mirrorPath) ? fs.readFileSync(mirrorPath, "utf8") : null;
    if (mirror !== canonical) drift.push(name);
  }
}

if (drift.length) {
  console.error(`Public metadata mirrors are out of sync: ${drift.join(", ")}`);
  console.error("Run: npm run sync:public-metadata");
  process.exit(1);
}

console.log(
  write
    ? `Synchronized ${MIRRORS.length} public metadata mirrors.`
    : `Verified ${MIRRORS.length} public metadata mirrors.`,
);
