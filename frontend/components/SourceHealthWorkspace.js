"use client";

import { useMemo, useState } from "react";
import styles from "./SourceHealthWorkspace.module.css";

const FILTERS = [
  ["all", "All"],
  ["usable", "Usable"],
  ["attention", "Needs attention"],
  ["processing", "Processing"],
  ["excluded", "Excluded"],
];

const USABLE = new Set(["usable", "truncated"]);
const PROCESSING = new Set(["needs_verification", "processing"]);
const EXCLUDED = new Set(["reference_only", "unsupported", "blocked", "invalid", "duplicate"]);
const ATTENTION = new Set(["reference_only", "failed", "unsupported", "blocked", "invalid", "truncated", "stale"]);

function titleCase(value) {
  return String(value || "").replace(/_/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function groupFor(entry) {
  const kind = entry?.sourceKind || entry?.kind;
  if (kind === "link") return "Links";
  if (["repository", "repository_file"].includes(kind)) return "Repository";
  if (["screenshot", "recording"].includes(kind)) return "Media";
  if (kind === "trusted_local_repository") return "Trusted local";
  if (kind === "extension_page") return "Extension";
  if (["upload", "document"].includes(kind)) return "Documents & uploads";
  if (kind === "notes") return "Brief";
  if (kind === "imported_archive") return "Imported";
  return "Other sources";
}

function displayName(entry, index) {
  if (entry.displayName) return entry.displayName;
  if (entry.kind === "notes") return "Campaign brief";
  if (entry.kind === "document") return `Extracted document ${Number(entry.index ?? index) + 1}`;
  if (entry.kind === "repository") return "Repository";
  if (entry.kind === "link") return entry.canonicalUrl || "Public link";
  return titleCase(entry.sourceKind || entry.kind || "Source");
}

function matchesFilter(entry, filter) {
  if (filter === "all") return true;
  if (filter === "usable") return USABLE.has(entry.status);
  if (filter === "attention") return ATTENTION.has(entry.status);
  if (filter === "processing") return PROCESSING.has(entry.status);
  if (filter === "excluded") return EXCLUDED.has(entry.status);
  return true;
}

function formatBytes(value) {
  const bytes = Number(value);
  if (!Number.isFinite(bytes) || bytes < 0) return null;
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusExplanation(entry) {
  if (entry.status === "usable") return "Verified usable evidence";
  if (entry.status === "truncated") return "Usable evidence · extraction truncated";
  if (entry.status === "needs_verification") return "Needs server verification";
  if (entry.status === "processing") return "Processing";
  if (entry.status === "reference_only") return "Reference only";
  if (entry.status === "unsupported") return "Unsupported";
  if (entry.status === "blocked") return "Blocked for safety";
  if (entry.status === "invalid") return "Invalid source";
  if (entry.status === "duplicate") return "Duplicate";
  if (entry.status === "stale") return "Stale";
  return "Failed";
}

export default function SourceHealthWorkspace({
  report,
  persistedReport = null,
  isStale = false,
}) {
  const [filter, setFilter] = useState("all");
  const entries = Array.isArray(report?.entries) ? report.entries : [];

  const visibleGroups = useMemo(() => {
    const grouped = new Map();
    entries.forEach((entry, index) => {
      if (!matchesFilter(entry, filter)) return;
      const group = groupFor(entry);
      const items = grouped.get(group) || [];
      items.push({ entry, index });
      grouped.set(group, items);
    });
    return [...grouped.entries()];
  }, [entries, filter]);

  const summary = report?.counts || {};
  const historyAvailable = Boolean(persistedReport && persistedReport !== report);

  return (
    <section className={styles.workspace} aria-labelledby="source-health-title">
      <header className={styles.header}>
        <div>
          <span>SOURCE HEALTH</span>
          <h3 id="source-health-title">What SignalFlow can actually use.</h3>
          <p>{report?.reason || "Add source material to see readiness and diagnostics."}</p>
        </div>
        <div className={styles.readiness} data-status={report?.status || "blocked"}>
          <strong>{titleCase(report?.status || "blocked")}</strong>
          <small>{summary.usable || 0} usable · {(summary.failed || 0) + (summary.blocked || 0) + (summary.unsupported || 0) + (summary.invalid || 0)} attention</small>
        </div>
      </header>

      {isStale && persistedReport && (
        <div className={styles.staleNotice} role="status">
          <strong>Source changed after the last generation.</strong>
          <span>Current readiness is shown below. The saved generation keeps its historical source-health report for audit and export.</span>
        </div>
      )}

      <div className={styles.summaryGrid} aria-label="Source health summary">
        <div><strong>{summary.usable || 0}</strong><span>Usable</span></div>
        <div><strong>{summary.needsVerification || 0}</strong><span>Verify</span></div>
        <div><strong>{summary.processing || 0}</strong><span>Processing</span></div>
        <div><strong>{summary.referenceOnly || 0}</strong><span>Reference only</span></div>
        <div><strong>{(summary.failed || 0) + (summary.blocked || 0) + (summary.unsupported || 0) + (summary.invalid || 0)}</strong><span>Needs attention</span></div>
        <div><strong>{summary.duplicate || 0}</strong><span>Duplicates</span></div>
      </div>

      <div className={styles.filterBar} role="group" aria-label="Filter source diagnostics">
        {FILTERS.map(([value, label]) => (
          <button
            type="button"
            key={value}
            aria-pressed={filter === value}
            data-active={filter === value}
            onClick={() => setFilter(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {visibleGroups.length === 0 ? (
        <div className={styles.empty}>
          {entries.length
            ? "No sources match this filter."
            : "No source diagnostics yet. Add a brief, repository, file, or public link."}
        </div>
      ) : (
        <div className={styles.groups}>
          {visibleGroups.map(([group, items]) => (
            <section key={group} className={styles.group} aria-label={group}>
              <div className={styles.groupHeading}><strong>{group}</strong><span>{items.length}</span></div>
              <div className={styles.artifactList}>
                {items.map(({ entry, index }) => {
                  const size = formatBytes(entry.byteSize ?? entry.decodedBytes);
                  return (
                    <details className={styles.artifact} key={entry.sourceArtifactId || entry.canonicalUrl || `${entry.kind}-${index}`}>
                      <summary>
                        <div>
                          <strong>{displayName(entry, index)}</strong>
                          <span>{statusExplanation(entry)}</span>
                        </div>
                        <small data-status={entry.status}>{titleCase(entry.status)}</small>
                      </summary>
                      <div className={styles.detailGrid}>
                        <div><span>Source kind</span><strong>{titleCase(entry.sourceKind || entry.kind)}</strong></div>
                        {entry.mimeType && <div><span>Type</span><strong>{entry.mimeType}</strong></div>}
                        {size && <div><span>Size</span><strong>{size}</strong></div>}
                        {entry.extractionState && <div><span>Extraction</span><strong>{titleCase(entry.extractionState)}</strong></div>}
                        {Number.isFinite(Number(entry.extractionChars)) && <div><span>Extracted text</span><strong>{Number(entry.extractionChars).toLocaleString()} chars</strong></div>}
                        {Number.isFinite(Number(entry.selectedFileCount)) && <div><span>Repository files</span><strong>{Number(entry.selectedFileCount)}</strong></div>}
                        {Number.isFinite(Number(entry.redirectCount)) && entry.redirectCount > 0 && <div><span>Redirects</span><strong>{entry.redirectCount}</strong></div>}
                        {entry.issueCode && <div><span>Issue</span><code>{entry.issueCode}</code></div>}
                      </div>
                      {entry.canonicalUrl && (
                        <p className={styles.safeReference}><span>Canonical public reference</span><code>{entry.canonicalUrl}</code></p>
                      )}
                      {entry.recoveryAction && (
                        <p className={styles.recovery}><strong>Recovery</strong><span>{entry.recoveryAction}</span></p>
                      )}
                    </details>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {historyAvailable && (
        <details className={styles.history}>
          <summary>Last generated source-health snapshot</summary>
          <p>{persistedReport.reason}</p>
          <div>
            <span>{persistedReport.counts?.usable || 0} usable</span>
            <span>{persistedReport.counts?.failed || 0} failed</span>
            <span>{persistedReport.counts?.referenceOnly || 0} reference only</span>
          </div>
        </details>
      )}
    </section>
  );
}
