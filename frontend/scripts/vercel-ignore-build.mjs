import { execFileSync } from "node:child_process";

const branch = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
const message = String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "").trim();
const currentSha = String(process.env.VERCEL_GIT_COMMIT_SHA || "").trim();
const previousSha = String(process.env.VERCEL_GIT_PREVIOUS_SHA || "").trim();

const productionBranch = "master";
const explicitPreview = /\[vercel-preview\]/i.test(message);

function skip(reason) {
  console.log(`Skipping Vercel build: ${reason}`);
  process.exit(0);
}

function build(reason) {
  console.log(`Vercel build allowed: ${reason}`);
  process.exit(1);
}

if (explicitPreview) {
  build("explicit [vercel-preview] checkpoint marker.");
}

if (branch !== productionBranch) {
  skip(`automatic preview builds are disabled for branch ${branch || "unknown"}.`);
}

if (!previousSha || !currentSha || previousSha === currentSha) {
  build("cannot prove the production commit is frontend-equivalent to the previous successful deployment.");
}

try {
  execFileSync(
    "git",
    ["diff", "--quiet", previousSha, currentSha, "--", "."],
    { stdio: "ignore" },
  );
  skip("no frontend project changes since the previous successful deployment.");
} catch (error) {
  if (error?.status === 1) {
    build("frontend project changes detected on master.");
  }

  build("git diff could not safely prove that the frontend is unchanged.");
}
