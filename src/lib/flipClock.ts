/**
 * Split-flap ("flip clock") renderer for the big timer display.
 *
 * Each character gets a cell. Only characters that actually changed animate,
 * so a ticking clock repaints two digits a second instead of the whole string.
 *
 * The animated cells are aria-hidden (four stacked copies of every digit read
 * terribly); the plain time string lives in a visually hidden span that the
 * surrounding aria-live region announces instead.
 */

/** Must stay in sync with the .flip-cell animations in theme.css. */
const FLIP_MS = 620;

const isDigit = (char: string): boolean => char >= "0" && char <= "9";

export interface RenderPlan {
  /** Cell layout changed (45:00 -> 01:05:00) — rebuild instead of animating. */
  rebuild: boolean;
  /** Indices of digits to flip. Empty when rebuilding. */
  flips: number[];
}

/**
 * Decide how to get from `prev` to `next`. Pure, so it is unit-testable without
 * a DOM — see flipClock.test.ts.
 */
export function planRender(prev: string, next: string): RenderPlan {
  const sameShape =
    next.length === prev.length &&
    [...next].every((char, i) => isDigit(char) === isDigit(prev[i]));

  if (!sameShape) return { rebuild: true, flips: [] };

  const flips: number[] = [];
  for (let i = 0; i < next.length; i += 1) {
    if (next[i] !== prev[i]) flips.push(i);
  }
  return { rebuild: false, flips };
}

interface Cell {
  el: HTMLElement;
  faceTop: HTMLElement;
  faceBottom: HTMLElement;
  flapTop: HTMLElement;
  flapBottom: HTMLElement;
  timer: number;
}

export class FlipClock {
  private readonly label: HTMLElement;
  private readonly track: HTMLElement;
  /** One entry per character; null where a separator sits, so indices line up. */
  private cells: (Cell | null)[] = [];
  private value = "";

  constructor(root: HTMLElement) {
    const initial = root.textContent?.trim() ?? "";

    root.textContent = "";
    root.classList.add("flip-clock");

    this.label = document.createElement("span");
    this.label.className = "sr-only";

    this.track = document.createElement("div");
    this.track.className = "flip-clock__track";
    this.track.setAttribute("aria-hidden", "true");

    root.append(this.label, this.track);

    if (initial) this.render(initial);
  }

  render(next: string): void {
    if (next === this.value) return;

    const plan = planRender(this.value, next);
    if (plan.rebuild) this.build(next);
    else plan.flips.forEach((i) => this.flip(i, this.value[i], next[i]));

    this.value = next;
    this.label.textContent = next;
  }

  /** Rebuild every cell with no animation — used on first paint and length changes. */
  private build(text: string): void {
    this.cells.forEach((cell) => cell && window.clearTimeout(cell.timer));
    this.cells = [];
    this.track.textContent = "";

    // Tell CSS how wide this track wants to be so it can pick a cell size that
    // fits — an HH:MM:SS clock needs smaller cells than MM:SS in the same card.
    // Ratios mirror the .flip-cell / .flip-separator widths plus one gap each.
    const units = [...text].reduce((sum, char) => sum + (isDigit(char) ? 0.79 : 0.33), 0);
    this.track.parentElement?.style.setProperty("--flip-units", units.toFixed(2));

    for (const char of text) {
      if (!isDigit(char)) {
        const separator = document.createElement("span");
        separator.className = "flip-separator";
        separator.textContent = char;
        this.track.append(separator);
        this.cells.push(null);
        continue;
      }

      const el = document.createElement("span");
      el.className = "flip-cell";
      const faceTop = makeFace("flip-cell__face flip-cell__face--top", char);
      const faceBottom = makeFace("flip-cell__face flip-cell__face--bottom", char);
      const flapTop = makeFace("flip-cell__flap flip-cell__flap--top", char);
      const flapBottom = makeFace("flip-cell__flap flip-cell__flap--bottom", char);
      el.append(faceTop, faceBottom, flapTop, flapBottom);
      this.track.append(el);
      this.cells.push({ el, faceTop, faceBottom, flapTop, flapBottom, timer: 0 });
    }
  }

  /** Only ever called for a digit-to-digit change — render() guarantees it. */
  private flip(index: number, from: string, to: string): void {
    const cell = this.cells[index];
    if (!cell) return;

    window.clearTimeout(cell.timer);

    // Behind the falling top flap sits the new digit; the bottom half keeps
    // showing the old digit until the new bottom flap lands on it.
    cell.faceTop.textContent = to;
    cell.faceBottom.textContent = from;
    cell.flapTop.textContent = from;
    cell.flapBottom.textContent = to;

    cell.el.classList.remove("is-flipping");
    void cell.el.offsetWidth; // restart the animation
    cell.el.classList.add("is-flipping");

    cell.timer = window.setTimeout(() => {
      cell.el.classList.remove("is-flipping");
      cell.faceBottom.textContent = to;
    }, FLIP_MS);
  }
}

function makeFace(className: string, char: string): HTMLElement {
  const el = document.createElement("span");
  el.className = className;
  el.textContent = char;
  return el;
}

/**
 * Attach a flip clock to an element only if it opted in with `data-flip-clock`.
 * Returns null otherwise so callers can fall back to plain textContent.
 */
export function mountFlipClock(el: HTMLElement | null): FlipClock | null {
  if (!el || !el.hasAttribute("data-flip-clock")) return null;
  return new FlipClock(el);
}
