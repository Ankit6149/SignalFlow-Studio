from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def read(path: str) -> str:
    return (ROOT / path).read_text(encoding="utf-8")


def write(path: str, content: str) -> None:
    (ROOT / path).write_text(content, encoding="utf-8")


def replace_once(content: str, old: str, new: str, *, label: str) -> str:
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    return content.replace(old, new, 1)


def insert_once(content: str, marker: str, addition: str, *, label: str) -> str:
    if addition.strip() in content:
        return content
    return replace_once(content, marker, f"{addition}{marker}", label=label)


def replace_in_section(content: str, section_marker: str, old: str, new: str, *, label: str) -> str:
    start = content.find(section_marker)
    if start < 0:
        raise RuntimeError(f"{label}: missing section marker")
    prefix = content[:start]
    section = content[start:]
    section = replace_once(section, old, new, label=label)
    return prefix + section


def update_page() -> None:
    path = "frontend/app/page.js"
    content = read(path)
    content = insert_once(
        content,
        'import PlatformIcon from "../components/PlatformIcon";\n',
        'import PortableTransferPanel from "../components/PortableTransferPanel";\n',
        label="page transfer import",
    )
    component = '''          <PortableTransferPanel
            campaigns={library}
            onLibraryChanged={async () => {
              setLibrary(await campaignApplication.listCampaigns());
            }}
          />

'''
    content = insert_once(
        content,
        '          {library.length === 0 ? (\n',
        component,
        label="page transfer component",
    )
    write(path, content)


def update_capabilities() -> None:
    path = "frontend/lib/capabilities/capabilityContract.mjs"
    content = read(path)
    constants = '''export const PORTABLE_TRANSFER_SCHEMA_VERSION = 1;
export const PORTABLE_TRANSFER_BROWSER_MAX_BYTES = 50 * 1024 * 1024;
'''
    content = insert_once(
        content,
        'export const EXTENSION_PROTOCOL_VERSION = 1;\n',
        constants,
        label="capability transfer constants",
    )
    content = replace_once(
        content,
        '  extension = {},\n  quotas = {},\n',
        '  extension = {},\n  transfer = {},\n  quotas = {},\n',
        label="capability transfer input",
    )
    builder_block = '''      transfer: {
        portableArchive: capability(
          true,
          "Versioned SignalFlow portable archives can be prepared and validated in this browser.",
          {
            schemaVersion: PORTABLE_TRANSFER_SCHEMA_VERSION,
            maxBrowserBytes: PORTABLE_TRANSFER_BROWSER_MAX_BYTES,
          },
        ),
        browserImportExport: capability(
          true,
          "This browser can prepare, download, validate, import, resume, and roll back portable archives.",
        ),
        hostedImport: capability(
          Boolean(transfer.hostedImport),
          transfer.hostedImport
            ? "A compatible hosted workspace transfer adapter is available to this session."
            : "Hosted workspace import is not enabled; the current transfer destination is this browser library.",
        ),
        signatures: capability(
          Boolean(transfer.signatures),
          transfer.signatures
            ? "Archive signing and verification are configured for this deployment."
            : "SHA-256 integrity is available; deployment archive signing is not configured.",
        ),
        silentSync: capability(
          false,
          "Portable transfer is explicit and user initiated; silent cross-deployment synchronization is not enabled.",
        ),
      },
'''
    content = replace_in_section(
        content,
        "export function createCapabilitySnapshot",
        '      models: {\n',
        builder_block + '      models: {\n',
        label="capability transfer builder",
    )
    content = replace_in_section(
        content,
        "export function parseCapabilitySnapshot",
        '  const extension = value.capabilities?.extension || {};\n  const exports = value.capabilities?.exports || {};\n',
        '  const extension = value.capabilities?.extension || {};\n  const exports = value.capabilities?.exports || {};\n  const transfer = value.capabilities?.transfer || {};\n',
        label="capability transfer parser input",
    )
    parser_block = '''      transfer: {
        portableArchive: normalizeCapability(transfer.portableArchive, fallbackReason),
        browserImportExport: normalizeCapability(transfer.browserImportExport, fallbackReason),
        hostedImport: normalizeCapability(transfer.hostedImport, fallbackReason),
        signatures: normalizeCapability(transfer.signatures, fallbackReason),
        silentSync: normalizeCapability(transfer.silentSync, fallbackReason),
      },
'''
    content = replace_in_section(
        content,
        "export function parseCapabilitySnapshot",
        '      models: {\n',
        parser_block + '      models: {\n',
        label="capability transfer parser",
    )
    write(path, content)


def update_readme() -> None:
    path = "README.md"
    content = read(path)
    section = '''## Portable transfer and recovery

The Library includes an explicit portable ownership workflow:

- select saved campaigns and prepare a versioned `.signalflow.json` archive;
- review campaign, asset, source-artifact, approval, export, blob-byte, and exclusion counts before download;
- verify SHA-256 integrity and optional deployment signatures before import;
- preview schema, size, traversal, blob, missing-asset, warning, and conflict states before changing storage;
- choose Skip, Copy, or Replace deliberately;
- cancel between records, resume compatible partial/cancelled reports, and roll back journaled changes;
- preserve generation timestamps, authoritative drafts, generated baselines, approvals, version archives, source snapshots, and transfer provenance as historical data.

Provider keys, OAuth/session credentials, signed/private references, private endpoints, and local filesystem paths are excluded with a safe manifest report. Transfer is user initiated; SignalFlow does not silently upload or synchronize browser data.

Browser-local import/export is implemented. The same application contract is tested through injected store-backed adapters, but a production hosted destination, cloud database, object storage, tenant authorization, and durable transfer jobs are **not** claimed yet.

See [docs/PORTABLE_TRANSFER.md](docs/PORTABLE_TRANSFER.md).

'''
    content = insert_once(
        content,
        '## Deployment capability contract\n',
        section,
        label="README transfer section",
    )
    content = insert_once(
        content,
        '- `frontend/lib/export/campaignExport.mjs` — authoritative deterministic export projector\n',
        '- `frontend/lib/transfer/` — portable archive, validation, conflict, resume, provenance, and rollback rules\n- `frontend/components/PortableTransferPanel.js` — Library transfer preparation, preview, import, and recovery UI\n',
        label="README transfer map",
    )
    content = insert_once(
        content,
        '- Browser-local and self-hostable today, cloud-ready through adapters\n',
        '- Explicit portable ownership; no silent cross-deployment sync\n',
        label="README transfer principle",
    )
    write(path, content)


def update_agents() -> None:
    path = "AGENTS.md"
    content = read(path)
    content = replace_once(
        content,
        '5. `docs/CAMPAIGN_SCHEMA_MIGRATION.md`\n6. `docs/APP_WORKSPACE_SYSTEM.md`\n7. `docs/STUDIO_UX_SYSTEM.md`\n8. `docs/CONNECTOR_READINESS.md`\n9. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`\n10. `SECURITY.md`\n',
        '5. `docs/CAMPAIGN_SCHEMA_MIGRATION.md`\n6. `docs/PORTABLE_TRANSFER.md`\n7. `docs/APP_WORKSPACE_SYSTEM.md`\n8. `docs/STUDIO_UX_SYSTEM.md`\n9. `docs/CONNECTOR_READINESS.md`\n10. `docs/PRODUCT_GRADE_OPEN_SOURCE.md`\n11. `SECURITY.md`\n',
        label="AGENTS read order",
    )
    content = insert_once(
        content,
        '- Authoritative export projection: `frontend/lib/export/campaignExport.mjs`\n',
        '- Portable archive/import application: `frontend/lib/transfer/` and `frontend/lib/application/browserTransferApplication.mjs`\n- Transfer UI: `frontend/components/PortableTransferPanel.js`\n',
        label="AGENTS transfer truth",
    )
    content = insert_once(
        content,
        '- Cloud/database/object-store/queue work must implement existing ports and pass the same adapter contract suites.\n',
        '- Portable transfer, import conflict resolution, provenance, integrity, resume, and rollback belong to the transfer application service—not React components.\n- Never persist or render excluded secret values, signed URLs, private endpoints, private addresses, or local filesystem paths; the exclusion manifest stores only safe field paths and reasons.\n- Imported generation, approval, and export events remain historical and must not be relabeled as newly created work.\n- Hosted transfer remains unavailable until tenant authorization, destination selection, storage, jobs, quotas, and credential-backed round trips pass.\n',
        label="AGENTS transfer rules",
    )
    content = insert_once(
        content,
        '- Stable IDs, duplicate-title coexistence, save changes, save as copy, edit-safe regeneration, approvals, and local version archives are implemented.\n',
        '- Browser Library portable archive preparation, validation, Skip/Copy/Replace import, reports, resume, and rollback are implemented.\n- Store-backed transfer adapters are contract-tested; production hosted transfer infrastructure is not implemented.\n- Portable transfer is explicit and user initiated; silent cross-deployment sync is not implemented.\n',
        label="AGENTS transfer boundaries",
    )
    write(path, content)


def update_capability_matrix() -> None:
    path = "docs/CAPABILITY_MATRIX.md"
    content = read(path)
    rows = '''| Portable `.signalflow.json` prepare/download | Available | Available | Available | Available |
| Validated browser import with Skip/Copy/Replace and rollback reports | Available | Available | Available | Available |
| Production hosted workspace transfer destination | Not implemented | Not implemented | Not implemented | Not implemented |
| Silent cross-deployment synchronization | Not implemented | Not implemented | Not implemented | Not implemented |
'''
    content = insert_once(
        content,
        '| Authoritative Markdown / JSON export | Available | Available | Available | Available |\n',
        rows,
        label="capability transfer rows",
    )
    section = '''## Portable transfer capability

The capability document declares portable transfer separately from cloud persistence:

- `transfer.portableArchive` reports schema version `1` and the browser import byte limit;
- `transfer.browserImportExport` is available because the Library can prepare, download, validate, import, resume, and roll back archives;
- `transfer.hostedImport` remains unavailable unless a compatible hosted workspace adapter is actually configured for the current session;
- `transfer.signatures` distinguishes always-available SHA-256 integrity from optional deployment signing;
- `transfer.silentSync` is unavailable by design because transfer is explicit and user initiated.

Browser capability does not imply a cloud database, object storage, account workspace, background job, tenant authorization, or cross-device sync. A future hosted adapter must preserve the same archive, provenance, conflict, report, and rollback contract and pass tenant-isolation, quota, backup/restore, and credential-backed acceptance gates before `hostedImport.available` can become true.

See [PORTABLE_TRANSFER.md](PORTABLE_TRANSFER.md).

'''
    content = insert_once(
        content,
        '## Campaign data rules\n',
        section,
        label="capability transfer section",
    )
    write(path, content)


def update_domain_architecture() -> None:
    path = "docs/DOMAIN_ARCHITECTURE.md"
    content = read(path)
    content = insert_once(
        content,
        '| AuditEvent | workspace | `auditEventId` | Security and product activity fact |\n',
        '| TransferReport | workspace/destination | `transferReportId` | Import validation, per-record outcomes, resume, and rollback journal |\n',
        label="domain TransferReport row",
    )
    content = replace_once(
        content,
        '- campaign repository;\n- asset repository;\n- blob storage;\n- job queue;\n',
        '- campaign repository;\n- asset repository;\n- source-artifact repository;\n- approval repository;\n- export repository;\n- transfer-report repository;\n- blob storage;\n- optional archive signer;\n- job queue;\n',
        label="domain transfer ports",
    )
    content = insert_once(
        content,
        '- memory and store-backed blob storage;\n',
        '- browser, memory, and store-backed asset/source-artifact/approval/export/transfer-report repositories;\n- browser blob storage for byte, text, and JSON payloads;\n',
        label="domain transfer adapters",
    )
    section = '''## Portable archive and transfer application

`frontend/lib/transfer/portableArchive.mjs` owns archive schema, sanitization, SHA-256 integrity, optional signing, traversal/size/blob validation, and encoded blob payloads. `frontend/lib/transfer/transferApplication.mjs` owns selection, preview, conflict mapping, provenance, import order, reports, resume, cancellation, and rollback.

The browser composition root is `frontend/lib/application/browserTransferApplication.mjs`. The Library renders `frontend/components/PortableTransferPanel.js`, which calls the application service and does not calculate digests, migrate records, inspect storage keys, resolve conflicts, or perform repository writes itself.

Portable transfer rules:

- archives are explicit `.signalflow.json` records with schema version `1`;
- secrets, OAuth/session data, signed/private references, private endpoints, and local filesystem paths are excluded with safe field-path reasons;
- SHA-256 integrity is mandatory and verified before writes; signatures are optional unless a destination requires them;
- Skip re-import is idempotent, Copy remaps stable IDs/references, and Replace journals previous destination records;
- campaigns import before assets/artifacts/approvals/exports so dependent IDs can be remapped;
- imported events preserve historical timestamps and carry `transferProvenance.historical = true`;
- normal browser import is atomic; non-atomic adapters persist partial outcomes and can resume using the same archive digest;
- rollback replays the ordered journal in reverse and records any incomplete recovery;
- browser import/export availability does not imply production hosted persistence or synchronization.

See [PORTABLE_TRANSFER.md](PORTABLE_TRANSFER.md).

'''
    content = insert_once(
        content,
        '## Authoritative export projection\n',
        section,
        label="domain transfer section",
    )
    write(path, content)


def update_llms() -> None:
    path = "llms.txt"
    content = read(path)
    content = insert_once(
        content,
        '- Deterministic Markdown/JSON export from one authoritative current draft per channel.\n',
        '- Explicit `.signalflow.json` archive preparation, SHA-256 validation, browser import preview, Skip/Copy/Replace conflicts, transfer reports, resume, and rollback.\n',
        label="llms transfer capability",
    )
    content = insert_once(
        content,
        '- Saved campaigns are currently browser-local; cloud database, cross-device sync, collaboration, durable jobs, and billing quotas are not implemented.\n',
        '- Portable transfer is explicit and browser-local today; a production hosted destination and silent synchronization are not implemented.\n- Archive creation excludes provider/OAuth/session secrets, signed/private references, private endpoints, and local filesystem paths with a safe exclusion manifest.\n',
        label="llms transfer boundary",
    )
    write(path, content)
    write("frontend/public/llms.txt", content)

    full_path = "llms-full.txt"
    full = read(full_path)
    section = '''## Portable transfer and recovery

The Library can prepare and import a versioned `.signalflow.json` archive.

Archive preparation is two-step: users select campaigns, prepare the archive, inspect campaign/asset/source/approval/export/blob-byte counts and exclusions, and then download. Provider keys, OAuth/session data, signed/private references, private endpoints, and local filesystem paths are excluded. The archive carries mandatory SHA-256 integrity and may carry an optional deployment signature.

Import validates schema, size, traversal-safe blob paths, payload lengths, integrity, optional signatures, missing assets, and existing-record conflicts before changing storage. Users deliberately choose Skip, Copy, or Replace. Import reports preserve per-record outcomes and an ordered rollback journal. Cancellation occurs between records; compatible partial/cancelled reports can resume with the same archive digest. Rollback is explicit and auditable.

Imported campaign drafts, generated baselines, generation runs, approvals, archives, source snapshots, artifacts, assets, and exports retain historical timestamps and transfer provenance. They are not described as newly generated activity.

Browser-local import/export is implemented. Memory and injected store-backed adapters pass the same contract tests, but this does not constitute a production hosted transfer service. Hosted destination workspaces, tenant authorization, cloud database/object storage, durable transfer jobs, quotas, and silent synchronization are not implemented.

'''
    full = insert_once(
        full,
        '## Deployment capability model\n',
        section,
        label="llms-full transfer section",
    )
    write(full_path, full)
    write("frontend/public/llms-full.txt", full)


def update_layout_and_schema() -> None:
    layout_path = "frontend/app/layout.js"
    layout = read(layout_path)
    layout = insert_once(
        layout,
        '        "Save campaign packages in the current browser",\n',
        '        "Prepare and validate portable SignalFlow campaign archives with explicit import conflict and rollback controls",\n',
        label="layout transfer feature",
    )
    write(layout_path, layout)

    schema_path = "frontend/public/schema.jsonld"
    schema = read(schema_path)
    schema = insert_once(
        schema,
        '      "Save campaign packages in the current browser",\n',
        '      "Prepare and validate portable SignalFlow campaign archives with explicit import conflict and rollback controls",\n',
        label="schema transfer feature",
    )
    write(schema_path, schema)


def main() -> None:
    update_page()
    update_capabilities()
    update_readme()
    update_agents()
    update_capability_matrix()
    update_domain_architecture()
    update_llms()
    update_layout_and_schema()


if __name__ == "__main__":
    main()
