/**
 * Time formatting utilities.
 * Uses Intl where locale matters; pure math for timer digit strings (so they
 * stay tabular-nums stable regardless of locale).
 */

/** Zero-pad to 2 digits. "5" → "05", "12" → "12". */
export function pad2(n: number): string {
  const i = Math.max(0, Math.floor(n));
  return i < 10 ? `0${i}` : String(i);
}

/** Clamp to non-negative integer. Rejects NaN/Infinity/negatives → 0. */
export function clampNonNegative(n: unknown): number {
  const num = typeof n === "number" ? n : Number(n);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.floor(num);
}

export interface HmsParts {
  hours: number;
  minutes: number;
  seconds: number;
}

/** Split a millisecond duration into whole H/M/S parts. */
export function msToHms(ms: number): HmsParts {
  const totalSec = Math.floor(clampNonNegative(ms) / 1000);
  return {
    hours: Math.floor(totalSec / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

/**
 * Format milliseconds as HH:MM:SS (or MM:SS if under an hour).
 * Always tabular-stable — used by the big timer display.
 */
export function formatHms(ms: number): string {
  const { hours, minutes, seconds } = msToHms(ms);
  if (hours > 0) {
    return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
  }
  return `${pad2(minutes)}:${pad2(seconds)}`;
}

/** Always show HH:MM:SS even under an hour (exam timer prefers this). */
export function formatHmsForced(ms: number): string {
  const { hours, minutes, seconds } = msToHms(ms);
  return `${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/**
 * Tab title countdown — "25:00 · Study Timer Online" while running.
 * Restores to BRAND when stopped (caller handles restore).
 */
export function formatTabTitle(ms: number, brand: string): string {
  return `${formatHms(ms)} · ${brand}`;
}

/**
 * Days/hours/minutes/seconds — for event countdowns where days matter.
 */
export interface DhmsParts {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

export function msToDhms(ms: number): DhmsParts {
  const totalSec = Math.floor(clampNonNegative(ms) / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export function formatDhms(ms: number): string {
  const { days, hours, minutes, seconds } = msToDhms(ms);
  return `${pad2(days)}:${pad2(hours)}:${pad2(minutes)}:${pad2(seconds)}`;
}

/**
 * Convert H/M/S input fields → total ms.
 * Treats empty/invalid as 0 (input is safe to leave blank).
 */
export function hmsInputsToMs(h: number | string, m: number | string, s: number | string): number {
  const hours = clampNonNegative(h);
  const minutes = clampNonNegative(m);
  const seconds = clampNonNegative(s);
  return (hours * 3600 + minutes * 60 + seconds) * 1000;
}

/**
 * Format a wall-clock time using the user's locale via Intl.
 * Used for exam timer "current time" / "finish time" displays.
 */
export function formatWallClock(date: Date, opts?: Intl.DateTimeFormatOptions): string {
  const formatter = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
    ...opts,
  });
  return formatter.format(date);
}

/** Format a date using the user's locale (for event countdown display). */
export function formatDateLocalized(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  }).format(date);
}

/** Format a date+time using the user's locale. */
export function formatDateTimeLocalized(date: Date): string {
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  }).format(date);
}
