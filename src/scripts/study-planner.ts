import {
  createPlannerTask,
  isActivePlannerTask,
  readPlannerTasks,
  sortPlannerQueue,
  writePlannerTasks,
  type PlannerTask,
  type PlannerTaskStatus,
} from "../lib/planner";
import { recordCompletedStudySession } from "../lib/sessions";

type ActiveStatusAction = "planned" | "done" | "skipped";

const STATUS_LABELS: Record<PlannerTaskStatus, string> = {
  planned: "In Queue",
  done: "Done",
  skipped: "Skipped",
};

const STATUS_VERBS: Record<ActiveStatusAction, string> = {
  planned: "moved back to the queue",
  done: "marked done",
  skipped: "skipped",
};

function qs<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function qsa<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function isStatusAction(value: string | undefined): value is ActiveStatusAction {
  return value === "planned" || value === "done" || value === "skipped";
}

function setText(element: HTMLElement | null, value: string): void {
  if (element) element.textContent = value;
}

function activeTasks(tasks: PlannerTask[]): PlannerTask[] {
  return sortPlannerQueue(tasks.filter(isActivePlannerTask));
}

function finishedTasks(tasks: PlannerTask[]): PlannerTask[] {
  return tasks
    .filter((task) => task.status === "done" || task.status === "skipped")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

function createStartLink(task: PlannerTask, isUpNext: boolean): HTMLAnchorElement {
  const params = new URLSearchParams({
    mode: "countdown",
    task: task.title,
    minutes: String(task.minutes),
    plannerTask: task.id,
    source: "planner",
  });
  const link = document.createElement("a");
  link.className = "btn-start";
  link.href = `/timer?${params.toString()}`;
  link.textContent = isUpNext ? "Start Timer" : "Start";
  return link;
}

function createStatusButton(task: PlannerTask, status: ActiveStatusAction, label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.className = "btn-ghost";
  button.type = "button";
  button.dataset.taskStatusAction = status;
  button.dataset.taskId = task.id;
  button.textContent = label;
  button.setAttribute("aria-label", `${label} for ${task.title}`);
  return button;
}

function createTaskItem(task: PlannerTask, finished = false, isUpNext = false): HTMLElement {
  const container = document.createElement(isUpNext ? "div" : "li");
  container.className = isUpNext ? "up-next-card" : "task-row";

  const info = document.createElement("div");
  info.className = "task-info";

  const title = document.createElement("div");
  title.className = "task-title";
  title.textContent = task.title;

  const meta = document.createElement("div");
  meta.className = "task-meta";
  const badgeText = task.status !== "planned" ? `[${STATUS_LABELS[task.status]}] ` : "";
  meta.textContent = `${badgeText}${task.subject || "Study"} · ${task.minutes} min`;

  info.append(title, meta);

  const actions = document.createElement("div");
  actions.className = "task-actions";

  if (!finished) {
    actions.append(createStartLink(task, isUpNext));
    actions.append(createStatusButton(task, "done", "Done"));
    actions.append(createStatusButton(task, "skipped", "Skip"));
  } else {
    actions.append(createStatusButton(task, "planned", "Queue Again"));
  }
  
  const deleteBtn = createStatusButton(task, "delete" as any, "Delete");
  deleteBtn.className = "btn-ghost btn-delete";
  actions.append(deleteBtn);

  container.append(info, actions);
  return container;
}

function syncSubjectChips(root: ParentNode, subject: string): void {
  qsa<HTMLButtonElement>(root, "[data-subject-chip]").forEach((chip) => {
    chip.setAttribute("aria-pressed", String(chip.dataset.subjectChip === subject));
  });
}

function setupPlanner(root: HTMLElement): void {
  const form = qs<HTMLFormElement>(root, "[data-planner-form]");
  const upNextTarget = qs<HTMLElement>(root, "[data-up-next-render-target]");
  const queueContainer = qs<HTMLElement>(root, "#queue-container");
  const list = qs<HTMLUListElement>(root, "[data-planner-list]");
  const finishedSection = qs<HTMLElement>(root, "[data-finished-section]");
  const finishedList = qs<HTMLUListElement>(root, "[data-planner-finished]");
  const empty = qs<HTMLElement>(root, "[data-planner-empty]");
  const activeCount = qs<HTMLElement>(root, "[data-planner-active-count]");
  const doneCount = qs<HTMLElement>(root, "[data-planner-done-count]");
  const doneCountLabel = qs<HTMLElement>(root, "[data-planner-done-count-label]");
  const minutes = qs<HTMLElement>(root, "[data-planner-minutes]");
  const live = qs<HTMLElement>(root, "[data-planner-live]");

  const announce = (message: string): void => {
    setText(live, message);
  };

  const render = () => {
    const tasks = readPlannerTasks();
    const active = activeTasks(tasks);
    const finished = finishedTasks(tasks);
    const done = finished.filter((task) => task.status === "done");
    const activeMinutes = active.reduce((sum, task) => sum + task.minutes, 0);

    // Up Next logic
    if (upNextTarget) {
      upNextTarget.innerHTML = "";
      if (active.length > 0) {
        upNextTarget.append(createTaskItem(active[0], false, true));
      }
    }

    // Queue logic
    if (list) {
      list.innerHTML = "";
      if (active.length > 1) {
        list.append(...active.slice(1).map((task) => createTaskItem(task, false, false)));
      }
    }

    if (queueContainer) queueContainer.style.display = active.length > 1 ? "block" : "none";
    if (empty) empty.style.display = active.length === 0 ? "block" : "none";

    // Finished logic
    if (finishedList) {
      finishedList.innerHTML = "";
      finishedList.append(...finished.map((task) => createTaskItem(task, true, false)));
    }
    if (finishedSection) {
      finishedSection.style.display = finished.length > 0 ? "block" : "none";
    }

    setText(activeCount, String(active.length));
    setText(doneCount, String(done.length));
    if (doneCountLabel) setText(doneCountLabel, String(done.length));
    setText(minutes, String(activeMinutes));
  };

  const addTask = (subject: string, title: string, estimate: number): void => {
    const cleanTitle = title.trim();
    if (!cleanTitle) return;

    const task = createPlannerTask({ subject, title: cleanTitle, minutes: estimate });
    writePlannerTasks([...readPlannerTasks(), task]);
    announce(`${task.title} added to today's queue.`);
    render();
  };

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const title = String(data.get("task") || "").trim();
    if (!title) return;

    addTask(String(data.get("subject") || ""), title, Number(data.get("minutes") || 45));
    form.reset();
    const minutesInput = qs<HTMLInputElement>(form, "[data-planner-minutes-input]");
    if (minutesInput) minutesInput.value = "45";
    syncSubjectChips(root, "");
    
    // Hide form and reset focus to "Add Task" button if it exists
    const formContainer = qs<HTMLElement>(document.body, "#add-task-form");
    if (formContainer) formContainer.classList.remove("is-expanded");
    qs<HTMLElement>(document.body, "#toggle-add-task")?.focus();
  });

  qsa<HTMLButtonElement>(root, "[data-subject-chip]").forEach((button) => {
    button.addEventListener("click", () => {
      const subject = button.dataset.subjectChip || "";
      const subjectInput = form ? qs<HTMLInputElement>(form, "[data-planner-subject]") : null;
      if (subjectInput) subjectInput.value = subject;
      syncSubjectChips(root, subject);
      qs<HTMLInputElement>(root, "[data-planner-task]")?.focus();
    });
  });

  root.addEventListener("click", (event) => {
    const button = (event.target as Element).closest<HTMLButtonElement>("[data-task-status-action]");
    if (!button) return;
    const taskId = button.dataset.taskId;
    const nextStatus = button.dataset.taskStatusAction;
    if (!taskId) return;

    if (nextStatus === "delete") {
      if (window.confirm("Delete this task? This removes it from this device.")) {
        const tasks = readPlannerTasks();
        const taskToDelete = tasks.find(t => t.id === taskId);
        const updated = tasks.filter((task) => task.id !== taskId);
        writePlannerTasks(updated);
        if (taskToDelete) announce(`${taskToDelete.title} deleted.`);
        render();
      }
      return;
    }

    if (!isStatusAction(nextStatus)) return;

    const updated = readPlannerTasks().map((task) => task.id === taskId
      ? { ...task, status: nextStatus, updatedAt: new Date().toISOString() }
      : task);
    const changed = updated.find((task) => task.id === taskId);
    
    if (changed && nextStatus === "done") {
      recordCompletedStudySession({
        task: changed.title,
        subject: changed.subject,
        plannerTaskId: changed.id,
        minutes: changed.minutes,
        durationMs: changed.minutes * 60000,
        mode: "study",
        source: "manual_done",
        status: "completed",
        finishedAt: new Date().toISOString(),
      });
    }
    
    writePlannerTasks(updated);
    if (changed) announce(`${changed.title} ${STATUS_VERBS[nextStatus]}.`);
    render();
  });

  window.addEventListener("storage", (event) => {
    if (event.key === "study-timer-online:plannerTasks") render();
  });

  render();
}

document.querySelectorAll<HTMLElement>("[data-study-planner]").forEach(setupPlanner);

export {};