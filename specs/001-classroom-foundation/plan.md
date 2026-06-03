# Implementation Plan: Meska Classroom Foundation (Student & Admin Panels)

**Branch**: `001-classroom-foundation` | **Date**: 2026-06-02 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/001-classroom-foundation/spec.md`

## Summary

Establish the navigable, branded foundation of Meska Classroom: two distinct panel surfaces — a **Student panel** (`/student`) and an **Admin panel** (`/admin`) — each with its own home, wrapped in a shared Server-Component shell (persistent Meska-logo header, brand tokens, loading/empty/error/not-found states), plus a minimal pre-panel entry at `/`. The interface is **English-only, LTR**, with no auth, no waves, and no real content (all deferred). The technical approach: App Router path-segment routing with nested per-panel layouts, a single source of truth for each panel's home href (`lib/panels.ts`) so cross-panel leakage is impossible by construction, Tailwind v4 `@theme` brand tokens (contrast-verified), and the project's first test runner (**Vitest + React Testing Library**) established to cover the panel-isolation guarantee. Full Phase 0/1 design detail lives in [research.md](./research.md), [data-model.md](./data-model.md), [contracts/ui-contracts.md](./contracts/ui-contracts.md), and [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.2.4 (React Compiler enabled), Next.js 16.2.6 (App Router)

**Primary Dependencies**: Next.js, React, Tailwind CSS v4 (`@tailwindcss/postcss`), `tw-animate-css`. **New (this feature)**: Vitest, React Testing Library, `@testing-library/jest-dom`, jsdom — see Constitution Check / R4.

**Storage**: N/A (no backend, no persistence in this feature)

**Testing**: Vitest + React Testing Library (jsdom) — unit/component. Responsive & a11y validated manually per the phase `walkthrough.md`.

**Target Platform**: Web — latest two major versions of Chrome, Edge, Firefox, Safari (desktop) + iOS Safari and Chrome on Android (latest two); mobile-first from 320px.

**Project Type**: Web application (Next.js App Router, frontend-only for now)

**Performance Goals**: Static/RSC pages; meet mobile CWV budget — **LCP < 2.5s, CLS < 0.1, INP < 200ms** on a mid-tier Android over Slow-4G. Logo dimensions reserved to protect CLS; client JS limited to the error boundaries.

**Constraints**: No horizontal scroll/clipping/overlap 320px→desktop; WCAG 2.1 AA (≥4.5:1 text, ≥3:1 UI/large); English-only LTR; brand color only via tokens; canonical `MeskaLogo.png` only.

**Scale/Scope**: 2 panels, ~5 routes (`/`, `/student`, `/admin`, per-panel + global not-found), ~3 shared components, 2 `lib/` modules. No data volume.

## Constitution Check

*GATE: evaluated against constitution v2.0.0. Must pass before Phase 0 and re-checked after Phase 1.*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, build+lint clean, App Router + `@/*` alias, shared logic in `lib/`, no manual memo (React Compiler), components tolerate long/AI text | **PASS** — design uses `lib/panels.ts`, `lib/strings.ts`, `components/*`; no hand-written memoization; `<main>` tolerates long content. |
| II — Testing (NON-NEGOTIABLE) | Guaranteed behavior covered by deterministic isolated tests shipping with the change; establish tooling on first need | **PASS** — establishes Vitest + RTL (R4); tests cover the panel-isolation/logo-target guarantee. Cross-wave denial test **N/A** (no wave-scoped paths) and explicitly not waived. |
| III — UX Consistency | Brand tokens (neon blue/white/`#EEF3F8`), consistent loading/empty/error, context-aware logo in persistent header, canonical `MeskaLogo.png`, English/LTR | **PASS w/ dependency** — tokens defined (R3); shared shell gives consistent states; logo target per-panel. **Dependency**: official `MeskaLogo.png` must replace the placeholder before sign-off (R6). |
| IV — Mobile-First / Responsive / A11y | Usable 320px→desktop, flex/grid, touch targets, visible focus, WCAG AA, brand contrast verified; data-heavy views document a mobile strategy | **PASS** — mobile-first shell; brand contrast computed in R3; validated at 320/390/430/768/desktop in the walkthrough. **Mobile strategy**: single fluid responsive layout; the "data-heavy view" adaptive strategy (card transform / contained scroll) is **N/A** here — no tables/long lists exist — and attaches to the first feature that introduces them. |
| V — Performance | RSC-first, bounded reads, lazy media, CWV budget stated | **PASS** — all screens are Server Components except `error.tsx`; no data reads; logo via `next/image` with reserved dimensions; budget stated above. |
| VI — Wave Isolation (NON-NEGOTIABLE) | Wave-scoped reads filtered server-side; cross-wave denial tested; admin capabilities role-gated | **N/A this feature** — no waves, enrollment, or wave-scoped queries exist; panel separation is structural, not tenant isolation. Role-gating/auth deferred to the first backend feature (per spec Out of Scope and constitution bootstrapping note). Explicitly not waived. |
| VII — Artifact Structure (NON-NEGOTIABLE) | plan = Phase → Story → Acceptance Criteria → Test Scenarios; walkthrough per implemented phase | **PASS** — see Implementation Phases below; each phase ships a `walkthrough.md`. |

**Tech-constraint check**: Adding **Vitest** is the one new architectural dependency. It is **anticipated and required** by Principle II ("the first feature needing tests MUST establish the tooling"), so it is justified rather than a discretionary addition — no Complexity Tracking entry needed. No state library or component library is added.

**Result**: PASS (no unjustified violations). The single tracked dependency is the official logo asset (R6).

## Project Structure

### Documentation (this feature)

```text
specs/001-classroom-foundation/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R7
├── data-model.md        # Phase 1 — config/component entities
├── quickstart.md        # Phase 1 — run & verify
├── contracts/
│   └── ui-contracts.md  # Phase 1 — route + component + token contracts
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit-specify)
├── spec.md
├── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md       # per implemented phase (/speckit-implement, Principle VII)
```

### Source Code (repository root)

```text
app/
├── layout.tsx           # root: lang="en" (LTR), brand fonts, metadata; renders children
├── globals.css          # brand tokens via @theme (brand/page/surface/ink); dark mode removed
├── page.tsx             # pre-panel entry (links to panels) — Phase 1 student link, Phase 2 admin link
├── not-found.tsx        # global branded not-found → path back to "/"
├── student/
│   ├── layout.tsx       # <PanelShell panel={PANELS.student}>
│   ├── page.tsx         # Student home (welcome/scaffold + empty state)
│   ├── loading.tsx      # Student loading state
│   ├── error.tsx        # Student error boundary ('use client')
│   └── not-found.tsx    # Student-scoped not-found → "/student"
└── admin/
    ├── layout.tsx       # <PanelShell panel={PANELS.admin}>
    ├── page.tsx         # Admin home (welcome/scaffold + empty state)
    ├── loading.tsx      # Admin loading state
    ├── error.tsx        # Admin error boundary ('use client')
    └── not-found.tsx    # Admin-scoped not-found → "/admin"

components/
├── PanelShell.tsx       # shared shell: <Header/> + semantic <main> (Server Component)
├── Header.tsx           # persistent header landmark (Server Component)
└── Logo.tsx             # canonical MeskaLogo.png link (keyboard, aria-label, focus ring)

lib/
├── panels.ts            # PANELS config + Panel type (home derived from id)
└── strings.ts           # centralized English UI copy

public/
└── MeskaLogo.png        # canonical asset (placeholder until official mark supplied — R6)

tests/                   # Vitest + RTL (co-located or under tests/ per setup)
└── (panel isolation, logo target, not-found, shell render)
```

**Structure Decision**: Next.js App Router, frontend-only. Two static path segments (`student`, `admin`) with nested layouts deliver the persistent per-panel header automatically; a shared `components/` shell + `lib/panels.ts` single source of truth make panel isolation structural and testable (R1). Vitest config and a `test` script are added at the repo root (R4).

## Implementation Phases

### Phase 1 — Branded shell & Student panel

Delivers the shared foundation (brand tokens, shell, header, logo, copy, test tooling) and the **Student panel** end-to-end — a viable MVP: a student can reach a branded, accessible, responsive home. Implements spec User Story 1 (P1).

#### User Story 1.1: As a student, I want to open a branded Student home with a persistent header whose logo always returns me to the Student home, so that I have a reliable, on-brand entry point.

- Description: Build `app/globals.css` brand tokens (remove boilerplate/dark mode); `lib/panels.ts`, `lib/strings.ts`; `components/Logo.tsx`, `components/Header.tsx`, `components/PanelShell.tsx`; `app/student/{layout,page,loading,error,not-found}.tsx`; the root `app/page.tsx` entry (Student link) and global `app/not-found.tsx`; update `app/layout.tsx` (metadata, `lang="en"`). Establish Vitest + RTL and write the Student-panel tests.

#### Acceptance Criteria (for the phase)

- [ ] Visiting `/student` renders the Student home inside the shared shell with the persistent Meska-logo header present.
- [ ] The header logo is a single keyboard-activatable link to `/student` with a visible brand focus ring and a meaningful accessible label.
- [ ] No rendered link within the Student panel points to an `/admin` route.
- [ ] `/student` provides defined loading, empty, and error states; an unknown `/student/*` route renders a branded not-found with a working link back to `/student`.
- [ ] The Student home has no horizontal scroll, clipping, or overlap at 320 / 390 / 430 / 768px and desktop, portrait and landscape.
- [ ] Brand color, page background `#EEF3F8`, and text are applied only via shared tokens; brand/ink contrast ≥ 4.5:1 (UI/focus ≥ 3:1); screen is English/LTR.
- [ ] `npm run build` passes, `npm run lint` is clean, and `npm test` runs the new Vitest suite green.
- [ ] The logo renders the canonical `MeskaLogo.png` with reserved dimensions (no CLS); placeholder flagged for replacement before sign-off.

#### Test Scenarios (for the phase)

1. **Given** the app is running, **When** a user navigates to `/student`, **Then** the Student home renders with a `<header>` landmark containing the Meska logo link whose target is `/student`.
2. **Given** the Student panel is rendered, **When** the test inspects all links in the shell and header, **Then** none resolves to an `/admin` path (panel isolation).
3. **Given** the header logo, **When** a keyboard user tabs to it and presses Enter, **Then** focus is visibly indicated and activation navigates to `/student`.
4. **Given** a request to `/student/does-not-exist`, **When** the route resolves, **Then** the Student-scoped not-found renders with a working link back to `/student`.
5. **Given** the Student home at 320px width, **When** rendered, **Then** there is no horizontal scroll and all controls remain reachable. *(manual, walkthrough)*

---

### Phase 2 — Admin panel & panel isolation

Adds the **Admin panel** reusing the shared shell, completes the pre-panel entry (Admin link), and proves the two panels never cross. Implements spec User Story 2 (P2).

#### User Story 2.1: As a Meska ops admin, I want to open a branded Admin home — visually consistent with the Student shell but a distinct panel whose logo returns me to the Admin home — so that I have a separate, on-brand admin entry point.

- Description: Add `app/admin/{layout,page,loading,error,not-found}.tsx` using `PANELS.admin`; add the Admin link to the root entry `app/page.tsx`; extend the test suite with cross-panel isolation tests covering both directions.

#### Acceptance Criteria (for the phase)

- [ ] Visiting `/admin` renders the Admin home inside the same shared shell with the persistent header; the header logo links to `/admin`.
- [ ] The Admin panel is visually consistent with the Student shell yet clearly identifies the Admin context.
- [ ] No rendered link within the Admin panel points to a `/student` route, and none within the Student panel points to an `/admin` route (both directions).
- [ ] `/admin` provides defined loading, empty, and error states; an unknown `/admin/*` route renders a branded not-found with a working link back to `/admin`.
- [ ] The Admin home meets the same responsive, contrast, English/LTR, and CWV criteria as Phase 1.
- [ ] The root `/` entry links to both the Student and Admin panels; its logo links to `/`.
- [ ] `npm run build`, `npm run lint`, and `npm test` all pass.

#### Test Scenarios (for the phase)

1. **Given** the app is running, **When** a user navigates to `/admin`, **Then** the Admin home renders with the persistent header whose logo target is `/admin`.
2. **Given** both panels exist, **When** the test inspects every link in the Admin shell, **Then** none resolves to a `/student` path — and the reciprocal check holds for the Student shell.
3. **Given** a request to `/admin/does-not-exist`, **When** the route resolves, **Then** the Admin-scoped not-found renders with a working link back to `/admin`.
4. **Given** the root entry `/`, **When** rendered, **Then** it shows working links to both `/student` and `/admin` and its logo links to `/`.
5. **Given** the Admin home at 320 / 390 / 430 / 768px and desktop, **When** rendered, **Then** there is no horizontal scroll, clipping, or overlap. *(manual, walkthrough)*

## Complexity Tracking

> No constitution violations require justification. The only new dependency (Vitest + RTL) is mandated by Principle II, and the only tracked external input is the official `MeskaLogo.png` asset (R6) — neither is a deviation.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| _(none)_ | — | — |
