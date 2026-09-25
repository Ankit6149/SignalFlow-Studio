export const GENERATION_LIMITS = Object.freeze({
  requestBytes: 512 * 1024,
  projectNameChars: 240,
  notesChars: 40_000,
  audienceChars: 4_000,
  linksChars: 16_000,
  linksCount: 8,
  documentItems: 12,
  documentChars: 120_000,
  totalTextContextChars: 180_000,
  channels: 12,
  outputTypes: 8,
  sourceRecordsPerKind: 24,
  mediaItems: 24,
});

export function generationLimitIssue({ code, field, message, actual, max }) {
  return Object.freeze({
    code: String(code),
    field: String(field),
    message: String(message),
    actual: Number(actual),
    max: Number(max),
  });
}
