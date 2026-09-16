/**
 * Run with: npm test
 *
 * Covers planRender only — the part with branches. The DOM half of FlipClock is
 * a straight translation of the plan and is verified in the browser.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { planRender } from "./flipClock.ts";

test("ticking a second flips only the digits that changed", () => {
  assert.deepEqual(planRender("25:00", "24:59"), { rebuild: false, flips: [1, 3, 4] });
});

test("no change means no flips", () => {
  assert.deepEqual(planRender("25:00", "25:00"), { rebuild: false, flips: [] });
});

test("the separator is never counted as a flip", () => {
  assert.deepEqual(planRender("01:00", "02:00"), { rebuild: false, flips: [1] });
});

test("crossing the hour changes the cell layout, so rebuild", () => {
  assert.deepEqual(planRender("59:59", "01:00:00"), { rebuild: true, flips: [] });
  assert.deepEqual(planRender("01:00:00", "59:59"), { rebuild: true, flips: [] });
});

test("first paint from an empty clock rebuilds", () => {
  assert.deepEqual(planRender("", "45:00"), { rebuild: true, flips: [] });
});

test("same length but a separator moved rebuilds rather than flipping a colon", () => {
  assert.deepEqual(planRender("12:34", "1:2:34".slice(0, 5)), { rebuild: true, flips: [] });
});
