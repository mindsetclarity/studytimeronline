/**
 * Synthesized alarm + ambient sound via Web Audio API.
 *
 * Why synthesized: zero audio files → zero copyright risk, zero network
 * weight, autoplay-safe (only runs after user gesture). Sounds are gentle,
 * short, and loop-free where possible.
 *
 * Browsers block audio until a user gesture. Call Alarm.unlock() inside a
 * click/keypress handler the first time, then play() works freely.
 */

export class Alarm {
  private ctx: AudioContext | null = null;

  /** Lazily create the AudioContext on first user gesture. */
  unlock(): void {
    if (this.ctx) return;
    try {
      const Ctor =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      this.ctx = new Ctor();
    } catch {
      this.ctx = null;
    }
    if (this.ctx && this.ctx.state === "suspended") {
      void this.ctx.resume();
    }
  }

  /**
   * Play a gentle 3-beep alarm (~1.8s total). Two soft sine tones with a
   * triangle fundamental, fade-in/out envelope, no harsh transients.
   */
  play(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === "suspended") void ctx.resume();

    const now = ctx.currentTime;
    const beats = [0, 0.6, 1.2];
    beats.forEach((start) => this.beep(ctx, now + start, 0.45));
  }

  private beep(ctx: AudioContext, start: number, dur: number): void {
    // Fundamental — soft triangle at 880Hz (A5)
    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = 880;

    // Subtle octave shimmer
    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = 1760;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(0.18, start + 0.05);
    gain.gain.setValueAtTime(0.18, start + dur - 0.08);
    gain.gain.linearRampToValueAtTime(0, start + dur);

    const shimmerGain = ctx.createGain();
    shimmerGain.gain.setValueAtTime(0, start);
    shimmerGain.gain.linearRampToValueAtTime(0.05, start + 0.05);
    shimmerGain.gain.linearRampToValueAtTime(0, start + dur);

    osc.connect(gain).connect(ctx.destination);
    shimmer.connect(shimmerGain).connect(ctx.destination);
    osc.start(start);
    shimmer.start(start);
    osc.stop(start + dur);
    shimmer.stop(start + dur);
  }
}

/**
 * Ambient sound generator — looping synthesized textures for focus sessions.
 * 'rain' and 'brown' use filtered noise; 'silence' is a no-op.
 */
export class Ambient {
  private ctx: AudioContext | null = null;
  private nodes: AudioNode[] = []; // filter/gain nodes, disconnected on stop()
  private source: AudioBufferSourceNode | null = null;
  private gain: GainNode | null = null; // master gain; ramped down before stop()
  private current: "silence" | "rain" | "brown" = "silence";

  setContext(ctx: AudioContext): void {
    this.ctx = ctx;
  }

  isPlaying(): boolean {
    return this.current !== "silence" && this.source !== null;
  }

  getCurrent(): "silence" | "rain" | "brown" {
    return this.current;
  }

  /** Switch ambient track. 'silence' stops everything. */
  play(kind: "silence" | "rain" | "brown"): void {
    if (!this.ctx) return;
    this.stop();
    if (kind === "silence") return;
    this.current = kind;
    this.startNoise(kind);
  }

  stop(): void {
    this.current = "silence";
    // Gentle 80ms fade-out to avoid click on stop
    if (this.gain && this.ctx) {
      try {
        const t = this.ctx.currentTime;
        this.gain.gain.cancelScheduledValues(t);
        this.gain.gain.setValueAtTime(this.gain.gain.value, t);
        this.gain.gain.linearRampToValueAtTime(0, t + 0.08);
      } catch {
        // ignore
      }
    }
    try {
      this.source?.stop();
    } catch {
      // already stopped
    }
    // Disconnect filter/gain nodes for clean GC
    this.nodes.forEach((n) => {
      try {
        n.disconnect();
      } catch {
        // ignore
      }
    });
    this.source = null;
    this.nodes = [];
    this.gain = null;
  }

  private startNoise(kind: "rain" | "brown"): void {
    if (!this.ctx) return;
    const ctx = this.ctx;
    const bufferSize = 2 * ctx.sampleRate;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);

    if (kind === "brown") {
      // Brownian noise — deeper, calmer (rumble)
      let last = 0;
      for (let i = 0; i < bufferSize; i++) {
        const white = Math.random() * 2 - 1;
        last = (last + 0.02 * white) / 1.02;
        data[i] = last * 3.5;
      }
    } else {
      // White noise → lowpass = rain-ish hiss
      for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
      }
    }

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;

    const gain = ctx.createGain();
    gain.gain.value = kind === "rain" ? 0.08 : 0.12;

    if (kind === "rain") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1800;
      src.connect(filter).connect(gain).connect(ctx.destination);
      this.nodes = [filter, gain];
    } else {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 500;
      src.connect(filter).connect(gain).connect(ctx.destination);
      this.nodes = [filter, gain];
    }

    src.start();
    this.source = src;
    this.gain = gain;
  }
}
