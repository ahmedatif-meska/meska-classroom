# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Next.js dev server (Turbopack, with experimental filesystem cache enabled).
- `npm run build` — production build.
- `npm start` — run the production build.
- `npm run lint` — run ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` and `next/typescript`).
- `npm test` — run the full Vitest suite (jsdom, non-watch).
- `npm run test:watch` — run Vitest in watch mode.
- `npx vitest run <file>` — run a single test file, e.g. `npx vitest run tests/components/Logo.test.tsx`.


## Architecture

- Next.js 16 App Router project (`app/` directory). Root layout is `app/layout.tsx`; global styles in `app/globals.css` (Tailwind v4 via `@tailwindcss/postcss`, plus `tw-animate-css`).
- React 19 with the **React Compiler enabled** (`reactCompiler: true` in `next.config.ts`, `babel-plugin-react-compiler` installed). Avoid hand-written `useMemo`/`useCallback` micro-optimizations the compiler will handle; do not write code that relies on referential stability the compiler may change.
- TypeScript strict mode is on. Path alias `@/*` maps to the repo root.
- `devIndicators: false` — the Next.js dev overlay indicator is disabled.

### Two-panel structure

The app has two distinct surfaces — Student and Admin — each with two routes:

```
app/page.tsx                    ← redirect("/student")
app/student/layout.tsx          ← simple pass-through (no shell)
app/student/page.tsx            ← join-session card (sign-in), centered
app/student/dashboard/page.tsx  ← student dashboard (sidebar layout)
app/admin/layout.tsx            ← simple pass-through (no shell)
app/admin/page.tsx              ← admin portal card (sign-in), centered
app/admin/dashboard/page.tsx    ← admin dashboard (sidebar layout)
```

Each panel root directory also contains `loading.tsx`, `error.tsx` (`'use client'`), and `not-found.tsx`.

### Shell components (`components/`)

- `DashboardShell` — Server Component; takes `panelName: string` + `children`. Renders a fixed left sidebar (panel name in brand blue, single "Dashboard" nav item) alongside a scrollable `<main>`. Used by both dashboard pages.
- `Logo` — Server Component; `next/image` wrapped in `next/link`; `aria-label` and `alt` from `lib/strings.ts`. Takes `homeHref` prop. Used on the student sign-in page.
- `PanelShell` — exists in `components/` but is currently unused (dead code from early implementation). The sign-in pages inline their own centering wrapper.

All components are Server Components. Only `error.tsx` files are `'use client'`.

### Config & copy (`lib/`)

- `lib/panels.ts` — `Panel` type and `PANELS` constant. `panel.home` is **always derived** as `` `/${panel.id}` `` — never hand-written. This is the single source of truth that makes cross-panel link leakage structurally impossible.
- `lib/strings.ts` — flat English UI copy constants. All user-facing strings must come from here; no inline string literals in components.

### Brand tokens (`app/globals.css`)

Four tokens under `@theme`; consumers must use tokens, never hex literals:

| Token | Value | Use |
|-------|-------|-----|
| `--color-brand` | `#1B5BFF` | accent, links, focus ring |
| `--color-page` | `#EEF3F8` | page background |
| `--color-surface` | `#FFFFFF` | content surfaces |
| `--color-ink` | `#0A1B2E` | primary text |

### Test tooling (`tests/`)

Vitest + React Testing Library (jsdom). Config: `vitest.config.ts` (globals enabled, `@` alias, jsdom env). Setup: `vitest.setup.ts` imports `@testing-library/jest-dom`. Test files live under `tests/` mirroring source paths (`tests/lib/`, `tests/components/`, `tests/app/`). Next.js modules (`next/image`, `next/link`) are mocked with plain HTML equivalents in every component test file.

## Notes

- No backend, API routes, state library, or component library. Follow App Router conventions and `@/` alias for all new structure.
- The `public/MeskaLogo.png` currently present is a placeholder; the official canonical asset must replace it at the same dimensions (160 × 28 CSS px) before the feature is signed off.

## Project principles

All work MUST comply with the project constitution at `.specify/memory/constitution.md` (currently **v2.0.0**; this file MUST stay consistent with it). In particular:

- **Mobile-first, responsive & accessible** — every screen/component works from 320px through desktop; validate at 320, 390, 430, 768px and desktop. Interactive elements must be touch-friendly, keyboard accessible, and show visible focus; mobile inputs use ≥16px font. Target **WCAG 2.1 AA** (≥4.5:1 contrast). The interface is **English only, left-to-right (LTR)**; internationalization, multi-language support, and RTL are out of scope until a future amendment reintroduces them.
- **Brand & UX consistency** — neon blue on white, `#EEF3F8` page background, tight palette via shared tokens; define loading/empty/error states. The Meska logo (canonical asset `MeskaLogo.png`) sits in the persistent header on every screen and links to the user's panel home — Student home for students, Admin home for admins (context-aware, never crossing panels).
- **Wave isolation (NON-NEGOTIABLE)** — students see only data for waves they are enrolled in; every wave-scoped query filters by the current user's enrollments, enforced server-side, with the cross-wave denial case covered by tests.
- **Testing (NON-NEGOTIABLE)** — see the testing note above.
- **Performance** — RSC-first, bounded/paginated wave-scoped reads, lazy media, no Core Web Vitals (LCP/CLS/interaction) regressions on mobile.
- **Artifact structure & walkthroughs (NON-NEGOTIABLE)** — Spec Kit artifacts MUST follow Principle VII: `plan.md` nests acceptance criteria and test scenarios at the **phase** level; `tasks.md` is `## Phase N` → `### User Story N.x` → atomic `- [ ]` items; each implemented phase ships a `walkthrough.md` in `specs/<feature>/`. Reviewers reject deviations.

## Working guidelines

Behavioral guidelines to reduce common coding mistakes. These bias toward caution over speed; for trivial tasks, use judgment.

**1. Think before coding** — Don't assume; don't hide confusion; surface tradeoffs. State assumptions explicitly and ask when uncertain. If multiple interpretations exist, present them rather than picking silently. If a simpler approach exists, say so and push back when warranted. If something is unclear, stop, name what's confusing, and ask.

**2. Simplicity first** — Minimum code that solves the problem, nothing speculative. No features beyond what was asked, no abstractions for single-use code, no unrequested "flexibility"/configurability, no error handling for impossible scenarios. If 200 lines could be 50, rewrite it. Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

**3. Surgical changes** — Touch only what you must; clean up only your own mess. Don't "improve" adjacent code, comments, or formatting; don't refactor what isn't broken; match existing style even if you'd do it differently. Remove imports/variables/functions that *your* changes made unused, but leave pre-existing dead code (mention it, don't delete it, unless asked). The test: every changed line should trace directly to the request.

**4. Goal-driven execution** — Define success criteria, then loop until verified. Turn tasks into verifiable goals ("add validation" → "write tests for invalid inputs, then make them pass"; "fix the bug" → "write a test that reproduces it, then make it pass"). For multi-step tasks, state a brief plan with a verify check per step. Strong success criteria enable independent looping; weak ones ("make it work") force constant clarification.

These are working if: fewer unnecessary changes in diffs, fewer rewrites from overcomplication, and clarifying questions come *before* implementation rather than after mistakes.

<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan at
`specs/004-admin-management/plan.md` (and its `research.md`, `data-model.md`,
`contracts/admin-management-contracts.md`, `quickstart.md`).
<!-- SPECKIT END -->
