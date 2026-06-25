/**
 * Study Timer Online - accurate countdown timer engine.
 *
 * Anti-pattern avoided: subtracting 1s on every setInterval tick. That drifts
 * because browsers throttle background tabs to 1Hz (or worse), so a "10 min"
 * timer can finish at 10:30 or never. Instead we store an ABSOLUTE end
 * timestamp and recompute remaining time on every tick from Date.now().
 *
 * Behavior:
 * - start(durationMs): store endTimestamp = Date.now() + durationMs
 * - tick(): remaining = max(0, endTimestamp - Date.now())
 * - pause(): freeze remainingMs at pause instant
 * - resume(): recompute endTimestamp = Date.now() + remainingMs
 * - reset(): restore original duration → idle
 *
 * Wake Lock is requested when running (where supported) so the screen stays
 * on during a focus session.
 */

export type TimerState = "idle" | "running" | "paused" | "finished";

export interface TickDetail {
  remainingMs: number;
  totalMs: number;
  progress: number; // 0 → 1, fraction of duration elapsed
}

export interface StateDetail {
  state: TimerState;
  remainingMs: number;
}

type TimerEvents = {
  tick: TickDetail;
  state: StateDetail;
  finish: TickDetail;
};

/**
 * CountdownEngine — emits 'tick', 'state', 'finish' via EventTarget.
 * Use one instance per timer. Composable, no DOM coupling beyond EventTarget.
 */
export class CountdownEngine extends EventTarget {
  private state: TimerState = "idle";
  private totalMs: number = 0;
  private endTimestamp: number | null = null;
  private remainingMs: number = 0;
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private wakeLock: WakeLockSentinel | null = null;

  /** Begin counting down `durationMs`. Replaces any in-progress timer. */
  start(durationMs: number): void {
    const clamped = this.clampDuration(durationMs);
    if (clamped <= 0) return;
    this.totalMs = clamped;
    this.remainingMs = clamped;
    this.endTimestamp = Date.now() + clamped;
    this.setState("running");
    this.requestWakeLock();
    this.startTicking();
    // emit an immediate tick so UI updates without waiting 250ms
    this.emitTick();
  }

  /** Pause a running timer; preserves remaining time exactly. */
  pause(): void {
    if (this.state !== "running") return;
    this.remainingMs = Math.max(0, (this.endTimestamp ?? 0) - Date.now());
    this.endTimestamp = null;
    this.stopTicking();
    this.releaseWakeLock();
    this.setState("paused");
    this.emitTick();
  }

  /** Resume a paused timer; recomputes endTimestamp from preserved remaining. */
  resume(): void {
    if (this.state !== "paused") return;
    if (this.remainingMs <= 0) return;
    this.endTimestamp = Date.now() + this.remainingMs;
    this.setState("running");
    this.requestWakeLock();
    this.startTicking();
    this.emitTick();
  }

  /** Reset to original duration (idle). */
  reset(): void {
    this.stopTicking();
    this.releaseWakeLock();
    this.endTimestamp = null;
    this.remainingMs = this.totalMs;
    this.setState("idle");
    this.emitTick();
  }

  /** Stop everything, clear duration. */
  clear(): void {
    this.stopTicking();
    this.releaseWakeLock();
    this.endTimestamp = null;
    this.remainingMs = 0;
    this.totalMs = 0;
    this.setState("idle");
    this.emitTick();
  }

  getState(): TimerState {
    return this.state;
  }

  getRemainingMs(): number {
    if (this.state === "running" && this.endTimestamp !== null) {
      return Math.max(0, this.endTimestamp - Date.now());
    }
    return this.remainingMs;
  }

  getTotalMs(): number {
    return this.totalMs;
  }

  /** Cleanup — always call when component unmounts. */
  destroy(): void {
    this.stopTicking();
    this.releaseWakeLock();
  }

  // ---- internals ----

  private clampDuration(ms: number): number {
    if (!Number.isFinite(ms) || Number.isNaN(ms) || ms < 0) return 0;
    return Math.floor(ms);
  }

  private startTicking(): void {
    this.stopTicking();
    // 250ms cadence balances smooth UI with CPU/battery. Accuracy is from
    // Date.now() math, not from cadence — so even 1Hz would stay correct.
    // globalThis (not window.) keeps the engine testable in Node.
    this.intervalId = globalThis.setInterval(() => this.emitTick(), 250);
  }

  private stopTicking(): void {
    if (this.intervalId !== null) {
      globalThis.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emitTick(): void {
    const remainingMs = this.getRemainingMs();
    const totalMs = this.totalMs || 1;
    const progress = totalMs > 0 ? 1 - remainingMs / totalMs : 0;
    const detail: TickDetail = { remainingMs, totalMs, progress };

    if (remainingMs <= 0 && this.state === "running") {
      this.remainingMs = 0;
      this.stopTicking();
      this.releaseWakeLock();
      this.setState("finished");
      this.emit("finish", detail);
    } else {
      this.emit("tick", detail);
    }
  }

  private setState(next: TimerState): void {
    if (this.state === next) return;
    this.state = next;
    this.emit("state", {
      state: next,
      remainingMs: this.getRemainingMs(),
    });
  }

  private emit<K extends keyof TimerEvents>(type: K, detail: TimerEvents[K]): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if ("wakeLock" in navigator) {
        // Re-acquire on visibilitychange since wake lock releases on tab hide
        this.wakeLock = await (navigator as Navigator).wakeLock.request("screen");
      }
    } catch {
      // Silently ignore — wake lock is a progressive enhancement
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      // ignore
    }
    this.wakeLock = null;
  }
}

/**
 * StopwatchEngine — counts UP from zero using absolute timestamps.
 * Same accuracy guarantees as CountdownEngine.
 */
export class StopwatchEngine extends EventTarget {
  private running = false;
  private startTimestamp: number | null = null;
  private accumulatedMs: number = 0; // sum of prior running segments
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private wakeLock: WakeLockSentinel | null = null;
  private laps: number[] = [];

  start(): void {
    if (this.running) return;
    this.running = true;
    this.startTimestamp = Date.now();
    this.requestWakeLock();
    this.startTicking();
    this.emitState();
  }

  pause(): void {
    if (!this.running) return;
    this.accumulatedMs += Date.now() - (this.startTimestamp ?? 0);
    this.running = false;
    this.startTimestamp = null;
    this.stopTicking();
    this.releaseWakeLock();
    this.emitState();
    this.emitTick();
  }

  reset(): void {
    this.running = false;
    this.startTimestamp = null;
    this.accumulatedMs = 0;
    this.laps = [];
    this.stopTicking();
    this.releaseWakeLock();
    this.emitState();
    this.emitTick();
  }

  /** Record a lap at current elapsed time. Returns lap index (1-based). */
  lap(): number {
    this.laps.push(this.getElapsedMs());
    this.dispatchEvent(new CustomEvent("lap", { detail: { laps: [...this.laps] } }));
    return this.laps.length;
  }

  getLaps(): number[] {
    return [...this.laps];
  }

  getElapsedMs(): number {
    const live = this.running ? Date.now() - (this.startTimestamp ?? 0) : 0;
    return this.accumulatedMs + live;
  }

  isRunning(): boolean {
    return this.running;
  }

  destroy(): void {
    this.stopTicking();
    this.releaseWakeLock();
  }

  private startTicking(): void {
    this.stopTicking();
    this.intervalId = globalThis.setInterval(() => this.emitTick(), 100);
  }

  private stopTicking(): void {
    if (this.intervalId !== null) {
      globalThis.clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private emitTick(): void {
    this.dispatchEvent(new CustomEvent("tick", { detail: { elapsedMs: this.getElapsedMs() } }));
  }

  private emitState(): void {
    this.dispatchEvent(
      new CustomEvent("state", { detail: { running: this.running } }),
    );
  }

  private async requestWakeLock(): Promise<void> {
    try {
      if ("wakeLock" in navigator) {
        this.wakeLock = await (navigator as Navigator).wakeLock.request("screen");
      }
    } catch {
      // ignore
    }
  }

  private async releaseWakeLock(): Promise<void> {
    try {
      await this.wakeLock?.release();
    } catch {
      // ignore
    }
    this.wakeLock = null;
  }
}
