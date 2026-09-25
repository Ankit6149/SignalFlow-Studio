import { parseGitHubUrl } from "../context/githubUrl.mjs";
import {
  normalizeDocumentText,
  normalizeTextInput,
} from "./inputNormalization.mjs";
import {
  GENERATION_LIMITS,
  generationLimitIssue,
} from "./generationLimits.mjs";

/**
 * Validates the generation inputs from the client.
 * Returns { valid: boolean, errors: string[] }
 */
export function validateGenerationInputs(body = {}) {
  const errors = [];
  const limitIssues = [];

  const addLimit = (issue) => {
    limitIssues.push(issue);
    errors.push(issue.message);
  };

  const projectName = normalizeTextInput(body?.project_name ?? body?.projectName);
  const notes = normalizeTextInput(body?.notes);
  const audience = normalizeTextInput(body?.audience);
  const repo = normalizeTextInput(body?.repo);
  const documentItems = normalizeDocumentText(body?.document_text);
  const documentText = documentItems.join("\n\n");
  const researchUrl = normalizeTextInput(body?.research_url ?? body?.docs_url);
  const urls = researchUrl ? researchUrl.split(/\s+/).filter(Boolean) : [];
  const channels = Array.isArray(body?.channels) ? body.channels.filter(Boolean) : [];
  const outputTypes = Array.isArray(body?.output_types) ? body.output_types.filter(Boolean) : [];
  const assets = Array.isArray(body?.assets) ? body.assets : [];
  const sourceArtifacts = Array.isArray(body?.source_artifacts ?? body?.sourceArtifacts)
    ? (body.source_artifacts ?? body.sourceArtifacts)
    : [];
  const processingRecords = Array.isArray(body?.processing_records ?? body?.processingRecords)
    ? (body.processing_records ?? body.processingRecords)
    : [];
  const mediaItems = Array.isArray(body?.media_items) ? body.media_items : [];

  const textChecks = [
    ["generation_limit.project_name_chars", "project_name", projectName.length, GENERATION_LIMITS.projectNameChars, "Project name"],
    ["generation_limit.notes_chars", "notes", notes.length, GENERATION_LIMITS.notesChars, "Notes"],
    ["generation_limit.audience_chars", "audience", audience.length, GENERATION_LIMITS.audienceChars, "Audience"],
    ["generation_limit.links_chars", "docs_url", researchUrl.length, GENERATION_LIMITS.linksChars, "Documentation links"],
    ["generation_limit.document_chars", "document_text", documentText.length, GENERATION_LIMITS.documentChars, "Document text"],
  ];
  for (const [code, field, actual, max, label] of textChecks) {
    if (actual > max) {
      addLimit(generationLimitIssue({
        code,
        field,
        actual,
        max,
        message: `${label} exceed the generation limit (${actual.toLocaleString()} / ${max.toLocaleString()} characters). Reduce this input before generating.`,
      }));
    }
  }

  const totalTextContextChars = notes.length + audience.length + researchUrl.length + documentText.length;
  if (totalTextContextChars > GENERATION_LIMITS.totalTextContextChars) {
    addLimit(generationLimitIssue({
      code: "generation_limit.total_text_context_chars",
      field: "context",
      actual: totalTextContextChars,
      max: GENERATION_LIMITS.totalTextContextChars,
      message: `Combined text context exceeds the generation limit (${totalTextContextChars.toLocaleString()} / ${GENERATION_LIMITS.totalTextContextChars.toLocaleString()} characters). Shorten the brief, links, or document text.`,
    }));
  }

  const countChecks = [
    ["generation_limit.links_count", "docs_url", urls.length, GENERATION_LIMITS.linksCount, "documentation links"],
    ["generation_limit.document_items", "document_text", documentItems.length, GENERATION_LIMITS.documentItems, "document items"],
    ["generation_limit.channels", "channels", channels.length, GENERATION_LIMITS.channels, "destination channels"],
    ["generation_limit.output_types", "output_types", outputTypes.length, GENERATION_LIMITS.outputTypes, "output types"],
    ["generation_limit.assets", "assets", assets.length, GENERATION_LIMITS.sourceRecordsPerKind, "assets"],
    ["generation_limit.source_artifacts", "source_artifacts", sourceArtifacts.length, GENERATION_LIMITS.sourceRecordsPerKind, "source artifacts"],
    ["generation_limit.processing_records", "processing_records", processingRecords.length, GENERATION_LIMITS.sourceRecordsPerKind, "processing records"],
    ["generation_limit.media_items", "media_items", mediaItems.length, GENERATION_LIMITS.mediaItems, "media items"],
  ];
  for (const [code, field, actual, max, label] of countChecks) {
    if (actual > max) {
      addLimit(generationLimitIssue({
        code,
        field,
        actual,
        max,
        message: `Use at most ${max} ${label} in one generation request; received ${actual}.`,
      }));
    }
  }

  if (!notes && !repo && !documentText) {
    errors.push("You must provide at least one input context: a Description notes brief, a GitHub repo URL, or pasted document text.");
  }

  if (repo && !parseGitHubUrl(repo)) {
    errors.push("GitHub Repo must identify a public repository such as https://github.com/owner/repo.");
  }

  if (researchUrl) {
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
    limitIssues,
  };
}
