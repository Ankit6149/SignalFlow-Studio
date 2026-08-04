import { parseGitHubUrl } from "../context/githubUrl.mjs";
import {
  normalizeDocumentText,
  normalizeTextInput,
} from "./inputNormalization.mjs";

/**
 * Validates the generation inputs from the client.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateGenerationInputs(body = {}) {
  const errors = [];

  const notes = normalizeTextInput(body?.notes);
  const repo = normalizeTextInput(body?.repo);
  const documentText = normalizeDocumentText(body?.document_text).join("\n\n");

  if (!notes && !repo && !documentText) {
    errors.push("You must provide at least one input context: a Description notes brief, a GitHub repo URL, or pasted document text.");
  }

  if (repo && !parseGitHubUrl(repo)) {
    errors.push("GitHub Repo must identify a public repository such as https://github.com/owner/repo.");
  }

  const researchUrl = normalizeTextInput(body?.research_url ?? body?.docs_url);
  if (researchUrl) {
    const urls = researchUrl.split(/\s+/).filter(Boolean);
    urls.forEach((entry) => {
      const candidate = /^https?:\/\//i.test(entry) ? entry : `https://${entry}`;
      try {
        const url = new URL(candidate);
        if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
          throw new TypeError("Unsupported URL");
        }
      } catch {
        errors.push(`Invalid research/docs link URL: "${entry}".`);
      }
    });
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
