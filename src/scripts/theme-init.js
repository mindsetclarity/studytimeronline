/**
 * No-FOUC theme initialization.
 * Runs inline in <head> BEFORE first paint to prevent flash of wrong theme.
 * Reads: localStorage 'tempo:theme' → prefers-color-scheme fallback.
 * Sets <html data-theme="light|dark">.
 */
(function () {
  try {
    var stored = localStorage.getItem("tempo:theme");
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (_e) {
    // localStorage blocked (private mode) — default to light
    document.documentElement.setAttribute("data-theme", "light");
  }
})();
