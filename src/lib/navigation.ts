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
    label: "Planner",
    href: "/study-planner",
    description: "Plan today's study tasks.",
  },
  {
    label: "Stats",
    href: "/study-stats",
    description: "See your study minutes and streak.",
  },
  {
    label: "Guides",
    href: "/guides",
    description: "Practical guides to studying with a timer.",
  },
];

export const STUDY_TOOLS: NavLink[] = PRIMARY_NAV.filter((link) => ["/timer", "/pomodoro"].includes(link.href));
export const TOOLS: NavLink[] = STUDY_TOOLS;
export const NAV_LINKS: NavLink[] = PRIMARY_NAV;

export const TRUST_LINKS: NavLink[] = [
  { label: "Study Guides", href: "/guides", description: "Practical guides to studying with a timer." },
  { label: "About Us", href: "/about", description: "The mission and story behind Study Timer Online." },
  { label: "Privacy Policy", href: "/privacy", description: "How this no-account timer site treats data." },
  { label: "Terms & Conditions", href: "/terms", description: "Simple terms for using Study Timer Online." },
  { label: "Contact Us", href: "/contact", description: "Send feedback or request a study feature." },
];

/** Match a pathname against a link, handling trailing slashes. */
export function isCurrent(pathname: string, href: string): boolean {
  const normalize = (p: string) => (p.endsWith("/") && p.length > 1 ? p.slice(0, -1) : p);
  return normalize(pathname) === normalize(href);
}