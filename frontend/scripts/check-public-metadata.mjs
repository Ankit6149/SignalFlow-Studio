import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = path.dirname(fileURLToPath(import.meta.url));
const frontendDir = path.resolve(currentDir, "..");
const repoRoot = path.resolve(frontendDir, "..");

const pairs = [
  ["robots.txt", "public/robots.txt"],
  ["llms.txt", "public/llms.txt"],
  ["llms-full.txt", "public/llms-full.txt"],
  ["schema.jsonld", "public/schema.jsonld"],
];

const failures = [];

for (const [rootRelative, publicRelative] of pairs) {
  const rootPath = path.join(repoRoot, rootRelative);
  const publicPath = path.join(frontendDir, publicRelative);
  const rootContent = fs.readFileSync(rootPath, "utf8");
  const publicContent = fs.readFileSync(publicPath, "utf8");

  if (rootContent !== publicContent) {
    failures.push({ rootRelative, publicRelative });
  }
}

if (failures.length) {
  console.error("Public metadata copies are out of sync:");
  for (const failure of failures) {
    console.error(`- ${failure.rootRelative} != frontend/${failure.publicRelative}`);
  }
  process.exit(1);
}

console.log("Public metadata root/deployed copies are synchronized.");
