# Implementation Plan: Student Home & Weeks Navigation

**Branch**: `010-student-home-weeks` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-student-home-weeks/spec.md`

## Summary

Restructure the student panel into a **Home** overview plus a **Weeks** navigation. Home is renamed from "Dashboard," greets the student by name ("Welcome to [name] 👋"), labels their cohort ("You are in wave [wave name]"), surfaces the admin-managed **instructors**, keeps the QR code, and **no longer lists materials or assignments**. Those move into a collapsible **Weeks** sidebar group that lists exactly the weeks of the student's own wave; selecting a week opens a per-week view whose **Resources** (materials) and **Assignments** (downloadable + submittable) are presented as labelled disclosures.

The course content already exists (feature 008: `wave_weeks`, `wave_materials`, `wave_assignments`, `wave_submissions`, private wave-scoped Storage). This feature is overwhelmingly a **presentation/navigation restructure** plus **one data-access change**: making the existing `instructors` rows readable by authenticated students (write stays admin-only) via a new RLS migration. No new content tables.

## Technical Context

**Language/Version**: TypeScript (strict), React 19 (React Compiler on), Next.js 16 App Router.

**Primary Dependencies**: Next.js 16, Supabase (`@supabase/ssr`, anon cookie-bound client), Tailwind v4, `sanitize-html` (via `lib/instructors/sanitize.ts`).

**Storage**: Supabase Postgres (RLS) — `instructors`, `tenants`, `students`, `wave_weeks`, `wave_materials`, `wave_assignments`, `wave_submissions`. Private Storage buckets `wave-materials` (materials + assignment files) and `assignment-submissions`; public `instructor-images`. No new tables; one new RLS policy revision on `instructors`.

**Testing**: Vitest + React Testing Library (jsdom); Supabase clients and `next/*` mocked; RLS denial cases in `tests/integration/rls.test.ts`.

**Target Platform**: Web (mobile-first), latest two versions of Chrome/Edge/Firefox/Safari + iOS Safari + Android Chrome.

**Project Type**: Web application (Next.js App Router; single project, `app/` + `components/` + `lib/`).

**Performance Goals**: No CWV regression vs baseline (LCP < 2.5s, CLS < 0.1, INP < 200ms on mid-tier Android / Slow-4G). RSC-first; instructor photos lazy-loaded; signed material/assignment URLs minted server-side per request.

**Constraints**: English-only/LTR; brand tokens only; uploads stay browser→Storage (unchanged submission flow); wave isolation enforced server-side (RLS); per-week reads bounded (a wave has few weeks; one week's materials/assignments fetched per page).

**Scale/Scope**: ~6 components touched/added, 2 routes (Home + new week route), 1 nav helper, 1 migration, copy additions, test updates. Per-student data sets are small (one wave, a handful of weeks, a small instructor list).

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Code Quality** — TS strict, App Router + `@/` alias, no manual memoization (React Compiler). `DashboardShell` gains an optional `children?: NavItem[]` for collapsible groups — backward compatible (admin nav unaffected). Components handle long/AI/user content (sanitized rich text; truncation not required here). **PASS**
- **II. Testing (NON-NEGOTIABLE)** — Every changed behavior ships deterministic tests; the cross-wave denial case is tested for the new week route and for instructor read (see Test Scenarios). New: `tests/app/student-week.test.tsx`, `tests/components/DashboardShell.test.tsx` (collapsible group), updated `tests/app/student-dashboard.test.tsx`, and `tests/integration/rls.test.ts` additions (student reads instructors; student write denied; cross-wave week/material denied). **PASS**
- **III. UX Consistency** — Brand tokens only; loading/empty/error states defined for Home, Weeks group, week view, Resources/Assignments groups, and instructors. Logo/home-link behavior unchanged. **PASS**
- **IV. Mobile-First & Accessible** — The Weeks collapsible lives inside the existing off-canvas drawer; disclosure toggles expose `aria-expanded`/`aria-controls`, are keyboard-activatable with visible focus; week-content Resources/Assignments use accessible disclosures; validated at 320/390/430/768/desktop. **PASS**
- **V. Performance** — RSC-first (week view and instructors are Server Components; only disclosures/nav toggles are client). Per-week bounded reads; lazy instructor images; no upload routed through a Server Action body (submission flow reused as-is). **PASS**
- **VI. Wave Isolation (NON-NEGOTIABLE)** — Weeks/materials/assignments remain wave-scoped by RLS and queried with `tenant_id = jwt_tenant_id()`; the new week route self-checks the week belongs to the caller's wave and 404s otherwise; file downloads keep the existing wave-folder Storage policy. **Instructors are global reference/display data (no `tenant_id`), so exposing them to all authenticated students is not a wave-scoped leak** — documented in research R3; instructor *writes* stay admin-gated. **PASS (with R3 note)**
- **VII. Artifact Structure (NON-NEGOTIABLE)** — This plan uses Phase → User Story → phase-level Acceptance Criteria + Test Scenarios; `/speckit-tasks` will consume it; each implemented phase ships a `walkthrough.md`. **PASS**

**Result: PASS — no violations, Complexity Tracking not required.**

## Project Structure

### Documentation (this feature)

```text
specs/010-student-home-weeks/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 output
├── data-model.md        # Phase 1 output
├── quickstart.md        # Phase 1 output
├── contracts/
│   └── ui-contracts.md   # Phase 1 output (UI/route/RLS contracts)
├── checklists/
│   └── requirements.md   # From /speckit-specify
├── tasks.md             # /speckit-tasks (later)
└── walkthrough.md       # /speckit-implement (per phase)
```

### Source Code (repository root)

```text
app/student/dashboard/
├── page.tsx                         # CHANGED — Home: greeting, wave label, instructors, QR; no materials/assignments
└── weeks/
    └── [weekId]/
        └── page.tsx                 # NEW — per-week view (Resources + Assignments), wave-self-gated

components/
├── DashboardShell.tsx               # CHANGED — NavItem gains optional children → collapsible group (drawer-aware)
├── StudentWeekContent.tsx           # NEW — one week's Resources/Assignments disclosures (refactored from StudentWaveContent)
├── StudentInstructors.tsx           # NEW — Home "About instructors" cards (photo, name, sanitized bio)
├── StudentWaveContent.tsx           # REMOVED — replaced by per-week view (dead after this feature)
└── SubmitAssignment.tsx             # UNCHANGED — reused inside the Assignments disclosure

lib/
├── students/
│   └── nav.tsx                      # NEW — buildStudentNav(supabase, tenantId): Home + Weeks(children=weeks)
└── strings.ts                       # CHANGED — Home/greeting/wave-label/Weeks/Resources/About-instructors/empty copy

supabase/migrations/
└── 0015_instructors_student_read.sql  # NEW — instructors SELECT readable by authenticated users; write unchanged

tests/
├── app/student-dashboard.test.tsx   # CHANGED — Home content assertions
├── app/student-week.test.tsx        # NEW — week view + cross-wave denial
├── components/DashboardShell.test.tsx  # NEW — collapsible group a11y/behavior
└── integration/rls.test.ts          # CHANGED — instructor student-read + write-deny; cross-wave week/material deny
```

**Structure Decision**: Single Next.js App Router project (existing layout). Follow the established per-page shell pattern (each student page invokes `DashboardShell` with nav built by a shared helper + its own `activeHref`), mirroring how every admin page uses `adminNavItems`. The new week view is a real route under the already-protected `/student/dashboard/:path*` matcher, so `proxy.ts` needs **no change**.

## Implementation Phases

### Phase 1 — Home reshape

#### User Story 1.1: As a student, I want a personalized Home (renamed from Dashboard) so that the panel greets me and frames my wave clearly.

- Description: Relabel the "Dashboard" nav entry and page heading to **Home**; replace the heading/subtitle with **"Welcome to [name] 👋"**; relabel the wave section to **"You are in wave [wave name]"** (keeping the authored, sanitized wave description and its empty state); **remove materials and assignments from Home**; keep the QR section. Add the new student-nav helper returning at least the **Home** entry (Weeks group added in Phase 2). Greeting falls back to the account email when the roster name is absent.

#### Acceptance Criteria (for the phase)

- [ ] The student sidebar entry and Home page heading read "Home" (never "Dashboard").
- [ ] Home greets the signed-in student as "Welcome to [their own name] 👋", falling back to their email when the name is unavailable.
- [ ] The wave section reads "You are in wave [wave name]" and renders the wave's sanitized description, with a sensible empty state when there is none.
- [ ] Home renders zero materials and zero assignments.
- [ ] The QR section remains present and functional.
- [ ] All new/changed copy comes from `lib/strings.ts` (no inline literals); English-only/LTR.
- [ ] Build and lint pass; Home renders correctly at 320/390/430/768/desktop.

#### Test Scenarios (for the phase)

1. **Given** a signed-in student with roster name "Sara" in wave "July Cohort", **When** Home loads, **Then** the nav and heading show "Home", the greeting shows "Welcome to Sara 👋", and the wave line shows "You are in wave July Cohort".
2. **Given** a student whose roster name is missing, **When** Home loads, **Then** the greeting falls back to their email and is never empty/broken.
3. **Given** the student's wave has materials and assignments, **When** Home loads, **Then** no material and no assignment is rendered anywhere on Home.
4. **Given** a wave with no description, **When** Home loads, **Then** the wave section shows the empty state rather than a blank/broken region.

---

### Phase 2 — Weeks navigation & per-week content

#### User Story 2.1: As a student, I want a collapsible Weeks list of my wave's weeks so that I can browse the course structure.

- Description: Extend `DashboardShell`'s `NavItem` with an optional `children` array; when present, render a disclosure group (label + chevron, `aria-expanded`/`aria-controls`) that expands to the child links, working inside the mobile drawer and auto-expanding when a child is the active route. `buildStudentNav` adds a **Weeks** group whose children are exactly the caller's wave's weeks (in `position` order, labelled by title or "Week N"), with a clear empty state when there are none.

#### User Story 2.2: As a student, I want each week's Resources and Assignments as labelled drop-downs so that I can download materials and submit assignments in context.

- Description: Add the route `app/student/dashboard/weeks/[weekId]/page.tsx` (RSC). It loads the week (scoped to the caller's wave; 404 if it is not the caller's), then renders `StudentWeekContent` showing a **Resources** disclosure (the week's materials as wave-scoped signed-URL downloads, empty state when none) and an **Assignments** disclosure (the week's assignments as downloads plus the existing `SubmitAssignment` control, empty state when none). Refactor the per-week rendering out of the now-removed `StudentWaveContent`.

#### Acceptance Criteria (for the phase)

- [ ] The sidebar shows a **Weeks** group with a working expand/collapse control (keyboard-activatable, visible focus, `aria-expanded`/`aria-controls`), functional inside the mobile drawer.
- [ ] Expanding Weeks lists exactly the caller's wave's weeks in `position` order; a wave with zero weeks shows a clear empty state.
- [ ] The Weeks list never contains a week from another wave.
- [ ] Selecting a week opens its view with a **Resources** disclosure and an **Assignments** disclosure, each labelled and collapsible.
- [ ] Resources lists the week's materials as downloadable items (existing wave-scoped signed URLs), with an empty state when none.
- [ ] Assignments lists the week's assignments as downloads and preserves submission upload, with an empty state when none.
- [ ] Requesting a week (or its files) outside the caller's wave is denied (404 / null URL); covered by an automated cross-wave test.
- [ ] Build and lint pass; week view and Weeks nav validated at 320/390/430/768/desktop.

#### Test Scenarios (for the phase)

1. **Given** a student whose wave has 2 weeks, **When** they expand Weeks, **Then** exactly "Week 1" and "Week 2" appear in position order and nothing from another wave.
2. **Given** a wave with no weeks, **When** the student expands Weeks, **Then** a clear empty state shows (no broken/empty list).
3. **Given** a week with a material and an assignment, **When** the student opens that week and its Resources and Assignments disclosures, **Then** the material downloads and the assignment is downloadable and submittable.
4. **Given** a week belonging to wave B, **When** a student of wave A navigates to `/student/dashboard/weeks/<that week id>`, **Then** they get a not-found/denied result and never see wave B content (cross-wave denial).
5. **Given** a student of wave A, **When** the app requests a wave-B material file path, **Then** the signed URL is null and no download is possible.
6. **Given** keyboard-only navigation, **When** the student focuses and toggles the Weeks group and a Resources/Assignments disclosure, **Then** they operate with visible focus and correct `aria-expanded`.

---

### Phase 3 — Instructors on Home

#### User Story 3.1: As a student, I want to see the course instructors on Home so that I know who is teaching, with the list coming from the admin panel.

- Description: Add a new RLS migration so authenticated users (which includes students) can `select` `instructors`; instructor `write` (insert/update/delete) stays admin-only and instructor images remain publicly readable. Add `StudentInstructors` (RSC) to Home below the wave section: cards showing each instructor's photo (lazy), name, and sanitized description, reflecting the current admin-managed set, with a friendly empty state (or omission) when none exist. Students get **view-only** access — no management affordances.

#### Acceptance Criteria (for the phase)

- [ ] Home shows an "About instructors" section listing all admin-created instructors with photo, name, and sanitized formatted description.
- [ ] Adding/editing/removing an instructor in the admin panel is reflected to students on their next Home load.
- [ ] When no instructors exist, the section shows a friendly empty state (or is omitted) with no error/broken layout.
- [ ] A student can perform no instructor create/edit/remove action; instructor writes are denied server-side (RLS) for students.
- [ ] Instructor descriptions are sanitized before rendering to students.
- [ ] Build and lint pass; the section renders at 320/390/430/768/desktop with lazy images.

#### Test Scenarios (for the phase)

1. **Given** two admin-created instructors, **When** a student opens Home, **Then** both appear with photo, name, and formatted (sanitized) description.
2. **Given** an admin removes an instructor, **When** the student reloads Home, **Then** the removed instructor no longer appears.
3. **Given** no instructors exist, **When** a student opens Home, **Then** the section shows the empty state (or is absent) with no error.
4. **Given** a student session, **When** an instructor insert/update/delete is attempted under that session, **Then** RLS denies it (instructor management stays admin-only).
5. **Given** an instructor description containing unsafe markup, **When** it renders to the student, **Then** only safe formatting is shown.

## Complexity Tracking

> No constitution violations — table intentionally empty.
