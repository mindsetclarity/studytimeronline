import { Alarm } from "../lib/alarm";
import { BRAND } from "../lib/brand";
import { formatHms, formatHmsForced, formatTabTitle } from "../lib/formatTime";
import { exitFullscreen, isFullscreen, toggleFullscreen } from "../lib/fullscreen";
import { showNotification } from "../lib/notification";
import { readPlannerTasks, writePlannerTasks } from "../lib/planner";
import { read, studyDurationMin, studyTask, write } from "../lib/storage";
import { recordCompletedStudySession } from "../lib/sessions";
import { CountdownEngine, StopwatchEngine, type StateDetail, type TickDetail } from "../lib/timerEngine";
import { addXP } from "../lib/gamification";
import { cancelSpeech, isVoiceEnabled, isVoiceSupported, setVoiceEnabled, speakTimerMessage } from "../lib/voice";

type StudyMode = "countup" | "countdown" | "pomodoro" | "exam";
type CockpitState = "idle" | "running" | "paused" | "finished";

interface StudySessionRecord {
  task: string;
  minutes: number;
  durationMs: number;
  mode: StudyMode;
  subject?: string;
  plannerTaskId?: string;
  notes: string;
  finishedAt: string;
}

interface ModeConfig {
  label: string;
  defaultMinutes: number;
  durationLabel: string;
  guidance: string;
}

const MODE_CONFIG: Record<StudyMode, ModeConfig> = {
  countup: {
    label: "Count Up",
    defaultMinutes: 0,
    durationLabel: "Duration In Minutes",
    guidance: "Use Count Up when the task matters more than a fixed stopping time.",
  },
  countdown: {
    label: "Countdown",
    defaultMinutes: 45,
    durationLabel: "Duration In Minutes",
    guidance: "Use a fixed block when you know how long you want to study.",
  },
  pomodoro: {
    label: "Pomodoro",
    defaultMinutes: 25,
    durationLabel: "Timer Minutes",
    guidance: "Finish one focused interval, then take a deliberate 5-minute break.",
  },
  exam: {
    label: "Exam Practice",
    defaultMinutes: 60,
    durationLabel: "Practice Duration In Minutes",
    guidance: "Use a strict limit and leave review until the timer finishes.",
  },
};

function qs<T extends Element>(root: ParentNode, selector: string): T | null {
  return root.querySelector<T>(selector);
}

function qsa<T extends Element>(root: ParentNode, selector: string): T[] {
  return Array.from(root.querySelectorAll<T>(selector));
}

function isStudyMode(value: string | null | undefined): value is StudyMode {
  return value === "countup" || value === "countdown" || value === "pomodoro" || value === "exam";
}

function setupStudyCockpit(root: HTMLElement): void {
  const countdown = new CountdownEngine();
  const stopwatch = new StopwatchEngine();
  const alarm = new Alarm();
  const originalTitle = document.title;
  const params = new URLSearchParams(window.location.search);
  const plannerTaskId = params.get("plannerTask") || "";
  const source = params.get("source") || "";

  const display = qs<HTMLElement>(root, "[data-timer-display]");
  const detail = qs<HTMLElement>(root, "[data-session-detail]");
  const progressWrap = qs<HTMLElement>(root, "[data-progress-wrap]");
  const progressFill = qs<HTMLElement>(root, "[data-progress-fill]");
  const intentionInput = qs<HTMLInputElement>(root, "[data-intention]");
  const durationInput = qs<HTMLInputElement>(root, "[data-duration]");
  const durationSetup = qs<HTMLElement>(root, "[data-duration-setup]");
  const durationLabel = qs<HTMLElement>(root, "[data-duration-label]");
  const notesInput = qs<HTMLTextAreaElement>(root, "[data-session-notes]");
  const currentIntention = qs<HTMLElement>(root, "[data-current-intention]");
  const modeLabel = qs<HTMLElement>(root, "[data-mode-label]");
  const modeGuidance = qs<HTMLElement>(root, "[data-mode-guidance]");
  const stateLabel = qs<HTMLElement>(root, "[data-session-state]");
  const startButton = qs<HTMLButtonElement>(root, "[data-start]");
  const pauseButton = qs<HTMLButtonElement>(root, "[data-pause]");
  const finishButton = qs<HTMLButtonElement>(root, "[data-finish]");
  const resetButton = qs<HTMLButtonElement>(root, "[data-reset]");
  const summary = qs<HTMLElement>(root, "[data-session-summary]");
  const stage = qs<HTMLElement>(root, "[data-study-stage]");

  const voiceToggle = qs<HTMLButtonElement>(root, "[data-voice-toggle]");
  let voiceEnabled = isVoiceEnabled();
  const spokenCheckpoints = new Set<number>();
  const spokenEvents = new Set<string>();

  if (voiceToggle && !isVoiceSupported()) {
    voiceToggle.hidden = true;
  } else if (voiceToggle) {
    voiceToggle.setAttribute("aria-checked", String(voiceEnabled));
    voiceToggle.addEventListener("click", () => {
      voiceEnabled = !voiceEnabled;
      setVoiceEnabled(voiceEnabled);
      voiceToggle.setAttribute("aria-checked", String(voiceEnabled));
    });
  }

  const fixedMode = isStudyMode(root.dataset.studyFixedMode) ? root.dataset.studyFixedMode : null;
  const storedMode = read<StudyMode>("studyCockpitMode", "countdown");
  const urlMode = params.get("mode");
  let mode: StudyMode = fixedMode ?? (isStudyMode(urlMode) ? urlMode : isStudyMode(storedMode) ? storedMode : "countdown");
  let state: CockpitState = "idle";
  let completing = false;

  const sharedMinutes = Number(params.get("minutes"));
  const storedStudyMinutes = read<number>("studyDurationMin", MODE_CONFIG.countdown.defaultMinutes);
  const initialMinutes = Number.isFinite(sharedMinutes) && sharedMinutes > 0
    ? Math.min(360, Math.floor(sharedMinutes))
    : mode === "countup" || mode === "countdown"
      ? storedStudyMinutes
      : MODE_CONFIG[mode].defaultMinutes;

  if (intentionInput) intentionInput.value = params.get("task") ?? studyTask.get();
  if (durationInput) durationInput.value = String(initialMinutes || 45);
  if (notesInput) notesInput.value = read<string>("studyCockpitDraftNotes", "");

  const durationMinutes = (): number => {
    const value = Number(durationInput?.value ?? 0);
    return Number.isFinite(value) ? Math.max(1, Math.min(360, Math.floor(value))) : 0;
  };

  const intention = (): string => intentionInput?.value.trim() || "";
  const notes = (): string => notesInput?.value.trim() || "";

  const formatForMode = (ms: number): string => mode === "countup" || mode === "exam" ? formatHmsForced(ms) : formatHms(ms);

  let lastFormattedDisplay = "";
  const setDisplay = (ms: number): void => {
    const formatted = formatForMode(ms);
    if (formatted !== lastFormattedDisplay) {
      lastFormattedDisplay = formatted;
      if (display) display.textContent = formatted;
    }
  };

  let lastProgressWidth = -1;
  const setProgress = (progress: number): void => {
    const widthRounded = Math.round(Math.max(0, Math.min(100, progress * 100)) * 10) / 10;
    if (widthRounded !== lastProgressWidth) {
      lastProgressWidth = widthRounded;
      if (progressFill) progressFill.style.width = `${widthRounded}%`;
    }
  };

  let lastTabTitle = "";
  const updateTabTitle = (ms: number): void => {
    if (state !== "running") return;
    const nextTitle = formatTabTitle(ms, BRAND);
    if (nextTitle !== lastTabTitle) {
      lastTabTitle = nextTitle;
      document.title = nextTitle;
    }
  };

  const updateIntentionLabel = (): void => {
    if (currentIntention) currentIntention.textContent = intention() || "No Study Intention Yet";
  };

  const updateUrl = (): void => {
    const next = new URLSearchParams();
    next.set("mode", mode);
    if (intention()) next.set("task", intention());
    if (mode !== "countup") next.set("minutes", String(durationMinutes()));
    const query = next.toString();
    history.replaceState(null, "", `${window.location.pathname}${query ? `?${query}` : ""}`);
  };

  const setState = (next: CockpitState): void => {
    state = next;
    root.dataset.timerState = next;
    document.body.classList.toggle("is-focusing", next === "running");
    if (stage) stage.dataset.timerState = next;
    if (stateLabel) stateLabel.textContent = next === "running" ? "Running" : next === "paused" ? "Paused" : next === "finished" ? "Complete" : "Ready";
    if (startButton) {
      if (!startButton.dataset.defaultLabel) startButton.dataset.defaultLabel = startButton.textContent?.trim() || "Start Timer";
      startButton.textContent = next === "paused" ? "Resume Timer" : next === "running" ? "Running" : startButton.dataset.defaultLabel || "Start Timer";
      startButton.disabled = next === "running" || next === "finished";
    }
    if (pauseButton) pauseButton.disabled = next !== "running";
    if (finishButton) finishButton.disabled = next === "idle" || next === "finished";
    if (resetButton) resetButton.disabled = next === "idle";

    const locked = next === "running" || next === "paused" || next === "finished";
    qsa<HTMLButtonElement>(root, "[data-study-mode]").forEach((button) => {
      button.disabled = locked;
    });
    qsa<HTMLButtonElement>(root, "[data-preset-minutes]").forEach((button) => {
      button.disabled = locked;
    });
    if (durationInput) durationInput.disabled = locked || mode === "countup";
    if (intentionInput) intentionInput.disabled = locked;
    const customChip = qs<HTMLElement>(root, ".compact-chip-custom");
    if (customChip) {
      customChip.classList.toggle("is-disabled", locked || mode === "countup");
    }
  };

  const modeDetail = (): string => {
    if (mode === "countup") return "Open-ended study session";
    const minutes = durationMinutes();
    if (mode === "pomodoro") return `${minutes}-minute focus, then a 5-minute break`;
    if (mode === "exam") return `${minutes}-minute timed practice`;
    return `${minutes}-minute focused study block`;
  };

  const updatePresetState = (): void => {
    const minutes = durationMinutes();
    let anyPresetMatched = false;
    qsa<HTMLButtonElement>(root, "[data-preset-minutes]").forEach((button) => {
      const isMatch = Number(button.dataset.presetMinutes) === minutes;
      if (isMatch) anyPresetMatched = true;
      button.setAttribute("aria-pressed", String(isMatch));
    });
    const customChip = qs<HTMLElement>(root, ".compact-chip-custom");
    if (customChip) {
      customChip.setAttribute("aria-pressed", String(!anyPresetMatched));
    }
  };

  const renderIdle = (): void => {
    setDisplay(mode === "countup" ? 0 : durationMinutes() * 60 * 1000);
    setProgress(0);
    if (detail) detail.textContent = modeDetail();
    updatePresetState();
  };

  const applyMode = (nextMode: StudyMode, useDefault: boolean): void => {
    mode = nextMode;
    root.dataset.studyMode = mode;
    if (stage) stage.dataset.studyMode = mode;
    write("studyCockpitMode", mode);
    qsa<HTMLButtonElement>(root, "[data-study-mode]").forEach((button) => {
      button.setAttribute("aria-pressed", String(button.dataset.studyMode === mode));
    });
    if (durationSetup) durationSetup.hidden = mode === "countup";
    if (progressWrap) progressWrap.hidden = mode === "countup";
    if (durationLabel) durationLabel.textContent = MODE_CONFIG[mode].durationLabel;
    if (modeLabel) modeLabel.textContent = MODE_CONFIG[mode].label;
    if (modeGuidance) modeGuidance.textContent = MODE_CONFIG[mode].guidance;
    if (useDefault && mode !== "countup" && durationInput) durationInput.value = String(MODE_CONFIG[mode].defaultMinutes);
    renderIdle();
    updateUrl();
  };

  const runningDetail = (): string => {
    if (mode === "countup") return "Open-ended session in progress";
    const end = new Date(Date.now() + countdown.getRemainingMs());
    const time = new Intl.DateTimeFormat(navigator.languages, { hour: "numeric", minute: "2-digit" }).format(end);
    if (mode === "pomodoro") return `Study until ${time}, then take a 5-minute break`;
    if (mode === "exam") return `Practice ends at ${time}`;
    return `Study until ${time}`;
  };

  const saveDraft = (): void => {
    studyTask.set(intention());
    if (mode !== "countup") studyDurationMin.set(durationMinutes());
    write("studyCockpitDraftNotes", notesInput?.value ?? "");
    updateUrl();
  };

  const formatSummaryDuration = (ms: number): string => {
    const formatter = new Intl.NumberFormat(navigator.languages);
    const totalSeconds = Math.max(0, Math.round(ms / 1000));
    if (totalSeconds < 60) return `${formatter.format(totalSeconds)} sec`;
    const totalMinutes = Math.max(1, Math.round(totalSeconds / 60));
    if (totalMinutes < 60) return `${formatter.format(totalMinutes)} min`;
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    return minutes > 0 ? `${formatter.format(hours)} hr ${formatter.format(minutes)} min` : `${formatter.format(hours)} hr`;
  };

  const nextAction = (): string => {
    if (mode === "pomodoro") return "Take a quiet 5-minute break, then decide whether the same task needs another interval.";
    if (mode === "exam") return "Mark the practice paper while the difficult questions are still fresh in your mind.";
    if (mode === "countup") return "Write one sentence about where to restart, then choose whether to continue or stop.";
    return "Take a short break, then choose the next specific task from your plan.";
  };

  const plannerSubject = (): string => {
    if (!plannerTaskId) return "";
    return readPlannerTasks().find((task) => task.id === plannerTaskId)?.subject || "";
  };

  const recordSession = (elapsedMs: number): void => {
    if (source === "planner" && plannerTaskId) {
      const subject = plannerSubject();
      recordCompletedStudySession({
        task: intention() || "Study Session",
        minutes: Math.max(1, Math.round(elapsedMs / 60000)),
        durationMs: Math.max(0, Math.round(elapsedMs)),
        mode,
        subject: subject || undefined,
        plannerTaskId: plannerTaskId || undefined,
        notes: notes(),
        finishedAt: new Date().toISOString(),
        source: "timer",
        status: "completed"
      });
      
      const tasks = readPlannerTasks();
      const updated = tasks.map(t => t.id === plannerTaskId ? { ...t, status: "done" as const } : t);
      writePlannerTasks(updated);
    }
  };

  const completeSession = (elapsedMs: number, automatic: boolean): void => {
    if (completing || elapsedMs <= 0) return;
    completing = true;
    setDisplay(automatic && mode !== "countup" ? 0 : elapsedMs);
    setProgress(1);
    if (detail) detail.textContent = "Session complete.";
    recordSession(elapsedMs);
    addXP(elapsedMs / 60000);
    write("studyCockpitDraftNotes", "");

    const summaryMode = qs<HTMLElement>(root, "[data-summary-mode]");
    const summaryDuration = qs<HTMLElement>(root, "[data-summary-duration]");
    const summaryTask = qs<HTMLElement>(root, "[data-summary-task]");
    const summaryNotes = qs<HTMLElement>(root, "[data-summary-notes]");
    const summaryNotesWrap = qs<HTMLElement>(root, "[data-summary-notes-wrap]");
    const summaryNext = qs<HTMLElement>(root, "[data-summary-next]");
    if (summaryMode) summaryMode.textContent = MODE_CONFIG[mode].label;
    if (summaryDuration) summaryDuration.textContent = formatSummaryDuration(elapsedMs);
    if (summaryTask) summaryTask.textContent = intention() || "Study Session";
    if (summaryNotes) summaryNotes.textContent = notes();
    if (summaryNotesWrap) summaryNotesWrap.hidden = !notes();
    if (summaryNext) summaryNext.textContent = nextAction();
    if (summary) {
      summary.hidden = false;
      summary.focus({ preventScroll: false });
    }
    setState("finished");
    document.title = originalTitle;
    if (automatic) {
      if (mode !== "countup" && !spokenEvents.has("timer-complete")) {
        spokenEvents.add("timer-complete");
        speakTimerMessage("Time over.");
      }
      alarm.play();
      showNotification(`${BRAND} session complete`, `${intention() || "Study session"} is complete.`);
    }
    completing = false;
  };

  const resetSession = (clearNotes = false): void => {
    completing = true;
    cancelSpeech();
    spokenCheckpoints.clear();
    spokenEvents.clear();
    countdown.clear();
    stopwatch.reset();
    completing = false;
    if (clearNotes && notesInput) {
      notesInput.value = "";
      write("studyCockpitDraftNotes", "");
    }
    if (summary) summary.hidden = true;
    setState("idle");
    renderIdle();
    document.title = originalTitle;
  };

  qsa<HTMLButtonElement>(root, "[data-study-mode]").forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.studyMode;
      if (!isStudyMode(next) || state !== "idle") return;
      applyMode(next, true);
    });
  });

  qsa<HTMLButtonElement>(root, "[data-preset-minutes]").forEach((button) => {
    button.addEventListener("click", () => {
      if (!durationInput || state !== "idle") return;
      durationInput.value = button.dataset.presetMinutes ?? "45";
      studyDurationMin.set(durationMinutes());
      renderIdle();
      updateUrl();
    });
  });

  const customChip = qs<HTMLElement>(root, ".compact-chip-custom");
  customChip?.addEventListener("click", (e) => {
    if (state !== "idle" || mode === "countup") return;
    if (e.target !== durationInput) {
      durationInput?.focus();
      durationInput?.select();
    }
  });

  intentionInput?.addEventListener("input", updateIntentionLabel);
  intentionInput?.addEventListener("change", saveDraft);
  notesInput?.addEventListener("change", () => write("studyCockpitDraftNotes", notesInput.value));
  durationInput?.addEventListener("input", () => {
    if (state !== "idle") return;
    renderIdle();
  });
  durationInput?.addEventListener("change", saveDraft);

  startButton?.addEventListener("click", () => {
    if (intentionInput && !intention()) {
      if (detail) detail.textContent = "Add a Timer Intention before starting.";
      intentionInput?.focus();
      return;
    }
    alarm.unlock();
    saveDraft();
    if (summary) summary.hidden = true;
    if (state === "paused") {
      if (mode === "countup") stopwatch.start();
      else countdown.resume();
      return;
    }
    if (mode === "countup") {
      stopwatch.start();
    } else {
      spokenCheckpoints.clear();
      spokenEvents.clear();
      if (!spokenEvents.has("timer-started")) {
        spokenEvents.add("timer-started");
        speakTimerMessage("Timer started.");
      }
      countdown.start(durationMinutes() * 60 * 1000);
    }
  });

  pauseButton?.addEventListener("click", () => {
    if (mode === "countup") stopwatch.pause();
    else countdown.pause();
  });

  finishButton?.addEventListener("click", () => {
    const elapsed = mode === "countup"
      ? stopwatch.getElapsedMs()
      : Math.max(0, countdown.getTotalMs() - countdown.getRemainingMs());
    completing = true;
    if (mode === "countup") stopwatch.pause();
    else countdown.pause();
    completing = false;
    completeSession(elapsed, false);
  });

  resetButton?.addEventListener("click", () => resetSession(false));

  const fullscreenBtn = qs<HTMLButtonElement>(root, "[data-fullscreen]");
  const stageEl = qs<HTMLElement>(root, "[data-study-stage]") ?? root;

  function handleFullscreenChange() {
    const isFull = Boolean(document.fullscreenElement);
    if (isFull) {
      stageEl.dataset.fullscreen = "true";
    } else {
      stageEl.removeAttribute("data-fullscreen");
      try {
        screen.orientation?.unlock?.();
      } catch {}
    }
    if (fullscreenBtn) {
      fullscreenBtn.textContent = isFull ? "Exit" : "Fullscreen";
      fullscreenBtn.setAttribute("aria-label", isFull ? "Exit fullscreen" : "Enter fullscreen");
    }
  }

  fullscreenBtn?.addEventListener("click", async () => {
    if (document.fullscreenElement) {
      await exitFullscreen();
    } else {
      await toggleFullscreen(stageEl);
    }
  });

  document.addEventListener("fullscreenchange", handleFullscreenChange);
  handleFullscreenChange();

  qs<HTMLButtonElement>(root, "[data-start-another]")?.addEventListener("click", () => {
    resetSession(true);
    intentionInput?.focus();
    intentionInput?.select();
  });

  countdown.addEventListener("tick", (event) => {
    if (mode === "countup") return;
    const tick = (event as CustomEvent<TickDetail>).detail;
    setDisplay(tick.remainingMs);
    setProgress(tick.progress);
    updateTabTitle(tick.remainingMs);

    if (state === "running") {
      const elapsedSeconds = Math.floor((countdown.getTotalMs() - tick.remainingMs) / 1000);
      const elapsedMinutes = Math.floor(elapsedSeconds / 60);

      if (elapsedMinutes > 0 && elapsedMinutes % 15 === 0) {
        if (!spokenCheckpoints.has(elapsedMinutes)) {
          spokenCheckpoints.add(elapsedMinutes);
          const remainingMinutes = Math.ceil(tick.remainingMs / 60000);
          if (remainingMinutes > 0) {
            speakTimerMessage(`${remainingMinutes} minutes left.`);
          }
        }
      }
    }
  });

  countdown.addEventListener("state", (event) => {
    if (mode === "countup" || completing) return;
    const next = (event as CustomEvent<StateDetail>).detail.state;
    setState(next);
    if (next === "running" && detail) detail.textContent = runningDetail();
    if (next === "paused" && detail) detail.textContent = "Paused. Continue when you are ready.";
  });

  countdown.addEventListener("finish", () => {
    if (mode === "countup") return;
    setDisplay(0);
    setProgress(1);
    completeSession(countdown.getTotalMs(), true);
  });

  stopwatch.addEventListener("tick", () => {
    if (mode !== "countup") return;
    const elapsed = stopwatch.getElapsedMs();
    setDisplay(elapsed);
    updateTabTitle(elapsed);
  });

  stopwatch.addEventListener("state", () => {
    if (mode !== "countup" || completing) return;
    if (stopwatch.isRunning()) {
      setState("running");
      if (detail) detail.textContent = runningDetail();
    } else if (state === "running") {
      setState("paused");
      if (detail) detail.textContent = "Paused. Continue when you are ready.";
    }
  });

  updateIntentionLabel();
  applyMode(mode, false);
  setState("idle");

  window.addEventListener("pagehide", () => {
    countdown.destroy();
    stopwatch.destroy();
    void exitFullscreen();
    document.removeEventListener("fullscreenchange", handleFullscreenChange);
    cancelSpeech();
  });
}

document.querySelectorAll<HTMLElement>("[data-study-cockpit]").forEach(setupStudyCockpit);

export {};





