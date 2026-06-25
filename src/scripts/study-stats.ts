import { readPlannerTasks } from "../lib/planner";
import { readSessions, type StudySessionRecord } from "../lib/sessions";

interface NormalizedSession {
  task: string;
  subject: string;
  minutes: number;
  mode: string;
  finishedAt: Date;
}

interface DaySummary {
  date: Date;
  start: number;
  minutes: number;
  label: string;
}

const DAY_MS = 24 * 60 * 60 * 1000;

function numberFormatter(): Intl.NumberFormat {
  return new Intl.NumberFormat(navigator.languages);
}

function startOfDay(date: Date): number {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy.getTime();
}

function normalizeSessions(): NormalizedSession[] {
  const plannerTasks = readPlannerTasks();
  const subjectById = new Map(plannerTasks.map((task) => [task.id, task.subject || "Study"]));
  const subjectByTitle = new Map(plannerTasks.map((task) => [task.title.trim().toLowerCase(), task.subject || "Study"]));

  return readSessions()
    .map((session): NormalizedSession | null => {
      const finishedAt = session.finishedAt ? new Date(session.finishedAt) : null;
      if (!finishedAt || Number.isNaN(finishedAt.getTime())) return null;
      if (session.status && session.status !== "completed") return null;

      const minutes = Number.isFinite(session.minutes) && Number(session.minutes) > 0
        ? Math.max(1, Math.round(Number(session.minutes)))
        : Math.max(1, Math.round(Number(session.durationMs || 0) / 60000));
      const task = String(session.task || "Study Session").trim() || "Study Session";
      const subject = String(
        session.subject
          || (session.plannerTaskId ? subjectById.get(session.plannerTaskId) : "")
          || subjectByTitle.get(task.toLowerCase())
          || (session.mode === "exam" ? "Exam Practice" : "Study"),
      ).trim() || "Study";

      return {
        task,
        subject,
        minutes,
        mode: String(session.mode || "study"),
        finishedAt,
      };
    })
    .filter((session): session is NormalizedSession => Boolean(session))
    .sort((a, b) => b.finishedAt.getTime() - a.finishedAt.getTime());
}

function set(root: ParentNode, selector: string, value: string): void {
  const element = root.querySelector<HTMLElement>(selector);
  if (element) element.textContent = value;
}

function minutesNumber(items: NormalizedSession[]): number {
  return items.reduce((sum, item) => sum + item.minutes, 0);
}

function formatMinutes(value: number): string {
  const formatter = numberFormatter();
  if (value < 60) return `${formatter.format(value)} min`;
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return minutes > 0 ? `${formatter.format(hours)} hr ${formatter.format(minutes)} min` : `${formatter.format(hours)} hr`;
}

function formatMode(mode: string): string {
  if (mode === "pomodoro") return "Pomodoro";
  if (mode === "exam") return "Exam Practice";
  if (mode === "countup") return "Count Up";
  if (mode === "countdown") return "Countdown";
  return "Study Timer";
}

function sessionsForDay(sessions: NormalizedSession[], dayStart: number): NormalizedSession[] {
  const dayEnd = dayStart + DAY_MS;
  return sessions.filter((session) => {
    const time = session.finishedAt.getTime();
    return time >= dayStart && time < dayEnd;
  });
}

function buildDaySummaries(sessions: NormalizedSession[], todayStart: number, count: number): DaySummary[] {
  const dayFormatter = new Intl.DateTimeFormat(navigator.languages, { weekday: "short" });
  return Array.from({ length: count }, (_, index) => {
    const start = todayStart - (count - 1 - index) * DAY_MS;
    const date = new Date(start);
    return {
      date,
      start,
      minutes: minutesNumber(sessionsForDay(sessions, start)),
      label: dayFormatter.format(date),
    };
  });
}

function steadyDays(sessions: NormalizedSession[], todayStart: number): number {
  let count = 0;
  for (let day = todayStart; day >= todayStart - 90 * DAY_MS; day -= DAY_MS) {
    if (sessionsForDay(sessions, day).length === 0) break;
    count += 1;
  }
  return count;
}

function steadyDaysLabel(days: number): string {
  if (days === 0) return "Quiet start";
  if (days === 1) return "1 steady day";
  return `${numberFormatter().format(days)} steady days`;
}

function rhythmCopy(streak: number, sessions: NormalizedSession[], todayMinutes: number): { headline: string; detail: string; pace: string; next: string } {
  if (sessions.length === 0) {
    return {
      headline: "Your rhythm is waiting.",
      detail: "Complete one focused session and this page will begin to take shape.",
      pace: "Ready when you are",
      next: "Choose one clear task.",
    };
  }

  if (streak >= 3) {
    return {
      headline: `${numberFormatter().format(streak)} steady days`,
      detail: "Your rhythm is forming. Keep the next session small, clear, and easy to begin.",
      pace: todayMinutes > 0 ? "Settled into focus" : "Open a gentle block",
      next: "Repeat the clearest subject.",
    };
  }

  if (streak === 2) {
    return {
      headline: "2 steady days",
      detail: "A pattern is starting to appear. Let today's session stay simple.",
      pace: todayMinutes > 0 ? "Building calmly" : "One block keeps it visible",
      next: "Start with the next planned task.",
    };
  }

  if (streak === 1) {
    return {
      headline: "1 steady day",
      detail: todayMinutes > 0 ? "You have already made today count." : "Yesterday gave you a base. Today can stay light.",
      pace: todayMinutes > 0 ? "Today has motion" : "A quiet return is enough",
      next: "Pick a 25 minute focus block.",
    };
  }

  return {
    headline: "A calm reset",
    detail: "Your past sessions are still here. Begin again with one honest block.",
    pace: "Fresh start available",
    next: "Plan one short session.",
  };
}

function todayDetail(minutes: number): string {
  if (minutes === 0) return "Start with one honest study block.";
  if (minutes < 25) return "A gentle start already counts.";
  if (minutes < 60) return "A steady block is already on the board.";
  if (minutes < 120) return "Deep work is taking shape today.";
  return "A substantial study day is forming.";
}

function topSubject(sessions: NormalizedSession[]): { subject: string; minutes: number } | null {
  const totals = new Map<string, number>();
  sessions.forEach((session) => totals.set(session.subject, (totals.get(session.subject) || 0) + session.minutes));
  const [subject, minutes] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || [];
  return subject ? { subject, minutes } : null;
}

function renderWeeklyBars(root: HTMLElement, sessions: NormalizedSession[], todayStart: number): void {
  const list = root.querySelector<HTMLElement>("[data-weekly-bars]");
  if (!list) return;

  const rangeFormatter = new Intl.DateTimeFormat(navigator.languages, { month: "short", day: "numeric" });
  const days = buildDaySummaries(sessions, todayStart, 7);
  const max = Math.max(1, ...days.map((day) => day.minutes));

  set(root, "[data-week-range]", `${rangeFormatter.format(days[0].date)} - ${rangeFormatter.format(days[6].date)}`);
  list.replaceChildren(...days.map((day, index) => {
    const item = document.createElement("div");
    const track = document.createElement("div");
    const fill = document.createElement("span");
    const value = document.createElement("strong");
    const label = document.createElement("small");

    item.className = "weekly-bar";
    item.dataset.today = String(index === days.length - 1);
    item.setAttribute("aria-label", `${day.label}: ${formatMinutes(day.minutes)} studied`);
    track.className = "weekly-bar__track";
    fill.style.height = day.minutes > 0 ? `${Math.max(8, Math.round((day.minutes / max) * 100))}%` : "0%";
    value.className = "tabular";
    value.textContent = String(day.minutes);
    label.textContent = day.label;
    track.append(fill);
    item.append(track, value, label);
    return item;
  }));
}

function renderHeatmap(root: HTMLElement, sessions: NormalizedSession[], todayStart: number): void {
  const heatmap = root.querySelector<HTMLElement>("[data-study-heatmap]");
  if (!heatmap) return;

  const days = buildDaySummaries(sessions, todayStart, 21);
  const max = Math.max(1, ...days.map((day) => day.minutes));
  const dateFormatter = new Intl.DateTimeFormat(navigator.languages, { month: "short", day: "numeric" });

  heatmap.replaceChildren(...days.map((day) => {
    const cell = document.createElement("span");
    const ratio = day.minutes / max;
    const level = day.minutes === 0 ? 0 : ratio < 0.25 ? 1 : ratio < 0.5 ? 2 : ratio < 0.8 ? 3 : 4;

    cell.className = "study-heatmap__cell";
    cell.dataset.level = String(level);
    cell.setAttribute("aria-label", `${dateFormatter.format(day.date)}: ${formatMinutes(day.minutes)}`);
    cell.title = `${dateFormatter.format(day.date)} - ${formatMinutes(day.minutes)}`;
    return cell;
  }));
}

function renderSubjectBreakdown(root: HTMLElement, sessions: NormalizedSession[]): void {
  const list = root.querySelector<HTMLUListElement>("[data-subject-breakdown]");
  const empty = root.querySelector<HTMLElement>("[data-subject-empty]");
  if (!list || !empty) return;

  const totals = new Map<string, number>();
  sessions.forEach((session) => totals.set(session.subject, (totals.get(session.subject) || 0) + session.minutes));
  const rows = [...totals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6);
  const max = Math.max(1, ...rows.map((row) => row[1]));
  const total = rows.reduce((sum, row) => sum + row[1], 0);

  set(root, "[data-subject-total]", formatMinutes(total));
  empty.hidden = rows.length > 0;
  list.replaceChildren(...rows.map(([subject, minutes]) => {
    const item = document.createElement("li");
    const top = document.createElement("div");
    const name = document.createElement("strong");
    const value = document.createElement("span");
    const track = document.createElement("div");
    const fill = document.createElement("span");
    const percent = document.createElement("small");

    name.textContent = subject;
    value.textContent = formatMinutes(minutes);
    percent.textContent = total > 0 ? `${Math.round((minutes / total) * 100)}% of week` : "0% of week";
    track.className = "subject-breakdown__track";
    fill.style.width = `${Math.max(8, Math.round((minutes / max) * 100))}%`;
    top.append(name, value);
    track.append(fill);
    item.append(top, track, percent);
    return item;
  }));
}

function renderSessionHistory(root: HTMLElement, sessions: NormalizedSession[]): void {
  const list = root.querySelector<HTMLOListElement>("[data-session-list]");
  const empty = root.querySelector<HTMLElement>("[data-session-empty]");
  if (!list || !empty) return;

  const dateFormatter = new Intl.DateTimeFormat(navigator.languages, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  empty.hidden = sessions.length > 0;
  list.replaceChildren(...sessions.slice(0, 16).map((session) => {
    const item = document.createElement("li");
    const copy = document.createElement("span");
    const title = document.createElement("strong");
    const meta = document.createElement("small");
    const chips = document.createElement("span");
    const mode = document.createElement("span");
    const minutes = document.createElement("span");

    title.textContent = session.task;
    meta.textContent = `${session.subject} / ${dateFormatter.format(session.finishedAt)}`;
    chips.className = "session-history__chips";
    mode.textContent = formatMode(session.mode);
    minutes.className = "tabular";
    minutes.textContent = formatMinutes(session.minutes);
    chips.append(mode, minutes);
    copy.append(title, meta);
    item.append(copy, chips);
    return item;
  }));
}

function setupStats(root: HTMLElement): void {
  const sessions = normalizeSessions();
  const todayStart = startOfDay(new Date());
  const weekStart = todayStart - 6 * DAY_MS;
  const today = sessionsForDay(sessions, todayStart);
  const week = sessions.filter((session) => session.finishedAt.getTime() >= weekStart);
  const todayMinutes = minutesNumber(today);
  const weekMinutes = minutesNumber(week);
  const streak = steadyDays(sessions, todayStart);
  const rhythm = rhythmCopy(streak, sessions, todayMinutes);
  const bestSubject = topSubject(week);

  set(root, "[data-stat-today]", formatMinutes(todayMinutes));
  set(root, "[data-stat-today-detail]", todayDetail(todayMinutes));
  set(root, "[data-stat-week]", formatMinutes(weekMinutes));
  set(root, "[data-stat-week-note]", week.length === 1 ? "1 calm session this week" : `${numberFormatter().format(week.length)} calm sessions this week`);
  set(root, "[data-stat-sessions]", numberFormatter().format(sessions.length));
  set(root, "[data-stat-average]", sessions.length ? formatMinutes(Math.round(minutesNumber(sessions) / sessions.length)) : "0 min");
  set(root, "[data-stat-streak]", steadyDaysLabel(streak));
  set(root, "[data-stat-rhythm]", rhythm.headline);
  set(root, "[data-stat-rhythm-detail]", rhythm.detail);
  set(root, "[data-stat-pace]", rhythm.pace);
  set(root, "[data-stat-return-note]", rhythm.next);
  set(root, "[data-stat-best-subject]", bestSubject ? `${bestSubject.subject} / ${formatMinutes(bestSubject.minutes)}` : "No pattern yet");

  renderWeeklyBars(root, sessions, todayStart);
  renderHeatmap(root, sessions, todayStart);
  renderSubjectBreakdown(root, week);
  renderSessionHistory(root, sessions);
}

document.querySelectorAll<HTMLElement>("[data-study-stats]").forEach(setupStats);

export {};