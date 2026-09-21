const branch = String(process.env.VERCEL_GIT_COMMIT_REF || "").trim();
const message = String(process.env.VERCEL_GIT_COMMIT_MESSAGE || "").trim();

const productionBranches = new Set(["master", "main"]);
const explicitPreview = /\[vercel-preview\]/i.test(message);

if (productionBranches.has(branch) || explicitPreview) {
  console.log(
    productionBranches.has(branch)
      ? "Vercel build allowed for production branch: " + branch
      : "Vercel build allowed by [vercel-preview] checkpoint marker."
  );
  process.exit(1);
}

console.log(
  "Skipping Vercel Preview build for intermediate commit on " +
    (branch || "unknown branch") +
    ". Add [vercel-preview] to a meaningful checkpoint commit when a Preview is required."
);
process.exit(0);
