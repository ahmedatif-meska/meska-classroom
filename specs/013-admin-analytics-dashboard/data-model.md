# Data Model: Admin Analytics Dashboard

This feature is **read-only**. It adds **no tables, no columns, no migrations, no RLS changes**. It reads existing tables (under the admin's RLS, which already returns all tenants to an admin) and derives an in-memory **view model** with pure functions in `lib/dashboard/`. This document lists the source columns consumed and the shape of the derived model.

## Source tables consumed (existing)

Only the columns actually read are listed. Selects are column-narrowed; totals use `count: 'exact', head: true` where no row data is needed.

| Table | Columns read | Used for |
|-------|--------------|----------|
| `tenants` (waves) | `id, name, type, status` | wave totals, online/offline split, waves-by-status, per-wave name/tags |
| `students` | `id, tenant_id, status` | member totals, per-wave member counts, per-member grouping key for points |
| `instructors` | (count only) | instructor total KPI |
| `wave_weeks` | `tenant_id` (count) | content total: weeks |
| `wave_materials` | (count only) | content total: materials |
| `wave_videos` | (count only) | content total: videos |
| `wave_assignments` | `id, tenant_id` | content total: assignments; submission-rate denominator (assignments per wave) |
| `wave_submissions` | `student_id, tenant_id, submitted_at` | submission counts/rate; assignment points count (`submitted_at ≥ POINTS_EPOCH`) |
| `wave_attendance` | `student_id, tenant_id` | attendance rate (members present ≥1×); attendance points count |
| `wave_feedback` | `student_id, tenant_id, session_rating, instructor_rating` | feedback counts; average session/instructor ratings; feedback points count |
| `point_rules` | `action, points` | current rule values for `computeTotal` (overall total + leaderboard) |

**Access**: all reads run on the cookie/RLS server client under `is_admin()`. Admin policies already grant program-wide SELECT on every table above (e.g. `wave_attendance_admin_all`, `point_rules_read`, `instructors` admin select), so no policy change is required. The page additionally asserts the admin session via `getUser()` before rendering, consistent with every admin route.

## Derived view model (`lib/dashboard/types.ts`)

Pure TypeScript types produced by `lib/dashboard/aggregate.ts` from the raw rows. No persistence.

```text
RateValue = number | null          // null === "no denominator" → rendered "—"

DashboardModel {
  // Overview (US1)
  waveTotal: number
  waveByType: { online: number; offline: number }
  memberTotal: number
  instructorTotal: number
  overallAttendanceRate: RateValue
  totalPoints: number

  // Per-wave breakdown (US2)
  waves: WaveStat[]

  // Charts (US3)
  charts: {
    typeSplit: ChartDatum[]        // [{label:'Online',value}, {label:'Offline',value}]
    statusSplit: ChartDatum[]      // one per lifecycle status
    membersPerWave: ChartDatum[]   // [{label: waveName, value: memberCount}]
    leaderboard: LeaderboardEntry[]// top-N members by points, desc
  }

  // Engagement & content insights (US4)
  engagement: {
    submissionsTotal: number
    overallSubmissionRate: RateValue
    avgSessionRating: RateValue     // 1..5 or null
    avgInstructorRating: RateValue  // 1..5 or null
    feedbackResponses: number
  }
  content: {
    weeks: number
    materials: number
    videos: number
    assignments: number
  }
}

WaveStat {
  id: string
  name: string
  type: 'online' | 'offline'
  status: 'not_started' | 'in_progress' | 'completed'
  memberCount: number
  attendanceRate: RateValue
  submissionRate: RateValue
  avgRating: RateValue              // average of session+instructor ratings, or null
}

ChartDatum { label: string; value: number }
LeaderboardEntry { studentId: string; name: string; points: number }
```

## Derivation rules (formulas)

Implemented as pure helpers in `lib/dashboard/rates.ts` and the grouping logic in `aggregate.ts`. Every formula guards a zero denominator → `null` (rendered "—"); none can yield `NaN`/`Infinity` (FR-005, FR-009, SC-006).

- **`waveByType`**: count `tenants` by `type`.
- **`statusSplit`**: count `tenants` by `status`.
- **Per-wave `memberCount`**: number of `students` with `tenant_id === wave.id` (includes `pending`; excludes unassigned — research R6).
- **`attendanceRate(wave)`** = `|distinct student_id in wave_attendance for this tenant| ÷ memberCount`. `memberCount === 0` → `null`.
- **`overallAttendanceRate`** = `|distinct student_id in wave_attendance over all| ÷ memberTotal`. `memberTotal === 0` → `null`.
- **`submissionRate(wave)`** = `|submissions for this tenant| ÷ (memberCount × |assignments for this tenant|)`. denominator `0` → `null`.
- **`overallSubmissionRate`** = `Σ submissions ÷ Σ (memberCount × assignmentCount) over waves`. denominator `0` → `null`.
- **`avgSessionRating` / `avgInstructorRating`** = mean of non-null ratings in `wave_feedback`. zero responses → `null`. Displayed rounded to one decimal on the 1–5 scale.
- **`avgRating(wave)`** = mean of that wave's non-null session+instructor ratings, or `null`.
- **`totalPoints`** = `computeTotal(aggregatedCounts, rules)` where `aggregatedCounts` sums every member's `{ attendance, assignment(submitted_at ≥ POINTS_EPOCH), feedback }` and `rules` are the current `point_rules` (reuse of `lib/points/total.ts` — research R4).
- **`leaderboard`** = per-member `computeTotal` over the same per-member counts, sorted desc, sliced to top-N. Members absent from all activity tables have 0 points (excluded unless they fill the top-N).
- **`content.*`** = direct counts of `wave_weeks`, `wave_materials`, `wave_videos`, `wave_assignments`.

## What is intentionally NOT modeled

- No time-series / historical trend storage (the spec scopes to live on-load figures).
- No per-session attendance schedule (does not exist; see research R2).
- No exports, filters, or drill-down state.
- No new audit, cache, or config rows. (The dashboard reads `point_rules` live and does not cache the points total, matching the student dashboard's deliberate no-cache choice so rule edits apply immediately.)
