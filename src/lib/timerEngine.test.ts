/**
 * Run with: npm test
 *
 * Covers CountdownEngine.restore — the reload path, where getting totalMs wrong
 * silently corrupts the progress bar rather than throwing.
 */
import assert from "node:assert/strict";
import test from "node:test";
import { CountdownEngine } from "./timerEngine.ts";

const TEN_MIN = 10 * 60 * 1000;

test("restore re-enters a countdown that is still running", (t) => {
  const engine = new CountdownEngine();
  t.after(() => engine.destroy()); // a failed assert must not leak its interval
  const restored = engine.restore(Date.now() + 4 * 60 * 1000, TEN_MIN);

  assert.equal(restored, true);
  assert.equal(engine.getState(), "running");
  // Progress must reflect the ORIGINAL duration, not the remainder.
  assert.equal(engine.getTotalMs(), TEN_MIN);
  assert.ok(Math.abs(engine.getRemainingMs() - 4 * 60 * 1000) < 1000);

});

test("restore refuses a deadline that already passed", (t) => {
  const engine = new CountdownEngine();
  t.after(() => engine.destroy()); // a failed assert must not leak its interval

  assert.equal(engine.restore(Date.now() - 1000, TEN_MIN), false);
  assert.equal(engine.getState(), "idle");

});

test("restore refuses junk without leaving the engine running", (t) => {
  const engine = new CountdownEngine();
  t.after(() => engine.destroy()); // a failed assert must not leak its interval

  assert.equal(engine.restore(Date.now() + TEN_MIN, 0), false);
  assert.equal(engine.restore(Number.NaN, TEN_MIN), false);
  assert.equal(engine.getState(), "idle");

});

test("a restored timer still pauses and resumes from the right remainder", (t) => {
  const engine = new CountdownEngine();
  t.after(() => engine.destroy()); // a failed assert must not leak its interval
  engine.restore(Date.now() + 4 * 60 * 1000, TEN_MIN);

  engine.pause();
  assert.equal(engine.getState(), "paused");
  const atPause = engine.getRemainingMs();

  engine.resume();
  assert.equal(engine.getState(), "running");
  assert.ok(Math.abs(engine.getRemainingMs() - atPause) < 1000);

});
