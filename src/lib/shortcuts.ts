/**
 * Single-key shortcuts for the timer pages.
 *
 * Each entry resolves to the button the key should press, so the caller keeps
 * one source of truth for "which control is live right now" — Space hits Start
 * or Pause depending on which of them is currently showing.
 */

/** Keys arrive lowercased, with the space bar normalised to "space". */
export type ShortcutMap = Record<string, () => HTMLButtonElement | null | undefined>;

const isTyping = (target: EventTarget | null): boolean =>
  target instanceof Element &&
  Boolean(target.closest("input, textarea, select, [contenteditable]"));

/** A control the user cannot see or use should not respond to its key either. */
const isActionable = (button: HTMLButtonElement | null | undefined): button is HTMLButtonElement =>
  Boolean(button) && !button!.disabled && button!.offsetParent !== null;

/** Returns a teardown function. */
export function bindShortcuts(map: ShortcutMap): () => void {
  const handler = (event: KeyboardEvent): void => {
    // Leave browser and OS chords alone, and never steal keys from a field —
    // the custom-minutes input has to keep accepting digits and spaces.
    if (event.ctrlKey || event.metaKey || event.altKey || event.repeat) return;
    if (isTyping(event.target)) return;

    const key = event.key === " " ? "space" : event.key.toLowerCase();
    const button = map[key]?.();
    if (!isActionable(button)) return;

    event.preventDefault(); // Space would otherwise scroll the page
    button.click();
  };

  document.addEventListener("keydown", handler);
  return () => document.removeEventListener("keydown", handler);
}
