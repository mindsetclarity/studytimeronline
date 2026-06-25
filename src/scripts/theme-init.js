/**
 * No-FOUC theme initialization.
 * Runs inline in <head> before first paint to prevent flash of wrong theme.
 * Reads localStorage "study-timer-online:theme" and falls back to the system preference.
 */
(function () {
  try {
    var stored = localStorage.getItem("study-timer-online:theme");
    var prefersDark =
      window.matchMedia &&
      window.matchMedia("(prefers-color-scheme: dark)").matches;
    var theme = stored || (prefersDark ? "dark" : "light");
    document.documentElement.setAttribute("data-theme", theme);
  } catch (_e) {
    document.documentElement.setAttribute("data-theme", "light");
  }
})();