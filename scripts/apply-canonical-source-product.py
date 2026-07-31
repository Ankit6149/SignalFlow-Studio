from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return content.replace(old, new, 1)


def insert_before(content: str, marker: str, addition: str, label: str) -> str:
    if addition.strip() in content:
        return content
    return replace_once(content, marker, addition + marker, label)


def replace_after(content: str, section: str, old: str, new: str, label: str) -> str:
    start = content.find(section)
    if start < 0:
        raise RuntimeError(f"{label}: missing section")
    anchor = content.find(old, start)
    if anchor < 0:
        raise RuntimeError(f"{label}: missing anchor")
    return content[:anchor] + new + content[anchor + len(old):]


def patch_layout() -> None:
    path = "frontend/app/layout.js"
    content = read(path)
    content = insert_before(
        content,
        'import "../app/campaign-versioning.css";\n',
        'import "../app/source-contract.css";\n',
        "layout source CSS",
    )
    write(path, content)


def patch_page_ui() -> None:
    path = "frontend/app/page.js"
    content = read(path)
    helper = '''const SOURCE_STATE_PRESENTATION = Object.freeze({
  usable_evidence: { label: "Usable evidence", description: "Verified extracted content can contribute to generation." },
  reference_only: { label: "Reference only", description: "Retained as context but not counted as extracted evidence." },
  processing: { label: "Processing", description: "This source is not ready for generation yet." },
  failed: { label: "Failed", description: "Ingestion or extraction failed; review or replace this source." },
  unsupported: { label: "Unsupported", description: "The current deployment cannot process this source type." },
});

function sourceFilePresentation(file) {
  const state = file?.sourceArtifact?.usability?.state
    || (file?.extracted ? "usable_evidence" : "reference_only");
  const presentation = SOURCE_STATE_PRESENTATION[state] || SOURCE_STATE_PRESENTATION.reference_only;
  const evidenceState = file?.sourceArtifact?.usability?.evidenceState || (file?.extracted ? "verified" : "unverified");
  return {
    state,
    label: presentation.label,
    description: presentation.description,
    evidenceLabel: evidenceState === "verified" ? "Verified evidence" : evidenceState === "not_applicable" ? "Evidence not applicable" : "Unverified evidence",
    versionId: file?.sourceArtifact?.sourceArtifactVersionId || "Legacy source",
  };
}

'''
    content = insert_before(
        content,
        'function formatDate(value) {\n',
        helper,
        "page source presentation helper",
    )
    content = insert_before(
        content,
        '  const campaignStatus = selectCampaignStatus({\n',
        '''  const sourceArtifactSummary = files.reduce((summary, file) => {
    const state = sourceFilePresentation(file).state;
    summary[state] = (summary[state] || 0) + 1;
    return summary;
  }, {});

''',
        "page source summary",
    )
    old = '''              {files.length > 0 && (
                <div className="file-list">
                  {files.map((file, index) => (
                    <div key={`${file.name}-${index}`} className="file-chip">
                      <span>{file.name}</span>
                      <small>
                        {file.extracted ? "Extracted" : `${Math.max(1, Math.round(file.size / 1024))} KB`}
                      </small>
                      <button
                        aria-label={`Remove ${file.name}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          removeFile(index);
                        }}
                      >
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}
'''
    new = '''              {files.length > 0 && (
                <>
                  <div className="file-list" aria-label="Canonical campaign sources">
                    {files.map((file, index) => {
                      const sourceState = sourceFilePresentation(file);
                      return (
                        <div key={file.sourceArtifact?.sourceArtifactId || `${file.name}-${index}`} className="file-chip file-chip--canonical">
                          <span className="file-chip__identity">
                            <span>{file.name}</span>
                            <small title={sourceState.versionId}>
                              {sourceState.evidenceLabel} · {Math.max(1, Math.round(file.size / 1024))} KB
                            </small>
                          </span>
                          <span
                            className={`source-state-badge is-${sourceState.state}`}
                            title={sourceState.description}
                          >
                            {sourceState.label}
                          </span>
                          <button
                            aria-label={`Remove ${file.name}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              removeFile(index);
                            }}
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                  <div className="source-contract-summary" role="status" aria-live="polite">
                    <strong>Source contract v1</strong>
                    <span>{sourceArtifactSummary.usable_evidence || 0} usable</span>
                    <i />
                    <span>{sourceArtifactSummary.reference_only || 0} reference only</span>
                    {(sourceArtifactSummary.processing || 0) > 0 && <><i /><span>{sourceArtifactSummary.processing} processing</span></>}
                    {(sourceArtifactSummary.failed || 0) > 0 && <><i /><span>{sourceArtifactSummary.failed} failed</span></>}
                  </div>
                </>
              )}
'''
    content = replace_once(content, old, new, "page canonical file list")
    write(path, content)


def patch_capabilities() -> None:
    path = "frontend/lib/capabilities/capabilityContract.mjs"
    content = read(path)
    content = insert_before(
        content,
        'export const PORTABLE_TRANSFER_SCHEMA_VERSION = 1;\n',
        'export const SOURCE_CONTRACT_SCHEMA_VERSION = 1;\n',
        "capability source schema constant",
    )
    content = replace_once(
        content,
        '  extension = {},\n  transfer = {},\n',
        '  extension = {},\n  sourceCapabilities = {},\n  transfer = {},\n',
        "capability source input",
    )
    old_sources = '''      sources: {
        brief: capability(true, "Written campaign briefs are supported."),
        publicLinks: capability(true, "Public link ingestion is supported with server-side safety checks."),
        browserFiles: capability(true, "Small text and code files can be extracted in the browser."),
        repositoryUrl: capability(true, "Public GitHub repository ingestion is supported."),
        localRepository: capability(
          Boolean(session.canReadLocalFiles && localProfile),
          session.canReadLocalFiles && localProfile
            ? "Trusted local repository paths are available in this deployment."
            : "Local filesystem repository paths are unavailable in this session.",
        ),
      },
'''
    new_sources = '''      sources: {
        canonicalContract: capability(
          true,
          "Versioned Asset, SourceArtifact, and AssetProcessing records are validated across browser, API, MCP, persistence, and portable transfer boundaries.",
          {
            schemaVersion: SOURCE_CONTRACT_SCHEMA_VERSION,
            kinds: ["upload", "link", "repository", "repository_file", "trusted_local_repository", "extension_page", "screenshot", "recording", "note", "imported_archive"],
          },
        ),
        brief: capability(true, "Written campaign briefs are supported."),
        publicLinks: capability(
          Boolean(sourceCapabilities.hardenedRemoteFetch),
          sourceCapabilities.hardenedRemoteFetch
            ? "Public links can be fetched through the hardened remote-source boundary."
            : "Public link fields exist, but hardened SSRF, redirect, timeout, MIME, and size enforcement is not complete; remote URLs cannot be trusted as usable evidence by the canonical contract.",
        ),
        browserFiles: capability(true, "Browser uploads create canonical Asset and SourceArtifact records; supported text/code can become verified usable evidence."),
        repositoryUrl: capability(Boolean(sourceCapabilities.repositoryPlanning), sourceCapabilities.repositoryPlanning
          ? "Repository URLs are normalized and planned through the canonical source contract."
          : "Repository URL ingestion exists, but complete normalization and nested application planning are not yet verified."),
        localRepository: capability(
          Boolean(session.canReadLocalFiles && localProfile),
          session.canReadLocalFiles && localProfile
            ? "Trusted local repository references can use opaque IDs and safe relative paths in this deployment."
            : "Trusted local repository access is unavailable in this session; absolute paths are never portable source fields.",
        ),
        processingRecords: capability(true, "Derived processing lineage can be recorded, but OCR, transcription, thumbnail, and analysis adapters remain capability-specific."),
        sourceHealthWorkspace: capability(false, "The complete source-health diagnostics workspace is not implemented yet."),
        remoteEvidenceVersions: capability(false, "Immutable remote evidence revalidation is not implemented yet."),
        retentionEnforcement: capability(false, "Retention and deletion states are recorded, but background enforcement is not implemented yet."),
      },
'''
    content = replace_once(content, old_sources, new_sources, "capability canonical sources")
    parser_old = '''      sources: {
        brief: normalizeCapability(sources.brief, fallbackReason),
        publicLinks: normalizeCapability(sources.publicLinks, fallbackReason),
        browserFiles: normalizeCapability(sources.browserFiles, fallbackReason),
        repositoryUrl: normalizeCapability(sources.repositoryUrl, fallbackReason),
        localRepository: normalizeCapability(sources.localRepository, fallbackReason),
      },
'''
    parser_new = '''      sources: {
        canonicalContract: normalizeCapability(sources.canonicalContract, fallbackReason),
        brief: normalizeCapability(sources.brief, fallbackReason),
        publicLinks: normalizeCapability(sources.publicLinks, fallbackReason),
        browserFiles: normalizeCapability(sources.browserFiles, fallbackReason),
        repositoryUrl: normalizeCapability(sources.repositoryUrl, fallbackReason),
        localRepository: normalizeCapability(sources.localRepository, fallbackReason),
        processingRecords: normalizeCapability(sources.processingRecords, fallbackReason),
        sourceHealthWorkspace: normalizeCapability(sources.sourceHealthWorkspace, fallbackReason),
        remoteEvidenceVersions: normalizeCapability(sources.remoteEvidenceVersions, fallbackReason),
        retentionEnforcement: normalizeCapability(sources.retentionEnforcement, fallbackReason),
      },
'''
    content = replace_once(content, parser_old, parser_new, "capability source parser")
    write(path, content)


def patch_docs() -> None:
    path = "README.md"
    content = read(path)
    section = '''## Canonical source and asset records

SignalFlow now uses one versioned source graph across browser uploads, generation requests, MCP, campaign freshness, persistence, and portable transfer:

- `Asset` records stored original/derived object metadata, safe storage identity, privacy, provenance, lifecycle, retention, and deletion state;
- `SourceArtifact` records source identity/version, ingestion method, usability/evidence state, extraction state, provenance, and Asset relationships;
- `AssetProcessing` records processor identity/version and input/output lineage without claiming a processor completed when it did not.

Browser uploads create canonical records immediately after reading the browser File. Campaign source fingerprints use stable SourceArtifact version references rather than editable filenames/descriptions. API and MCP validate one workspace-scoped graph and return safe issue codes on invalid references.

Remote URLs remain reference-only unless a hardened fetch boundary verifies them; #127 owns SSRF/redirect/timeout/MIME/size enforcement. The complete diagnostics workspace, remote revalidation, processing adapters, and retention/deletion jobs remain separate open issues.

See [docs/SOURCE_ASSET_CONTRACT.md](docs/SOURCE_ASSET_CONTRACT.md).

'''
    content = insert_before(content, '## Portable transfer and recovery\n', section, "README source contract")
    content = insert_before(
        content,
        '- `frontend/lib/transfer/` — portable archive, validation, conflict, resume, provenance, and rollback rules\n',
        '- `frontend/lib/domain/sourceArtifacts.mjs` — canonical Asset, SourceArtifact, AssetProcessing, migration, graph validation, and compatibility projections\n',
        "README source map",
    )
    write(path, content)

    path = "AGENTS.md"
    content = read(path)
    content = replace_once(
        content,
        '6. `docs/PORTABLE_TRANSFER.md`\n7. `docs/APP_WORKSPACE_SYSTEM.md`\n',
        '6. `docs/SOURCE_ASSET_CONTRACT.md`\n7. `docs/PORTABLE_TRANSFER.md`\n8. `docs/APP_WORKSPACE_SYSTEM.md`\n',
        "AGENTS source doc order",
    )
    content = content.replace('8. `docs/STUDIO_UX_SYSTEM.md`\n9. `docs/CONNECTOR_READINESS.md`\n10. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`\n11. `SECURITY.md`\n', '9. `docs/STUDIO_UX_SYSTEM.md`\n10. `docs/CONNECTOR_READINESS.md`\n11. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`\n12. `SECURITY.md`\n')
    content = insert_before(
        content,
        '- Portable archive/import application: `frontend/lib/transfer/` and `frontend/lib/application/browserTransferApplication.mjs`\n',
        '- Canonical source graph: `frontend/lib/domain/sourceArtifacts.mjs`\n',
        "AGENTS source truth",
    )
    content = insert_before(
        content,
        '- Portable transfer, import conflict resolution, provenance, integrity, resume, and rollback belong to the transfer application service—not React components.\n',
        '- Every upload, API, MCP, repository, extension, import, and future job boundary must create or migrate canonical Asset/SourceArtifact records before generation or persistence.\n- `media_items` is compatibility projection only; never use it as storage, provenance, readiness, or source identity.\n- Remote URLs cannot be labeled usable evidence until the hardened fetch boundary verifies them.\n- Absolute local paths, signed URLs, secrets, runtime File/Blob/request objects, and cross-workspace references are forbidden domain fields.\n- Metadata edits must preserve immutable provenance and source version identity.\n',
        "AGENTS source rules",
    )
    content = insert_before(
        content,
        '- Browser Library portable archive preparation, validation, Skip/Copy/Replace import, reports, resume, and rollback are implemented.\n',
        '- Canonical Asset, SourceArtifact, and AssetProcessing records are implemented across browser upload, source freshness, API, MCP, repositories, and portable transfer.\n- The complete source-health workspace, hardened remote fetch, immutable remote revalidation, processing adapters, and retention/deletion enforcement are not implemented.\n',
        "AGENTS source boundaries",
    )
    write(path, content)

    path = "docs/DOMAIN_ARCHITECTURE.md"
    content = read(path)
    content = insert_before(
        content,
        '| TransferReport | workspace/destination | `transferReportId` | Import validation, per-record outcomes, resume, and rollback journal |\n',
        '| AssetProcessing | workspace | `processingId` | Processor/version and input/output Asset/SourceArtifact lineage |\n',
        "domain processing row",
    )
    section = '''## Canonical source graph

`frontend/lib/domain/sourceArtifacts.mjs` is the sole canonical definition for Asset, SourceArtifact, and AssetProcessing. It owns source kinds, ingestion methods, lifecycle, usability/evidence, upload/processing, privacy, retention/deletion, safe references, provenance, legacy migration, graph validation, campaign snapshot references, and generation compatibility projection.

The graph validator rejects duplicate IDs, cross-workspace/campaign references, missing Asset/SourceArtifact/processing links, unsafe URL/repository/local references, and provenance cycles. Browser and store-backed repositories migrate and write canonical records back on read. API and MCP validate the same graph before generation.

Campaign source snapshots store stable SourceArtifact version references. Editable metadata and storage location are excluded from the freshness fingerprint. Portable transfer carries AssetProcessing records, excludes non-exportable private records, and remaps scalar and array references under Copy.

See [SOURCE_ASSET_CONTRACT.md](SOURCE_ASSET_CONTRACT.md).

'''
    content = insert_before(content, '## Portable archive and transfer application\n', section, "domain source section")
    write(path, content)

    path = "docs/CAPABILITY_MATRIX.md"
    content = read(path)
    rows = '''| Canonical Asset / SourceArtifact / AssetProcessing contract | Available | Available | Available | Available |
| Hardened remote URL evidence fetch | Not implemented | Not implemented | Not implemented | Not implemented |
| Complete source-health diagnostics workspace | Not implemented | Not implemented | Not implemented | Not implemented |
| Remote evidence revalidation/version adoption | Not implemented | Not implemented | Not implemented | Not implemented |
| Retention/deletion background enforcement | Not implemented | Not implemented | Not implemented | Not implemented |
'''
    content = insert_before(content, '| Portable `.signalflow.json` prepare/download | Available | Available | Available | Available |\n', rows, "capability source rows")
    section = '''## Canonical source capability

The capability document reports `sources.canonicalContract` with schema version `1`. Browser file uploads and processing lineage records are available as contracts. Public links fail closed as a capability until #127 provides hardened SSRF/redirect/timeout/MIME/size enforcement. Repository planning, the source-health workspace, remote evidence versions, and retention/deletion enforcement remain separately unavailable.

A canonical source record does not prove extraction, OCR, transcription, visual analysis, remote verification, or deletion completed. Those states are explicit per artifact/processing record and must match the actual adapter result.

'''
    content = insert_before(content, '## Portable transfer capability\n', section, "capability source section")
    write(path, content)

    path = "docs/PORTABLE_TRANSFER.md"
    content = read(path)
    content = insert_before(
        content,
        'The contract can carry:\n',
        'Portable transfer consumes the canonical source graph from [SOURCE_ASSET_CONTRACT.md](SOURCE_ASSET_CONTRACT.md). Records with export disabled by privacy policy and processing records that depend on excluded data are omitted with safe manifest reasons.\n\n',
        "portable source contract link",
    )
    content = insert_before(
        content,
        '- Asset metadata and optional blob payloads;\n',
        '- AssetProcessing records with processor/version and input/output lineage;\n',
        "portable processing record",
    )
    write(path, content)


def patch_public_truth() -> None:
    path = "llms.txt"
    content = read(path)
    content = insert_before(
        content,
        '- Explicit `.signalflow.json` archive preparation, SHA-256 validation, browser import preview, Skip/Copy/Replace conflicts, transfer reports, resume, and rollback.\n',
        '- Canonical Asset, SourceArtifact, and AssetProcessing records across browser upload, campaign freshness, API, MCP, persistence, and portable transfer.\n',
        "llms source capability",
    )
    content = insert_before(
        content,
        '- Portable transfer is explicit and browser-local today; a production hosted destination and silent synchronization are not implemented.\n',
        '- Remote URLs remain unverified/reference-only until the hardened fetch boundary is implemented; complete source diagnostics, remote revalidation, processing adapters, and retention/deletion jobs are not implemented.\n',
        "llms source boundary",
    )
    write(path, content)
    write("frontend/public/llms.txt", content)

    path = "llms-full.txt"
    content = read(path)
    section = '''## Canonical source and asset graph

SignalFlow uses versioned Asset, SourceArtifact, and AssetProcessing records for browser uploads, source fingerprints, API/MCP validation, persistence, and portable transfer. Records include stable ownership/version identity, safe references, usability/evidence and processing state, privacy, provenance, original/derived relationships, retention, and deletion state.

Browser uploads create canonical records after reading the browser File; runtime File objects and local paths are not persisted. Campaign fingerprints use SourceArtifact version references rather than editable display metadata. API and MCP validate one workspace-scoped graph and project legacy `media_items` only at the generation compatibility edge.

Remote URL records cannot become usable evidence until a hardened network fetch verifies them. The full source-health workspace, remote evidence revalidation, OCR/transcription/visual processing adapters, Asset Library, and retention/deletion enforcement remain unfinished separate capabilities.

'''
    content = insert_before(content, '## Portable transfer and recovery\n', section, "llms full source section")
    write(path, content)
    write("frontend/public/llms-full.txt", content)


def main() -> None:
    patch_layout()
    patch_page_ui()
    patch_capabilities()
    patch_docs()
    patch_public_truth()


if __name__ == "__main__":
    main()
