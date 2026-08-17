import test from "node:test";
import assert from "node:assert/strict";

import { createPreparedNarrativeMemory } from "../lib/domain/narrativeMemory.mjs";
import { createBrowserNarrativeMemoryRepository } from "../lib/infrastructure/narrativeMemoryAdapters.mjs";

function fakeStorage() {
  const values = new Map();
  return {
    getItem(key) { return values.has(key) ? values.get(key) : null; },
    setItem(key, value) { values.set(key, String(value)); },
    removeItem(key) { values.delete(key); },
  };
}

const NOW = "2026-08-17T18:15:00.000Z";

test("browser NarrativeMemory survives application reconstruction without duplicating exact approval history", async () => {
  const storage = fakeStorage();
  const options = { getStorage: () => storage, key: "narrative-memory-test" };
  const first = createBrowserNarrativeMemoryRepository(options);
  const memory = createPreparedNarrativeMemory({
    narrativeMemoryId: "memory-browser-1",
    workspaceId: "local-personal",
    opportunityId: "opportunity-browser-1",
    narrativeStrategyId: "strategy-browser-1",
    contentPieceId: "piece-browser-1",
    platformVariantId: "variant-browser-1",
    platformVariantRevisionId: "revision-browser-1",
    platformVariantApprovalId: "approval-browser-1",
    platform: "linkedin",
    topic: "Privacy routing",
    angle: "Architecture boundary",
    coreIdea: "Privacy constrains routing before model selection.",
    approvedContent: "Privacy constrains model routing before selection.",
    approvedAt: NOW,
    createdAt: NOW,
  });
  await first.upsert(memory);

  const reopened = createBrowserNarrativeMemoryRepository(options);
  const records = await reopened.list();
  assert.equal(records.length, 1);
  assert.deepEqual(records[0], memory);

  await reopened.upsert(memory);
  assert.equal((await reopened.list()).length, 1);
});
