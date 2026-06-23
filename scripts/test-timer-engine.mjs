/**
 * Lightweight accuracy self-test for CountdownEngine.
 * Not a full test framework — just verifies the timestamp math holds under
 * simulated clock skew and pause/resume. Run: npx tsx scripts/test-timer-engine.mjs
 *
 * Mocks Date.now + setInterval so it runs fast and deterministically.
 */
import { CountdownEngine, StopwatchEngine } from "../src/lib/timerEngine.ts";

let passed = 0;
let failed = 0;
function assert(cond, msg) {
  if (cond) {
    passed++;
    console.log(`  ✓ ${msg}`);
  } else {
    failed++;
    console.error(`  ✗ ${msg}`);
  }
}

// ---- Mock Date.now ----
let mockNow = 1000000;
const realDateNow = Date.now;
const realSetInterval = globalThis.setInterval;
const realClearInterval = globalThis.clearInterval;
Date.now = () => mockNow;

// Mock setInterval to be controllable
let intervalCb = null;
let intervalId = null;
globalThis.setInterval = (cb) => {
  intervalCb = cb;
  intervalId = Symbol("interval");
  return intervalId;
};
globalThis.clearInterval = () => {
  intervalCb = null;
  intervalId = null;
};
function tickInterval() {
  if (intervalCb) intervalCb();
}

console.log("CountdownEngine — accuracy tests\n");

// Test 1: start computes endTimestamp correctly
{
  const e = new CountdownEngine();
  e.start(60_000); // 1 min
  assert(e.getRemainingMs() === 60_000, "immediately after start, remaining = full duration");

  // Simulate 30s passing (tab active, ticks fire)
  mockNow += 30_000;
  tickInterval();
  assert(e.getRemainingMs() === 30_000, "after 30s of real time, 30s remaining (not 60s)");
  e.destroy();
}

// Test 2: survives background throttling — 60s of wall time, ticks fire late
{
  const e = new CountdownEngine();
  e.start(60_000);
  // Simulate browser throttling: only ONE tick fires after 60s wall time
  mockNow += 60_000;
  tickInterval();
  assert(e.getState() === "finished", "backgrounded for full duration → finished (not stuck running)");
  assert(e.getRemainingMs() === 0, "backgrounded timer reads 0, not 60-1=59");
  e.destroy();
}

// Test 3: pause preserves exact remaining; resume continues correctly
{
  const e = new CountdownEngine();
  e.start(60_000);
  mockNow += 20_000; // 40s remain
  e.pause();
  assert(e.getState() === "paused", "paused state set");
  assert(e.getRemainingMs() === 40_000, "paused at exactly 40s (not 39/41)");

  // Wait 5 min while paused — remaining must NOT decrease
  mockNow += 300_000;
  assert(e.getRemainingMs() === 40_000, "remaining unchanged while paused for 5min");

  // Resume: new endTimestamp = now + 40s
  e.resume();
  assert(e.getState() === "running", "resumed to running");
  mockNow += 15_000;
  tickInterval();
  assert(e.getRemainingMs() === 25_000, "after 15s post-resume, 25s remain");
  e.destroy();
}

// Test 4: reset restores original duration → idle
{
  const e = new CountdownEngine();
  e.start(45_000);
  mockNow += 30_000;
  e.reset();
  assert(e.getState() === "idle", "reset → idle");
  assert(e.getRemainingMs() === 45_000, "reset restores original 45s");
  e.destroy();
}

// Test 5: rejects invalid input safely
{
  const e = new CountdownEngine();
  e.start(NaN);
  assert(e.getState() === "idle", "NaN duration → no start, stays idle");
  e.start(-100);
  assert(e.getState() === "idle", "negative duration → no start");
  e.destroy();
}

console.log("\nStopwatchEngine — accuracy tests\n");

// Test 6: stopwatch counts up correctly, pause preserves elapsed
{
  const s = new StopwatchEngine();
  s.start();
  mockNow += 10_000;
  tickInterval();
  assert(s.getElapsedMs() === 10_000, "10s elapsed after start");

  s.pause();
  mockNow += 999_999; // long pause
  assert(s.getElapsedMs() === 10_000, "elapsed frozen during pause");

  s.start(); // resume
  mockNow += 5_000;
  tickInterval();
  assert(s.getElapsedMs() === 15_000, "accumulated elapsed across pause segment");
  s.destroy();
}

// Test 7: lap recording
{
  const s = new StopwatchEngine();
  s.start();
  mockNow += 10_000;
  s.lap();
  mockNow += 5_000;
  s.lap();
  const laps = s.getLaps();
  assert(laps.length === 2, "two laps recorded");
  assert(laps[0] === 10_000 && laps[1] === 15_000, "lap timestamps correct");
  s.destroy();
}

// ---- Restore ----
Date.now = realDateNow;
globalThis.setInterval = realSetInterval;
globalThis.clearInterval = realClearInterval;

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed > 0 ? 1 : 0);
