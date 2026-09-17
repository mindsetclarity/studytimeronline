/**
 * Streak and "today" maths for finished study sessions. No imports, so it runs
 * under node:test as-is — see streak.test.ts.
 */

/** The fields this module reads; StudySessionRecord satisfies it. */
export interface SessionLike {
  finishedAt?: string;
  minutes?: number;
  durationMs?: number;
  status?: string;
}

/** Local calendar day, e.g. "2026-9-16". Calendar keys stay correct across DST. */
function dayKey(date: Date): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

/**
 * Consecutive days, ending today, with at least one finished session. A day
 * with nothing today means the streak is 0 — it has not been extended yet.
 */
export function streakDays(finishedAt: Date[], now: Date = new Date()): number {
  const days = new Set(finishedAt.filter((d) => !Number.isNaN(d.getTime())).map(dayKey));
  const cursor = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let count = 0;
  while (days.has(dayKey(cursor)) && count < 3650) {
    count += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return count;
}

export interface DayProgress {
  todayMinutes: number;
  todaySessions: number;
  streak: number;
}

/** What the completion screen shows right after a session is saved. */
export function dayProgress(sessions: SessionLike[], now: Date = new Date()): DayProgress {
  const completed = sessions.filter((s) => (!s.status || s.status === "completed") && s.finishedAt);
  const today = dayKey(now);
  let todayMinutes = 0;
  let todaySessions = 0;
  for (const s of completed) {
    if (dayKey(new Date(s.finishedAt!)) !== today) continue;
    todaySessions += 1;
    todayMinutes += Number(s.minutes) > 0 ? Math.round(Number(s.minutes)) : Math.round(Number(s.durationMs || 0) / 60000);
  }
  return { todayMinutes, todaySessions, streak: streakDays(completed.map((s) => new Date(s.finishedAt!)), now) };
}
