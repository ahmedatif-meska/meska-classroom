# Walkthrough: Student Password Reset, Attendance Tracking & Gamification Points

Feature 012 — branch `012-attendance-points-student-reset`. One section per implemented
plan phase (Principle VII). All three phases are implemented; migrations `0019`–`0021`
are applied to the live Supabase project (`meska classroom`).

## How to run (all phases)

```bash
npm install            # if needed
npm run dev            # http://localhost:3000
npm test               # 98 files / 561 tests green (7 RLS tests skip without creds)
npm run build          # clean
npm run lint           # clean
```

- Env: the usual `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`). **No new env vars; no new bucket.**
- Live RLS integration tests (cross-wave denial for `wave_attendance`/`wave_feedback`):
  load `.env.local` into the shell, then `npx vitest run tests/integration/rls.test.ts`
  (verified green against the live project).
- Constants: `ATTENDANCE_TZ = "Africa/Cairo"` (`lib/attendance/day.ts`),
  `POINTS_EPOCH = "2026-06-12T00:00:00Z"` (`lib/points/total.ts`).

---

## Phase 1 — Student password reset (US1)

### Implemented

| Feature | Path |
|---|---|
| "Forgot Password?" link on student sign-in (was a dead `#` anchor) | `components/StudentLoginForm.tsx` |
| Request page | `app/student/forgot-password/page.tsx` |
| Request form (neutral sent state) | `components/StudentForgotPasswordForm.tsx` |
| `requestStudentPasswordReset` + FR-005 others-revocation in `setStudentPassword` | `app/student/actions.ts` |
| `is_student_email()` gate (mirror of `is_admin_email`) | `supabase/migrations/0019_student_password_reset.sql` |
| Reused unchanged: confirm interstitial → set-password | `app/student/auth/confirm/page.tsx`, `app/student/set-password/` |

### Golden path (desktop AND mobile 320/390/430/768px)

1. Open `/student` → click **Forgot Password?** (next to the password label) → land on
   `/student/forgot-password`.
2. Submit a real member email → neutral "Check your email" confirmation. Submit a random
   or admin-only email → the IDENTICAL confirmation (no enumeration), no email sent.
3. Open the member's reset email → `/student/auth/confirm` interstitial → **Continue** →
   `/student/set-password` → set a valid new password → land on `/student/dashboard`.
4. Sign out, sign in with the NEW password → works. (FR-005: a session left open in a
   second browser is revoked — `signOut({ scope: "others" })`.)
5. Re-use the same emailed link → invalid-link state with a back-to-sign-in path.
6. Regression: `/admin/forgot-password` flow is untouched.

---

## Phase 2 — Attendance tracking (US2 scan, US3 CSV)

### Implemented

| Feature | Path |
|---|---|
| **Attendance** tab (nav between Members and Points) | `lib/adminNav.tsx`, `app/admin/attendance/page.tsx` (+ `loading.tsx`) |
| Scan QR moved from Members (auto-opens on `?scan=1`) | `components/ScanMemberButton.tsx` (`autoOpen` prop); removed from `app/admin/members/page.tsx` |
| Attendance panel on the member-info page (offline waves newest-first, weeks per wave, student's wave preselected, Attend → success modal Next/Back, already-attended notice, no-weeks note) | `components/AttendancePanel.tsx`, rendered by `app/admin/members/[id]/page.tsx` |
| `markAttendance` (offline-only FR-015, own-wave FR-027, once-per-day FR-028 incl. race) + `importOnlineAttendance` (online-only, skip+report, never aborts FR-016) | `app/admin/attendance/actions.ts` |
| Online CSV section (template download, browser-side parse, marked/skipped report) | `components/OnlineAttendanceUpload.tsx`, `components/AttendanceTemplateButton.tsx`, `lib/attendance/csv.ts` |
| Records table (Student / Wave / Week / Date / Method, bounded 200, contained scroll) | `app/admin/attendance/page.tsx` |
| `wave_attendance` table + RLS (`unique(student_id, attended_on)`) | `supabase/migrations/0020_wave_attendance.sql` |
| Proxy protection for the new tabs | `proxy.ts` (`config.matcher`) |

### Golden path (desktop AND mobile)

1. Sign in as admin → **Attendance** in the sidebar (collapses into the drawer on mobile).
   Confirm **Scan QR is gone from `/admin/members`** and present here.
2. Press **Scan QR** → scan a member's dashboard QR (phone) → land on
   `/admin/members/<id>` → below the member card, the **Attendance** panel shows the
   offline waves newest-first with the student's own wave preselected, and its weeks.
3. Press **Attend** → success modal "Student attended successfully" → **Next** returns to
   `/admin/attendance?scan=1` with the scanner already open; **Back** goes to
   `/admin/dashboard`.
4. Scan/mark the same member again today → amber **Already attended** notice, no new row.
5. Pick a different offline wave (not the student's) → red rejection, no row (FR-027).
6. Pick a wave with no weeks → "This wave has no weeks yet." and Attend disabled.
7. Online: on `/admin/attendance`, in **Online attendance** pick an online wave + week,
   **Download CSV template** (single `email` header), upload a file with one member,
   one unknown email, one already-marked member → "1 marked present", two reported skips.
   A malformed file (wrong/multi-column header) errors inline and never submits.
8. Every record appears in the table; on a phone the table scrolls inside its own box
   (no page-level sideways scroll).
9. Cross-wave/role denial: a non-admin calling either action gets a generic forbidden
   message; a student session cannot read another wave's rows or write any
   (`tests/integration/rls.test.ts`, verified live).

---

## Phase 3 — Points & feedback (US4 admin table, US5 student points)

### Implemented

| Feature | Path |
|---|---|
| **Points** tab with the editable rules table (10/20/30 seed) | `lib/adminNav.tsx`, `app/admin/points/page.tsx` (+ `loading.tsx`), `components/PointRulesTable.tsx` |
| `updatePointRule` (admin-gated, non-negative integers only) | `app/admin/points/actions.ts` |
| Persisted weekly feedback + thank-you popup naming the award | `components/WeekFeedback.tsx` (now takes `weekId` from `components/StudentWeekContent.tsx`), `submitFeedback` in `app/student/actions.ts` |
| Derived rewards total on the student Home (counts × current rules, un-cached) | `app/student/dashboard/page.tsx`, `lib/points/total.ts` |
| `point_rules` (global config) + `wave_feedback` (`unique(week_id, student_id)`) + RLS | `supabase/migrations/0021_points_and_feedback.sql` |

### Golden path (desktop AND mobile)

1. Admin → **Points** tab → three rows (Attendance 10, Assignment upload 20, Feedback 30).
2. Change Feedback to 40 → **Save** → "Saved". Clear the field and Save → inline
   rejection, the stored value stays 40.
3. As a brand-new member: Home **My Rewards** reads **0 Points** (pre-existing assignment
   submissions don't count — points epoch).
4. Get marked present once (+10), upload an assignment (+20), open a week page and submit
   feedback → a popup thanks you and names the award ("You earned 40 Points") → total
   reads **70 Points** on next Home view.
5. Re-submit feedback for the same week → the same row updates; the total does NOT grow.
6. Admin sets Feedback back to 30 → the student's total drops to 60 on next view
   (retroactive recompute, FR-029).
7. A student cannot feed a foreign wave's `week_id` into `submitFeedback` (rejected before
   any write) and cannot read another wave's feedback (RLS, verified live).

---

## Verification status

- `npm test`: **98 files / 561 tests green** (live RLS file additionally run with creds —
  6 green including the new feature-012 isolation case). `npm run build` + `npm run lint`
  clean. Proxy denial for `/admin/attendance` + `/admin/points` covered in
  `tests/middleware.test.ts`.
- Pre-existing repair: `tests/app/admin/waves/wavesPage.test.tsx` was already failing on
  `main` (commit `1d8d218` "wave filters" added an "Online" filter button that made a
  page-wide `getByText("Online")` ambiguous); the assertion is now scoped to the cards.
- **Accepted tradeoff (recorded)**: `is_student_email()` is an anon-executable boolean
  `SECURITY DEFINER` RPC — deliberate parity with `is_admin_email` (0003). It returns
  only a boolean and the UI response is identical for any email; the Supabase advisor
  WARN for it matches the pre-existing one for `is_admin_email`.

## Known gaps / reviewer steps

- **Email round-trip & camera scanning** can only be exercised by a human: follow Phase 1
  steps 2–5 with a real inbox, and Phase 2 steps 2–4 with a phone camera
  (`specs/012-attendance-points-student-reset/quickstart.md` mirrors these).
- **Visual quality gates** (320/390/430/768/desktop sweep, AA contrast spot-checks,
  drawer behavior with the two new nav items) — the layouts reuse the existing token
  classes and patterns, but the breakpoint sweep is a reviewer pass (T053).
- The day boundary is `Africa/Cairo` by design (research R3); if Meska ever operates a
  cohort in another timezone, revisit `ATTENDANCE_TZ`.
- Admin-side feedback REVIEW (reading students' submitted feedback) is out of scope for
  012 — the data is persisted and admin-readable by RLS, but no admin UI lists it yet.
