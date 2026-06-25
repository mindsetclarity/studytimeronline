import { theme as themeStorage } from "../lib/storage";

const THEME_KEY = "study-timer-online:theme";
const reduceMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");

function prefersReducedMotion(): boolean {
  return reduceMotionQuery.matches;
}

function pulseAttribute(element: HTMLElement, name: string, duration = 260): void {
  if (prefersReducedMotion()) return;
  element.setAttribute(name, "true");
  window.setTimeout(() => element.removeAttribute(name), duration);
}

function setTheme(next: "light" | "dark"): void {
  document.documentElement.setAttribute("data-theme", next);
  themeStorage.set(next);
  const meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (meta) meta.content = next === "dark" ? "#0a0a0a" : "#fafafa";
}

function currentTheme(): "light" | "dark" {
  return document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";
}

function setupThemeToggle(): void {
  document.querySelectorAll<HTMLButtonElement>("[data-theme-toggle]").forEach((button) => {
    button.addEventListener("click", () => {
      setTheme(currentTheme() === "dark" ? "light" : "dark");
      showToast(`Theme set to ${currentTheme()}.`);
    });
  });

  // Migrate the old key once if an early build stored it.
  try {
    const legacy = localStorage.getItem("tempo:theme");
    if (legacy && !localStorage.getItem(THEME_KEY)) {
      localStorage.setItem(THEME_KEY, legacy);
      localStorage.removeItem("tempo:theme");
    }
  } catch {
    // Storage is optional.
  }
}

function setupMobileMenu(): void {
  const button = document.querySelector<HTMLButtonElement>("[data-menu-button]");
  const menu = document.querySelector<HTMLElement>("[data-mobile-menu]");
  if (!button || !menu) return;
  let closeTimer = 0;

  const setOpen = (open: boolean) => {
    window.clearTimeout(closeTimer);
    button.setAttribute("aria-expanded", String(open));
    document.body.toggleAttribute("data-menu-open", open);

    if (open) {
      menu.hidden = false;
      menu.dataset.menuState = "open";
      return;
    }

    menu.dataset.menuState = "closing";
    closeTimer = window.setTimeout(() => {
      if (button.getAttribute("aria-expanded") === "true") return;
      menu.hidden = true;
      menu.removeAttribute("data-menu-state");
    }, prefersReducedMotion() ? 0 : 190);
  };

  button.addEventListener("click", () => {
    setOpen(button.getAttribute("aria-expanded") !== "true");
  });

  menu.querySelectorAll("a").forEach((link) => {
    link.addEventListener("click", () => setOpen(false));
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") setOpen(false);
  });
}

function setupBackNavigation(): void {
  document.querySelectorAll<HTMLAnchorElement>("[data-back-link]").forEach((link) => {
    link.addEventListener("click", (event) => {
      if (window.history.length <= 1) return;
      event.preventDefault();
      window.history.back();
    });
  });
}

function setupPageReveal(): void {
  if (prefersReducedMotion()) return;
  const targets = Array.from(document.querySelectorAll<HTMLElement>("main > section"));
  targets.forEach((target, index) => {
    target.dataset.motionReveal = "pending";
    target.style.setProperty("--motion-order", String(Math.min(index, 4)));
  });
  requestAnimationFrame(() => {
    targets.forEach((target) => {
      target.dataset.motionReveal = "visible";
    });
  });
}

function setupTimerDigitMotion(): void {
  const displays = document.querySelectorAll<HTMLElement>(".timer-display, [data-timer-display], [data-exam-display]");
  displays.forEach((display) => {
    let previous = display.textContent;
    const observer = new MutationObserver(() => {
      const current = display.textContent;
      if (!current || current === previous) return;
      previous = current;
      pulseAttribute(display, "data-motion-tick", 220);
    });
    observer.observe(display, { childList: true, characterData: true, subtree: true });
  });
}

function setupPressMotion(): void {
  const selector = "button, .btn-primary, .btn-secondary, .btn-nav-focus, .mobile-action-bar__link";
  document.addEventListener("pointerdown", (event) => {
    const target = (event.target as Element).closest<HTMLElement>(selector);
    if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return;
    pulseAttribute(target, "data-motion-press", 260);
  });
  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    const target = (event.target as Element | null)?.closest<HTMLElement>(selector);
    if (!target || target.hasAttribute("disabled") || target.getAttribute("aria-disabled") === "true") return;
    pulseAttribute(target, "data-motion-press", 260);
  });
}

export function showToast(message: string): void {
  const region = document.querySelector<HTMLElement>("[data-toast-region]");
  if (!region) return;
  region.textContent = message;
  region.dataset.visible = "true";
  window.setTimeout(() => {
    region.dataset.visible = "false";
  }, 2600);
}

import { getGamificationState } from "../lib/gamification";

function setupGamificationUI(): void {
  const xpBars = document.querySelectorAll<HTMLElement>(".header-xp-bar");
  if (xpBars.length === 0) return;

  const updateUI = () => {
    const state = getGamificationState();
    xpBars.forEach(bar => {
      const levelSpan = bar.querySelector("span");
      const progressFill = bar.querySelector("div > div") as HTMLElement;
      if (levelSpan) levelSpan.textContent = `Lvl ${state.level}`;
      if (progressFill) progressFill.style.width = `${state.progressPercent}%`;
    });
  };

  updateUI();
  window.addEventListener('gamification:update', updateUI as EventListener);
}

setupThemeToggle();
setupMobileMenu();
setupBackNavigation();
setupPageReveal();
setupTimerDigitMotion();
setupPressMotion();
setupGamificationUI();