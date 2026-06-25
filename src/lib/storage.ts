/**
 * Typed, fail-safe localStorage wrapper.
 * All access is wrapped in try/catch — never throws (private mode, disabled,
 * quota exceeded all degrade gracefully to in-memory defaults).
 */

const PREFIX = "study-timer-online:";

function key(name: string): string {
  return `${PREFIX}${name}`;
}

/** Read a JSON value, falling back to default on any error. */
export function read<T>(name: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key(name));
    if (raw === null) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/** Write a JSON value; silently ignores failures. */
export function write<T>(name: string, value: T): void {
  try {
    localStorage.setItem(key(name), JSON.stringify(value));
  } catch {
    // ignore quota / disabled storage
  }
}

/** Remove a key. */
export function remove(name: string): void {
  try {
    localStorage.removeItem(key(name));
  } catch {
    // ignore
  }
}

// ---- Typed accessors for known preferences ----

export type ThemePref = "light" | "dark";

/** Returns the stored theme pref, or null if unset (caller falls back to system). */
export const theme = {
  get(): ThemePref | null {
    const v = read<string>("theme", "");
    return v === "dark" || v === "light" ? v : null;
  },
  set(v: ThemePref): void {
    write("theme", v);
  },
};

export const alarm = {
  get(): boolean {
    return read<boolean>("alarm", true);
  },
  set(v: boolean): void {
    write("alarm", v);
  },
};

export type DisplayMode = "digital" | "flip";

export const displayMode = {
  get(): DisplayMode {
    return read<DisplayMode>("displayMode", "digital");
  },
  set(v: DisplayMode): void {
    write("displayMode", v);
  },
};

export interface PomodoroSettings {
  focusMin: number;
  shortBreakMin: number;
  longBreakMin: number;
  longBreakEvery: number; // sessions before long break
  autoStartNext: boolean;
  ambient: "silence" | "rain" | "brown";
}

export const pomodoro: {
  get(): PomodoroSettings;
  set(v: PomodoroSettings): void;
} = {
  get(): PomodoroSettings {
    return read<PomodoroSettings>("pomodoro", {
      focusMin: 25,
      shortBreakMin: 5,
      longBreakMin: 15,
      longBreakEvery: 4,
      autoStartNext: false,
      ambient: "silence",
    });
  },
  set(v: PomodoroSettings): void {
    write("pomodoro", v);
  },
};

export const studyTask = {
  get(): string {
    return read<string>("studyTask", "");
  },
  set(v: string): void {
    write("studyTask", v);
  },
};

export const studyDurationMin = {
  get(): number {
    return read<number>("studyDurationMin", 25);
  },
  set(v: number): void {
    write("studyDurationMin", v);
  },
};

export const examPrefs = {
  get() {
    return read<{
      alwaysShowSeconds: boolean;
      lastTitle: string;
    }>("examPrefs", {
      alwaysShowSeconds: true,
      lastTitle: "",
    });
  },
  set(v: { alwaysShowSeconds: boolean; lastTitle: string }): void {
    write("examPrefs", v);
  },
};

export const flipClock = {
  get() {
    return read<{
      mode: DisplayMode;
      hour24: boolean;
      showSeconds: boolean;
      showDate: boolean;
      theme: "ink" | "midnight" | "paper" | "warm";
    }>("flipClock", {
      mode: "flip",
      hour24: false,
      showSeconds: true,
      showDate: true,
      theme: "ink",
    });
  },
  set(v: {
    mode: DisplayMode;
    hour24: boolean;
    showSeconds: boolean;
    showDate: boolean;
    theme: "ink" | "midnight" | "paper" | "warm";
  }): void {
    write("flipClock", v);
  },
};
