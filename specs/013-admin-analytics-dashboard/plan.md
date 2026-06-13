# Implementation Plan: Admin Analytics Dashboard

**Branch**: `013-admin-analytics-dashboard` | **Date**: 2026-06-13 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/013-admin-analytics-dashboard/spec.md`

## Summary

Turn the near-empty admin dashboard (`/admin/dashboard`, currently a single dashed placeholder box) into a live, visually engaging analytics home that aggregates **existing** data into headline KPIs, a per-wave breakdown, brand-colored charts, and engagement/content insight panels. The page is **read-only**: it introduces no new tables, no migrations, and no new runtime dependencies. Charts are rendered as **pure server-side SVG/CSS** (no chart library), keeping the page RSC-first with zero added client JS — consistent with the constitution's "no component library unless justified" posture.

All aggregation is performed by **pure, unit-tested functions in `lib/dashboard/`** that take raw rows fetched by the page RSC and return a view model (totals, per-wave rates, leaderboard, chart series). This mirrors the established pattern on the admin Waves page (`app/admin/waves/page.tsx`), which already fetches `tenants` + `wave_weeks.tenant_id` + `students.tenant_id` and counts them in in-memory `Map`s. The dashboard extends that same approach across the remaining wave-scoped tables.

Four phases, one per prioritized user story, each independently shippable:

1. **Overview KPIs (US1, P1)** — the `lib/dashboard/` aggregation foundation + the headline summary-card row (waves with online/offline split, members, instructors, overall attendance rate, total points). The MVP.
2. **Per-wave breakdown (US2, P2)** — a per-wave panel/table: name, type + status tags (reusing `WaveCard`'s tag styling), member count, attendance rate, submission rate, average rating.
3. **Charts (US3, P3)** — pure-SVG charts: online/offline donut, waves-by-status, members-per-wave bars, top-members-by-points leaderboard; each with an accessible text equivalent and an empty state.
4. **Engagement & content insights (US4, P4)** — submissions + rate, average session/instructor ratings + response count, content totals (weeks, materials, videos, assignments).

Points totals reuse `lib/points/total.ts` (`computeTotal`, `POINTS_EPOCH`) exactly as the student dashboard does, so the leaderboard and program total use the same rules math. Wave isolation is not a constraint on the viewer (the page is admin-only and shows program-wide data), but admin gating is enforced server-side as on every admin route.

## Technical Context

**Language/Version**: TypeScript (strict), React 19 (React Compiler on), Next.js 16 App Router — per `CLAUDE.md`.

**Primary Dependencies**: Existing only — Supabase (Postgres + Auth + RLS), Tailwind v4, Vitest + React Testing Library. **No new dependency.** Charts are hand-rolled SVG/CSS Server Components (decision recorded in `research.md` R1; recharts/visx rejected).

**Storage**: Read-only over existing tables — `tenants` (waves: `type`, `status`), `students`, `instructors`, `wave_weeks`, `wave_materials`, `wave_videos`, `wave_assignments`, `wave_submissions`, `wave_attendance`, `wave_feedback`, `point_rules`. **No new tables, no migration.** Admin RLS (`is_admin()`) already grants the program-wide reads these tables need.

**Testing**: Vitest (jsdom). Pure-lib unit tests for every aggregation function in `lib/dashboard/` (totals, rate formulas with division-by-zero guards, per-wave grouping, leaderboard ordering, chart-series shaping, empty-data sets). Component tests for the SVG chart components (proportional geometry, accessible text equivalent present, empty state) and the stat-card/breakdown components. No Server Action is added (read-only page), so no action tests; no new wave-scoped write path, so no new cross-wave denial case (the admin reader sees all by design — documented in the Constitution Check).

**Target Platform**: Responsive web, mobile-first (320px → desktop); latest two versions of Chrome/Edge/Firefox/Safari + iOS Safari + Android Chrome. The admin dashboard is consulted on both desktop and phone.

**Performance Goals**: No CWV regression vs baseline **LCP < 2.5s / CLS < 0.1 / INP < 200ms** on mid-tier Android over Slow-4G. Per-feature budget: the page is a single RSC render with **no added client JS** (pure-SVG charts ship as static markup). Data is read in one `Promise.all` batch of lightweight, column-narrowed queries (mostly `head:true` counts and minimal-column selects); aggregation is in-memory over those rows. Reads are bounded — see Constraints for the cap strategy.

**Constraints**: Brand tokens only (charts use `--color-brand` + the existing tag palette already in `WaveCard`; any additional chart shade must be a documented brand-consistent tint, recorded in research). English/LTR. WCAG 2.1 AA — every chart MUST carry a text equivalent (color/shape is never the sole information channel). All copy from `lib/strings.ts`. Every rate/average MUST guard division-by-zero → `0` or "—" (never NaN/Infinity). Admin-only via existing route protection + `getUser()`-then-render. Reads MUST be bounded: the members-per-wave and leaderboard inputs are capped/ordered (top-N for the leaderboard, full set acceptable for current scale; see research R3 for the growth upgrade path to an aggregate SQL view).

**Scale/Scope**: 0 migrations, 0 new dependencies, 0 Server Actions. 1 new pure lib module (`lib/dashboard/`), ~6 new presentational Server Components (`components/dashboard/`), 1 rewritten page (`app/admin/dashboard/page.tsx`), `lib/strings.ts` copy additions, and the matching unit/component tests. Medium.

## Constitution Check

*GATE: must pass before Phase 0 and re-checked after design. Constitution v2.2.0.*

- **I. Code Quality** — TS strict; all aggregation logic extracted to pure helpers in `lib/dashboard/` (no Supabase imports → deterministically testable); reuses `lib/points/total.ts` and `WaveCard` tag styling rather than duplicating; no manual memoization (React Compiler); admin-supplied content (wave names) truncated in cards/tables/chart labels per Principle I. **PASS**
- **II. Testing (NON-NEGOTIABLE)** — ships unit tests for every aggregation function (rates, totals, grouping, leaderboard order, empty/zero sets, division-by-zero guards) and component tests for the SVG charts + stat cards (geometry, accessible text equivalent, empty states). No bug fix without a failing-first reproduction test. **No new wave-scoped write path is introduced**, so there is no new cross-wave denial case to add; the existing reads run under admin RLS which already returns all tenants to an admin by design (noted under VI). **PASS**
- **III. UX Consistency** — brand tokens only; reuses the existing wave type/status tag visual language; the page defines explicit **loading** (`loading.tsx` already in the route group), **empty** (fresh platform → neutral zeros / "no data yet"), and **error** (`error.tsx` already present) states; logo/nav context-aware and unchanged. **PASS**
- **IV. Mobile-First & Accessible** — summary cards stack at 320px; the per-wave breakdown uses the contained-scroll `AdminTable` pattern (no page-level horizontal scroll) or a card reflow; charts are fluid SVG (`viewBox` + 100% width) that resize without clipping; each chart exposes a text equivalent (adjacent data summary / accessible labels) so information survives without color; AA contrast verified for every chart fill on white/`#EEF3F8`; validated at 320/390/430/768/desktop. Uses the existing `DashboardShell` (drawer behavior unchanged). **PASS**
- **V. Performance** — RSC-first; **zero added client JS** (pure-SVG charts are static server markup); a single `Promise.all` of column-narrowed reads (mostly `count: head:true` and minimal-column selects), aggregated in memory; reads bounded (leaderboard top-N; growth path to an aggregate SQL view documented in research R3). No file uploads → Principle V's browser→Storage rule is not engaged. No CWV regression budgeted. **PASS**
- **VI. Wave Isolation (NON-NEGOTIABLE)** — the dashboard is **admin-only** and intentionally shows **program-wide, cross-wave** data; this is the sanctioned admin capability ("Admins see all tenants"), not a leak. Access is gated server-side by the existing admin route protection (`proxy.ts`) plus the page's `getUser()` check, consistent with every admin route. No student-facing surface is added, so no per-student wave filter is required and no new cross-wave denial case arises. **PASS**
- **VII. Artifact Structure (NON-NEGOTIABLE)** — phases below are `Phase → User Story → Acceptance Criteria → Test Scenarios`; each implemented phase ships a `walkthrough.md` section covering desktop + mobile golden paths. **PASS**

**No violations → Complexity Tracking is empty.** The one notable choice — hand-rolled SVG charts instead of a charting library — is the *simpler, dependency-free* option and is therefore not a complexity deviation; its rationale and the rejected library alternative are recorded in `research.md` (R1) per the "adding a dependency must be justified" rule (here we justify *not* adding one).

## Project Structure

### Documentation (this feature)

```text
specs/013-admin-analytics-dashboard/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0 — decisions (SVG charts vs lib, rate formulas, aggregation strategy & bounds, palette, points reuse)
├── data-model.md        # Phase 1 — read-only source tables + the derived dashboard view model + formulas
├── quickstart.md        # Phase 1 — run + manual verification per phase (desktop + mobile)
├── contracts/
│   └── ui-contracts.md  # Phase 1 — page data contract, component props, chart accessibility contract, copy keys
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit-specify)
├── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md       # per-phase output (/speckit-implement)
```

### Source Code (repository root)

```text
lib/
├── dashboard/
│   ├── types.ts                        # NEW — DashboardModel, WaveStat, ChartDatum, LeaderboardEntry types
│   ├── aggregate.ts                    # NEW — pure: rows → DashboardModel (totals, per-wave grouping, leaderboard)
│   └── rates.ts                        # NEW — pure: attendanceRate / submissionRate / average with div-by-zero guards
├── points/total.ts                     # REUSE — computeTotal, POINTS_EPOCH (unchanged)
└── strings.ts                          # EDIT — dashboard KPI labels, chart titles/empty states, per-wave column headers

app/
└── admin/
    └── dashboard/
        ├── page.tsx                    # EDIT — rewrite: batch reads → lib/dashboard/aggregate → render sections
        ├── loading.tsx                 # REUSE (already in route group) — verify it covers the new layout
        └── error.tsx                   # REUSE (already present)

components/
└── dashboard/
    ├── StatCard.tsx                    # NEW — Server Component: icon + big number + label (+ optional sub-split)
    ├── StatCardGrid.tsx                # NEW — responsive grid wrapper (stacks at 320px)
    ├── DonutChart.tsx                  # NEW — pure-SVG donut (online/offline, waves-by-status) + text equivalent
    ├── BarChart.tsx                    # NEW — pure-SVG horizontal bars (members per wave) + text equivalent
    ├── PointsLeaderboard.tsx           # NEW — ranked top-N members by points (list/bars) + text equivalent
    ├── PerWaveTable.tsx                # NEW — per-wave breakdown via AdminTable (type/status tags, rates, avg rating)
    └── InsightPanel.tsx                # NEW — labelled stat group for engagement/content insights (ratings, content totals)

tests/
├── lib/dashboard/aggregate.test.ts     # NEW — totals, per-wave grouping, leaderboard ordering, empty/zero data
├── lib/dashboard/rates.test.ts         # NEW — rate/average formulas + division-by-zero → 0/"—" guards
├── components/dashboard/StatCard.test.tsx       # NEW — renders number/label/zero state
├── components/dashboard/DonutChart.test.tsx     # NEW — proportional arcs, text equivalent present, empty state
├── components/dashboard/BarChart.test.tsx       # NEW — proportional bar widths, labels, empty state
├── components/dashboard/PointsLeaderboard.test.tsx  # NEW — ranking, top-N cap, empty state
└── components/dashboard/PerWaveTable.test.tsx   # NEW — row per wave, tags, "—" for no-data metrics
```

**Structure Decision**: All read-only aggregation lives in a new pure module `lib/dashboard/` (Supabase-free, deterministically tested), fed by raw rows the page RSC fetches in one batch — exactly the pattern `app/admin/waves/page.tsx` already uses. Presentational chart/card components live under `components/dashboard/` and are Server Components (pure SVG markup, no `'use client'`), so the dashboard adds **no client JS**. The page itself is the only edited route; `loading.tsx`/`error.tsx` already exist in the route group and are reused. No new route group, Server Action, table, or dependency is introduced.

## Implementation Phases

### Phase 1 — Aggregation foundation & Overview KPIs

#### User Story 1.1 (US1): As an admin opening the dashboard, I want a row of headline KPI cards so that I grasp the program's size and health in seconds

- Description: Build the pure `lib/dashboard/` aggregation layer (`types.ts`, `rates.ts`, `aggregate.ts`) that turns raw rows into a `DashboardModel`, then rewrite `app/admin/dashboard/page.tsx` to fetch the needed data in one `Promise.all` (waves with `type`/`status`, student `tenant_id`s, instructor count, attendance/submission/feedback rows, `point_rules`) and render a responsive `StatCardGrid` of `StatCard`s: total waves with an online/offline split, total members, total instructors, overall attendance rate, and total points awarded program-wide. Total points reuse `computeTotal`/`POINTS_EPOCH` over aggregated counts. Every card shows a neutral zero when its source is empty.

#### Acceptance Criteria (for the phase)

- [ ] `lib/dashboard/rates.ts` exports pure `attendanceRate`, `submissionRate`, and `average` helpers that return a finite number (or a sentinel for "no denominator") and NEVER produce `NaN`/`Infinity` for zero denominators (covered by unit tests).
- [ ] `lib/dashboard/aggregate.ts` exports a pure function mapping raw rows → `DashboardModel` including wave totals + online/offline split, member total, instructor total, overall attendance rate, and total points (via `computeTotal`); it imports no Supabase client.
- [ ] `app/admin/dashboard/page.tsx` renders the KPI cards from the model with correct values matching seeded fixtures; an empty platform renders every card as `0` / "—" with no error and no `NaN`.
- [ ] The KPI grid stacks vertically at 320px with no clipping or horizontal page scroll and remains legible through desktop.
- [ ] All KPI labels come from `lib/strings.ts`; the page is admin-gated (renders only for an authenticated admin, consistent with the route).
- [ ] `npm run build` and `npm run lint` pass clean.

#### Test Scenarios (for the phase)

1. **Given** rows for 5 waves (3 online, 2 offline), 120 members, and 8 instructors, **When** `aggregate` runs, **Then** the model reports 5 waves (3/2 split), 120 members, 8 instructors.
2. **Given** zero attendance rows and zero members, **When** `attendanceRate` is computed, **Then** it returns the no-denominator sentinel (rendered "—"), never `NaN`.
3. **Given** aggregated counts {attendance, post-epoch submissions, feedback} and `point_rules` 10/20/30, **When** total points is computed, **Then** it equals `computeTotal` of those counts × rules.
4. **Given** an empty platform, **When** the dashboard renders, **Then** every KPI card shows `0`/"—" and the page does not error.
5. **Given** a 320px viewport, **When** the dashboard renders, **Then** cards stack and no content is clipped or causes horizontal page scroll.

---

### Phase 2 — Per-wave breakdown

#### User Story 2.1 (US2): As an admin, I want a per-wave breakdown so that I can compare cohorts and spot which need attention

- Description: Add `PerWaveTable` (built on the contained-scroll `AdminTable`) listing every wave once with its name, type badge + lifecycle status tag (reusing `WaveCard`'s tag copy/colors), member count, attendance rate, submission rate, and average feedback rating. `aggregate.ts` is extended to produce a `WaveStat[]` grouped by `tenant_id`. Per-wave rates use the documented formulas (`rates.ts`) with division-by-zero guards; a wave with no members/activity shows `0` or "—" and still renders cleanly. Long wave names truncate.

#### Acceptance Criteria (for the phase)

- [ ] `aggregate.ts` produces a `WaveStat` per wave: `{ id, name, type, status, memberCount, attendanceRate, submissionRate, avgRating }`, grouping attendance/submission/feedback/member rows by `tenant_id`.
- [ ] `PerWaveTable` renders one row per wave with name, the same colored type/status tags as `WaveCard`, member count, attendance rate, submission rate, and average rating; it uses `AdminTable` so the table scrolls inside its container (no page-level horizontal scroll on mobile) and each row carries the `data-admin-row` hook.
- [ ] A wave with zero members shows `0` members and "—" for rates/average (no `NaN`); a wave with members but no submissions shows a `0%`/"—" submission rate per the documented formula.
- [ ] Long wave names truncate without breaking the row layout.
- [ ] Per-wave rate values are consistent with the same formulas used in the Phase 1 overall figures (FR-019).
- [ ] `npm run build`/`lint` clean; validated 320/390/430/768/desktop.

#### Test Scenarios (for the phase)

1. **Given** a wave with 20 members where 15 have ≥1 attendance record, **When** the breakdown renders, **Then** that wave shows "20" members and the attendance rate the documented formula yields (e.g. 75%).
2. **Given** a wave with status `in_progress` + type `online`, **When** rendered, **Then** it carries the same status/type tag styling used on the Waves list.
3. **Given** a newly created wave with no members or activity, **When** rendered, **Then** member count is `0` and every rate/average is "—" with the row intact.
4. **Given** a very long wave name, **When** rendered, **Then** it truncates and the row does not overflow horizontally at the page level on mobile.
5. **Given** the same data set, **When** a wave's per-wave attendance rate and the Phase 1 overall rate are both computed, **Then** they use the identical formula (no divergent definition).

---

### Phase 3 — Charts

#### User Story 3.1 (US3): As an admin, I want brand-colored charts so that distributions are easy to read at a glance, with the same data available to assistive tech

- Description: Add pure-SVG Server Components — `DonutChart` (online vs offline split, and waves-by-lifecycle-status), `BarChart` (members per wave), and `PointsLeaderboard` (top-N members by total points). Each consumes a chart series shaped by `aggregate.ts`, uses only brand-consistent fills, and renders an accessible text equivalent (an adjacent data summary and/or accessible labels) so a screen reader obtains the same figures. Each chart shows a clear empty state when its metric has no data. No client JS is added.

#### Acceptance Criteria (for the phase)

- [ ] `aggregate.ts` exposes chart series: online/offline counts, waves-by-status counts, members-per-wave (name + count), and a top-N leaderboard (`{ name, points }`, ordered desc, capped).
- [ ] `DonutChart` renders arc geometry proportional to its input (a 3:2 input yields a 60%/40% split) using brand-consistent fills, and includes a text equivalent stating the same figures; an all-zero input shows the defined empty state, not a broken graphic.
- [ ] `BarChart` renders one bar per wave with width proportional to member count and a visible wave-name label (truncated if long); empty input shows the empty state.
- [ ] `PointsLeaderboard` lists the top-N members by points in descending order with their totals; fewer than N members renders only those present; zero members shows the empty state.
- [ ] All chart components are Server Components (no `'use client'`); the dashboard ships no additional client JS for charts.
- [ ] Every chart fill meets WCAG AA contrast on white and `#EEF3F8`; charts resize fluidly (no clipping) from 320px to desktop.
- [ ] `npm run build`/`lint` clean.

#### Test Scenarios (for the phase)

1. **Given** 3 online and 2 offline waves, **When** `DonutChart` renders, **Then** its arcs represent a 3:2 split and its text equivalent states "3 online, 2 offline".
2. **Given** members distributed unevenly across waves, **When** `BarChart` renders, **Then** each bar's width is proportional to its wave's member count and labeled with the (possibly truncated) wave name.
3. **Given** more members than the leaderboard cap, **When** `PointsLeaderboard` renders, **Then** exactly the top-N appear in descending points order.
4. **Given** no data for a chart's metric, **When** it renders, **Then** it shows the defined empty state rather than a blank/broken graphic.
5. **Given** a screen reader, **When** any chart is reached, **Then** the underlying figures are available as text (verified via the accessible-text-equivalent assertion in the component test).

---

### Phase 4 — Engagement & content insights

#### User Story 4.1 (US4): As an admin, I want engagement and content insight panels so that I can see how learners are responding and how much content exists

- Description: Add `InsightPanel`s for: total assignment submissions + overall submission rate; average session rating, average instructor rating (each on the 1–5 scale) + total feedback responses; and content-volume totals (weeks, learning materials, videos, assignments). `aggregate.ts` is extended to compute these from the already-fetched rows (counts + averages with guards). Each panel shows a neutral empty state ("No responses yet" / `0`) when its metric has no data.

#### Acceptance Criteria (for the phase)

- [ ] `aggregate.ts` computes: total submissions + overall submission rate; average session rating, average instructor rating, total feedback responses; and content totals (weeks, materials, videos, assignments) — all with division-by-zero guards for the averages/rate.
- [ ] `InsightPanel`s render those figures with labels + icons; ratings display on the 1–5 scale rounded sensibly with the response count they are based on.
- [ ] With no submissions/feedback, the panels show `0` / "No responses yet" rather than a misleading average or an error.
- [ ] Content totals match the underlying row counts for seeded fixtures.
- [ ] The page integrates all four phases' sections into one coherent, responsive layout validated at 320/390/430/768/desktop with no clipping or page-level horizontal scroll.
- [ ] `npm run build`/`lint` clean.

#### Test Scenarios (for the phase)

1. **Given** feedback rows whose session ratings average 4.2, **When** the feedback panel renders, **Then** it shows ≈4.2 / 5 and the response count it used.
2. **Given** 4 weeks, 12 materials, 6 videos, and 8 assignments, **When** the content panel renders, **Then** it shows those four totals with labels/icons.
3. **Given** no submissions and no feedback, **When** the panels render, **Then** they show `0` / "No responses yet" with no `NaN` and no error.
4. **Given** the full dashboard with all sections, **When** rendered at 320/390/430/768/desktop, **Then** there is no clipping, overlap, or page-level horizontal scroll.

## Complexity Tracking

> No constitution violations — table intentionally empty.
