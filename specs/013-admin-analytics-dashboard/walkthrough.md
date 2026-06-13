# Walkthrough: Admin Analytics Dashboard

Feature `013-admin-analytics-dashboard`. The admin dashboard (`/admin/dashboard`),
previously a single dashed placeholder, is now a live read-only analytics home:
headline KPI cards, a per-wave breakdown, brand-colored pure-SVG charts, and
engagement/content insight panels. **No migration, no new dependency, no Server
Action.**

## How to run

```bash
npm install     # no new deps
npm run dev     # http://localhost:3000
```

Sign in as an admin (`npm run seed:admin` if needed), then open
`http://localhost:3000/admin/dashboard`. For a meaningful view, seed a few waves
(mixed online/offline + statuses), members, and some attendance/submissions/feedback.

Tests / gates:

```bash
npx vitest run tests/lib/dashboard tests/components/dashboard   # 32 tests
npm test            # full suite — 591 passed, 7 skipped
npm run build       # clean
npm run lint        # clean
```

## Phase 1 — Aggregation foundation & Overview KPIs (US1)

**What shipped**

- `lib/dashboard/types.ts` — the `DashboardModel` view-model + `RawDashboardData` input types.
- `lib/dashboard/rates.ts` — pure `attendanceRate` / `submissionRate` / `average`; every one guards a zero denominator → `null` (never `NaN`/`Infinity`).
- `lib/dashboard/aggregate.ts` — pure `buildDashboardModel(raw)`; reuses `computeTotal`/`POINTS_EPOCH` from `lib/points/total.ts` for the points total + leaderboard.
- `lib/dashboard/format.ts` — `formatPercent` / `formatRating` (null → "—").
- `components/dashboard/StatCard.tsx`, `StatCardGrid.tsx` — KPI cards + responsive grid (1 col @320 → 4 @lg).
- `app/admin/dashboard/page.tsx` — rewritten RSC: one `Promise.all` of column-narrowed reads → `buildDashboardModel` → sections.

**Golden path (desktop + mobile)**

1. Open `/admin/dashboard`. The **Overview** row shows: Waves (with an "N online · M offline" sublabel), Members, Instructors, Attendance rate, Points awarded.
2. Cross-check the wave count + online/offline split against `/admin/waves`.
3. **320px**: KPI cards stack to a single column; no clipping or horizontal page scroll.
4. **Empty platform**: every card reads `0` / "—" — no `NaN`, no error (verified by `tests/app/admin-dashboard.test.tsx` rendering with empty reads, and `aggregate.test.ts` empty-platform case).

## Phase 2 — Per-wave breakdown (US2)

**What shipped**

- `components/WaveTags.tsx` — `STATUS_META` + `WaveStatusTag`/`WaveTypeTag`, extracted from `WaveCard` (which now imports `STATUS_META`; its rendered output is unchanged).
- `components/dashboard/PerWaveTable.tsx` — contained-scroll table (`overflow-x-auto` + `min-w-[760px]`, `data-admin-row` rows) with the shared tags; `"—"` for null rates; long names truncate.
- `buildDashboardModel` extended with the `waves: WaveStat[]` slice.

**Golden path**

1. Under **Waves at a glance**, each wave appears once: name, type tag, status tag (same colors as the Waves list), member count, attendance %, submission %, avg rating.
2. A wave with members who attended ≥ once shows attendance = present ÷ members.
3. A wave with no members/activity shows `0` members and `"—"` for the three rates; the row still renders.
4. **Mobile**: the table scrolls inside its own box — the page/body never scrolls sideways. Long wave names truncate.

## Phase 3 — Charts (US3)

**What shipped**

- `components/dashboard/DonutChart.tsx` — pure-SVG donut (arc lengths ∝ value), `role="img"` + `aria-label` summary **and** a visible legend (the text equivalent); empty state on all-zero input.
- `components/dashboard/BarChart.tsx` — pure-CSS horizontal bars (width ∝ value), labels+values always shown; empty state.
- `components/dashboard/PointsLeaderboard.tsx` — ranked top-N (capped + sorted by the aggregator); empty state.
- `buildDashboardModel` extended with the `charts` slice; palettes are brand + the wave status-tag family (research R7).

**Golden path**

1. Under **Charts**: an online/offline donut, a waves-by-status donut, a members-per-wave bar chart, and a top-members points leaderboard.
2. Proportions match the data (3 online / 2 offline → a 60/40 donut; the largest wave has the longest bar).
3. A screen reader reads each donut's `aria-label` (e.g. "Online vs offline waves: online 3, offline 2"); bars/rows carry their figures as text.
4. A metric with no data shows "No data yet" rather than a blank/broken graphic.
5. **No added client JS** — all chart components are Server Components.

## Phase 4 — Engagement & content insights (US4)

**What shipped**

- `components/dashboard/InsightPanel.tsx` — titled group of labelled stats.
- `buildDashboardModel` extended with the `engagement` and `content` slices.
- Two panels rendered on the page: **Engagement** (submissions + rate, avg session/instructor ratings on the 1–5 scale + response count) and **Content built** (weeks, materials, videos, assignments).

**Golden path**

1. The Engagement panel shows total submissions, overall submission rate, average session and instructor ratings (e.g. "4.5 / 5") with the response count; ratings read "No responses yet" when there is no feedback.
2. The Content panel shows the four content totals.
3. Cross-check a rating average and a content total against the underlying rows.
4. **Full page at 320/390/430/768/desktop**: all four sections render with no clipping, overlap, or page-level horizontal scroll; the sidebar collapses to the drawer on mobile.

## Known gaps / notes

- **No dashboard-specific `loading.tsx`** was added — the route has none today and the reads are a single fast batch; the admin route group's `error.tsx` covers read failures. Add a `loading.tsx` skeleton later if perceived latency warrants it.
- **Attendance rate** = members present ≥ once ÷ total members, and **submission rate** = received ÷ (members × assignments) — the documented defaults (research R2). No per-session schedule exists to compute a "sessions attended" rate.
- **Scale**: aggregation is in-memory over column-narrowed reads (matches the Waves page). If activity rows grow large, swap to an aggregate SQL view behind `buildDashboardModel`'s input (research R3) — no UI change needed.
- **Responsive/a11y at the five breakpoints** is satisfied by design (stacking grid, contained-scroll table, fluid SVG, text equivalents, brand-token fills) and verified per `quickstart.md`; component tests assert the chart text equivalents and empty states.
