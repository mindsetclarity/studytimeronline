# studytimeronline.com — front-end rebuild design

Date: 2026-08-22
Status: approved for planning
Approach: A — one app component, several keyword landing routes, thin marketing shell

## 1. Why

The site already has real functionality (accurate timer engine, pomodoro cockpit, planner, stats) but three structural problems keep it from competing:

1. **Two design systems ship at once.** `src/styles/global.css` (10,925 lines, light "Vercel-ish" tokens, matches `DESIGN.md`) is overridden at runtime by `src/styles/theme.css` (228 lines, neon glass) plus a hardcoded `data-theme="dark"` in `Layout.astro`. `src/scripts/theme-init.js` was written to prevent theme FOUC and is never imported. Nobody can theme the site predictably.
2. **Navigation hides the product.** `PRIMARY_NAV` lists Home / Timer / Pomodoro / Plan Today. `/study-planner` and `/study-stats` — about 820 lines of working functionality — are reachable only through the thin `/today` hub. Stats is the retention hook and it is effectively invisible.
3. **Route duplication.** `/today` ("Plan Today") and `/study-planner` (`<title>Today</title>`, h1 "Today's Plan") are two pages doing overlapping jobs with near-identical titles — bad for users, and SEO cannibalization.

Six large pages share exactly two components; everything else is inline per-page markup. That is why each change costs as much as the last one.

### Competitive position

Primary reference competitor: **Flip Clock: World Clock** (`com.wssc.simpleclock`) — 5M+ installs, 4.8★ from 80.4K reviews, free with a pay-what-you-want lifetime unlock, zero ads. Its reviews credit three things: deep visual customization (digit colour, card colour, background image, background music), a focus history that accumulates, and a floating mini-timer that survives app switching.

It is beatable on four axes a website owns and an Android app cannot:

- It is Android-only. Students do sustained work on a laptop, where this app cannot appear.
- Install friction. A URL has none.
- No search discoverability. Nobody googles "study timer" and lands in the Play Store.
- Its focus history is a single number — no subjects, no schedule insight, no planner.

The nearer competition is browser-based: Flocus, Pomofocus, StudyWithMe, Cozy Study. They already win on the aesthetic-plus-ambient axis. The look therefore has to be the hook, not the feature list.

## 2. Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Signature look | Flip clock (split-flap) as hero | Iconic, screensaver-worthy, directly contests the competitor's identity |
| Default theme | Light, with a working dark toggle | Warm-paper split-flap (Twemco desk clock) reads more premium than the airport-board look; dark toggle delivers the competitor's aesthetic |
| Backend | None | Every selected feature works from `localStorage` + URL state. Study rooms and accounts were not selected, and they were the only two needing a server |
| Monetization | Ads on marketing surfaces only | Ads inside a focus session would surrender the competitor's strongest review theme ("ad-free, no permissions") |
| Lofi music | Out of scope | Licensing, not engineering. Ambient loops ship instead |
| `src/lib/*` | Unchanged | Timer engine, alarm, storage, URL state are solid and tested |

## 3. Routes

One shared app component rendered by several routes. Each route carries distinct meta and distinct below-fold copy, so they rank for different intents without cannibalizing.

| Route | Renders | Search intent | Status |
|---|---|---|---|
| `/` | Live flip clock, startable in one click, then SEO copy + FAQ + ad slot | "study timer online" | rebuild |
| `/timer` | `StudyApp mode="countdown"` | "online timer" | rebuild |
| `/pomodoro` | `StudyApp mode="pomodoro"` | "pomodoro timer" | rebuild |
| `/stopwatch` | `StudyApp mode="stopwatch"` | "online stopwatch" | new |
| `/clock` | `StudyApp mode="clock"` | "flip clock" — competitor's keyword | new |
| `/planner` | Task queue | "study planner" | move from `/study-planner` |
| `/stats` | Analytics | "study time tracker" | move from `/study-stats` |
| `/about`, `/contact`, `/privacy`, `/terms` | Static | — | keep, expand thin copy |
| `/404`, `/500` | Error pages | — | restyle only |

**Redirects (301, permanent):**

- `/today` → `/planner`
- `/study-planner` → `/planner`
- `/study-stats` → `/stats`

Implemented in `astro.config.mjs` via the `redirects` option so they are emitted as real 301s by the Cloudflare adapter, not client-side.

Each app route sets its own `<link rel="canonical">` to itself. The below-fold copy on each route must be substantively different prose — not a template with a swapped noun — or the cannibalization problem simply moves.

## 4. Design system

Delete `src/styles/theme.css` and `src/styles/global.css`. Replace with two files:

- `src/styles/tokens.css` — CSS custom properties only, roughly 250 lines. Tailwind v4 `@theme` block continues to source from here.
- `src/styles/app.css` — component and layout rules that Tailwind utilities do not cover (flip-clock 3D, drawer, focus surface).

### Palette

Light is the default. It is a warm paper canvas, not stark white.

| Token | Light | Dark |
|---|---|---|
| `--canvas` | warm paper (near `#f7f5f0`) | near-black (near `#0e0e10`) |
| `--card` | cream (near `#efece4`) | charcoal (near `#1c1c1e`) |
| `--digit` | ink (near `#1a1a1a`) | bone (near `#e8e6e1`) |
| `--text` / `--text-muted` | ink / warm gray | bone / cool gray |
| `--hairline` | low-contrast warm gray | low-contrast cool gray |
| `--accent` | user-selectable hue, single value | same |

Exact hex values are set during implementation against a contrast check; every text-on-surface pair must clear WCAG AA (4.5:1 body, 3:1 large display) in both themes.

### Theming mechanism

`data-theme="light" | "dark"` on `<html>`. Absence of the attribute means follow `prefers-color-scheme`. Three states total: explicit light, explicit dark, system.

`src/scripts/theme-init.js` (currently dead code) is revived and inlined in `<head>` before first paint to prevent FOUC. `Layout.astro` stops hardcoding `data-theme="dark"`.

### Typography

- **Digits:** one display face with tabular figures and a heavy weight, so flip cards never reflow between frames. Loaded via Google Fonts with a system fallback stack.
- **UI and body:** Inter (already in use).
- Font choice is user-selectable from a fixed set of 3–4 faces; the setting writes `--font-digit`.

## 5. Components

Currently: `Header.astro`, `Footer.astro`. After:

```
src/components/
  AppShell.astro          layout wrapper for the four app routes: rail + surface
  app/FlipClock.astro     the split-flap digits
  app/TimerControls.astro start / pause / reset / mode switch / duration presets
  app/SettingsDrawer.astro theme, colours, background, font, 12/24h, seconds
  app/SoundMixer.astro    ambient loop sliders
  app/SubjectPicker.astro subject tag applied at session start
  app/StatCard.astro      reused across /stats and /planner
  marketing/Hero.astro
  marketing/FaqSection.astro
  marketing/AdSlot.astro
  Header.astro            rewritten
  Footer.astro            rewritten
```

`StudyApp` is composed in `AppShell.astro` from `FlipClock` + `TimerControls` + `SettingsDrawer`; the `mode` prop selects which controls render and which engine class from `src/lib/timerEngine.ts` is instantiated.

**Navigation:** the primary nav becomes Timer / Pomodoro / Planner / Stats, with Clock and Stopwatch in the footer. Planner and Stats are promoted out of hiding.

## 6. Flip clock

Pure CSS 3D. No library.

Each digit is a card with a top half and a bottom half. The flip animates a duplicate half element with `transform: rotateX(-180deg)` and `backface-visibility: hidden` over roughly 400ms. Approximately 60 lines of CSS and 30 lines of JS whose only job is to set the next digit and trigger the class.

**Constraints:**

- Under `prefers-reduced-motion: reduce`, the flip is replaced by an opacity cross-fade. Non-negotiable — a full-screen element flipping every second is a genuine vestibular trigger.
- Digits are `aria-hidden`; a visually-hidden live region announces remaining time at a coarse interval (on minute change, not every second) so screen readers are informed without being flooded.
- The clock scales by container query / `clamp()`, not fixed breakpoints, so one implementation serves a 360px phone and a 27" monitor in full-screen.

## 7. Customization

The settings drawer writes CSS custom properties onto `document.documentElement` and persists through the existing typed `src/lib/storage.ts`.

Settings: theme (light / dark / system), digit colour, card colour, background (solid, gradient, or user-supplied image URL), digit font, 12/24-hour, show seconds.

**Constraint:** a user-supplied background image URL is untrusted input. It is applied only as a CSS `background-image: url(...)` value after validating the string parses as an `http(s)` URL, and the value is never interpolated into markup. No `javascript:` or `data:` schemes accepted.

## 8. Ambient sound

Extends the existing `Ambient` class in `src/lib/alarm.ts`. Four loops shipped as small audio files in `public/audio/`: rain, café, brown noise, fireplace. Independent volume slider per loop, mixable, persisted.

Audio must be started by a user gesture (browser autoplay policy) — the mixer's first interaction is the gesture, so no separate unlock prompt is needed.

Lofi music is explicitly out of scope for this work.

## 9. Stats, streaks, presets, PWA

**Subject tagging.** `SubjectPicker` applies a subject to a session at start; `src/lib/sessions.ts` gains a `subject` field. Existing stored sessions without one are treated as "Unlabelled" — no migration, the field is optional.

**Stats page** gains, on top of the existing heatmap: today and week totals, subject breakdown, current streak, and a best-focus-hour insight derived from session start times. The insight requires a minimum sample (at least 5 sessions) before it is shown, otherwise it states that more data is needed rather than reporting noise.

**Streaks.** Built on `src/lib/gamification.ts`. A day counts toward the streak when total focused time crosses a user-set daily goal.

**Preset links.** `src/lib/urlState.ts` already encodes state in the query string. A "copy my setup" control encodes durations, theme, and sound mix. Loading such a URL applies the preset without overwriting the visitor's saved settings until they explicitly save it.

**PWA.** `public/site.webmanifest` exists. Add a service worker with a cache-first app shell and a network-first strategy for HTML. Fix the `theme_color` mismatch (manifest says `#ffffff`, meta says `#05080f`) and add the missing `favicon.svg`, which currently 404s on every page.

## 10. Ads

A single `marketing/AdSlot.astro`. Rule: it may be rendered only from `src/components/marketing/*` and marketing sections of `/`, `/about`, and the below-fold regions of app routes. It must never render inside `AppShell` or above the fold on an app route.

The AdSense script tag loads lazily and only on pages that actually mount a slot — it is not added to `Layout.astro` globally.

## 11. Infrastructure and SEO

Outstanding items from the project guidelines, all currently missing:

- `public/_headers` — security headers (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`) and cache-control for hashed assets. Note: with the Cloudflare **Workers** adapter, `_headers` is honoured for static assets served from `dist/client`; SSR responses need headers set in the adapter/middleware. Both paths are covered.
- `WebApplication` and `Organization` JSON-LD sitewide; `BreadcrumbList` on sub-pages. `FAQPage` JSON-LD already exists on `/` and is kept.
- `favicon.svg` asset (referenced by `Layout.astro`, does not exist).
- Manifest / meta `theme_color` reconciliation.
- Delete the stale `.vercel/` directory left over from the fork.
- Per the project guideline, disable the `workers.dev` subdomain once the `.com` domain is attached, so the site is not indexable at two origins.
- 600+ words of original prose about the tool on `/`, plus distinct copy per app route (§3).

## 12. Testing

Follows the existing pattern in `scripts/test-timer-engine.mjs` — plain Node, assertion-based, no framework.

- `scripts/test-timer-engine.mjs` — unchanged, must still pass.
- New: flip-digit sequencing (given previous and next value, the correct half-cards animate; 59→00 and 9→0 rollovers behave).
- New: `urlState` round-trip — encode a preset, decode it, assert deep equality.
- New: streak calculation — consecutive days, a gap breaking the streak, and a day that meets the goal only in aggregate across sessions.

Manual verification per phase: Lighthouse mobile (performance and accessibility), layout at 360 / 768 / 1280 px, both themes, and `prefers-reduced-motion` enabled.

## 13. Sequencing

| Phase | Delivers | Done when |
|---|---|---|
| 1 | `tokens.css`, `app.css`, `AppShell`, `FlipClock`, working light/dark toggle; old CSS deleted | `/timer` renders the new clock in both themes with no FOUC |
| 2 | Route consolidation, 301s, `SettingsDrawer`, nav rewrite | All routes in §3 resolve; old URLs 301; customization persists across reload |
| 3 | `SoundMixer`, subject tagging, stats + streaks, preset links, service worker | Stats shows subject breakdown and streak; site installs and runs offline |
| 4 | Marketing copy, per-route SEO prose, JSON-LD, `AdSlot`, `_headers`, favicon fix, `.vercel/` removal | Lighthouse SEO and a11y ≥ 95 on `/` and `/timer` |

Each phase ends on a green test run and its own commit.

## 14. Out of scope

Accounts, cross-device sync, group or virtual study rooms, a blog or study-guides section, lofi music licensing, and any backend service. Each was either deselected or depends on a server this design deliberately does not add.
