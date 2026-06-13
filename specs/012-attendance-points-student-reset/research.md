# Research: Student Password Reset, Attendance Tracking & Gamification Points

Phase 0 decisions. Each resolves an unknown surfaced by the spec/Technical Context.

## R1 — Reuse the student auth scaffolding for password reset (do NOT build a new confirm/set-password flow)

- **Decision**: Add only a `/student/forgot-password` request page + `requestStudentPasswordReset` action + the `is_student_email()` SQL gate. Reuse the EXISTING `/student/auth/confirm` (`confirmStudentInvite`, which already accepts `type='recovery'`) and `/student/set-password` (`setStudentPassword`). The reset email's `redirectTo` is `${NEXT_PUBLIC_SITE_URL}/student/auth/confirm` — identical to the member magic-link redirect.
- **Rationale**: `app/student/actions.ts` already verifies `recovery` OTPs on explicit click (defending against inbox prefetch) and updates the member credential. Mirrors the admin 003 flow exactly but on the student surface. Minimum new code (Principle II "Simplicity").
- **Alternatives considered**: A dedicated `/student/reset-password` route (admin has a separate one) — rejected: students already land on `set-password` for both onboarding and recovery, so a second route is redundant. Sending reset through the admin `requestPasswordReset` — rejected: it gates on `is_admin_email` and redirects to `/admin/...`, wrong population and surface.
- **Note**: `setStudentPassword` redirects a recovered student straight to `/student/dashboard` (they hold a valid recovery session). That is acceptable for recovery; no global sign-out is needed (unlike admin, which revokes sessions — a deliberate admin-only hardening we do not copy).

## R2 — `is_student_email()` mirrors `is_admin_email()`

- **Decision**: `create function public.is_student_email(p_email text) returns boolean language sql security definer set search_path = public stable` → `exists(select 1 from public.students where lower(email)=lower(p_email))`. `revoke all from public; grant execute to anon, authenticated`.
- **Rationale**: Same trust pattern as 003 — returns only a boolean, never exposes a row, lets the request-side action decide whether to send a reset without the service-role key. We match on ANY student row (status `pending` or `active`): a pending member who never set a password can still recover, and the credential update simply sets their first password.
- **Alternatives considered**: Restrict to `status='active'` — rejected: would block a pending member from self-recovering; the magic-link onboarding and recovery share the same set-password endpoint, so allowing both is consistent and harmless (non-enumerating response means no information leaks either way).

## R3 — Attendance "calendar day" uses a single fixed timezone, computed in a pure helper

- **Decision**: `lib/attendance/day.ts#attendanceDay(d: Date): string` returns `YYYY-MM-DD` for a fixed IANA timezone constant `ATTENDANCE_TZ = "Africa/Cairo"` (Meska's operating timezone), via `Intl.DateTimeFormat('en-CA', { timeZone })`. The Server Action stores this string in `wave_attendance.attended_on` (a `date` column); the `unique(student_id, attended_on)` constraint enforces one record per student per local day.
- **Rationale**: A `date` derived in a fixed business timezone gives a deterministic, testable day boundary (Principle II) and matches how staff perceive "today's session." Pure function → unit-tested at the boundary (23:59 vs 00:01 local). UTC `now()::date` in the DB would split a single evening session across two dates for UTC+2/+3.
- **Alternatives considered**: `timestamptz` + a rolling 24h window — rejected: the spec says "per calendar day," not a sliding window, and a date column makes the uniqueness constraint trivial. Per-request browser timezone — rejected: non-deterministic and would let the day boundary vary by device.

## R4 — The online attendance CSV travels as parsed text, not a stored file

- **Decision**: `OnlineAttendanceUpload` reads the picked `.csv` with the File API **in the browser**, parses it via `lib/attendance/csv.ts#parseAttendanceCsv(text)` into a deduped, validated email array, and submits that array (JSON in `FormData`) to `importOnlineAttendance(waveId, weekId, emails)`. No Supabase Storage bucket, no file bytes in the action body.
- **Rationale**: The payload is a list of emails — kilobytes, not megabytes — so the Principle V browser→Storage rule (which exists because Vercel caps function bodies at ~4.5 MB for real file uploads) does not apply; there is no file to store. Parsing client-side keeps the action a pure data operation and lets the pure parser be unit-tested. The fixed template (single `email` column) is a static download.
- **Alternatives considered**: Upload the CSV to Storage then parse server-side — rejected: pointless Storage object + RLS surface for transient kilobytes. Multipart file in the action body — rejected: unnecessary, and would couple us to the body-size cap for no benefit.
- **Validation rules** (pure, tested): require an `email` header (case-insensitive, tolerate BOM/whitespace/trailing columns being absent), accept one email per row, lowercase+trim, drop blanks, dedupe within the file, and surface a clear error for a missing header or an empty file. Email-to-member resolution and the once-per-day skip happen server-side (RLS-bounded), reported back per row.

## R5 — Student points are DERIVED (counts × current rule values), not a stored ledger

- **Decision**: A student's total is computed on read: `attendance_count × attendance_pts + assignment_count × assignment_pts + feedback_count × feedback_pts`, where counts come from `wave_attendance`, `wave_submissions`, `wave_feedback` (the caller's own rows under RLS) and the multipliers from `point_rules`. Implemented in `lib/points/total.ts#computeTotal(counts, rules)` (pure) and called from the student dashboard RSC.
- **Rationale**: Directly satisfies FR-029 (editing a rule retroactively and consistently changes every total) for free — the multiplier is read live. No award-time snapshot rows to migrate when a value changes. Counts are cheap `head:true` count queries. Feedback's `unique(week_id, student_id)` and submissions' `unique(assignment_id, student_id)` mean each action is naturally counted once (no double-award on re-edit/re-upload).
- **Alternatives considered**: A `point_events` ledger storing fixed amounts — rejected: a rule edit would NOT change historical totals (violates FR-029) unless we store action-type-not-amount, which collapses back into "count by type × current value" — i.e. the derived model with extra write overhead.

## R6 — "Start at zero" + an assignment points-epoch

- **Decision**: `wave_attendance` and `wave_feedback` are brand-new (empty at launch → contribute 0). For assignments, only submissions at/after a constant `POINTS_EPOCH` count toward points. `POINTS_EPOCH` is a documented ISO timestamp constant (the points feature's go-live), compared against `wave_submissions.submitted_at` in the count query.
- **Rationale**: FR-022 requires every student to start at zero, but `wave_submissions` already holds historical rows. Excluding pre-epoch submissions makes the opening total zero for everyone while still granting +assignment for every upload going forward. Attendance/feedback need no epoch because their tables start empty.
- **Alternatives considered**: Count all historical submissions — rejected: students who already submitted would not "start at zero" (violates FR-022). A per-student "points start date" — rejected: over-engineered; a single feature epoch is sufficient and simplest. Wiping/migrating submissions — rejected: destroys assignment data.
- **Caveat (documented)**: a re-upload after the epoch bumps `submitted_at` and would let a pre-epoch assignment count once. This is an acceptable, rare edge; latest-wins upsert keeps one row per assignment, so it can never multi-count.

## R7 — `point_rules` is GLOBAL config, modeled on the instructors table

- **Decision**: `point_rules` carries NO `tenant_id`. RLS: `select` to `authenticated` (students read the values to display their total), `all`/write to `is_admin()`. Three fixed rows keyed by `action`.
- **Rationale**: Point values are platform-wide display/config data, not wave-scoped student data — exactly the precedent set by 0015 widening instructor SELECT to authenticated students (global directory, admin-write). Not a wave-isolation concern (Principle VI applies to tenant-scoped rows). Keeping it global means one consistent reward scheme across all waves, matching the spec (a single editable table).
- **Alternatives considered**: Per-wave point rules — rejected: the spec describes ONE table the admin edits, not per-wave tuning; per-wave would multiply rows and UI for no requested benefit.

## R8 — Scan→info→attend lives on the existing self-gated member-info page

- **Decision**: The `AttendancePanel` (offline-wave + week selectors, Attend, Next/Back modal) renders on `/admin/members/[id]` for admins. **Next** navigates to `/admin/attendance?scan=1` (the Attendance tab reopens the scanner from a query flag); **Back** navigates to `/admin/dashboard`.
- **Rationale**: The scan already lands on this page (it is the QR target, self-gated to admins, exempt from the proxy redirect). Putting the attend controls here makes scan→attend a single navigation with no extra route. The panel renders only for admins (the page already shows `Unauthorized` to non-admins), so member PII and attendance controls stay admin-only. Reopening the scanner via a query flag keeps the camera island on the Attendance tab (single owner of `ScanMemberButton`).
- **Alternatives considered**: A bespoke `/admin/attendance/[studentId]` route — rejected: duplicates the member-info page and its self-gating for no benefit. Embedding the scanner on the member-info page for "Next" — rejected: would put two scanner owners in the app; a query-flag round-trip to the Attendance tab is simpler and keeps one scanner.
