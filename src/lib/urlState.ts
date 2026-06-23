/**
 * URL state encoding — deep-linkable countdowns and shareable event/pomodoro
 * sessions. No backend; everything lives in query params.
 *
 * Encoded formats (kept short & human-readable):
 *   /countdown-timer?h=0&m=25&s=0&t=digital    → share a countdown setup
 *   /event-countdown?e=Birthday&at=2026-12-31T23:59   → share an event
 *   /pomodoro-timer?f=25&sb=5&lb=15&task=Maths   → share a pomodoro setup
 */

import { clampNonNegative } from "./formatTime";

export interface CountdownState {
  hours: number;
  minutes: number;
  seconds: number;
  mode?: "digital" | "flip";
}

export interface EventCountdownState {
  name: string;
  /** ISO datetime string, e.g. 2026-12-31T23:59 */
  at: string;
}

export interface PomodoroState {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  task: string;
}

// ---- countdown ----

export function writeCountdown(state: CountdownState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.hours > 0) p.set("h", String(state.hours));
  if (state.minutes > 0) p.set("m", String(state.minutes));
  if (state.seconds > 0) p.set("s", String(state.seconds));
  if (state.mode) p.set("t", state.mode === "flip" ? "flip" : "digital");
  return p;
}

export function readCountdown(params: URLSearchParams): CountdownState {
  return {
    hours: clampNonNegative(params.get("h")),
    minutes: clampNonNegative(params.get("m")),
    seconds: clampNonNegative(params.get("s")),
    mode: params.get("t") === "flip" ? "flip" : "digital",
  };
}

// ---- event countdown ----

export function writeEvent(state: EventCountdownState): URLSearchParams {
  const p = new URLSearchParams();
  if (state.name) p.set("e", state.name);
  if (state.at) p.set("at", state.at);
  return p;
}

export function readEvent(params: URLSearchParams): EventCountdownState {
  return {
    name: params.get("e") ?? "",
    at: params.get("at") ?? "",
  };
}

/** Validate an event datetime string. Returns null if valid, error message if not. */
export function validateEventDatetime(at: string): string | null {
  if (!at) return "Choose a date and time for your event.";
  const date = new Date(at);
  if (Number.isNaN(date.getTime())) return "That date doesn't look right.";
  if (date.getTime() <= Date.now()) {
    return "Pick a date and time in the future.";
  }
  return null;
}

// ---- pomodoro ----

export function writePomodoro(state: PomodoroState): URLSearchParams {
  const p = new URLSearchParams();
  p.set("f", String(state.focusMin));
  p.set("sb", String(state.shortBreakMin));
  p.set("lb", String(state.longBreakMin));
  if (state.task) p.set("task", state.task);
  return p;
}

export function readPomodoro(params: URLSearchParams): PomodoroState {
  return {
    focusMin: clampNonNegative(params.get("f")) || 25,
    shortBreakMin: clampNonNegative(params.get("sb")) || 5,
    longBreakMin: clampNonNegative(params.get("lb")) || 15,
    task: params.get("task") ?? "",
  };
}

// ---- share helpers ----

/** Build a shareable URL for the current page + given params. */
export function buildShareUrl(pathname: string, params: URLSearchParams): string {
  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

/** Copy text to clipboard with a graceful <textarea> fallback. Resolves true on success. */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // fall through to legacy path
  }
  try {
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "absolute";
    ta.style.left = "-9999px";
    document.body.appendChild(ta);
    ta.select();
    // execCommand is deprecated but is the only reliable clipboard fallback
    // for non-secure contexts; navigator.clipboard is tried first above.
    const ok = document.execCommand("copy");
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}
