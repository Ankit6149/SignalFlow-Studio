from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
PATH = ROOT / "frontend/lib/transfer/transferApplication.mjs"
content = PATH.read_text(encoding="utf-8")


def replace_once(old: str, new: str, label: str) -> None:
    global content
    count = content.count(old)
    if count != 1:
        raise RuntimeError(f"{label}: expected one anchor, found {count}")
    content = content.replace(old, new, 1)


replace_once(
'''async function selectRecords(repository, ids = []) {
  if (!ids.length) return repository.list();
  const records = await Promise.all(ids.map((id) => repository.get(id)));
  return records.filter(Boolean);
}
''',
'''async function selectRecords(repository, ids = []) {
  if (!ids.length) return repository.list();
  const records = await Promise.all(ids.map((id) => repository.get(id)));
  return records.filter(Boolean);
}

function createEphemeralRecordRepository(idField) {
  const records = new Map();
  return {
    async list() {
      return Array.from(records.values()).map((record) => portableClone(record));
    },
    async get(id) {
      return records.has(id) ? portableClone(records.get(id)) : null;
    },
    async upsert(record) {
      records.set(record[idField], portableClone(record));
      return portableClone(record);
    },
    async remove(id) {
      return records.delete(id);
    },
  };
}
''',
"ephemeral processing repository",
)

replace_once(
'''    sourceArtifactRepository: assertPort("sourceArtifactRepository", sourceArtifactRepository),
    assetProcessingRepository: assertPort("assetProcessingRepository", assetProcessingRepository),
    approvalRepository: assertPort("approvalRepository", approvalRepository),
''',
'''    sourceArtifactRepository: assertPort("sourceArtifactRepository", sourceArtifactRepository),
    assetProcessingRepository: assertPort(
      "assetProcessingRepository",
      assetProcessingRepository || createEphemeralRecordRepository("processingId"),
    ),
    approvalRepository: assertPort("approvalRepository", approvalRepository),
''',
"optional processing repository",
)

PATH.write_text(content, encoding="utf-8")
