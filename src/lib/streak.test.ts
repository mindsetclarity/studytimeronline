/** Run with: npm test */
import assert from "node:assert/strict";
import test from "node:test";
import { dayProgress, streakDays } from "./streak.ts";

const at = (y: number, m: number, d: number, h = 12) => new Date(y, m - 1, d, h);
const NOW = at(2026, 9, 16, 18);

test("no sessions today means no streak, even with history", () => {
  assert.equal(streakDays([at(2026, 9, 15), at(2026, 9, 14)], NOW), 0);
});

test("counts consecutive days ending today", () => {
  assert.equal(streakDays([at(2026, 9, 16), at(2026, 9, 15), at(2026, 9, 14)], NOW), 3);
});

test("a gap ends the streak", () => {
  assert.equal(streakDays([at(2026, 9, 16), at(2026, 9, 14)], NOW), 1);
});

test("several sessions on one day count once", () => {
  assert.equal(streakDays([at(2026, 9, 16, 9), at(2026, 9, 16, 20), at(2026, 9, 15)], NOW), 2);
});

test("streak crosses a month boundary", () => {
  assert.equal(streakDays([at(2026, 10, 1), at(2026, 9, 30)], at(2026, 10, 1, 18)), 2);
});

test("dayProgress totals today only and ignores unfinished records", () => {
  const p = dayProgress([
    { finishedAt: at(2026, 9, 16, 9).toISOString(), minutes: 25, status: "completed" },
    { finishedAt: at(2026, 9, 16, 11).toISOString(), durationMs: 45 * 60000 },
    { finishedAt: at(2026, 9, 16, 12).toISOString(), minutes: 30, status: "abandoned" },
    { finishedAt: at(2026, 9, 15, 12).toISOString(), minutes: 60, status: "completed" },
  ], NOW);
  assert.deepEqual(p, { todayMinutes: 70, todaySessions: 2, streak: 2 });
});
