import { read, write } from "./storage";

export type PlannerTaskStatus = "planned" | "done" | "skipped";

export interface PlannerTask {
  id: string;
  subject: string;
  title: string;
  minutes: number;
  status: PlannerTaskStatus;
  createdAt: string;
  updatedAt: string;
}

interface LegacyPlannerTask {
  id?: string;
  subject?: string;
  title?: string;
  task?: string;
  minutes?: number;
  done?: boolean;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
}

const STORAGE_KEY = "plannerTasks";
const MAX_TASKS = 40;

function isPlannerStatus(value: unknown): value is PlannerTaskStatus {
  return value === "planned" || value === "done" || value === "skipped";
}

function cleanMinutes(value: unknown): number {
  const minutes = Number(value);
  return Number.isFinite(minutes) ? Math.max(1, Math.min(360, Math.floor(minutes))) : 45;
}

function normalizeTask(task: LegacyPlannerTask, index: number): PlannerTask | null {
  const title = String(task.title ?? task.task ?? "").trim();
  if (!title) return null;

  const now = new Date().toISOString();
  let status = isPlannerStatus(task.status) ? task.status : task.done ? "done" : "planned";
  if (task.status === "later") status = "planned";

  return {
    id: String(task.id || `planner-${Date.now()}-${index}`),
    subject: String(task.subject ?? "").trim(),
    title,
    minutes: cleanMinutes(task.minutes),
    status,
    createdAt: task.createdAt || now,
    updatedAt: task.updatedAt || now,
  };
}

export function readPlannerTasks(): PlannerTask[] {
  const raw = read<LegacyPlannerTask[]>(STORAGE_KEY, []);
  if (!Array.isArray(raw)) return [];

  const tasks = raw.map(normalizeTask).filter((task): task is PlannerTask => Boolean(task));
  return sortPlannerQueue(tasks).slice(0, MAX_TASKS);
}

export function writePlannerTasks(tasks: PlannerTask[]): void {
  write(STORAGE_KEY, sortPlannerQueue(tasks).slice(0, MAX_TASKS));
}

export function isActivePlannerTask(task: PlannerTask): boolean {
  return task.status === "planned";
}

export function sortPlannerQueue(tasks: PlannerTask[]): PlannerTask[] {
  const order: Record<PlannerTaskStatus, number> = {
    planned: 0,
    done: 1,
    skipped: 2,
  };

  return [...tasks].sort((a, b) => {
    const statusDiff = order[a.status] - order[b.status];
    if (statusDiff !== 0) return statusDiff;
    return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
  });
}

export function createPlannerTask(input: { subject: string; title: string; minutes: number }): PlannerTask {
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID ? crypto.randomUUID() : `planner-${Date.now()}`,
    subject: input.subject.trim(),
    title: input.title.trim(),
    minutes: cleanMinutes(input.minutes),
    status: "planned",
    createdAt: now,
    updatedAt: now,
  };
}
