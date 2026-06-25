/** Study-first product navigation. */
export interface NavLink {
  label: string;
  href: string;
  description?: string;
}

export const PRIMARY_NAV: NavLink[] = [
  {
    label: "Home",
    href: "/",
    description: "Return to the clean study landing page.",
  },
  {
    label: "Timer",
    href: "/timer",
    description: "Start a focused countdown timer.",
  },
  {
    label: "Pomodoro",
    href: "/pomodoro",
    description: "Run a calm Pomodoro interval.",
  },
  {
    label: "Plan Today",
    href: "/today",
    description: "Open today's planning hub.",
  },
];

export const STUDY_TOOLS: NavLink[] = PRIMARY_NAV.filter((link) => !["/", "/today"].includes(link.href));
export const TOOLS: NavLink[] = STUDY_TOOLS;
export const NAV_LINKS: NavLink[] = PRIMARY_NAV;

export const TRUST_LINKS: NavLink[] = [
  { label: "Privacy", href: "/privacy", description: "How this no-account timer site treats data." },
  { label: "Terms", href: "/terms", description: "Simple terms for using Study Timer Online." },
  { label: "Contact", href: "/contact", description: "Send feedback or request a study feature." },
];

/** Match a pathname against a link, handling trailing slashes. */
export function isCurrent(pathname: string, href: string): boolean {
  const normalize = (p: string) => (p.endsWith("/") && p.length > 1 ? p.slice(0, -1) : p);
  return normalize(pathname) === normalize(href);
}