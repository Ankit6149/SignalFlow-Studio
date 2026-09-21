function normalizeWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/https?:\/\/\S+/g, " ")
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((word) => word.length >= 3);
}

function draftText(draft) {
  if (typeof draft === "string") return draft;
  if (Array.isArray(draft)) return draft.join(" ");
  if (!draft || typeof draft !== "object") return "";
  return Object.values(draft)
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value) => ["string", "number"].includes(typeof value))
    .join(" ");
}

function ngrams(words, size = 4) {
  const values = new Set();
  for (let index = 0; index <= words.length - size; index += 1) {
    values.add(words.slice(index, index + size).join(" "));
  }
  return values;
}

function pairReport(leftChannel, leftDraft, rightChannel, rightDraft) {
  const left = ngrams(normalizeWords(draftText(leftDraft)));
  const right = ngrams(normalizeWords(draftText(rightDraft)));
  if (!left.size || !right.size) return null;
  const overlap = [...left].filter((value) => right.has(value));
  const denominator = Math.min(left.size, right.size);
  const score = denominator ? overlap.length / denominator : 0;
  const excessive = overlap.length >= 3 && score >= 0.42;
  return Object.freeze({
    leftChannel,
    rightChannel,
    score: Number(score.toFixed(4)),
    overlap: Object.freeze(overlap.slice(0, 5)),
    excessive,
  });
}

export function assessCrossChannelDuplicates(drafts = {}) {
  const entries = Object.entries(drafts).filter(([, draft]) => draftText(draft).trim());
  const reports = [];
  for (let left = 0; left < entries.length; left += 1) {
    for (let right = left + 1; right < entries.length; right += 1) {
      const report = pairReport(entries[left][0], entries[left][1], entries[right][0], entries[right][1]);
      if (report) reports.push(report);
    }
  }
  return Object.freeze(reports);
}

export function duplicateRevisionTargets({ generatedDrafts = {}, comparisonDrafts = {}, requestedChannels = [] } = {}) {
  const requested = new Set(requestedChannels);
  const combined = { ...comparisonDrafts, ...generatedDrafts };
  const reports = assessCrossChannelDuplicates(combined).filter((item) => item.excessive);
  const byChannel = new Map();

  for (const report of reports) {
    let target = requested.has(report.rightChannel) ? report.rightChannel : null;
    if (!target && requested.has(report.leftChannel) && !requested.has(report.rightChannel)) target = report.leftChannel;
    if (!target) continue;
    const other = target === report.leftChannel ? report.rightChannel : report.leftChannel;
    const current = byChannel.get(target);
    if (!current || report.score > current.score) {
      byChannel.set(target, Object.freeze({
        channel: target,
        duplicateWith: other,
        score: report.score,
        overlap: report.overlap,
        issueCode: "cross_channel_duplicate",
        guidance: `Differentiate this destination from ${other}: change the opening, structure, and CTA while preserving shared facts. Avoid repeating: ${report.overlap.slice(0, 2).join(" | ")}`,
      }));
    }
  }

  return Object.freeze(Array.from(byChannel.values()));
}
