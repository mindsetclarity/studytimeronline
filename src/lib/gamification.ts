const XP_STORAGE_KEY = "study-timer-online:xp";

export interface GamificationState {
  totalXP: number;
  level: number;
  progressPercent: number;
}

export function getGamificationState(): GamificationState {
  let totalXP = 0;
  if (typeof window !== "undefined") {
    try {
      const stored = localStorage.getItem(XP_STORAGE_KEY);
      if (stored) totalXP = parseInt(stored, 10) || 0;
    } catch {}
  }

  const level = Math.floor(totalXP / 1000) + 1;
  const progressPercent = (totalXP % 1000) / 1000 * 100;

  return { totalXP, level, progressPercent };
}

export function addXP(minutesFocused: number): GamificationState {
  const current = getGamificationState();
  const newXP = current.totalXP + Math.round(minutesFocused * 10);
  
  if (typeof window !== "undefined") {
    try {
      localStorage.setItem(XP_STORAGE_KEY, newXP.toString());
      window.dispatchEvent(new CustomEvent('gamification:update', { detail: getGamificationState() }));
    } catch {}
  }

  return getGamificationState();
}
