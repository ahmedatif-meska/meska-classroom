# Implementation Plan: Student Password Reset, Attendance Tracking & Gamification Points

**Branch**: `012-attendance-points-student-reset` | **Date**: 2026-06-12 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/012-attendance-points-student-reset/spec.md`

## Summary

Three independent capabilities, each its own phase:

1. **Student password reset (Feature 1)** — add self-service recovery to the student sign-in surface, mirroring the admin flow (003). The student auth scaffolding already accepts a `recovery` link (`confirmStudentInvite` → `/student/set-password` → `setStudentPassword`), so this phase only adds a **Forgot password?** link, a `/student/forgot-password` request page + form, a non-enumerating `requestStudentPasswordReset` Server Action, and a SQL `is_student_email()` gate (mirror of `is_admin_email`). No new auth tables — Supabase Auth owns the single-use token.

2. **Attendance tracking (Feature 2)** — a new admin **Attendance** tab (`/admin/attendance`). The **Scan QR** button moves here from Members (same `ScanMemberButton`, unchanged scan→`/admin/members/[id]` navigation). The member-info page gains an admin-only attendance panel: an **offline**-wave dropdown (newest first), a week dropdown from that wave, and an **Attend** button → success modal with **Next** (reopen scanner) / **Back** (admin home). Offline attendance is one-scan; **online** waves take attendance via an email-only CSV uploaded on the Attendance tab against a selected online wave + week. A new `wave_attendance` table (tenant-scoped, `unique(student_id, attended_on)` → one record per student per calendar day across all waves) backs both paths and the records table.

3. **Gamification points (Feature 3)** — a new admin **Points** tab (`/admin/points`) with an editable `point_rules` table (attendance 10 / assignment 20 / feedback 30 defaults). Student totals are **derived** as `Σ action_count × current rule value`, so editing a rule recomputes every total (FR-029). Feedback becomes **persisted** (new `wave_feedback` table) so it both counts for points and drives a thank-you popup naming the awarded points. The student "My Rewards" placeholder shows the real total; everyone starts at zero (FR-022) via the empty new tables + an assignment points epoch.

No new runtime dependencies. Three migrations (`0019`–`0021`). Wave isolation enforced by flat `tenant_id = jwt_tenant_id()` RLS plus admin gates, with cross-wave denial tests.

## Technical Context

**Language/Version**: TypeScript (strict), React 19 (React Compiler on), Next.js 16 App Router — per `CLAUDE.md`.

**Primary Dependencies**: Existing only — Supabase (Postgres + Auth + RLS + Storage), Tailwind v4, `html5-qrcode` (already used by `ScanMemberButton`), Vitest + React Testing Library. **No new dependency.**

**Storage**: Postgres tables `public.wave_attendance`, `public.wave_feedback`, `public.point_rules` (all new) + the `is_student_email()` RPC. **No Storage bucket** — the attendance CSV is a tiny email-only text payload parsed in the browser and submitted as a string array to a Server Action (no file bytes, far under the 4.5 MB body cap; Principle V Storage rule does not apply because no file is stored).

**Testing**: Vitest (jsdom) — pure-lib unit tests (CSV email parse, attendance-date in fixed tz, points math, `is_student_email` gate behavior via mocked RPC), component tests (attendance panel, Points table edit, feedback popup), Server Action tests (mocked Supabase + gates), and extensions to `tests/integration/rls.test.ts` for the cross-wave denial cases of the three new tables.

**Target Platform**: Responsive web, mobile-first (320px → desktop); latest two versions of Chrome/Edge/Firefox/Safari + iOS Safari + Android Chrome. The scan flow is camera-driven on a phone — the primary attendance device.

**Project Type**: Web application (Next.js App Router; Student + Admin panels).

**Performance Goals**: No CWV regression vs baseline **LCP < 2.5s / CLS < 0.1 / INP < 200ms** on mid-tier Android over Slow-4G. Per-feature budget: the Attendance records table and Points table are bounded admin reads (paginated/ordered, capped); the camera scanner is already a lazy `import()` island; student points are three `count`-only reads in the existing dashboard RSC (no new client JS on the student home beyond the existing rewards card).

**Constraints**: Wave isolation NON-NEGOTIABLE (server-side `tenant_id` filter + RLS + cross-wave test) for `wave_attendance` and `wave_feedback`. `point_rules` is **global config** (no `tenant_id`), modeled on the instructors table (admin-write, authenticated-read) — justified in the Constitution Check, not a wave-isolation concern. Non-enumerating reset response (identical confirmation regardless of account existence). Brand tokens only; English/LTR; WCAG 2.1 AA; ≥16px mobile inputs.

**Scale/Scope**: 3 migrations, 1 new pure lib module (`lib/attendance/`) + 1 (`lib/points/`), ~7 Server Actions, 2 new admin routes (Attendance, Points) + nav entries, 1 admin-side attendance panel on the member-info page, 1 student feedback rewrite + 1 student rewards-total read, copy + tests. Medium.

## Constitution Check

*GATE: must pass before Phase 0 and re-checked after design. Constitution v2.2.0.*

- **I. Code Quality** — TS strict; pure helpers extracted (`lib/attendance/csv.ts` email parse, `lib/attendance/day.ts` fixed-tz date, `lib/points/total.ts` math); reuses 003/008 patterns; no manual memoization; long/admin-supplied content bounded and truncated in tables. **PASS**
- **II. Testing (NON-NEGOTIABLE)** — ships unit tests (CSV parse, attendance-day, points math, student-email gate), component tests (attendance panel states, Points edit validation, feedback thank-you popup), action tests (gate + once-per-day + non-enumeration), and cross-wave denial tests for `wave_attendance` + `wave_feedback` in `tests/integration/rls.test.ts`. A reproduction test precedes any bug fix. **PASS**
- **III. UX Consistency** — brand tokens only; every new view defines loading/empty/error states (empty attendance table, empty Points reasoning, "already attended" notice, reset sent confirmation); logo/nav context-aware and unchanged across panels. **PASS**
- **IV. Mobile-First & Accessible** — attendance panel, success modal (internal scroll, focus-trapped, Escape/backdrop close), Points table (contained horizontal scroll via `AdminTable`), CSV controls, and the new sidebar entries validated at 320/390/430/768/desktop; touch-friendly labelled controls, visible focus, ≥16px inputs, AA contrast. The two new admin nav items collapse with the existing off-canvas drawer (no change to `DashboardShell`). **PASS**
- **V. Performance** — RSC-first; the only client islands are the existing scanner, the small attendance-action panel, the Points inline-edit form, and the feedback card; admin reads bounded/ordered; CSV is small text through a Server Action (no file bytes, no Storage) — Principle V's browser→Storage rule is satisfied vacuously (no file is uploaded/stored). **PASS**
- **VI. Wave Isolation (NON-NEGOTIABLE)** — `wave_attendance.tenant_id` and `wave_feedback.tenant_id` denormalized; RLS `select` = `is_admin() or tenant_id = jwt_tenant_id()`, student write confined to own student-id + own wave; admin actions gated by `assertAdminSession`; `markAttendance` independently verifies the scanned student belongs to the selected wave (FR-027) before writing; cross-wave denial tested. `point_rules` carries no tenant (global), admin-write/authenticated-read. **PASS**
- **VII. Artifact Structure (NON-NEGOTIABLE)** — phases below are `Phase → User Story → Acceptance Criteria → Test Scenarios`; each implemented phase ships a `walkthrough.md` section covering desktop + mobile golden paths. **PASS**

**No violations → Complexity Tracking is empty.** Two new admin routes and three new tables are routine extensions of the existing 003/008 patterns (no new architectural layer, dependency, API route, state library, or component library). `point_rules` as a global (non-tenant) config table reuses the established instructors-table precedent (admin-write, authenticated-read for display data).

## Project Structure

### Documentation (this feature)

```text
specs/012-attendance-points-student-reset/
├── plan.md              # This file
├── spec.md
├── research.md          # Phase 0 — decisions (reset reuse, attendance-day tz, CSV-as-text, points-epoch, point_rules globality)
├── data-model.md        # Phase 1 — wave_attendance, wave_feedback, point_rules + RLS + derived-total math
├── quickstart.md        # Phase 1 — run + manual verification per feature
├── contracts/
│   └── ui-contracts.md  # Phase 1 — Server Actions + admin/student UI + copy keys
├── checklists/
│   └── requirements.md  # spec quality checklist (from /speckit-specify)
├── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md       # per-phase output (/speckit-implement)
```

### Source Code (repository root)

```text
supabase/migrations/
├── 0019_student_password_reset.sql     # NEW — is_student_email() RPC (mirror is_admin_email)
├── 0020_wave_attendance.sql            # NEW — wave_attendance table + RLS (unique student_id, attended_on)
└── 0021_points_and_feedback.sql        # NEW — point_rules (seeded) + wave_feedback table + RLS

lib/
├── auth/
│   └── studentPasswordReset.ts         # NEW (or reuse passwordReset.ts validateEmailField) — student-side email validation note
├── attendance/
│   ├── csv.ts                          # NEW — parse/validate the email-only attendance CSV (pure)
│   └── day.ts                          # NEW — attendanceDay(date): fixed-tz YYYY-MM-DD (pure)
├── points/
│   └── total.ts                        # NEW — computeTotal(counts, rules) (pure)
├── strings.ts                          # EDIT — student-reset, attendance, points, feedback copy keys
├── adminNav.tsx                        # EDIT — add Attendance + Points nav items (+ icons)
└── cache/keys.ts                       # EDIT (if needed) — admin list keys for attendance/points

app/
├── student/
│   ├── page.tsx                        # EDIT — none (link lives in StudentLoginForm)
│   ├── forgot-password/page.tsx        # NEW — request-reset page (student surface)
│   └── actions.ts                      # EDIT — add requestStudentPasswordReset; add submitFeedback
├── admin/
│   ├── attendance/
│   │   ├── page.tsx                     # NEW — Attendance tab: Scan QR + online CSV + records table
│   │   ├── actions.ts                   # NEW — markAttendance, importOnlineAttendance
│   │   ├── loading.tsx / error.tsx      # NEW — panel states (match existing route group convention)
│   ├── points/
│   │   ├── page.tsx                     # NEW — Points tab: editable point_rules table
│   │   ├── actions.ts                   # NEW — updatePointRule
│   │   ├── loading.tsx / error.tsx      # NEW
│   └── members/
│       ├── page.tsx                     # EDIT — remove <ScanMemberButton/> (moved to Attendance)
│       └── [id]/page.tsx                # EDIT — render admin attendance panel (offline-wave + week + Attend)

components/
├── StudentLoginForm.tsx                # EDIT — add "Forgot password?" link to /student/forgot-password
├── StudentForgotPasswordForm.tsx       # NEW — 'use client' request form (mirror ForgotPasswordForm)
├── AttendancePanel.tsx                 # NEW — 'use client' offline-wave+week selectors, Attend, success modal (Next/Back)
├── OnlineAttendanceUpload.tsx          # NEW — 'use client' online-wave+week + CSV pick/parse/submit + template download
├── AttendanceTemplateButton.tsx        # NEW — download the fixed email-only CSV template (or reuse DownloadTemplateButton pattern)
├── PointRulesTable.tsx                 # NEW — 'use client' inline-edit rows → updatePointRule
└── WeekFeedback.tsx                    # EDIT — submit via submitFeedback action; thank-you popup names awarded points

tests/
├── lib/attendance/csv.test.ts          # NEW — email CSV parse: header, dups, blanks, bad rows
├── lib/attendance/day.test.ts          # NEW — fixed-tz day boundary
├── lib/points/total.test.ts            # NEW — counts × rules math, zero values
├── app/student-reset-actions.test.ts   # NEW — requestStudentPasswordReset non-enumeration + student-email gate
├── app/attendance-actions.test.ts      # NEW — markAttendance gate, wave-membership (FR-027), once-per-day (FR-028); CSV import skip/report
├── app/points-actions.test.ts          # NEW — updatePointRule gate + validation
├── components/AttendancePanel.test.tsx # NEW — selectors, Attend → modal, already-attended, Next/Back
├── components/PointRulesTable.test.tsx # NEW — edit/validate/persist
├── components/WeekFeedback.test.tsx    # NEW — submit → thank-you popup names points
└── integration/rls.test.ts            # EDIT — wave_attendance + wave_feedback cross-wave denial
```

**Structure Decision**: Two new admin route groups (`/admin/attendance`, `/admin/points`) following the existing `/admin/<area>` convention (page + actions + loading/error). The student reset reuses the existing `/student/auth/confirm` → `/student/set-password` machinery, adding only the request page and action. The attendance authoring panel lives on the existing self-gated member-info page (the scan target), so the scan→info→attend flow is one navigation. Pure logic is isolated under `lib/attendance/` and `lib/points/` for deterministic tests.

## Implementation Phases

### Phase 1 — Student password reset

#### User Story 1.1 (US1): As a member who forgot my password, I want to reset it from the student sign-in page so that I regain access without admin help

- Description: Add a **Forgot password?** link on the student sign-in form to a new `/student/forgot-password` page whose form calls a new `requestStudentPasswordReset` Server Action. The action validates the email, calls `is_student_email()` (new SQL gate), and only for a real member sends `resetPasswordForEmail` redirecting to `/student/auth/confirm` — which already verifies `recovery` links on click and routes to `/student/set-password` → `setStudentPassword`. Every request returns the same neutral "if an account exists, a link was sent" confirmation (no enumeration). The set-password and confirm flows are reused unchanged.

#### Acceptance Criteria (for the phase)

- [ ] Migration `0019_student_password_reset.sql` creates `is_student_email(text)` (`SECURITY DEFINER`, `stable`, returns boolean only) granted to `anon, authenticated`, returning true iff a `public.students` row has that email.
- [ ] The student sign-in form shows a keyboard-accessible **Forgot password?** link to `/student/forgot-password`.
- [ ] `/student/forgot-password` renders a labelled email form; submitting any value returns the SAME neutral confirmation; a member email triggers a reset email to `/student/auth/confirm`, a non-member (or admin-only) email triggers none.
- [ ] Following the emailed link lands on the existing student confirm interstitial; pressing Continue verifies the `recovery` OTP and reaches `/student/set-password`; submitting a valid new password updates the member credential, revokes the member's OTHER sessions (FR-005), and signs them into `/student/dashboard`.
- [ ] An expired/used link shows the existing invalid-link state with a path back to sign-in.
- [ ] The admin reset flow is untouched; an admin email submitted on the student page yields no student reset.
- [ ] `npm run build` and `npm run lint` pass clean.

#### Test Scenarios (for the phase)

1. **Given** the student sign-in page, **When** it renders, **Then** a "Forgot password?" link points to `/student/forgot-password`.
2. **Given** a member email, **When** `requestStudentPasswordReset` runs, **Then** `is_student_email` is true, a recovery email is requested to `/student/auth/confirm`, and the neutral confirmation is returned.
3. **Given** a non-member email (and separately an admin-only email), **When** the action runs, **Then** no reset email is sent and the SAME neutral confirmation is returned (non-enumeration).
4. **Given** a member with a valid recovery session, **When** they submit a valid new password, **Then** the credential updates and they reach `/student/dashboard`; **And** an expired token lands on the invalid-link state.
5. **Given** the admin recovery flow, **When** the student feature is exercised, **Then** admin request/confirm/update behavior is unchanged (regression guard).

---

### Phase 2 — Attendance tracking

#### User Story 2.1 (US2): As an admin, I want to scan a student at an in-person session and mark them present for an offline wave's week so that attendance is recorded once per day

- Description: Add the **Attendance** admin tab and move `ScanMemberButton` to it (removing it from Members; scan still navigates to `/admin/members/[id]`). On the member-info page, render an admin-only `AttendancePanel`: an **offline**-wave dropdown (waves where `type='offline'`, ordered `created_at` desc), a week dropdown loaded from the chosen wave, and an **Attend** button calling `markAttendance(studentId, waveId, weekId)`. The action is admin-gated, verifies the student belongs to the selected wave (FR-027), enforces one record per student per calendar day across all waves (FR-028, `unique(student_id, attended_on)` + pre-check), and on success returns a state driving a success modal with **Next** (→ `/admin/attendance?scan=1`, reopen scanner) and **Back** (→ `/admin/dashboard`). A repeat that day returns the "already attended" state.

#### User Story 2.2 (US3): As an admin, I want to mark an online wave's attendees present by uploading an email-only CSV so that remote sessions are tracked too

- Description: On the Attendance tab, add `OnlineAttendanceUpload`: an **online**-wave dropdown (`type='online'`, newest first) + week dropdown, a fixed downloadable CSV template (single `email` column), and a file picker that parses the CSV **in the browser** (`lib/attendance/csv.ts`) to an email array submitted to `importOnlineAttendance(waveId, weekId, emails)`. The action marks each matching member present (same once-per-day rule), and reports skipped rows (unmatched email, already-marked-today, duplicates in file) without aborting. All records land in the Attendance records table (student, wave, week, date, method scan/csv).

#### Acceptance Criteria (for the phase)

- [ ] Migration `0020_wave_attendance.sql` creates `public.wave_attendance` (`id`, `tenant_id`, `week_id`, `student_id`, `attended_on date`, `method text check in ('scan','csv')`, `created_at`) with `unique(student_id, attended_on)`, the lookup indexes, and RLS (`select` = admin-or-own-wave-own-row; writes admin-only). Wave isolation enabled.
- [ ] `ScanMemberButton` no longer renders on `/admin/members`; it renders on `/admin/attendance` and its scan still resolves to `/admin/members/[id]` unchanged.
- [ ] The member-info page shows the attendance panel only to admins; the offline-wave dropdown lists `type='offline'` waves newest-first; the week dropdown reflects the selected wave's `wave_weeks` by `position`.
- [ ] `markAttendance` is admin-gated; rejects (no write) when the selected wave is not `type='offline'` (scan is offline-only, FR-015) or when the student is not enrolled in the selected wave (FR-027); inserts `method='scan'`; returns "already attended" when a record exists for that student that calendar day (FR-028); a successful insert drives the Next/Back modal.
- [ ] The online CSV template downloads with exactly an `email` header; `importOnlineAttendance` marks each matching member (`method='csv'`) for the selected online wave/week, skips+reports unmatched / already-today / in-file-duplicate rows, and never aborts the batch.
- [ ] The Attendance records table lists each record with student, wave, week, date, and method; empty state defined; table uses the contained-scroll `AdminTable` pattern (no page-level horizontal scroll on mobile).
- [ ] A non-admin caller of either action gets the generic forbidden message and causes no write; a student cannot read another wave's attendance (RLS).
- [ ] `npm run build`/`lint` clean; validated 320/390/430/768/desktop.

#### Test Scenarios (for the phase)

1. **Given** the migration is applied, **When** the schema is inspected, **Then** `wave_attendance` exists with `unique(student_id, attended_on)`, RLS enabled, and the documented policies.
2. **Given** an admin on a scanned student's info page, **When** they pick the student's own offline wave + a week and press Attend with no record today, **Then** one `scan` row is written and the success modal offers Next/Back.
3. **Given** the same student already marked today, **When** the admin presses Attend again (same or different week/wave), **Then** the action returns "already attended" and writes nothing (FR-028).
4. **Given** an offline wave the scanned student is NOT enrolled in, **When** the admin presses Attend, **Then** it is rejected with a clear message and no row is written (FR-027).
5. **Given** the success modal, **When** the admin presses Next, **Then** they land on `/admin/attendance?scan=1` (scanner reopens); **When** they press Back, **Then** they land on `/admin/dashboard`.
6. **Given** an online wave + week and a CSV of three emails (one unmatched, one already-marked-today, one new), **When** uploaded, **Then** only the new member is marked `csv`, and the other two are reported skipped without aborting.
7. **Given** a student in wave B, **When** RLS is exercised for a wave-A attendance row, **Then** the row is denied (cross-wave denial — `tests/integration/rls.test.ts`).
8. **Given** a non-admin session, **When** `markAttendance` or `importOnlineAttendance` runs, **Then** it returns forbidden and performs no write.

---

### Phase 3 — Gamification points & persisted feedback

#### User Story 3.1 (US4): As an admin, I want an editable points table so that I can tune how many points each action grants

- Description: Add the **Points** admin tab rendering `PointRulesTable` over the `point_rules` config (rows `attendance`, `assignment`, `feedback`, seeded 10/20/30). Each row is inline-editable; `updatePointRule(action, points)` is admin-gated and validates a non-negative whole number, rejecting invalid input with the prior value preserved. Saved values immediately govern derived student totals.

#### User Story 3.2 (US5): As a student, I want to earn and see points (and a thank-you when I give feedback) so that I'm motivated to participate

- Description: Persist feedback (new `wave_feedback`, `unique(week_id, student_id)`) via a new `submitFeedback` Server Action wired into the rewritten `WeekFeedback` card; on success it returns the current feedback rule value and the card shows a thank-you popup naming the awarded points. The student dashboard "My Rewards" placeholder is replaced by the real total computed by `computeTotal` = `attendance_count × attendance_pts + assignment_count(after points-epoch) × assignment_pts + feedback_count × feedback_pts`. New tables start empty and the assignment points-epoch keeps pre-existing submissions from counting, so every student starts at zero (FR-022); editing a rule recomputes all totals (FR-029).

#### Acceptance Criteria (for the phase)

- [ ] Migration `0021_points_and_feedback.sql` creates `public.point_rules` (`action text primary key check in ('attendance','assignment','feedback')`, `points int not null default ... check >= 0`, `updated_at`), seeded 10/20/30, RLS select=authenticated / write=admin; and `public.wave_feedback` (`id`, `tenant_id`, `week_id`, `student_id`, `session_rating`, `instructor_rating`, `comment`, `created_at`, `unique(week_id, student_id)`) with RLS (student insert/select own + own wave; admin all).
- [ ] The Points tab lists the three rules with current values; `updatePointRule` is admin-gated, accepts a non-negative integer, and rejects negatives/blank/non-numeric with the prior value kept and a clear message.
- [ ] `submitFeedback` is student-gated, writes (upserts) the caller's own-week feedback in their own wave, and returns the current feedback point value; the feedback card shows a thank-you popup naming that value; resubmitting the same week does not create a second row (points counted once).
- [ ] The student dashboard shows the real total = counts × current rule values; a brand-new member shows zero; pre-existing assignment submissions (before the points-epoch) do not count.
- [ ] Editing a rule value changes the displayed total on next student view consistently across students (FR-029).
- [ ] A non-admin calling `updatePointRule`, or a student submitting feedback for another wave's week, is denied with no write (RLS + gate); `npm run build`/`lint` clean.

#### Test Scenarios (for the phase)

1. **Given** the migration is applied, **When** the schema is inspected, **Then** `point_rules` holds the three seeded rows (10/20/30) and `wave_feedback` exists with `unique(week_id, student_id)` and RLS enabled.
2. **Given** an admin on the Points tab, **When** they set assignment to 25 (valid), **Then** it persists; **When** they set it to -1 or blank, **Then** it is rejected and the prior value remains.
3. **Given** a student, **When** they submit feedback for their week, **Then** a `wave_feedback` row is written and a thank-you popup names the feedback points; **When** they resubmit that week, **Then** no second row is created.
4. **Given** a new member with no actions, **When** they open the dashboard, **Then** the total reads zero (pre-epoch assignment submissions, if any, excluded).
5. **Given** a student with 1 attendance + 1 post-epoch assignment + 1 feedback under rules 10/20/30, **When** the total is computed, **Then** it equals 60; **When** an admin changes feedback to 40, **Then** the next view shows 70 (retroactive recompute).
6. **Given** a student in wave B, **When** they attempt feedback on a wave-A week, **Then** RLS denies the write (cross-wave denial — `tests/integration/rls.test.ts`).
7. **Given** a non-admin session, **When** `updatePointRule` runs, **Then** it returns forbidden and performs no write.

## Complexity Tracking

> No constitution violations — table intentionally empty.
