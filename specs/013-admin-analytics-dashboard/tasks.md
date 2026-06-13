---
description: "Task list for Admin Analytics Dashboard"
---

# Tasks: Admin Analytics Dashboard

**Input**: Design documents from `specs/013-admin-analytics-dashboard/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md

**Tests**: REQUIRED (Principle II). This feature adds **no new wave-scoped write path** — it is a read-only admin page that shows program-wide data under admin RLS (which already returns all tenants to an admin). Per the plan's Constitution Check VI, there is therefore **no new cross-wave access-denial case** to add; the required tests here are the pure-aggregation unit tests and the chart/card component tests.

**Organization**: `## Phase N` → `### User Story N.x` → atomic `- [ ]` items (Principle VII). Acceptance criteria + test scenarios live at the phase level in `plan.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1–US4, mapping to the spec's user stories
- Exact file paths are included in every task

---

## Phase 1: Setup

**Purpose**: Module/test folders for the new code. No dependency install (feature adds none).

- [X] T001 Create the new module folders `lib/dashboard/` and `components/dashboard/`, and the mirroring test folders `tests/lib/dashboard/` and `tests/components/dashboard/` (empty; populated by later phases). Confirm `package.json`/lockfile are unchanged (no new dependency).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The shared, story-agnostic scaffolding every user story builds on: view-model types, the pure rate helpers, copy keys, and the admin-gated page read skeleton.

**⚠️ CRITICAL**: No user-story phase can complete until this phase is done.

- [X] T002 [P] Define the view-model types in `lib/dashboard/types.ts` — `RateValue` (`number | null`), `DashboardModel`, `WaveStat`, `ChartDatum`, `LeaderboardEntry`, and `RawDashboardData` (the narrowed row arrays + `point_rules`) per `data-model.md`.
- [X] T003 [P] Write failing unit tests for the rate helpers in `tests/lib/dashboard/rates.test.ts` — `attendanceRate`, `submissionRate`, `average`: correct values for normal inputs, and zero-denominator → `null` (rendered "—"), asserting no `NaN`/`Infinity` is ever produced.
- [X] T004 Implement the pure helpers in `lib/dashboard/rates.ts` (`attendanceRate(present, total)`, `submissionRate(received, expected)`, `average(sum, count)`; Supabase-free) so T003 passes.
- [X] T005 [P] Add the dashboard copy keys to `lib/strings.ts` (section headings, KPI labels incl. online/offline sublabel, chart titles + shared `chartEmptyNote`, per-wave column headers, insight labels, `rateNoData` "—", `feedbackNoResponsesNote`) per `contracts/ui-contracts.md`. Reuse existing `waveType*`/`waveStatus*`/member-plural keys — do not duplicate them.
- [X] T006 Replace the placeholder body of `app/admin/dashboard/page.tsx` with the admin-gated RSC scaffold: `getUser()`, a single `Promise.all` of the column-narrowed reads listed in `data-model.md` (waves, students, instructors count, weeks/materials/videos/assignments, submissions, attendance, feedback, `point_rules`), and a call to `buildDashboardModel` (imported from `lib/dashboard/aggregate.ts`, added in T008). Keep the `DashboardShell` wrapper and render empty section containers with their headings; no aggregation arithmetic inline.

**Checkpoint**: Types, guarded rate helpers, copy, and the page read pipeline exist. User-story phases can proceed.

---

## Phase 3 — Overview KPIs (plan Phase 1)

**Goal**: Headline KPI cards giving the program snapshot at a glance. **This is the MVP.**

### User Story 3.1: Program overview (Priority: P1) 🎯 MVP

**Independent Test**: Sign in as admin; the KPI cards show correct totals (waves + online/offline split, members, instructors, overall attendance rate, total points) matching seeded data, stack cleanly at 320px, and read `0`/"—" on an empty platform.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [X] T007 [P] [US1] Write failing unit tests for the overview slice in `tests/lib/dashboard/aggregate.test.ts` — `buildDashboardModel` returns correct `waveTotal`, `waveByType` (online/offline), `memberTotal`, `instructorTotal`, `overallAttendanceRate` (via `rates`), and `totalPoints` (via `computeTotal`); empty input → zeros and `null` rate (no `NaN`).
- [X] T008 [P] [US1] Write a failing component test in `tests/components/dashboard/StatCard.test.tsx` — `StatCard` renders its value, label, optional sublabel, and a zero value.

#### Implementation for User Story 3.1

- [X] T009 [US1] Implement the overview slice of `buildDashboardModel` in `lib/dashboard/aggregate.ts` (`waveTotal`, `waveByType`, `memberTotal`, `instructorTotal`, `overallAttendanceRate` via `rates.ts`, `totalPoints` via `computeTotal`/`POINTS_EPOCH` from `lib/points/total.ts` over aggregated per-member counts) so T007 passes.
- [X] T010 [P] [US1] Create `components/dashboard/StatCard.tsx` (Server Component: icon + big number + label + optional sublabel) so T008 passes.
- [X] T011 [P] [US1] Create `components/dashboard/StatCardGrid.tsx` (Server Component: responsive grid — 1 col @320, 2 @sm, up to 4 @lg).
- [X] T012 [US1] In `app/admin/dashboard/page.tsx`, render the KPI section: a `StatCardGrid` of `StatCard`s for waves (with online/offline sublabel), members, instructors, attendance rate, and total points, using `lib/strings.ts` copy and showing `rateNoData` ("—") when the rate is `null`.

**Checkpoint**: KPI overview is independently functional. Produce the `walkthrough.md` section for this phase before sign-off.

---

## Phase 4 — Per-wave breakdown (plan Phase 2)

**Goal**: A per-wave table so the admin can compare cohorts.

### User Story 4.1: Per-wave breakdown (Priority: P2)

**Independent Test**: Each wave appears once with name, type/status tags (same colors as the Waves list), member count, attendance rate, submission rate, and average rating; a wave with no members/activity shows `0`/"—" and still renders; long names truncate; the table scrolls inside its container on mobile.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [X] T013 [P] [US2] Extend `tests/lib/dashboard/aggregate.test.ts` with failing tests for the `waves: WaveStat[]` slice — grouping by `tenant_id`; `memberCount` includes `pending` and excludes unassigned (no `tenant_id`); per-wave `attendanceRate`/`submissionRate`/`avgRating` use `rates.ts` with `null` guards; per-wave attendance rate equals the overall formula for the same data (FR-019 consistency).
- [X] T014 [P] [US2] Write a failing component test in `tests/components/dashboard/PerWaveTable.test.tsx` — one row per wave, correct type/status tags, `"—"` for no-data metrics, long-name truncation, and the `data-admin-row` hook on each row.

#### Implementation for User Story 4.1

- [X] T015 [US2] Extend `buildDashboardModel` in `lib/dashboard/aggregate.ts` to produce `waves: WaveStat[]` (`{ id, name, type, status, memberCount, attendanceRate, submissionRate, avgRating }`) grouped by `tenant_id`, so T013 passes.
- [X] T016 [US2] Extract the wave type/status tag copy+color mapping currently inline in `components/WaveCard.tsx` into a small shared helper (`components/WaveTags.tsx` or `lib/waves/tags.ts`) and have `WaveCard` consume it with **no change to its rendered output** (avoids color duplication — Principle I).
- [X] T017 [US2] Create `components/dashboard/PerWaveTable.tsx` built on `AdminTable` (contained horizontal scroll), reusing the T016 tag helper, rendering member count and the three rates/average with `"—"` for `null`, so T014 passes.
- [X] T018 [US2] Render the per-wave breakdown section in `app/admin/dashboard/page.tsx` below the KPI cards, fed by `model.waves`.

**Checkpoint**: Per-wave breakdown is independently functional. Update `walkthrough.md` for this phase.

---

## Phase 5 — Charts (plan Phase 3)

**Goal**: Brand-colored pure-SVG charts with accessible text equivalents.

### User Story 5.1: Visual charts (Priority: P3)

**Independent Test**: The online/offline donut, waves-by-status chart, members-per-wave bars, and points leaderboard render with proportions matching the data, use brand colors, expose a text equivalent of their figures, and show an empty state when their metric has no data. No client JS is added.

#### Tests for User Story 5.1 (REQUIRED — Principle II) ⚠️

- [X] T019 [P] [US3] Extend `tests/lib/dashboard/aggregate.test.ts` with failing tests for the `charts` slice — `typeSplit`, `statusSplit`, `membersPerWave` (label = wave name), and `leaderboard` (per-member `computeTotal`, sorted desc, capped to top-N).
- [X] T020 [P] [US3] Write a failing component test in `tests/components/dashboard/DonutChart.test.tsx` — arc geometry proportional to input (3:2 → 60/40), text equivalent present and matching, all-zero → empty state.
- [X] T021 [P] [US3] Write a failing component test in `tests/components/dashboard/BarChart.test.tsx` — bar widths proportional to value, labels present (truncated if long), empty input → empty state.
- [X] T022 [P] [US3] Write a failing component test in `tests/components/dashboard/PointsLeaderboard.test.tsx` — entries in descending points order, top-N cap respected, zero members → empty state.

#### Implementation for User Story 5.1

- [X] T023 [US3] Extend `buildDashboardModel` in `lib/dashboard/aggregate.ts` to produce `charts.typeSplit`, `charts.statusSplit`, `charts.membersPerWave`, and `charts.leaderboard` (top-N), so T019 passes.
- [X] T024 [P] [US3] Create `components/dashboard/DonutChart.tsx` (pure-SVG Server Component; `role="img"` + `aria-label`/`<title>` text equivalent; brand-consistent fills per research R7; `emptyLabel`) so T020 passes.
- [X] T025 [P] [US3] Create `components/dashboard/BarChart.tsx` (pure-SVG horizontal bars; truncated labels; text equivalent; `emptyLabel`) so T021 passes.
- [X] T026 [P] [US3] Create `components/dashboard/PointsLeaderboard.tsx` (ranked top-N list/bars; text equivalent; `emptyLabel`) so T022 passes.
- [X] T027 [US3] Render the charts section in `app/admin/dashboard/page.tsx` — `DonutChart` for type split and for status split, `BarChart` for members-per-wave, `PointsLeaderboard` — using `lib/strings.ts` titles and `chartEmptyNote`.

**Checkpoint**: Charts are independently functional. Update `walkthrough.md` for this phase.

---

## Phase 6 — Engagement & content insights (plan Phase 4)

**Goal**: Secondary panels for engagement and content volume.

### User Story 6.1: Engagement & content insights (Priority: P4)

**Independent Test**: Panels show total submissions + overall submission rate; average session and instructor ratings (1–5) + response count; and content totals (weeks, materials, videos, assignments); all match seeded data and show `0`/"No responses yet" when empty.

#### Tests for User Story 6.1 (REQUIRED — Principle II) ⚠️

- [X] T028 [P] [US4] Extend `tests/lib/dashboard/aggregate.test.ts` with failing tests for the `engagement` and `content` slices — `submissionsTotal`, `overallSubmissionRate`, `avgSessionRating`, `avgInstructorRating`, `feedbackResponses`, and the four content counts; zero feedback/submissions → `null` averages/rate (no `NaN`).
- [X] T029 [P] [US4] Write a failing component test in `tests/components/dashboard/InsightPanel.test.tsx` — renders labelled items with values/icons and a neutral empty/zero value.

#### Implementation for User Story 6.1

- [X] T030 [US4] Extend `buildDashboardModel` in `lib/dashboard/aggregate.ts` to produce the `engagement` and `content` slices, so T028 passes.
- [X] T031 [US4] Create `components/dashboard/InsightPanel.tsx` (Server Component: titled group of `{ label, value, icon? }` items) so T029 passes.
- [X] T032 [US4] Render the engagement and content insight panels in `app/admin/dashboard/page.tsx` — submissions + rate; ratings on the 1–5 scale rounded to one decimal with their response count (`feedbackNoResponsesNote` when zero); content totals — using `lib/strings.ts`.

**Checkpoint**: All four sections present and independently functional. Update `walkthrough.md` for this phase.

---

## Phase 7 — Polish & Cross-Cutting Concerns

- [X] T033 [P] Verify `app/admin/dashboard/loading.tsx` covers the new multi-section layout (not just the old placeholder); update the skeleton if needed.
- [X] T034 Full responsive + accessibility pass per `quickstart.md` at 320/390/430/768px + desktop — no clipping/overlap/page-level horizontal scroll; chart fills meet AA contrast on white and `#EEF3F8`; keyboard focus order and visible focus correct; sidebar collapses to the drawer on mobile.
- [X] T035 Run `npm run build` and `npm run lint` clean, and `npm test` green (new `tests/lib/dashboard/*` and `tests/components/dashboard/*` included) — Quality Gates 1 & 2.
- [X] T036 Write/finalize `specs/013-admin-analytics-dashboard/walkthrough.md` with one section per implemented phase (run command + URL, route/component paths, numbered desktop + mobile golden-path verification, known gaps) — Principle VII.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies.
- **Foundational (Phase 2)**: depends on Setup. **Blocks all user stories.** Within it: T004 depends on T003; T006 depends on T002 (and references the aggregate file added in T009). T002, T003, T005 are parallel.
- **User stories (Phases 3–6)**: all depend on Foundational. They share one file each in `lib/dashboard/aggregate.ts` (built incrementally) and `app/admin/dashboard/page.tsx` (rendered incrementally), so the **aggregate-extend** and **page-render** tasks across phases are sequential, but each phase's tests and new components are parallel. Stories remain independently testable (each ships its own aggregation slice + components + page section).
- **Polish (Phase 7)**: depends on all desired stories.

### Within each user story

- Write the failing tests first (Principle II), then implement to green.
- `aggregate.ts` slice → components → page render.

### Parallel Opportunities

- Phase 2: T002, T003, T005 in parallel.
- Phase 3: T007, T008 (tests) parallel; T010, T011 (distinct component files) parallel.
- Phase 5: T020, T021, T022 (tests) parallel; T024, T025, T026 (distinct chart files) parallel.
- Phase 6: T028, T029 parallel.
- Phase 7: T033 parallel with documentation prep.

### Note on wave isolation (Principle VI)

No task adds a wave-scoped **write** path or a student-facing surface. The page is admin-only and intentionally shows cross-wave (program-wide) data under admin RLS, as sanctioned by the constitution ("Admins see all tenants"). Hence there is **no cross-wave denial test** in this feature — confirmed against the plan's Constitution Check VI.

---

## Parallel Example: User Story 3.1 (Overview)

```bash
# Tests first, together:
Task: "Unit tests for overview aggregation in tests/lib/dashboard/aggregate.test.ts"   # T007
Task: "Component test for StatCard in tests/components/dashboard/StatCard.test.tsx"     # T008

# Then the two distinct component files together:
Task: "Create components/dashboard/StatCard.tsx"      # T010
Task: "Create components/dashboard/StatCardGrid.tsx"  # T011
```

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. Phase 1 Setup → 2. Phase 2 Foundational → 3. Phase 3 (US1 Overview KPIs) → **STOP and validate** against seeded + empty data → demo. This alone delivers the requested "catchy" program snapshot.

### Incremental Delivery

Add US2 (per-wave) → US3 (charts) → US4 (insights), each tested and demoable on its own, each adding a section without breaking the prior ones.

---

## Notes

- [P] = different files, no incomplete-task dependency.
- This feature adds **no migration, no new dependency, and no Server Action** — keep aggregation in pure `lib/dashboard/` and all chart components as Server Components (zero added client JS).
- Reuse `lib/points/total.ts` for points and the `WaveCard` tag helper for type/status tags — do not duplicate point math or tag colors.
- Verify each test fails before implementing it. Commit after each task or logical group.
