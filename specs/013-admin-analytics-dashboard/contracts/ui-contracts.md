# UI Contracts: Admin Analytics Dashboard

The dashboard exposes **no external/API interface and no Server Action** — it is a read-only RSC page. The contracts that matter are: the page's data-read contract, the props of each presentational component, the chart accessibility contract, and the copy keys. These are what `/speckit-tasks` and the implementation must honor.

## Page contract — `app/admin/dashboard/page.tsx`

- **Auth**: Server Component; calls `supabase.auth.getUser()`; admin-only by virtue of `proxy.ts` route protection over `/admin/**`. Renders inside the existing `DashboardShell` with `adminNavItems` and `activeHref="/admin/dashboard"`.
- **Read**: a single `Promise.all` of column-narrowed queries on the cookie/RLS server client (see `data-model.md` for the column list). No service-role client. No mutation.
- **Transform**: pass the raw rows to `lib/dashboard/aggregate.ts` → `DashboardModel`. The page contains **no aggregation arithmetic inline** (all in the pure lib, for testability).
- **Render order**: KPI cards (US1) → per-wave breakdown (US2) → charts (US3) → engagement/content insight panels (US4). Each section is independently present once its phase lands.
- **States**: `loading.tsx` (existing route-group file) covers the initial load; `error.tsx` (existing) covers a read failure; the empty-platform state is the intrinsic zero-data render (no separate branch).

## `lib/dashboard/` (pure, Supabase-free)

```text
rates.ts
  attendanceRate(presentMembers: number, totalMembers: number): RateValue
  submissionRate(received: number, expected: number): RateValue
  average(sum: number, count: number): RateValue          // null when count === 0
  // All return null on a zero denominator; never NaN/Infinity.

aggregate.ts
  buildDashboardModel(input: RawDashboardData): DashboardModel
  // input = the narrowed row arrays + point_rules; output per data-model.md.
  // Reuses computeTotal/POINTS_EPOCH from lib/points/total.ts for points.

types.ts
  RateValue, DashboardModel, WaveStat, ChartDatum, LeaderboardEntry, RawDashboardData
```

**Contract guarantees** (asserted by `tests/lib/dashboard/*`): pure (no I/O), deterministic, total (defined for empty inputs), and never emits `NaN`/`Infinity`.

## Component props (`components/dashboard/`, all Server Components)

```text
StatCard      { label: string; value: string | number; icon: ReactNode;
                sublabel?: string }      // e.g. "3 online · 2 offline"
StatCardGrid  { children }               // responsive grid: 1col@320, 2col@sm, up to 4col@lg

DonutChart    { title: string; data: ChartDatum[];
                emptyLabel: string }     // arcs proportional to data; renders <title>/text equivalent
BarChart      { title: string; data: ChartDatum[];
                emptyLabel: string }     // horizontal bars proportional to value; truncated labels
PointsLeaderboard { title: string; entries: LeaderboardEntry[];
                emptyLabel: string }     // ranked top-N desc

PerWaveTable  { waves: WaveStat[] }      // built on AdminTable; type/status tags reuse WaveCard styling;
                                         // RateValue null → "—"; long names truncate

InsightPanel  { title: string;
                items: { label: string; value: string; icon?: ReactNode }[] }
```

- No component is `'use client'`. No `useState`/effects. No manual memoization (React Compiler).
- Type/status tags MUST reuse the copy + color classes already in `components/WaveCard.tsx` (extract a tiny shared tag helper if duplication arises, per Principle I — do not re-define colors).

## Chart accessibility contract (FR-012, SC-005)

Every chart component MUST satisfy ALL of:
1. The `<svg>` has `role="img"` and an `aria-label` (or `<title>`/`<desc>`) summarizing the data, OR an adjacent visually-present data summary (e.g. a legend list with values) that conveys the same figures.
2. Information is never carried by color alone — each segment/bar/row has a text label + value.
3. An empty input renders `emptyLabel` text, not a blank or broken graphic.
4. Fills use only brand-consistent tokens/classes (research R7); contrast ≥ 3:1 for the graphical elements, ≥ 4.5:1 for text labels, verified on white and `#EEF3F8`.

Component tests assert (1) the text equivalent is present and matches the input, and (3) the empty state.

## Copy keys (`lib/strings.ts` additions)

All user-facing text comes from `strings`. Indicative keys (final names at implementation time):

```text
dashboardOverviewHeading, dashboardPerWaveHeading, dashboardChartsHeading, dashboardInsightsHeading
kpiWavesLabel, kpiOnlineOfflineSublabel, kpiMembersLabel, kpiInstructorsLabel,
  kpiAttendanceRateLabel, kpiTotalPointsLabel
chartTypeSplitTitle, chartStatusSplitTitle, chartMembersPerWaveTitle, chartLeaderboardTitle
chartEmptyNote                          // shared "No data yet" for empty charts
perWaveColName, perWaveColType, perWaveColStatus, perWaveColMembers,
  perWaveColAttendance, perWaveColSubmission, perWaveColRating
insightSubmissionsLabel, insightSubmissionRateLabel, insightAvgSessionRatingLabel,
  insightAvgInstructorRatingLabel, insightFeedbackResponsesLabel,
  insightWeeksLabel, insightMaterialsLabel, insightVideosLabel, insightAssignmentsLabel
rateNoData                              // the "—" sentinel display string
feedbackNoResponsesNote                 // "No responses yet"
```

Reuse existing keys where they already exist: `waveTypeOnline`, `waveTypeOffline`, `waveStatusNotStarted`, `waveStatusInProgress`, `waveStatusCompleted`, and the member singular/plural labels.

## Out of contract (explicitly not built)

No Server Actions, no API routes, no client-side data fetching, no export endpoint, no query params/filters, no realtime subscription. Any of these would be a new contract requiring its own spec.
