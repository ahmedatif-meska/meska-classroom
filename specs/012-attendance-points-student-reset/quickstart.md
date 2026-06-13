# Quickstart: Student Reset, Attendance & Points

## Run

```bash
npm run dev          # http://localhost:3000 (Turbopack)
npm run lint         # must be clean
npm test             # Vitest (jsdom), non-watch
npx vitest run tests/app/attendance-actions.test.ts   # single file
```

Apply the new migrations in order (Supabase): `0019_student_password_reset.sql`,
`0020_wave_attendance.sql`, `0021_points_and_feedback.sql`. Env unchanged
(`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
`NEXT_PUBLIC_SITE_URL`). No new env vars, no new Storage bucket.

Set `POINTS_EPOCH` (the ISO timestamp marking points go-live) and `ATTENDANCE_TZ`
(`"Africa/Cairo"`) as the documented constants in their `lib/` modules.

## Manual verification

### Feature 1 — student reset (desktop + mobile 320/390/430/768)
1. On `/student`, click **Forgot password?** → `/student/forgot-password`.
2. Submit a real member email → neutral "if an account exists…" confirmation. Submit a random/admin
   email → the SAME confirmation (no enumeration).
3. Open the member's reset email → `/student/auth/confirm` → Continue → `/student/set-password` →
   set a new password → land on `/student/dashboard`; sign in again with the new password.
4. Reuse the link → invalid-link state with a back-to-sign-in path.

### Feature 2 — attendance
1. Confirm **Scan QR** is gone from `/admin/members` and present on `/admin/attendance`.
2. On `/admin/attendance`, Scan a member → `/admin/members/[id]`; pick the student's **offline** wave
   (newest first) + a week → **Attend** → success modal.
3. **Next** → returns to `/admin/attendance` with the scanner open. **Back** → `/admin/dashboard`.
4. Scan the same member again today → **already attended** notice (no second row).
5. Pick an offline wave the student is NOT in → rejected with a clear message, no row.
6. Online CSV: pick an **online** wave + week, download the template (header `email` only), upload a
   small CSV (one new, one unmatched, one already-marked) → marked count = 1, two reported skipped.
7. Records table lists every row (Student, Wave, Week, Date, Method) and scrolls inside the table on
   mobile (no page-level horizontal scroll); empty state shows before any record.

### Feature 3 — points & feedback
1. New member dashboard **My Rewards** = `0`.
2. On `/admin/points`, change a value (e.g. feedback 30→40); invalid (-1/blank) is rejected, prior kept.
3. As the student, give week feedback → thank-you popup names the awarded points (matches the rule).
   Resubmit the same week → no extra points (one row).
4. After 1 attendance + 1 assignment upload (post-epoch) + 1 feedback under 10/20/40 → total = 70.
5. Admin edits a rule → student total recomputes on next view (retroactive, consistent).

## Tests to ship (Principle II)
- Pure: `lib/attendance/csv.ts`, `lib/attendance/day.ts`, `lib/points/total.ts`.
- Actions: student-reset non-enumeration; `markAttendance` gate + wrong-wave (FR-027) + once-per-day
  (FR-028); CSV import skip/report; `updatePointRule` gate + validation; `submitFeedback` gate + points.
- Components: `AttendancePanel` (Attend→modal, already-attended, Next/Back), `PointRulesTable`,
  `WeekFeedback` thank-you popup.
- Integration: `tests/integration/rls.test.ts` — `wave_attendance` + `wave_feedback` cross-wave denial.
