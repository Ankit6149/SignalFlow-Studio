import test from "node:test";
import assert from "node:assert/strict";

import {
  CONTENT_SIGNAL_KINDS,
  CONTENT_SIGNAL_STATUSES,
  createManualContentSignal,
  normalizeContentSignal,
} from "../lib/domain/contentSignals.mjs";
import {
  createDeterministicIdService,
} from "../lib/domain/ports.mjs";
import { createMemoryAsyncStore } from "../lib/infrastructure/adapters.mjs";
import {
  createBrowserContentSignalRepository,
  createMemoryContentSignalRepository,
  createStoreBackedContentSignalRepository,
} from "../lib/infrastructure/contentSignalAdapters.mjs";
import {
  createMemoryAssetRepository,
  createMemorySourceArtifactRepository,
} from "../lib/infrastructure/transferAdapters.mjs";
import { createContentSignalApplication } from "../lib/application/contentSignalApplication.mjs";
import { createBrowserContentSignalApplication } from "../lib/application/browserContentSignalApplication.mjs";
import { createUploadSourceBundle } from "../lib/domain/sourceArtifacts.mjs";

const NOW = "2026-08-16T12:00:00.000Z";
const LATER = "2026-08-17T12:00:00.000Z";
const WORKSPACE = "local-personal";

function fixedClock(values = [NOW]) {
  let index = 0;
  return {
    now() {
      const value = values[Math.min(index, values.length - 1)];
      index += 1;
      return value;
    },
  };
}

function fakeStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
    dump(key) { return values.get(key) || null; },
  };
}

function manualSignal(overrides = {}) {
  return createManualContentSignal({
    signalId: "signal-1",
    workspaceId: WORKSPACE,
    headline: "I changed how SignalFlow handles private repository context",
    summary: "The boundary is clearer and I want to explain why that matters.",
    signalKind: CONTENT_SIGNAL_KINDS.LESSON,
    observedAt: NOW,
    ...overrides,
  });
}

function appWith(repository, options = {}) {
  return createContentSignalApplication({
    contentSignalRepository: repository,
    workspaceId: options.workspaceId || WORKSPACE,
    clock: options.clock || fixedClock(),
    idService: options.idService || createDeterministicIdService("test"),
    sourceArtifactRepository: options.sourceArtifactRepository || null,
    assetRepository: options.assetRepository || null,
  });
}

test("manual ContentSignal is versioned, project-optional, private by default, and not a Campaign", () => {
  const signal = manualSignal();
  assert.equal(signal.kind, "ContentSignal");
  assert.equal(signal.schemaVersion, 1);
  assert.equal(signal.signalSchemaVersion, 1);
  assert.equal(signal.workspaceId, WORKSPACE);
  assert.equal(signal.projectId, null);
  assert.equal(signal.sourceType, "manual");
  assert.equal(signal.status, CONTENT_SIGNAL_STATUSES.NEW);
  assert.equal(signal.privacyClassification, "workspace_private");
  assert.equal(signal.provenance.ingestionMethod, "user_input");
  assert.equal(signal.provenance.capturedAt, NOW);
  assert.ok(!Object.prototype.hasOwnProperty.call(signal, "campaignId"));
});

test("ContentSignal supports project scope and deduplicated canonical references", () => {
  const signal = manualSignal({
    projectId: "signalflow-studio",
    sourceArtifactIds: ["source-2", "source-1", "source-2"],
    assetIds: ["asset-1", "asset-1"],
  });
  assert.equal(signal.projectId, "signalflow-studio");
  assert.deepEqual(signal.sourceArtifactIds, ["source-1", "source-2"]);
  assert.deepEqual(signal.assetIds, ["asset-1"]);
});

test("future signal schemas, unsafe IDs, invalid snooze records, and runtime records fail closed", () => {
  assert.throws(() => normalizeContentSignal({ ...manualSignal(), signalSchemaVersion: 999 }), /newer than supported/i);
  assert.throws(() => manualSignal({ projectId: "C:\\private\\repo" }), /opaque ID/i);
  assert.throws(() => normalizeContentSignal({ ...manualSignal(), status: "snoozed", snoozedUntil: null }), /requires snoozedUntil/i);
  assert.throws(() => normalizeContentSignal({ ...manualSignal(), summary: new Date() }), /ContentSignal text|convert/i);
});

test("memory repository rejects a signal ID being reassigned across workspaces", async () => {
  const repository = createMemoryContentSignalRepository([manualSignal()]);
  await assert.rejects(
    repository.upsert(manualSignal({ workspaceId: "other-workspace" })),
    /another workspace/i,
  );
});

test("application creates project-less and project-scoped signals without creating a Campaign", async () => {
  const repository = createMemoryContentSignalRepository();
  const app = appWith(repository, { idService: createDeterministicIdService("owner") });
  const first = await app.createManualSignal({ thought: "Ignored field", headline: "A project-less thought" });
  const second = await app.createManualSignal({ headline: "A project update", projectId: "signalflow-studio", signalKind: "feature" });
  assert.equal(first.signalId, "owner-signal-1");
  assert.equal(first.projectId, null);
  assert.equal(second.projectId, "signalflow-studio");
  assert.deepEqual((await app.listSignals()).map((item) => item.signalId), [second.signalId, first.signalId]);
  assert.ok((await repository.list()).every((item) => item.kind === "ContentSignal"));
});

test("ignore, snooze, restore, archive, and metadata edits persist through the application service", async () => {
  const repository = createMemoryContentSignalRepository();
  const app = appWith(repository, {
    clock: fixedClock([NOW, "2026-08-16T12:10:00.000Z", "2026-08-16T12:20:00.000Z", "2026-08-16T12:30:00.000Z", "2026-08-16T12:40:00.000Z", "2026-08-16T12:50:00.000Z"]),
  });
  const created = await app.createManualSignal({ headline: "A thought to manage" });
  const ignored = await app.ignoreSignal(created.signalId);
  assert.equal(ignored.status, "ignored");
  const restored = await app.restoreSignal(created.signalId);
  assert.equal(restored.status, "new");
  const snoozed = await app.snoozeSignal(created.signalId, LATER);
  assert.equal(snoozed.status, "snoozed");
  assert.equal(snoozed.snoozedUntil, LATER);
  const edited = await app.updateSignalMetadata(created.signalId, { headline: "A clearer thought", boundaryNote: "Do not mention private client names." });
  assert.equal(edited.headline, "A clearer thought");
  assert.equal(edited.provenance.capturedAt, NOW);
  const archived = await app.archiveSignal(created.signalId);
  assert.equal(archived.status, "archived");
  assert.equal((await app.listSignals()).length, 0);
  assert.equal((await app.listSignals({ includeArchived: true })).length, 1);
});

test("application refuses cross-workspace reads and updates", async () => {
  const repository = createMemoryContentSignalRepository([manualSignal()]);
  const otherApp = appWith(repository, { workspaceId: "other-workspace" });
  await assert.rejects(otherApp.readSignal("signal-1"), /does not belong/i);
  await assert.rejects(otherApp.ignoreSignal("signal-1"), /does not belong/i);
});

test("canonical source and asset attachment validates existence and workspace ownership", async () => {
  const bundle = createUploadSourceBundle({
    file: { name: "proof.txt", type: "text/plain", size: 5 },
    extractedText: "proof",
    workspaceId: WORKSPACE,
    assetId: "asset-proof",
    sourceArtifactId: "source-proof",
    now: NOW,
  });
  const repository = createMemoryContentSignalRepository();
  const app = appWith(repository, {
    sourceArtifactRepository: createMemorySourceArtifactRepository([bundle.sourceArtifact]),
    assetRepository: createMemoryAssetRepository([bundle.asset]),
  });
  const signal = await app.createManualSignal({ headline: "A thought with proof" });
  const attached = await app.attachSourceToSignal(signal.signalId, {
    sourceArtifactIds: [bundle.sourceArtifact.sourceArtifactId],
    assetIds: [bundle.asset.assetId],
  });
  assert.deepEqual(attached.sourceArtifactIds, [bundle.sourceArtifact.sourceArtifactId]);
  assert.deepEqual(attached.assetIds, [bundle.asset.assetId]);
  await assert.rejects(
    app.attachSourceToSignal(signal.signalId, { sourceArtifactIds: ["missing-source"] }),
    /does not exist/i,
  );
});

test("browser application survives reconstruction using the same localStorage key", async () => {
  const storage = fakeStorage();
  const firstApp = createBrowserContentSignalApplication({
    getStorage: () => storage,
    key: "signals-test",
    workspaceId: WORKSPACE,
    validateCanonicalReferences: false,
    clock: fixedClock([NOW, "2026-08-16T12:05:00.000Z"]),
    idService: createDeterministicIdService("browser"),
  });
  const created = await firstApp.createManualSignal({ headline: "This must survive refresh", projectId: "signalflow-studio" });
  await firstApp.ignoreSignal(created.signalId);
  assert.match(storage.dump("signals-test"), /This must survive refresh/);

  const reopenedApp = createBrowserContentSignalApplication({
    getStorage: () => storage,
    key: "signals-test",
    workspaceId: WORKSPACE,
    validateCanonicalReferences: false,
    clock: fixedClock(),
  });
  const reopened = await reopenedApp.readSignal(created.signalId);
  assert.equal(reopened.headline, "This must survive refresh");
  assert.equal(reopened.projectId, "signalflow-studio");
  assert.equal(reopened.status, "ignored");
});

test("store-backed repository satisfies create read list update and remove lifecycle", async () => {
  const store = createMemoryAsyncStore();
  const repository = createStoreBackedContentSignalRepository({ store });
  const signal = manualSignal();
  await repository.upsert(signal);
  assert.equal((await repository.get(signal.signalId)).headline, signal.headline);
  assert.equal((await repository.list()).length, 1);
  await repository.upsert({ ...signal, headline: "Updated signal" });
  assert.equal((await repository.get(signal.signalId)).headline, "Updated signal");
  assert.equal(await repository.remove(signal.signalId), true);
  assert.equal(await repository.get(signal.signalId), null);
});

test("browser repository stores only canonical portable ContentSignal records", async () => {
  const storage = fakeStorage();
  const repository = createBrowserContentSignalRepository({ getStorage: () => storage, key: "signals" });
  await repository.upsert(manualSignal());
  const serialized = storage.dump("signals");
  assert.match(serialized, /"kind":"ContentSignal"/);
  assert.match(serialized, /"signalSchemaVersion":1/);
  assert.doesNotMatch(serialized, /campaignId|apiKey|accessToken|cookie/i);
});
