---
description: "Task list for feature 012 — Student Password Reset, Attendance Tracking & Gamification Points"
---

# Tasks: Student Password Reset, Attendance Tracking & Gamification Points

**Input**: Design documents from `specs/012-attendance-points-student-reset/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED (Principle II — NON-NEGOTIABLE). Every wave-scoped path includes the cross-wave access-denial test (Principle VI). Tests are written FIRST and must FAIL before implementation.

**Phase mapping to plan.md**: plan.md groups work as *Phase 1 — Student password reset (US1)*, *Phase 2 — Attendance tracking (US2 scan, US3 CSV)*, *Phase 3 — Points & feedback (US4 admin table, US5 student points)*. Here that is split into Setup + Foundational (shared copy, all three migrations, the pure domain helpers) followed by one phase per user story, per the tasks structure. Acceptance criteria and test scenarios live at the phase level in plan.md.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: US1–US5 (maps to spec.md user stories)

---

## Phase 1 — Setup (Shared copy)

**Purpose**: Add every user-facing string the three features need, so no component task invents inline copy. T001–T003 all edit `lib/strings.ts` — run them sequentially (T001 → T002 → T003).

- [X] T001 In `lib/strings.ts`, add the student-reset keys from `contracts/ui-contracts.md` (`studentForgotTitle`, `studentForgotSubtitle`, `studentForgotSubmitLabel`, `studentForgotSentTitle`, `studentForgotSentNote`). The sign-in link reuses the EXISTING `studentForgotPasswordLabel` key (lib/strings.ts ~line 530) — do not add a duplicate link label.
- [X] T002 In `lib/strings.ts`, add the attendance keys from `contracts/ui-contracts.md` (`attendanceNavLabel`, `attendanceTitle`, `attendanceSubtitle`, `attendanceScanSectionTitle`, `attendanceOnlineSectionTitle`, `attendanceWaveLabel`, `attendanceWeekLabel`, `attendanceAttendLabel`, `attendanceSuccessTitle`, `attendanceNextLabel`, `attendanceBackLabel`, `attendanceAlreadyTitle`, `attendanceAlreadyNote`, `attendanceWrongWave`, `attendanceForbidden`, `attendanceTemplateLabel`, `attendanceUploadLabel`, `attendanceImportSummary`, `attendanceSkippedUnmatched`, `attendanceSkippedAlready`, `attendanceNoWeeksNote`, `attendanceEmptyTitle`, `attendanceEmptyNote`, `attendanceColStudent`, `attendanceColWave`, `attendanceColWeek`, `attendanceColDate`, `attendanceColMethod`, `attendanceMethodScan`, `attendanceMethodCsv`).
- [X] T003 In `lib/strings.ts`, add the points + feedback keys from `contracts/ui-contracts.md` (`pointsNavLabel`, `pointsTitle`, `pointsSubtitle`, `pointsActionAttendance`, `pointsActionAssignment`, `pointsActionFeedback`, `pointsValueLabel`, `pointsSaveLabel`, `pointsSavedNote`, `pointsInvalid`, `pointsForbidden`, `studentFeedbackThanksTitle`, `studentFeedbackAwardedPrefix`) and a `studentRewardsPointsUnit` label; leave the hardcoded `studentRewardsPoints: "1,250 Points"` placeholder in place until T051 swaps the dashboard to the computed total (T051 removes that key; T050 removes the superseded `studentFeedbackThanks` key).

---

## Phase 2 — Foundational (Blocking Prerequisites)

**Purpose**: The three migrations and the pure domain helpers the user stories depend on. Each migration only truly blocks its own stories (0019→US1, 0020→US2/US3, 0021→US4/US5), but all land here so the schema ships as one reviewed unit.

**⚠️ CRITICAL**: A user story phase cannot start until its migration and helpers are green.

- [X] T004 [P] Create migration `supabase/migrations/0019_student_password_reset.sql` defining `public.is_student_email(p_email text)` — `returns boolean`, `language sql`, `security definer`, `set search_path = public`, `stable`, body `exists(select 1 from public.students where lower(email)=lower(p_email))`; `revoke all ... from public; grant execute ... to anon, authenticated`. Per `data-model.md` §0019 (mirror of `is_admin_email` in `0003_password_reset.sql`).
- [X] T005 [P] Create migration `supabase/migrations/0020_wave_attendance.sql` defining `public.wave_attendance` (`id` uuid pk default gen_random_uuid(), `tenant_id` FK→tenants ON DELETE CASCADE, `week_id` FK→wave_weeks ON DELETE CASCADE, `student_id` FK→students ON DELETE CASCADE, `attended_on date not null`, `method text not null check (method in ('scan','csv'))`, `created_at timestamptz default now()`), `unique (student_id, attended_on)`, indexes on `(tenant_id, week_id)` and `(student_id)`, RLS enabled with `wave_attendance_admin_all` (`is_admin()` using+check) and `wave_attendance_student_select` (own wave + own student row, no student writes). Per `data-model.md` §0020.
- [X] T006 [P] Create migration `supabase/migrations/0021_points_and_feedback.sql` defining (a) `public.point_rules` (`action text pk check (action in ('attendance','assignment','feedback'))`, `points int not null check (points >= 0)`, `updated_at timestamptz default now()`), seeded `('attendance',10),('assignment',20),('feedback',30)` with `on conflict do nothing`, RLS `point_rules_read` (select to authenticated) + `point_rules_admin_write` (`is_admin()`); and (b) `public.wave_feedback` (`id`, `tenant_id` FK→tenants, `week_id` FK→wave_weeks, `student_id` FK→students, `session_rating int check (between 1 and 5)` nullable, `instructor_rating` likewise, `comment text`, `created_at`), `unique (week_id, student_id)`, index `(student_id)`, RLS mirroring `wave_submissions` (admin all; student select/insert/update own row in own wave). Per `data-model.md` §0021.
- [X] T007 Apply migrations `supabase/migrations/0019_student_password_reset.sql`, `supabase/migrations/0020_wave_attendance.sql`, and `supabase/migrations/0021_points_and_feedback.sql` to the Supabase project (Supabase MCP `apply_migration` or dashboard SQL editor) and confirm the function, both tables, the `point_rules` seed rows, and RLS exist.
- [X] T008 [P] Write FAILING unit tests in `tests/lib/attendance/csv.test.ts` for `parseAttendanceCsv`: accepts a single `email` header (case-insensitive, tolerates BOM/whitespace); trims+lowercases rows; drops blanks; dedupes in-file duplicates; errors on a missing `email` header, on an empty file, and on a header row with extra columns (e.g. `email,name` → `{ error }`). Per `data-model.md` validation rules and `research.md` R4.
- [X] T009 [P] Write FAILING unit tests in `tests/lib/attendance/day.test.ts` for `attendanceDay`: returns `YYYY-MM-DD` in `ATTENDANCE_TZ` (`Africa/Cairo`); a UTC instant just before/after the local midnight boundary lands on the correct local dates (the 23:59 vs 00:01 cases). Per `research.md` R3.
- [X] T010 [P] Write FAILING unit tests in `tests/lib/points/total.test.ts` for `computeTotal`: `counts × rules` sum (1/1/1 under 10/20/30 → 60); zero counts → 0; a zero-valued rule contributes 0 while others still count. Per `research.md` R5.
- [X] T011 [P] Implement `lib/attendance/csv.ts` — `parseAttendanceCsv(text): { emails: string[] } | { error: string }` per the T008 rules (including rejecting a multi-column header); pure, Supabase-free; making T008 pass.
- [X] T012 [P] Implement `lib/attendance/day.ts` — `export const ATTENDANCE_TZ = "Africa/Cairo"` and `attendanceDay(d: Date): string` via `Intl.DateTimeFormat('en-CA', { timeZone: ATTENDANCE_TZ })`; pure; making T009 pass.
- [X] T013 [P] Implement `lib/points/total.ts` — `export const POINTS_EPOCH = "<go-live ISO timestamp>"` (documented constant, `research.md` R6) and `computeTotal(counts: { attendance: number; assignment: number; feedback: number }, rules: { attendance: number; assignment: number; feedback: number }): number`; pure; making T010 pass.

**Checkpoint**: Schema + seeds live, pure helpers green. User stories can begin (in parallel if staffed).

---

## Phase 3 — Student password reset (US1)

**Purpose** (plan Phase 1): A member resets a forgotten password from the student sign-in surface, reusing the existing confirm/set-password machinery. Acceptance criteria + test scenarios: see plan.md Phase 1.

### User Story 3.1 (US1): Student can reset a forgotten password (Priority: P1) 🎯 MVP

**Goal**: "Forgot password?" on `/student` → request page → reset email → existing `/student/auth/confirm` → `/student/set-password` → sign in with the new password. Identical neutral confirmation for any submitted email (no enumeration).

**Independent Test**: Request a reset for a member email and complete the flow end-to-end; request one for an unknown/admin email and observe the identical confirmation with no student email sent.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [X] T014 [P] [US1] Write FAILING Server Action tests in `tests/app/student-reset-actions.test.ts` (mock `@/lib/supabase/server`): `requestStudentPasswordReset` returns a field error for an empty email; when `is_student_email` RPC returns true it calls `resetPasswordForEmail` with `redirectTo` ending `/student/auth/confirm` and returns `{ sent: true }`; when the RPC returns false it does NOT call `resetPasswordForEmail` and STILL returns `{ sent: true }` (non-enumeration, FR-002/SC-002). Also assert `setStudentPassword` calls `supabase.auth.signOut({ scope: "others" })` after a successful password update (FR-005 — other sessions revoked, current recovery session kept).
- [X] T015 [P] [US1] Write FAILING component test in `tests/components/StudentForgotPasswordForm.test.tsx`: renders a labelled email input (≥16px on mobile via the shared input classes) and submit button; the sent state shows the neutral `studentForgotSentTitle`/`studentForgotSentNote` confirmation; a field error renders with `role="alert"`; a back-to-sign-in link points to `/student`.

#### Implementation for User Story 3.1

- [X] T016 [US1] In `app/student/actions.ts`, add `export type StudentRequestResetState = { error?: string; sent?: boolean }` and the `requestStudentPasswordReset` Server Action: validate with `validateEmailField` (reused from `@/lib/auth/passwordReset`), trim+lowercase, `supabase.rpc("is_student_email", { p_email: email })`, on true call `supabase.auth.resetPasswordForEmail(email, { redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/student/auth/confirm` })`, always return `{ sent: true }`. Also extend `setStudentPassword`: after a successful `updateUser`, call `supabase.auth.signOut({ scope: "others" })` to revoke the member's other sessions (FR-005) while keeping the current recovery session for the dashboard redirect. Per `contracts/ui-contracts.md` Feature 1.
- [X] T017 [P] [US1] Create `components/StudentForgotPasswordForm.tsx` (`'use client'`) using `useActionState(requestStudentPasswordReset)`: email input + submit; on `sent` swap to the neutral confirmation; mirror the structure/classes of the admin `components/ForgotPasswordForm.tsx`; brand tokens only, visible focus.
- [X] T018 [P] [US1] Create `app/student/forgot-password/page.tsx`: centered card on the student surface (mirror the `/student` sign-in page wrapper — `BrandHeader homeHref="/student"`, `BrandMark`, title `studentForgotTitle`, subtitle `studentForgotSubtitle`) rendering `StudentForgotPasswordForm`.
- [X] T019 [US1] In `components/StudentLoginForm.tsx`, re-point the EXISTING dead **Forgot password?** anchor (lines ~48–53, `<a href="#">` with `strings.studentForgotPasswordLabel`) to `/student/forgot-password` using `next/link`; keep the existing styling/placement and visible focus.
- [ ] T020 [US1] Run `npx vitest run tests/app/student-reset-actions.test.ts tests/components/StudentForgotPasswordForm.test.tsx`, then `npm run build` and `npm run lint`; confirm green/clean. Manually verify the admin reset flow is untouched (`/admin/forgot-password` unchanged — regression guard, FR-007) and, in the quickstart run, that a second-browser session is signed out after the reset (FR-005).

**Checkpoint**: Members self-recover with zero admin involvement; non-enumeration verified. Independently shippable.

---

## Phase 4 — Offline attendance by QR scan (US2)

**Purpose** (plan Phase 2, scan path): The Attendance tab exists, Scan QR lives there, and a scanned student is marked present for an offline wave's week — once per calendar day. Acceptance criteria + test scenarios: see plan.md Phase 2.

### User Story 4.1 (US2): Admin records offline attendance by scanning a student (Priority: P1) 🎯 MVP

**Goal**: Scan → member info → offline wave (newest first) + week → Attend → success modal with Next (rescan) / Back (admin home); same-day repeats rejected as "already attended".

**Independent Test**: Scan a member, mark them present, see the row in the records table; scan again the same day and get the already-attended notice with no duplicate row.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [X] T021 [P] [US2] Write FAILING Server Action tests in `tests/app/attendance-actions.test.ts` (mock `@/lib/supabase/server` + `@/lib/auth/adminGate`): `markAttendance` returns `attendanceForbidden` with no write for a non-admin; rejects with no write when the selected wave is not `type='offline'` (scan is offline-only, FR-015); returns `attendanceWrongWave` with no write when the student's `tenant_id` ≠ the selected `wave_id` (FR-027); returns `{ alreadyAttended: true }` when a `wave_attendance` row exists for `(student_id, attendanceDay(now))` (FR-028) and when the insert hits the unique violation (race path); on success inserts `{ tenant_id, week_id, student_id, attended_on, method: 'scan' }` and returns `{ marked: true }`.
- [X] T022 [P] [US2] Write FAILING component test in `tests/components/AttendancePanel.test.tsx`: the wave `<select>` lists only the offline waves passed in, newest-first; the week `<select>` re-populates from the selected wave's weeks; selecting a wave with NO weeks shows `attendanceNoWeeksNote` and disables Attend (edge case: the admin sees why); pressing Attend with a selection submits `student_id`/`wave_id`/`week_id`; a `marked` state shows the success modal with a Next link to `/admin/attendance?scan=1` and a Back link to `/admin/dashboard`; an `alreadyAttended` state shows `attendanceAlreadyTitle`/`attendanceAlreadyNote` and no success modal; modal closes on Escape.
- [X] T023 [P] [US2] Extend `tests/integration/rls.test.ts` with the **cross-wave denial** cases for `wave_attendance` (Principle VI): a Wave-B student session cannot `select` a Wave-A attendance row, and a student session cannot `insert` into `wave_attendance` at all (admin-recorded only).

#### Implementation for User Story 4.1

- [X] T024 [US2] Create `app/admin/attendance/actions.ts` with `export type AttendanceState = { error?: string; marked?: boolean; alreadyAttended?: boolean }` and the `markAttendance` Server Action per `contracts/ui-contracts.md` Feature 2: `getUser()` + `assertAdminSession` gate → require `student_id`/`wave_id`/`week_id` → confirm the selected wave is `type='offline'` (scan is offline-only, FR-015; reject otherwise, no write) → load the student and reject `attendanceWrongWave` unless `student.tenant_id === wave_id` (FR-027) → confirm the week belongs to the wave → `attended_on = attendanceDay(new Date())` → pre-check `(student_id, attended_on)` → insert `method: 'scan'`, mapping a unique-violation error to `{ alreadyAttended: true }` → `revalidatePath("/admin/attendance")` → `{ marked: true }`; `logError` on unexpected failure.
- [X] T025 [P] [US2] Create `components/AttendancePanel.tsx` (`'use client'`): props `{ studentId: string; waves: { id: string; name: string; weeks: { id: string; label: string }[] }[] }` (offline waves, newest-first, weeks by `position`); wave + week `<select>`s (labelled, ≥16px on mobile), Attend button via `useActionState(markAttendance)`; when the selected wave has no weeks, render `attendanceNoWeeksNote` and disable Attend; on `marked` render the success modal (`role="dialog"`, `aria-modal`, focus-trapped, Escape/backdrop close, internal scroll) with **Next** → `/admin/attendance?scan=1` and **Back** → `/admin/dashboard`; on `alreadyAttended` render the notice; on `error` render `role="alert"`. Brand tokens, AA contrast.
- [X] T026 [US2] In `app/admin/members/[id]/page.tsx`, after the member `<dl>` (admin branch only — the `Unauthorized` branch is unchanged), fetch offline waves (`tenants` where `type='offline'` ordered `created_at` desc, fields `id,name`) and their `wave_weeks` (`id,position,title` ordered by `position`, labelled "Week N — title"), and render `<AttendancePanel studentId={member.id} waves={...} />` when the member exists.
- [X] T027 [US2] Create `app/admin/attendance/page.tsx`: admin `DashboardShell` (`activeHref="/admin/attendance"`, `adminNavItems`, `AdminSidebarFooter`); a **Scan** section rendering `<ScanMemberButton autoOpen={searchParams.scan === "1"} />`; a **Records** section rendering an `AdminTable` over `wave_attendance` joined to student name, wave name, and week (`position`/`title`), ordered `attended_on` desc then `created_at` desc, bounded (e.g. latest 200 rows), columns Student / Wave / Week / Date / Method (`attendanceMethodScan`/`attendanceMethodCsv`), with the `attendanceEmptyTitle`/`attendanceEmptyNote` empty state. Also create `app/admin/attendance/loading.tsx` and `app/admin/attendance/error.tsx` (`'use client'`) matching the existing admin route-group conventions.
- [X] T028 [P] [US2] First extend `tests/components/ScanMemberButton.test.tsx` with FAILING cases (`autoOpen` opens the scanner dialog on mount; default/absent leaves it closed — FR-013), then in `components/ScanMemberButton.tsx` add the optional `autoOpen?: boolean` prop implementing that behavior; default behavior unchanged.
- [X] T029 [P] [US2] In `app/admin/members/page.tsx`, remove the `ScanMemberButton` import and its JSX from the actions row (the button now lives on `/admin/attendance`); no other change.
- [X] T030 [US2] In `lib/adminNav.tsx`, add an **Attendance** nav item (`strings.attendanceNavLabel`, `href: "/admin/attendance"`, a small inline check/clipboard icon matching the existing icon style) between Members and Errors.
- [X] T031 [US2] Run `npx vitest run tests/app/attendance-actions.test.ts tests/components/AttendancePanel.test.tsx tests/integration/rls.test.ts`, then `npm run build`/`npm run lint`; confirm green/clean.

**Checkpoint**: The live scan→attend→next loop works end-to-end with once-per-day enforcement. With Phase 3 this is the P1 MVP.

---

## Phase 5 — Online attendance via CSV (US3)

**Purpose** (plan Phase 2, CSV path): Online waves take attendance by an email-only CSV with a fixed template; results land in the same records table. Acceptance criteria + test scenarios: see plan.md Phase 2.

### User Story 5.1 (US3): Admin records online attendance via CSV upload (Priority: P2)

**Goal**: Pick an online wave + week, download the fixed template, upload emails; matches are marked (`csv`), unmatched/already/duplicate rows are skipped and reported.

**Independent Test**: Upload a CSV with one new member, one unmatched email, and one already-marked member → exactly one new record; both skips reported.

#### Tests for User Story 5.1 (REQUIRED — Principle II) ⚠️

- [X] T032 [P] [US3] Extend `tests/app/attendance-actions.test.ts` with FAILING tests for `importOnlineAttendance`: non-admin → forbidden, no write; a wave whose `type` ≠ `'online'` is rejected; for a valid batch it inserts `method: 'csv'` rows only for emails matching students in the selected wave, skips+reports `unmatched` and `already` (existing same-day record) rows, collapses in-file duplicates, maps a per-row insert unique-violation (lost race) to an `already` skip, and returns `{ marked, skipped }` without aborting on any skip (FR-016).
- [X] T033 [P] [US3] Write FAILING component test in `tests/components/OnlineAttendanceUpload.test.tsx`: the wave `<select>` lists only online waves (newest-first) and the week `<select>` follows it; selecting a wave with NO weeks shows `attendanceNoWeeksNote` and disables the upload submit; the template download control (`attendanceTemplateLabel`) is present; after a submit resolves, the marked count and per-row skip reasons render (`attendanceImportSummary`, `attendanceSkippedUnmatched`, `attendanceSkippedAlready`); a parse error (missing `email` header) renders `role="alert"` without submitting.

#### Implementation for User Story 5.1

- [X] T034 [US3] In `app/admin/attendance/actions.ts`, add `export type ImportState = { error?: string; marked?: number; skipped?: { email: string; reason: "unmatched" | "already" }[] }` and the `importOnlineAttendance` Server Action per `contracts/ui-contracts.md`: admin gate → require `wave_id`/`week_id` + `emails` (JSON string array; re-validate non-empty, dedupe, lowercase) → confirm the wave is `type='online'` and the week belongs to it → resolve `students` in the wave by `lower(email)` → for each: unmatched → skip; existing `(student_id, attendanceDay(now))` row → skip `already`; else insert `method:'csv'`, mapping a per-row unique-violation insert error (lost race) to an `already` skip and continuing the batch → `revalidatePath("/admin/attendance")` → `{ marked, skipped }`.
- [X] T035 [P] [US3] Create `components/AttendanceTemplateButton.tsx` (`'use client'`): downloads `attendance-template.csv` (`email` header + one example row) via a client-side Blob, mirroring `components/DownloadTemplateButton.tsx`; labelled `attendanceTemplateLabel`.
- [X] T036 [US3] Create `components/OnlineAttendanceUpload.tsx` (`'use client'`): online-wave + week `<select>`s (same prop shape as `AttendancePanel`; a wave with no weeks shows `attendanceNoWeeksNote` and disables submit), `AttendanceTemplateButton`, a file input accepting `.csv`; on pick read with the File API and parse via `parseAttendanceCsv` (parse errors shown inline, nothing submitted); submit the email array as a JSON `FormData` field to `importOnlineAttendance` via `useActionState`; render the marked/skipped report. ≥16px inputs, labelled controls, brand tokens.
- [X] T037 [US3] In `app/admin/attendance/page.tsx`, fetch the online waves (+weeks) alongside the offline data and render the **Online CSV** section (`attendanceOnlineSectionTitle`) with `<OnlineAttendanceUpload .../>` between the Scan section and the Records table.
- [X] T038 [US3] Run `npx vitest run tests/app/attendance-actions.test.ts tests/components/OnlineAttendanceUpload.test.tsx tests/lib/attendance/csv.test.ts`, then `npm run build`/`npm run lint`; confirm green/clean.

**Checkpoint**: Both capture methods feed one records table; the once-per-day rule holds across scan and CSV.

---

## Phase 6 — Admin points table (US4)

**Purpose** (plan Phase 3, config side): The Points tab exposes the three editable reward values that govern every derived total. Acceptance criteria + test scenarios: see plan.md Phase 3.

### User Story 6.1 (US4): Admin manages the points-award table (Priority: P2)

**Goal**: A Points tab showing attendance/assignment/feedback values (10/20/30 defaults), each editable to a non-negative whole number; invalid edits rejected with the prior value kept.

**Independent Test**: Change feedback 30→40 and see it persist; submit -1/blank/non-numeric and see the rejection with 40 still in place.

#### Tests for User Story 6.1 (REQUIRED — Principle II) ⚠️

- [X] T039 [P] [US4] Write FAILING Server Action tests in `tests/app/points-actions.test.ts` (mock `@/lib/supabase/server` + `@/lib/auth/adminGate`): `updatePointRule` returns `pointsForbidden` with no write for a non-admin; rejects an unknown `action`, a negative, blank, non-numeric, or fractional `points` with `pointsInvalid` and no write; a valid non-negative integer updates the row (and `updated_at`) and returns `{ saved: true }`.
- [X] T040 [P] [US4] Write FAILING component test in `tests/components/PointRulesTable.test.tsx`: renders the three labelled rows (`pointsActionAttendance`/`pointsActionAssignment`/`pointsActionFeedback`) with their current values in number inputs (≥16px on mobile); a save submits `action` + `points`; an error state renders `role="alert"` while the input keeps the prior persisted value; a saved state shows the transient `pointsSavedNote`.

#### Implementation for User Story 6.1

- [X] T041 [US4] Create `app/admin/points/actions.ts` with `export type PointRuleState = { error?: string; saved?: boolean }` and the `updatePointRule` Server Action per `contracts/ui-contracts.md`: admin gate → `action` ∈ {`attendance`,`assignment`,`feedback`} → parse `points` as a non-negative integer (reject otherwise) → `update point_rules set points = $points, updated_at = now() where action = $action` → `revalidatePath("/admin/points")` + `revalidatePath("/student/dashboard")` → `{ saved: true }`; `logError` on unexpected failure.
- [X] T042 [P] [US4] Create `components/PointRulesTable.tsx` (`'use client'`): one row per rule (label, number input, per-row Save via `useActionState(updatePointRule)`); inline `role="alert"` error and transient saved note; touch-friendly, labelled, visible focus, AA contrast, brand tokens.
- [X] T043 [US4] Create `app/admin/points/page.tsx` (admin `DashboardShell`, `activeHref="/admin/points"`; reads the three `point_rules` rows and renders `<PointRulesTable rules={...} />` with `pointsTitle`/`pointsSubtitle` intro) plus `app/admin/points/loading.tsx` and `app/admin/points/error.tsx` (`'use client'`); and in `lib/adminNav.tsx` add a **Points** nav item (`strings.pointsNavLabel`, `href: "/admin/points"`, star/trophy inline icon) after Attendance.
- [X] T044 [US4] Run `npx vitest run tests/app/points-actions.test.ts tests/components/PointRulesTable.test.tsx`, then `npm run build`/`npm run lint`; confirm green/clean.

**Checkpoint**: The reward configuration is live and tunable; totals (US5) will read it directly.

---

## Phase 7 — Student points & persisted feedback (US5)

**Purpose** (plan Phase 3, student side): Feedback persists (once per week per student) with a points-awarded thank-you popup, and the dashboard shows the real derived total starting at zero. Acceptance criteria + test scenarios: see plan.md Phase 3.

### User Story 7.1 (US5): Student earns and sees gamification points (Priority: P3)

**Goal**: Total = attendance×rule + post-epoch assignments×rule + feedback×rule, recomputed live against the current rules; submitting feedback persists it and pops a thank-you naming the awarded points.

**Independent Test**: A new member sees 0; after one attendance + one assignment upload + one feedback under 10/20/30 the total reads 60; an admin rule edit changes it on next view.

#### Tests for User Story 7.1 (REQUIRED — Principle II) ⚠️

- [X] T045 [P] [US5] Write FAILING Server Action tests in `tests/app/student-feedback-actions.test.ts` (mock `@/lib/supabase/server`): `submitFeedback` returns `studentForbidden` for a non-student session; requires `week_id`; rejects `studentForbidden` with no write when the week is not found under the caller's RLS (own-tenant session + ANOTHER wave's `week_id` — the foreign-week farming case, mirrors `submitAssignment`); upserts `wave_feedback` on `(week_id, student_id)` with the caller's own `student_id` + JWT `tenant_id` and bounded ratings (1–5 when present); reads `point_rules` and returns `{ saved: true, awardedPoints: <feedback value> }`; a resubmission upserts (no second row).
- [X] T046 [P] [US5] Extend `tests/components/WeekFeedback.test.tsx` for the rewritten card: submit posts `week_id` + ratings + comment through the action; a `saved` state renders the thank-you popup with `studentFeedbackThanksTitle` and the awarded points (e.g. "30"); the popup is dismissible and the card does not re-submit.
- [X] T047 [P] [US5] Extend `tests/integration/rls.test.ts` with the **cross-wave denial** case for `wave_feedback` (Principle VI): a Wave-B student session cannot `insert` feedback carrying Wave-A's `tenant_id`/week, and cannot `select` a Wave-A feedback row.
- [X] T048 [P] [US5] Write FAILING test in `tests/app/student-dashboard-points.test.ts` (or extend the existing dashboard test file if one exists) asserting the rewards section renders the `computeTotal` result from the three count reads + `point_rules` — zero for a member with no actions, and the counts×rules sum otherwise (assignment count filtered `submitted_at >= POINTS_EPOCH`).

#### Implementation for User Story 7.1

- [X] T049 [US5] In `app/student/actions.ts`, add `export type FeedbackState = { error?: string; saved?: boolean; awardedPoints?: number }` and the `submitFeedback` Server Action per `contracts/ui-contracts.md` Feature 3: `assertStudentSession` gate → require `week_id` → resolve own `students` row + JWT `tenant_id` → fetch the week from `wave_weeks` by id under the caller's RLS and reject `studentForbidden` if not found (own-wave weeks only — blocks foreign-week feedback farming; mirrors `submitAssignment`) → validate optional ratings (1–5) and bound `comment` length → upsert `wave_feedback` `{ tenant_id, week_id, student_id, session_rating, instructor_rating, comment }` with `onConflict: "week_id,student_id"` → read `point_rules` `feedback` value → `revalidatePath("/student/dashboard")` → `{ saved: true, awardedPoints }`; `logError` + generic error on failure.
- [X] T050 [US5] Rewrite `components/WeekFeedback.tsx` to persist: accept a `weekId: string` prop (passed from `components/StudentWeekContent.tsx` at the existing render site, line ~308), submit via `useActionState(submitFeedback)` posting `week_id` + both ratings + comment, and on `saved` show the thank-you popup (`role="dialog"`, dismissible, Escape/backdrop) with `studentFeedbackThanksTitle` + `studentFeedbackAwardedPrefix` + `awardedPoints`; keep the existing star/textarea UI and disabled-until-input behavior; remove the now-superseded `studentFeedbackThanks` key from `lib/strings.ts`.
- [X] T051 [US5] In `app/student/dashboard/page.tsx`, replace the hardcoded `strings.studentRewardsPoints` placeholder in the My Rewards section with the computed total: three `count`-only reads over the caller's own rows (`wave_attendance`; `wave_submissions` with `submitted_at >= POINTS_EPOCH`; `wave_feedback`) + the `point_rules` values → `computeTotal(...)`, rendered as `<n> Points` (`studentRewardsPointsUnit`). Do NOT wrap these reads in `cached()` (a rule edit must show on next view — FR-029); remove the now-unused `studentRewardsPoints` key from `lib/strings.ts`.
- [X] T052 [US5] Run `npx vitest run tests/app/student-feedback-actions.test.ts tests/components/WeekFeedback.test.tsx tests/app/student-dashboard-points.test.ts tests/lib/points/total.test.ts tests/integration/rls.test.ts`, then `npm run build`/`npm run lint`; confirm green/clean.

**Checkpoint**: Full gamification loop — actions accrue, rules tune retroactively, feedback thanks with the exact award.

---

## Phase 8 — Polish & Cross-Cutting Concerns

- [ ] T053 Validate Quality Gates for every new surface (`app/student/forgot-password/page.tsx`, `app/admin/attendance/page.tsx` + `components/AttendancePanel.tsx` success modal + records table, `app/admin/points/page.tsx` + `components/PointRulesTable.tsx`, `components/WeekFeedback.tsx` popup, the rewards card in `app/student/dashboard/page.tsx`) at **320 / 390 / 430 / 768px and desktop**: no page-level horizontal scroll (records table scrolls inside its own wrapper), ≥16px mobile inputs, visible focus, labelled controls, modals scroll internally and close on Escape/backdrop, WCAG 2.1 AA contrast on white and `#EEF3F8` (Principle IV).
- [X] T054 Confirm the performance budget (Principle V): the records read in `app/admin/attendance/page.tsx` is bounded; the scanner in `components/ScanMemberButton.tsx` remains a lazy `import()` island; `app/student/dashboard/page.tsx` adds only count-queries + one `point_rules` read (no new client JS beyond the feedback popup); no CWV regression at the baseline LCP < 2.5s / CLS < 0.1 / INP < 200ms.
- [X] T055 Audit non-enumeration end-to-end (`app/student/actions.ts` `requestStudentPasswordReset`, `components/StudentForgotPasswordForm.tsx`): identical response/copy for any email, no student-existence signal in the UI (SC-002). Record the accepted tradeoff that `is_student_email()` is an anon-executable boolean RPC — deliberate parity with `is_admin_email` (`0003_password_reset.sql`); the RPC returns only a boolean and the UI never differentiates.
- [ ] T056 Run `npm test` (full suite) and execute `specs/012-attendance-points-student-reset/quickstart.md` manual verification end-to-end (all three features, desktop + mobile).
- [X] T057 Write `specs/012-attendance-points-student-reset/walkthrough.md` covering each implemented phase (run steps, route/component paths, numbered desktop + mobile golden-path verification, known gaps) per Principle VII.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately; T001–T003 are parallel.
- **Foundational (Phase 2)**: depends on nothing in Setup except shared review timing; **blocks the stories as follows** — `0019`+`validateEmailField` reuse → US1; `0020`+`csv.ts`+`day.ts` → US2/US3; `0021`+`total.ts` → US4/US5.
- **US1 (Phase 3)**: depends on T004/T007 (and T001). Fully independent of every other story.
- **US2 (Phase 4)**: depends on T005/T007, T009/T012 (`day.ts`), and T002. Independent of US1.
- **US3 (Phase 5)**: depends on T005/T007, T008/T011 (`csv.ts`), T012, T002, **and US2's T024/T027** (shares `app/admin/attendance/actions.ts` and the Attendance page shell).
- **US4 (Phase 6)**: depends on T006/T007 and T003; T043's nav edit lands after US2's T030 (shared `lib/adminNav.tsx`). Otherwise independent of US1–US3.
- **US5 (Phase 7)**: depends on T006/T007 (the `point_rules` seed ships in the Foundational migration), T010/T013 (`total.ts`), and T003; independent of US4's editing UI; attendance/assignment counts work without US2 (they simply read 0/whatever exists). T047 lands after US2's T023 (both extend `tests/integration/rls.test.ts`).
- **Polish (Phase 8)**: depends on all desired stories.

### Within Each User Story

- Tests written and FAILING before implementation (Principle II).
- Migrations/domain helpers before actions; actions before UI; UI before the verification task.
- Tasks sharing a file are sequential: T001 → T002 → T003 (`lib/strings.ts`); T024 → T034 (`app/admin/attendance/actions.ts`); T030 → T043 (`lib/adminNav.tsx`); T023 → T047 (`tests/integration/rls.test.ts`); T027 → T037 (`app/admin/attendance/page.tsx`).

### Parallel Opportunities

- Phase 1: T001 → T002 → T003 are sequential (same file). Phase 2: T004 ∥ T005 ∥ T006, then T008 ∥ T009 ∥ T010, then T011 ∥ T012 ∥ T013.
- After Foundational: US1, US2, US4, and US5 can proceed **in parallel** (files disjoint except the explicit cross-story sequences above: T030 → T043 on `lib/adminNav.tsx`, T023 → T047 on `tests/integration/rls.test.ts`); US3 follows US2.
- Within US2: T021 ∥ T022 ∥ T023 (tests), then T025 ∥ T028 ∥ T029 alongside T024.
- Within US5: T045 ∥ T046 ∥ T047 ∥ T048 (tests), then T049 → T050 → T051.

---

## Parallel Example: User Story 2 (US2)

```bash
# Tests first (different files):
Task: "T021 markAttendance action tests in tests/app/attendance-actions.test.ts"
Task: "T022 AttendancePanel component test in tests/components/AttendancePanel.test.tsx"
Task: "T023 wave_attendance cross-wave denial in tests/integration/rls.test.ts"

# Then implementation across different files:
Task: "T024 markAttendance in app/admin/attendance/actions.ts"
Task: "T025 components/AttendancePanel.tsx"
Task: "T028 autoOpen prop in components/ScanMemberButton.tsx"
Task: "T029 remove scan button from app/admin/members/page.tsx"
```

---

## Implementation Strategy

### MVP first (the two P1 stories)

1. Phase 1 Setup → Phase 2 Foundational (migrations + pure helpers).
2. Phase 3 (US1): student reset → validate independently (full email round-trip + non-enumeration). Deploy/demo.
3. Phase 4 (US2): scan attendance loop → validate independently (mark, already-attended, Next/Back, records table). Deploy/demo.

### Incremental delivery

4. Phase 5 (US3): online CSV → validate (skips reported, one record per match).
5. Phase 6 (US4): points config → validate (edit + reject invalid).
6. Phase 7 (US5): student totals + feedback popup → validate (zero start, 60-point scenario, retroactive rule edit).
7. Phase 8: polish, responsive/a11y, perf, quickstart, walkthrough.

---

## Notes

- [P] = different files, no incomplete-task dependency. Tasks sharing `attendance/actions.ts`, `adminNav.tsx`, or `strings.ts` are explicitly sequenced.
- The CSV is parsed **in the browser** and submitted as a small JSON email array — no Storage bucket, no file bytes in any Server Action body (`research.md` R4).
- The once-per-day rule is **global per student per local (`Africa/Cairo`) calendar day** — `unique(student_id, attended_on)` + the action pre-check (FR-028); the wrong-wave rejection (FR-027) happens in the action before any write.
- Points are derived on read (counts × current `point_rules`), so admin edits are retroactive by construction (FR-029); the dashboard points reads stay un-cached.
- `POINTS_EPOCH` keeps pre-existing assignment submissions out of totals so every student starts at zero (FR-022, `research.md` R6).
- Commit after each task or logical group.
