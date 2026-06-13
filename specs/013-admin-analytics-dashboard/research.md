# Research: Admin Analytics Dashboard

Phase 0 decisions. Each resolves a question the plan's Technical Context raised. Format: Decision / Rationale / Alternatives considered.

## R1 — Charts: pure server-side SVG vs a charting library

**Decision**: Render all charts as hand-rolled **SVG/CSS Server Components** (`components/dashboard/`), with no charting dependency.

**Rationale**:
- The constitution treats adding a dependency or component library as an architectural decision requiring justification; the burden here is to justify *adding* one. The charts needed are simple (a donut split, a status breakdown, horizontal member bars, a ranked leaderboard) — all trivially expressible as static SVG/`<div>` bars.
- RSC-first / Performance (Principle V): a library like recharts is client-only (`'use client'`, ~50–100 KB gz) and would force the whole chart subtree into the client bundle, adding JS and a hydration cost on a page that otherwise needs none. Pure SVG ships as static server markup → **zero added client JS**, no CWV risk.
- Accessibility (Principle IV) is easier to guarantee by hand: we control the markup, so each chart pairs its visual with an explicit text equivalent (an adjacent figure list / accessible labels), satisfying FR-012 without fighting a library's defaults.
- Brand consistency: we use only the existing `--color-brand` and the tag palette already in `WaveCard`, never a library's default rainbow.

**Alternatives considered**:
- **recharts / visx / chart.js** — rejected: new client-only dependency, bundle + hydration cost, RSC-incompatible, harder to constrain to brand tokens and to make accessible. Not justified for four simple charts.
- **A server-rendered image (e.g. SSR canvas)** — rejected: heavier, not crisp/responsive, worse a11y than inline SVG.

## R2 — Attendance-rate and submission-rate formulas

**Decision** (ratifies the spec's documented defaults; FR-019 requires one definition used everywhere):
- **Attendance rate (per wave)** = `members with ≥1 attendance record ÷ total members in the wave`. Overall attendance rate applies the same definition program-wide (members with ≥1 attendance record ÷ total members).
- **Submission rate (per wave)** = `distinct (member, assignment) submissions received ÷ (members × assignments in the wave)`. Overall = sum of received ÷ sum of expected across waves.
- A wave with **no denominator** (zero members, or zero assignments for submission rate) renders **"—"**, not `0%`.

**Rationale**: There is no stored per-session schedule, so a "present sessions ÷ held sessions" denominator does not exist in the data (`wave_attendance` is one row per student per *calendar day*, with no table of "sessions held"). "Share of members who showed up at least once" is computable from existing rows, is intuitive for an at-a-glance KPI, and degrades cleanly to "—" with no members. Submission rate uses the natural expected-vs-received ratio. Both live in `lib/dashboard/rates.ts` and are reused by the overall figures and the per-wave breakdown so the two never diverge (FR-019).

**Alternatives considered**:
- **Attendance = total attendance rows ÷ (members × distinct attendance days)** — rejected: "distinct days" is data-derived and noisy (a day with one attendee inflates the denominator oddly); less intuitive than "% of members who attended".
- **Adding a sessions/schedule table to get a true rate** — rejected: out of scope (the spec is read-only analytics); would require a migration and new admin authoring UI. Recorded as a possible future refinement.

## R3 — Aggregation strategy & read bounds

**Decision**: Fetch the needed rows in **one `Promise.all`** in the page RSC using **column-narrowed** selects (mostly `select(col)` of just the grouping keys, plus `count: 'exact', head: true` where only a total is needed), then aggregate **in memory** with pure functions in `lib/dashboard/`. The points leaderboard is capped to **top-N** (N small, e.g. 10). This mirrors `app/admin/waves/page.tsx`, which already selects `wave_weeks.tenant_id` + `students.tenant_id` and counts them in `Map`s.

**Rationale**: At the platform's current scale (tens of waves, hundreds of members, low-thousands of activity rows), pulling minimal-column rows and grouping in memory is simple, dependency-free, and matches the established codebase pattern. Narrowing columns and using head-counts keeps payloads small. The leaderboard cap bounds the only inherently ranked output.

**Growth upgrade path (documented, not built now)**: if activity rows grow large, replace the in-memory grouping with a single **read-only SQL view or `SECURITY DEFINER` aggregate RPC** (`GROUP BY tenant_id`) returning pre-aggregated per-wave counts — one round trip, no large row transfer. This is an internal swap behind `lib/dashboard/aggregate.ts`'s input boundary and needs no UI change. Flagged here so a future scale issue has a clear, non-breaking fix.

**Alternatives considered**:
- **Build the aggregate SQL view now** — rejected as premature (adds a migration for no current benefit; simplicity-first). Kept as the documented scale path.
- **Per-wave N+1 queries** — rejected: more round trips, worse than one batch + in-memory grouping.

## R4 — Points reuse

**Decision**: Reuse `lib/points/total.ts` (`computeTotal`, `POINTS_EPOCH`) unchanged for both the program-wide total-points KPI and the per-member leaderboard. Aggregate per-member counts as `{ attendance, assignment (submitted_at ≥ POINTS_EPOCH), feedback }` and apply the current `point_rules` values.

**Rationale**: The student dashboard already computes a student's total exactly this way (`app/student/dashboard/page.tsx`). Reusing the same pure function guarantees the admin leaderboard and the student-facing total agree, and that an admin point-rule edit recomputes both consistently (FR-029 semantics carried over). No new math, no epoch divergence.

**Alternatives considered**:
- **A separate admin-side points calc** — rejected: duplicate logic that could drift from the student total. Single source of truth wins.

## R5 — Empty / loading / error states & division-by-zero

**Decision**: The route group's existing `loading.tsx` and `error.tsx` are reused (verify `loading.tsx` visually covers the new multi-section layout; adjust if it only matched the old placeholder). The **empty platform** state is intrinsic: every aggregation returns `0` and every rate returns the "—" sentinel, so the page renders meaningfully with no data and no special-case branch. All rate/average helpers in `rates.ts` guard a zero denominator and return a typed sentinel the components render as "—".

**Rationale**: Satisfies Principle III's defined-states requirement and FR-005/FR-009/FR-020/SC-004/SC-006 (no NaN/Infinity, neutral zeros) with the minimum code — the "empty" state is just the zero-data path through the same components, kept correct by the guarded helpers.

**Alternatives considered**:
- **A dedicated full-page empty state** — rejected: unnecessary; zeroed cards + chart empty states communicate "fresh platform" and keep one render path.

## R6 — Member-count inclusion (pending vs active)

**Decision**: Member counts (overall and per-wave) include **all roster members assigned to a wave** (both `pending` and active), and exclude unassigned members (those with no `tenant_id`) — matching `app/admin/waves/page.tsx`, which already skips `tenant_id`-less students when counting per wave.

**Rationale**: Consistency with the existing Waves list (the admin's existing mental model of "members in a wave"). Pending members are still enrolled in the cohort. Unassigned members belong to no wave so they cannot be attributed to one. If "active-only" is later desired, it is a one-line filter behind `aggregate.ts`.

**Alternatives considered**:
- **Active-only counts** — rejected for now: would disagree with the Waves list count for the same wave, confusing the admin. Noted as an easy future toggle.

## R7 — Palette for multi-segment charts

**Decision**: Primary series use `--color-brand`. Where a chart needs to distinguish 2–3 categories (online/offline; the three lifecycle statuses), reuse the **status tag palette already defined in `WaveCard`** (slate for not-started, amber for in-progress, emerald for completed) and a brand/brand-tint pair for online/offline. No new standalone accent hue is introduced.

**Rationale**: Principle III requires brand-token discipline and flags new accent colors. Reusing the existing tag colors keeps the dashboard visually consistent with the Waves list (a status segment is the same color as that status's tag), needs no new token, and stays within the sanctioned palette.

**Alternatives considered**:
- **A fresh multi-color chart palette** — rejected: would introduce un-tokenized accent colors needing explicit justification, and clash with the established tag colors.
