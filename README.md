# Study Timer Online

A static Astro and Tailwind 4 website for a premium study command center: Study Timer, Pomodoro, Exam Timer, Focus Session, Study Planner, and Study Stats.

## Scripts

```sh
npm.cmd run dev
npm.cmd run build
npx.cmd astro check
node scripts/test-timer-engine.mjs
```

Use `npm.cmd` and `npx.cmd` on Windows PowerShell to avoid script execution policy issues with `.ps1` shims.

## Architecture

- `src/lib/` contains framework-agnostic timer engines, formatting, storage, URL state, alarm, notification, and fullscreen helpers.
- `src/components/` contains the shared Astro app shell and reusable visual sections.
- `src/scripts/` contains small page-specific browser modules bundled by Astro.
- `src/pages/` contains static Astro routes for study-first product pages and secondary utility pages.

The v1 direction is static-first, no-backend, global English-first, and designed around `DESIGN.md`: ink/canvas surfaces, restrained shadows, premium typography, visible controls, and accessible study workflows. The main product is no longer a generic timer collection; it is a calm study timer for focused students.