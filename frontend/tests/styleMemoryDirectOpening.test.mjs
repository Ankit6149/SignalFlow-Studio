import test from "node:test";
import assert from "node:assert/strict";

import { styleObservationsFromExplicitReason } from "../lib/domain/styleMemory.mjs";

test("a direct-opening change request becomes one explainable candidate style observation", () => {
  const observations = styleObservationsFromExplicitReason(
    "Make the opening more direct and keep the architecture boundary precise.",
  );

  assert.equal(observations.length, 1);
  assert.equal(observations[0].hypothesisKey, "opening.more_direct");
  assert.equal(observations[0].category, "opening");
  assert.match(observations[0].hypothesis, /direct openings/i);
});

test("factual precision by itself is not silently promoted into a style preference", () => {
  const observations = styleObservationsFromExplicitReason(
    "Keep the architecture boundary precise and do not change the technical claim.",
  );

  assert.deepEqual(observations, []);
});
