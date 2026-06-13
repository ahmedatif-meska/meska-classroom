# UI & Server-Action Contracts

All mutations are Server Actions (no API routes). Reads are RSC-first. Copy comes from
`lib/strings.ts` (new keys listed at the end). Brand tokens only; WCAG 2.1 AA; ≥16px mobile inputs.

---

## Feature 1 — Student password reset

### Server Action — `requestStudentPasswordReset(prev, formData) → { error?: string; sent?: boolean }`
- File: `app/student/actions.ts`.
- Validate email with `validateEmailField` (reused). On invalid → `{ error }`.
- Lowercase/trim; call `supabase.rpc('is_student_email', { p_email })`.
  - If true → `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${SITE_URL}/student/auth/confirm` })`.
  - Always (true or false) → return `{ sent: true }` (non-enumerating, SC-002).
- No audit log table for students (admin uses `admin_auth_events`; students have none — out of scope).

### Reused / lightly extended
- `/student/auth/confirm` (`confirmStudentInvite`) already verifies `type='recovery'` → `/student/set-password`. Unchanged.
- `setStudentPassword` updates the credential → `/student/dashboard`. **One addition (FR-005)**: after a
  successful `updateUser`, revoke the member's OTHER sessions via `supabase.auth.signOut({ scope: "others" })`
  (keeps the current recovery session so the redirect to the dashboard still works).

### UI
- `components/StudentLoginForm.tsx` (EDIT): the **Forgot password?** link already exists as a dead
  `<a href="#">` using the existing `strings.studentForgotPasswordLabel` key — re-point it to
  `/student/forgot-password` with `next/link` (keyboard-accessible, brand link, visible focus).
- `app/student/forgot-password/page.tsx` (NEW): centered card mirroring `/admin/forgot-password`;
  renders `StudentForgotPasswordForm`.
- `components/StudentForgotPasswordForm.tsx` (NEW, `'use client'`): email input + submit via
  `useActionState(requestStudentPasswordReset)`. States: idle → submitting → **sent** (neutral
  confirmation, identical wording for any email) / field error. A "Back to sign-in" link.

---

## Feature 2 — Attendance

### Server Action — `markAttendance(prev, formData) → AttendanceState`
`type AttendanceState = { error?: string; marked?: boolean; alreadyAttended?: boolean }`
- File: `app/admin/attendance/actions.ts`.
- `assertAdminSession` (via `getUser`) → else `{ error: strings.attendanceForbidden }`.
- Read `student_id`, `wave_id`, `week_id` from `formData`; all required.
- Confirm the selected wave is `type='offline'` (scan is offline-only, FR-015) → else error (no write).
- Load the student (`students` by id, RLS-admin) → confirm `student.tenant_id === wave_id` (FR-027);
  else `{ error: strings.attendanceWrongWave }` (no write).
- Confirm `week_id` belongs to `wave_id` (defensive).
- Compute `attended_on = attendanceDay(new Date())`.
- Pre-check: existing `wave_attendance` for `(student_id, attended_on)` → if found `{ alreadyAttended: true }`.
- Insert `{ tenant_id: wave_id, week_id, student_id, attended_on, method: 'scan' }`. On unique
  violation (race) → treat as `{ alreadyAttended: true }`. On success `{ marked: true }`.
- `revalidatePath('/admin/attendance')`.

### Server Action — `importOnlineAttendance(prev, formData) → ImportState`
`type ImportState = { error?: string; marked?: number; skipped?: { email: string; reason: 'unmatched' | 'already' }[] }`
(in-file duplicates are collapsed before processing — client- and server-side — so no `duplicate` reason ever surfaces; a per-row insert that loses a race to the `unique(student_id, attended_on)` constraint is reported as `already` and never aborts the batch)
- File: `app/admin/attendance/actions.ts`.
- `assertAdminSession` → else forbidden.
- `wave_id`, `week_id` required; `emails` is a JSON string array (parsed/validated client-side via
  `parseAttendanceCsv`, re-validated server-side: non-empty, deduped).
- Confirm the wave is `type='online'` (defensive — CSV path is online-only).
- For each email: resolve a `students` row in `wave_id` by `lower(email)`; unmatched → skip+report;
  already-marked today (`attendanceDay`) → skip+report; else insert `method: 'csv'`. In-file dups
  collapsed before processing. Never abort the batch.
- Return `{ marked, skipped }`; `revalidatePath('/admin/attendance')`.

### UI — `app/admin/attendance/page.tsx` (NEW)
Admin `DashboardShell` (activeHref `/admin/attendance`). Sections:
1. **Scan** — `<ScanMemberButton/>` (moved here). When `?scan=1` is present (the "Next" return),
   auto-open the scanner.
2. **Online CSV** — `<OnlineAttendanceUpload/>`: online-wave dropdown (newest-first) + week dropdown +
   template download + file picker; shows the marked/skipped report after submit.
3. **Records table** — `AdminTable` over `wave_attendance` joined to student/wave/week, ordered by
   `attended_on` desc then created_at; columns: Student, Wave, Week, Date, Method. Bounded/paginated;
   empty state defined.

### UI — `components/AttendancePanel.tsx` (NEW, `'use client'`) on `/admin/members/[id]`
- Rendered only when the page's admin gate passes (panel receives the student id + the offline-wave
  list + each wave's weeks as props from the RSC).
- Offline-wave `<select>` (waves `type='offline'`, `created_at` desc); week `<select>` populated from
  the chosen wave; **Attend** button → `markAttendance`.
- On `marked` → **success modal**: message + **Next** (→ `/admin/attendance?scan=1`) and **Back**
  (→ `/admin/dashboard`). On `alreadyAttended` → "already attended today" notice (no modal advance).
  Modal is focus-trapped, closes on Escape/backdrop, internal scroll, AA contrast.

### UI — member-info page (EDIT `app/admin/members/[id]/page.tsx`)
- After the member fields, for admins, fetch offline waves (+weeks) and render `<AttendancePanel/>`.
- The non-admin `Unauthorized` branch is unchanged (panel never reaches a non-admin).

### UI — Members page (EDIT `app/admin/members/page.tsx`)
- Remove `<ScanMemberButton/>` from the actions row (now lives on Attendance). No other change.

### Template — `components/AttendanceTemplateButton.tsx` (NEW)
- Downloads a fixed `attendance-template.csv` with exactly the header `email` and an example row,
  generated client-side (Blob) — mirror `DownloadTemplateButton`.

---

## Feature 3 — Points & feedback

### Server Action — `updatePointRule(prev, formData) → { error?: string; saved?: boolean }`
- File: `app/admin/points/actions.ts`.
- `assertAdminSession` → else `{ error: strings.pointsForbidden }`.
- `action` ∈ {attendance, assignment, feedback}; `points` parsed as a non-negative integer
  (reject negative/blank/non-numeric/fractional → `{ error: strings.pointsInvalid }`, prior kept).
- `update point_rules set points, updated_at = now() where action = $action`.
- `revalidatePath('/admin/points')` and `revalidatePath('/student/dashboard')`.

### Server Action — `submitFeedback(prev, formData) → FeedbackState`
`type FeedbackState = { error?: string; saved?: boolean; awardedPoints?: number }`
- File: `app/student/actions.ts`.
- `assertStudentSession` → else `{ error: strings.studentForbidden }`.
- `week_id` required; resolve the caller's own `students` row + `tenant_id` from the JWT.
- Fetch the week from `wave_weeks` by id under the caller's RLS (own-wave rows only) and reject
  `studentForbidden` if not found — a foreign wave's week id can never be fed points
  (mirrors `submitAssignment`'s assignment check).
- Optional `session_rating`/`instructor_rating` (1–5 if present) + `comment` (bounded).
- Upsert `wave_feedback` on `(week_id, student_id)` with `tenant_id` from the JWT (RLS confines to
  own wave — cross-wave week rejected).
- Read `point_rules.feedback`; return `{ saved: true, awardedPoints: feedbackPts }`.
- `revalidatePath('/student/dashboard')`.

### UI — `app/admin/points/page.tsx` (NEW)
- Admin `DashboardShell` (activeHref `/admin/points`). Renders `<PointRulesTable rules={...}/>` —
  the three rows (Attendance, Assignment, Feedback) with current values; intro copy explaining the
  scheme. Empty/loading/error states.

### UI — `components/PointRulesTable.tsx` (NEW, `'use client'`)
- Each row: label + inline number input + Save (per-row `useActionState(updatePointRule)`), or a
  single form. Validation error shown inline; saved confirmation transient. Touch-friendly, ≥16px
  inputs, labelled, AA contrast.

### UI — `components/WeekFeedback.tsx` (EDIT)
- Replace the local `onClick(setSubmitted)` with `useActionState(submitFeedback)`; submit posts
  `week_id` + ratings + comment. On `saved` → **thank-you popup** thanking the student AND naming
  `awardedPoints` (e.g. "You earned 30 points!"). The card needs the `week_id` prop (passed from the
  week page where it is rendered).

### UI — student dashboard rewards (EDIT `app/student/dashboard/page.tsx`)
- Replace the hardcoded `strings.studentRewardsPoints` placeholder with the computed total:
  three count reads (own attendance, own post-epoch submissions, own feedback) + `point_rules` →
  `computeTotal(...)`. Brand-styled number; zero renders as `0`.

---

## New copy keys (`lib/strings.ts`)

Student reset: `studentForgotTitle`, `studentForgotSubtitle`, `studentForgotSubmitLabel`,
`studentForgotSentTitle`, `studentForgotSentNote` (the sign-in link reuses the EXISTING
`studentForgotPasswordLabel` key).

Attendance (nav + tab): `attendanceNavLabel`, `attendanceTitle`, `attendanceSubtitle`,
`attendanceScanSectionTitle`, `attendanceOnlineSectionTitle`, `attendanceWaveLabel`,
`attendanceWeekLabel`, `attendanceAttendLabel`, `attendanceSuccessTitle`, `attendanceNextLabel`,
`attendanceBackLabel`, `attendanceAlreadyTitle`, `attendanceAlreadyNote`, `attendanceWrongWave`,
`attendanceForbidden`, `attendanceTemplateLabel`, `attendanceUploadLabel`, `attendanceImportSummary`,
`attendanceSkippedUnmatched`, `attendanceSkippedAlready`, `attendanceNoWeeksNote`,
`attendanceEmptyTitle`, `attendanceEmptyNote`,
table headers `attendanceColStudent/Wave/Week/Date/Method`, `attendanceMethodScan`, `attendanceMethodCsv`.

Points: `pointsNavLabel`, `pointsTitle`, `pointsSubtitle`, `pointsActionAttendance`,
`pointsActionAssignment`, `pointsActionFeedback`, `pointsValueLabel`, `pointsSaveLabel`,
`pointsSavedNote`, `pointsInvalid`, `pointsForbidden`.

Feedback popup: `studentFeedbackThanksTitle`, `studentFeedbackAwardedPrefix` (the old
`studentFeedbackThanks` key is removed with the WeekFeedback rewrite). Student rewards stays
`studentRewardsTitle`; the number becomes dynamic with a `studentRewardsPointsUnit` label
(the hardcoded `studentRewardsPoints` key is removed with the dashboard swap).
