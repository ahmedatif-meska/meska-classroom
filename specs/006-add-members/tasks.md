---
description: "Task list for Add Members"
---

# Tasks: Add Members

**Input**: Design documents from `specs/006-add-members/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/add-members-contracts.md](./contracts/add-members-contracts.md)

**Tests**: REQUIRED (Principle II, NON-NEGOTIABLE). The field/CSV validators, the QR helper, the
student gate, the create/bulk/resend Server Actions (admin-gate denial, dup-email reject,
invite/claims/insert, whole-file reject, per-row create), the student sign-in/set-password
actions, and the list/modal/member-info rendering are pure or Supabase-mockable, so each ships
deterministic unit/component tests, written first and confirmed failing before implementation.
The **NON-NEGOTIABLE cross-wave/role denial** test (Principle VI) is `memberInfoPage.test.tsx`
(a non-admin/member is denied the admin-only member-info page) plus `studentGate.test.ts` and
the `signInStudent` admin-rejection; together they cover that a member never reads outside their
wave or reaches an admin surface.

**Organization** (Principle VII): `## Phase N — <name>` mirrors [plan.md](./plan.md);
`### User Story N.x` matches the plan's story numbering (US1.1, US2.1, US3.1, US4.1, US5.1).
Phase-level acceptance criteria and test scenarios live in plan.md.

**Builds on `002-admin-auth` + `004-admin-management` + `005-instructors`** (implemented):
reuses `lib/supabase/server.ts` (cookie/RLS client), `lib/supabase/admin.ts` (service-role Admin
API), `lib/auth/adminGate.ts` (`assertAdminSession`), `lib/auth/passwordReset.ts`
(`validateNewPassword`), the `AddAdminModal`/`AdminTable`/`AdminLoginForm`/`ResetPasswordForm`/
`/admin/auth/confirm` patterns, `lib/adminNav.tsx`, `proxy.ts`, and `lib/strings.ts` / tokens.
**Adds three things** (Complexity Tracking): the service-role Admin API for member provisioning
(reuse of the 004 pattern), **one** dependency `qrcode` (inline-SVG QR), and the **first student
auth sessions** + student-route protection. **Wave == `tenants` row** (confirmed 2026-06-04).

> **Conventions adopted from prior features (do not re-litigate) — these refine plan.md wording:**
> - **No route-level `loading.tsx`.** Per 004 (T010) / 005, a route `loading.tsx` blanks the whole
>   `DashboardShell` on every tab switch. The fast RSC read needs none; **empty + error states
>   still apply.** (Diverges from plan.md's Phase-1 mention of `loading.tsx` — intentionally.)
> - **`MemberTable` uses the `AdminTable` contained-horizontal-scroll pattern**, NOT a card
>   transform: a semantic `<table>` in `overflow-x-auto` with `min-w-[…]` + `whitespace-nowrap`
>   cells and a `data-member-row` hook (`learning.md` Bug 3 — the roster is tabular like admins).
>   (Diverges from plan.md's "card transform" wording — intentionally; the page/body never scrolls
>   sideways, only the table wrapper.)
> - **Header layout**: `flex items-start justify-between` at all sizes, action wrapped in
>   `shrink-0`, title side `min-w-0` (`learning.md` Bug 2).

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[Story]**: maps to the plan's user stories (US1.1, US2.1, US3.1, US4.1, US5.1)

---

## Phase 1 — Members page: navigation, list, template & schema foundation

**Purpose**: Deliver the surface and the read — the **Members** sidebar entry and `/admin/members`
listing every member (full name, WhatsApp, email, wave, status) with empty + error states (no
route loading) and a contained-horizontal-scroll table — plus the foundational infra later phases
need: migration `0006` (evolve `students`; seed **Offline**/**Online** waves; widen the audit
CHECK), the `qrcode` dependency, the static CSV template, the proxy matcher, and the Members nav
item. Independently testable: seed a member row and assert the list renders it; confirm an
unauthenticated caller is redirected.

### Shared setup (prerequisite for the phase — no story label)

- [x] T001 Create `supabase/migrations/0006_add_members.sql` exactly per [data-model.md](./data-model.md): add `students.user_id` (unique FK `auth.users` on delete cascade), `email`, `whatsapp`, `status` (`pending`/`active` CHECK); add `students_email_lower_key` unique index on `lower(email)`; idempotently seed `tenants` rows **Offline** and **Online**; widen `admin_auth_events` reason CHECK with `member_created`, `member_reinvited`.
- [x] T002 Apply migration `0006` to the Supabase project (`fghcfihgfgqoodylwcks`) and verify per [quickstart.md](./quickstart.md) §2: `students` has the new columns + index, `tenants` contains Offline & Online, the reason CHECK is widened. (depends on T001)
- [x] T003 [P] Add `qrcode` (dependency) and `@types/qrcode` (devDependency) to `package.json` and install.
- [x] T004 [P] Append a **Members** `NavItem` (new inline icon) routing to `/admin/members` in `lib/adminNav.tsx`.
- [x] T005 [P] Add the **Members-list** copy group (`membersNavLabel`, `membersTitle`, `membersSubtitle`, `membersAddLabel`, `membersColName/Whatsapp/Email/Wave/Status`, `membersStatusPending/Active`, `membersEmpty`, `membersDownloadTemplate`) to `lib/strings.ts` (contracts C7).
- [x] T006 [P] Add `public/members-template.csv` with the header row exactly `Full Name,WhatsApp Number,Email` and no data rows (matches the validator, SC-010).
- [x] T007 Add the matcher `"/admin/members/:path*"` to the admin list in `proxy.ts` `config.matcher` (the existing non-admin→`/admin` logic already gates it; the student branch lands in Phase 3).

### User Story 1.1: As an administrator, I want a Members page that lists every member with a downloadable template, so that I can see and manage the roster. (Priority: P1) 🎯 MVP

**Goal**: A `/admin/members` page listing all members with empty/error states and a CSV-template download.

**Independent Test**: Seed members across both waves; the page renders each with name/WhatsApp/email/wave/status; an unauthenticated visit to `/admin/members` redirects to `/admin`; the template downloads with the expected header.

#### Tests for User Story 1.1 (REQUIRED — Principle II) ⚠️

- [x] T008 [P] [US1.1] Write `tests/app/admin/members/membersPage.test.tsx`: rows render full name, WhatsApp, email, wave name, status; empty state shown when no members (mock the cookie/RLS client). Confirm it FAILS first.

#### Implementation for User Story 1.1

- [x] T009 [P] [US1.1] Create `components/MemberTable.tsx` — semantic `<table>` in `overflow-x-auto` with `min-w-[760px]` + `whitespace-nowrap` cells, `data-member-row` on each `<tr>`; columns: full name, WhatsApp, email, wave, status; status badge (pending/active); each row links to `/admin/members/[id]` (the per-row resend control is added in Phase 2). Copy via `lib/strings.ts`.
- [x] T010 [P] [US1.1] Create `components/DownloadTemplateButton.tsx` — a download link/button to `/members-template.csv` (copy via strings).
- [x] T011 [US1.1] Create `app/admin/members/page.tsx` — RSC inside `DashboardShell` (navItems=`adminNavItems`, `activeHref="/admin/members"`, footer=`AdminSidebarFooter`): read `students` joined to its wave name (`tenants.name`) via the cookie/RLS client ordered by `created_at desc` (bounded, R10); header with `items-start justify-between` (title `min-w-0`, a `shrink-0` slot holding `DownloadTemplateButton`; the **Add Members** action slot is filled in Phase 2); render `MemberTable` + empty state. **No `loading.tsx`** (convention above). (depends on T009, T010)

**Checkpoint**: Members list is live and independently testable. Produce the Phase-1 section of `specs/006-add-members/walkthrough.md` before sign-off.

---

## Phase 2 — Add a single member: form, QR identity & onboarding email

**Purpose**: Deliver single creation end-to-end: **Add Members → Add by form**, validators, the
member-info URL helper, the shared `provisionMember` helper, and the gated `createMember` +
`resendMemberInvite` actions (service-role invite + `{role:'student', tenant_id}` claims + pending
`students` insert).

### User Story 2.1: As an administrator, I want to add a member through a form (name, WhatsApp, email, wave), so that they are created, assigned to a wave, and emailed an onboarding link. (Priority: P1)

**Goal**: Create one member from a form, assigning a wave, generating their identity, and sending the onboarding email.

**Independent Test**: Submit a valid form → a `pending` member appears in the selected wave and an onboarding email is dispatched; blank/duplicate/malformed inputs are rejected with no creation; a non-admin caller is denied before any Admin-API call.

#### Tests for User Story 2.1 (REQUIRED — Principle II) ⚠️

- [x] T012 [P] [US2.1] Write `tests/lib/members/validation.test.ts`: `validateMemberFields` rejects empty/whitespace-only fields, malformed email, missing wave; accepts valid input (FR-008). Confirm FAIL first.
- [x] T013 [P] [US2.1] Write `tests/lib/members/qr.test.ts`: `memberInfoUrl(id)` returns `${SITE_URL}/admin/members/<id>` (FR-016). Confirm FAIL first.
- [x] T014 [P] [US2.1] Write `tests/app/admin/members/createMember.test.ts`: denies before any Admin-API call without an admin session (FR-028); rejects a duplicate email (FR-009); on valid input invites + sets claims + inserts a `pending` row; surfaces `inviteFailed` (FR-027). Mock cookie/RLS + Admin client. Confirm FAIL first.
- [x] T015 [P] [US2.1] Write `tests/app/admin/members/resendMemberInvite.test.ts`: gate denial; only `pending` targets; issues a fresh link + audits `member_reinvited` (FR-026). Confirm FAIL first.
- [x] T016 [P] [US2.1] Write `tests/components/AddMembersModal.test.tsx`: chooser opens form; required fields block submit; Cancel/close discards; invite-not-sent warning keeps the modal open (FR-006/FR-008/FR-027). Confirm FAIL first.

#### Implementation for User Story 2.1

- [x] T017 [P] [US2.1] Create `lib/members/validation.ts` — `validateMemberFields(fullName, whatsapp, email, waveId)` + `isValidEmail` (pure, `{ ok } | { ok:false, error }`), copy keys via strings.
- [x] T018 [P] [US2.1] Create `lib/members/qr.ts` with `memberInfoUrl(id)` (the `renderQrSvg` export is added in Phase 4).
- [x] T019 [US2.1] Create `lib/members/create.ts` — `provisionMember(admin, supabase, { fullName, email, whatsapp, waveId })`: `inviteUserByEmail` (service-role, `redirectTo=${SITE_URL}/student/auth/confirm`, `data:{full_name, whatsapp}`) → map already-registered → `updateUserById` claims `{role:'student', tenant_id:waveId}` → insert `students` (`user_id`, `email`, `whatsapp`, `full_name`, `tenant_id:waveId`, `student_code:=email`, `status:'pending'`) → return `{ memberId, inviteFailed } | { error }` (contracts C3). (depends on T002)
- [x] T020 [US2.1] Create `app/admin/members/actions.ts` — `createMember` (`assertAdminSession` → `validateMemberFields` → reject existing email via `students` `lower(email)` lookup → `provisionMember` → `logEvent('member_created')` → `revalidatePath('/admin/members')`) and `resendMemberInvite` (`assertAdminSession` → pending-only → `resetPasswordForEmail` → `logEvent('member_reinvited')`). Add the `AuthEventReason` union entries. (depends on T017, T018, T019)
- [x] T021 [US2.1] Add the **add-form** copy group to `lib/strings.ts` (`addMembersChooserTitle`, `addMemberFormOption`, `bulkUploadOption`, `memberFullNameLabel`, `memberWhatsappLabel`, `memberWaveLabel`, `memberMgmtForbidden`, `memberMgmtEmailInUse`, `memberMgmtResendNotPending`, `memberInviteNotSent`, submit/submitting + resend labels).
- [x] T022 [US2.1] Create `components/AddMembersModal.tsx` — client island (`useActionState(createMember)`): the **Add Members** trigger button; a chooser (Add by form | Bulk upload — bulk wired in Phase 5); the single form (full name, WhatsApp, email, a **wave** `<select>` from a `waves` prop); idle/submitting/field-error/invite-not-sent/success states; Cancel/close discards (mirror `AddAdminModal`). (depends on T020, T021)
- [x] T023 [US2.1] Edit `app/admin/members/page.tsx` to read the waves (`tenants`) list and render `<AddMembersModal waves={…} />` in the header's `shrink-0` slot; add the per-row **Resend invite** control (pending-only) to `MemberTable` wired to `resendMemberInvite`. (depends on T022)

**Checkpoint**: An admin can create one member; the member is `pending` and emailed. Add the Phase-2 walkthrough section.

---

## Phase 3 — Member onboarding & student login (email + password)

**Purpose**: Close the auth loop — the student sign-in page becomes a real email+password form,
the onboarding link lands on `/student/auth/confirm` → `/student/set-password`, and student routes
are protected.

### User Story 3.1: As a member, I want to set a password via my onboarding link and sign in to the student panel with my email, so that I can access my account. (Priority: P1)

**Goal**: A member sets a password from the invite link and signs in with email+password; pending/expired states are handled; student routes are gated.

**Independent Test**: Create a member, open the invite link, set a password → status active → sign in with email+password → reach `/student/dashboard`; a pending member and an expired/used link are refused; an unauthenticated visit to `/student/dashboard` redirects to `/student`.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [x] T024 [P] [US3.1] Write `tests/lib/auth/studentGate.test.ts`: `validateStudentLoginFields` requires both fields; `assertStudentSession` accepts `role==='student'`, **rejects admin and anon** (role denial, Principle VI). Confirm FAIL first.
- [x] T025 [P] [US3.1] Write `tests/app/student/signInStudent.test.ts`: valid member → `/student/dashboard`; **admin token denied**; bad credentials denied; a pending member (no password) denied (FR-020/FR-021). Confirm FAIL first.
- [x] T026 [P] [US3.1] Write `tests/app/student/setStudentPassword.test.ts`: a valid invite/recovery session sets the password and flips `students.status='active'`; an invalid/expired/admin session is refused (FR-018/FR-019). Confirm FAIL first.

#### Implementation for User Story 3.1

- [x] T027 [P] [US3.1] Create `lib/auth/studentGate.ts` — `validateStudentLoginFields(email, password)` and `assertStudentSession(session)` (`ok` iff `role==='student'`), pure (no Supabase/Next imports).
- [x] T028 [US3.1] Create `app/student/actions.ts` — `signInStudent` (`validateStudentLoginFields` → `signInWithPassword` → `assertStudentSession` else sign out + generic fail → redirect `/student/dashboard`); `confirmStudentInvite` (mirror `confirmPasswordReset`: `verifyOtp` `invite`/`recovery` on explicit click → reject if admin → redirect `/student/set-password` else `?error=link`); `setStudentPassword` (valid student session → `validateNewPassword` (reused) → `updateUser({password})` → set own `students.status='active'` → redirect); `signOutStudent`. (depends on T027)
- [x] T029 [P] [US3.1] Create `components/StudentLoginForm.tsx` — email + password, `useActionState(signInStudent)`, ≥16px inputs, visible focus (mirror `AdminLoginForm`); shows the "your login ID is your email" note.
- [x] T030 [P] [US3.1] Create `components/StudentSetPasswordForm.tsx` — password + confirm, `useActionState(setStudentPassword)` (mirror `ResetPasswordForm`).
- [x] T031 [US3.1] Rework `app/student/page.tsx` to render `StudentLoginForm` (replace the placeholder join form that posts to `/student/dashboard`). (depends on T029)
- [x] T032 [US3.1] Create `app/student/auth/confirm/page.tsx` — interstitial reading `token_hash`/`type`, posting to `confirmStudentInvite` on an explicit "Continue" (mirror `/admin/auth/confirm`). (depends on T028)
- [x] T033 [US3.1] Create `app/student/set-password/page.tsx` — renders `StudentSetPasswordForm`; shows the invalid-link state on `?error=link`. (depends on T030, T028)
- [x] T034 [US3.1] Refactor `proxy.ts` to branch by path: admin matchers require `role==='admin'` (→ `/admin`); a new **student** matcher `"/student/dashboard/:path*"` requires an authenticated `role==='student'` (→ `/student`). Keep `getUser()` JWT validation. Update `config.matcher`.
- [x] T035 [P] [US3.1] Add the **student-auth** copy group to `lib/strings.ts` (`studentSignInTitle`, `studentEmailLabel`, `studentAuthFailed`, `studentLoginIdIsEmailNote`, `studentSetPasswordTitle`, set-password submit/submitting, `studentResetLinkInvalid`, `studentSignOutLabel`).
- [x] T036 [US3.1] Configure Supabase Auth per [quickstart.md](./quickstart.md) §3: allow `${SITE_URL}/student/auth/confirm` as a redirect URL and customize the **Invite user** email template to state the recipient's login ID is their email (FR-017). (operator/config; verify in the walkthrough)

**Checkpoint**: A member can onboard and sign in with email+password; student routes are gated. Add the Phase-3 walkthrough section (desktop + mobile).

---

## Phase 4 — QR on the student home + admin member-information page

**Purpose**: Deliver the QR payoff — the member's QR on their home, and the admin-only
member-information page it resolves to.

### User Story 4.1: As a member I want my QR on my home; and as an administrator I want scanning it to open that member's information. (Priority: P2 / P3)

**Goal**: Render a member's QR (encoding their member-info URL) on the student home; render the admin-only member-info page; deny non-admins.

**Independent Test**: A signed-in member sees their own QR SVG (placeholder if none); an admin opening the QR link sees that member's details; a member/anon opening it is redirected and sees no PII; an unknown id shows not-found.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [x] T037 [P] [US4.1] Extend `tests/lib/members/qr.test.ts`: `renderQrSvg(url)` returns an `<svg>` string for a member-info URL (FR-016/FR-022). Confirm FAIL first.
- [x] T038 [P] [US4.1] Write `tests/app/admin/members/memberInfoPage.test.tsx`: an admin sees the member's fields; a **non-admin/member is denied** (no PII) and an unknown id renders not-found (FR-023/FR-024/SC-007). **This is the NON-NEGOTIABLE role/cross-wave denial test.** Confirm FAIL first.
- [x] T039 [P] [US4.1] Write `tests/app/student/studentDashboard.test.tsx`: a member with a row shows their QR SVG encoding their own URL; with no row, a placeholder (not a broken image) is shown (FR-022/SC-008). Confirm FAIL first.

#### Implementation for User Story 4.1

- [x] T040 [US4.1] Add `renderQrSvg(url)` to `lib/members/qr.ts` using `qrcode` (`QRCode.toString(url, { type:'svg' })`). (depends on T003)
- [x] T041 [P] [US4.1] Create `components/MemberQrCode.tsx` — renders the inline QR SVG (dimension-reserved, accessible label) or a placeholder when no member URL is given.
- [x] T042 [US4.1] Edit `app/student/dashboard/page.tsx` — read the signed-in member's own `students` row (`eq('user_id', auth.uid())`) via the cookie/RLS client, render `<MemberQrCode url={memberInfoUrl(student.id)} />` (or placeholder), and add a sign-out control wired to `signOutStudent`. (depends on T040, T041)
- [x] T043 [US4.1] Create `app/admin/members/[id]/page.tsx` — RSC reading the member by id via the cookie/RLS client (admin `is_admin()` sees all), rendering full name, WhatsApp, email, wave, status; not-found state for a missing id. Admin-only via the existing `/admin/members/:path*` matcher. (depends on T035-style strings)
- [x] T044 [P] [US4.1] Add the **member-info** copy group to `lib/strings.ts` (`memberInfoTitle`, field labels, `memberNotFound`, student-home QR labels/placeholder).

**Checkpoint**: QR shows on the home and resolves to the admin-only info page; non-admins denied. Add the Phase-4 walkthrough section.

---

## Phase 5 — Bulk upload members via CSV

**Purpose**: Deliver bulk import — download template → upload → server-side validate → confirm
wave → submit, reusing `provisionMember` per row.

### User Story 5.1: As an administrator, I want to bulk-upload members from the template and assign them to a wave, so that I can onboard a cohort at once. (Priority: P2)

**Goal**: Validate an uploaded CSV server-side (whole-file reject on any blank/whitespace cell or malformed email; report duplicates), confirm a wave, and create all valid members.

**Independent Test**: A valid template → all rows become pending members in the confirmed wave, each invited; a file with a blank cell is rejected wholesale with the offending row identified and nothing created; duplicate emails are reported and skipped; a non-admin caller is denied.

#### Tests for User Story 5.1 (REQUIRED — Principle II) ⚠️

- [x] T045 [P] [US5.1] Write `tests/lib/members/csv.test.ts`: parses quoted fields/embedded commas; **rejects the whole file on any empty/whitespace-only cell**; flags malformed emails; detects in-file duplicate emails (FR-012/FR-015). Confirm FAIL first.
- [x] T046 [P] [US5.1] Write `tests/app/admin/members/bulkCreateMembers.test.ts`: gate denial before any creation; whole-file reject on a blank cell (nothing created); valid file creates each row via `provisionMember` and skips existing/in-file duplicates with per-row reasons (FR-012/FR-014/FR-015/SC-004/SC-005). Confirm FAIL first.
- [x] T047 [P] [US5.1] Extend `tests/components/AddMembersModal.test.tsx`: the bulk path uploads → shows validation errors for a blank cell → on a valid file shows the wave-confirm step → submits (FR-011/FR-012/FR-013). Confirm FAIL first.

#### Implementation for User Story 5.1

- [x] T048 [P] [US5.1] Create `lib/members/csv.ts` — `parseAndValidateMembersCsv(text)` (dependency-free): parse the fixed 3-column template incl. quoted fields; return `{ ok:false, error, badRows }` on any blank/whitespace cell or malformed email; flag in-file duplicate emails; else `{ ok:true, rows }` (contracts C4).
- [x] T049 [US5.1] Add `bulkCreateMembers` to `app/admin/members/actions.ts` — `assertAdminSession` → read file + `wave_id` → `parseAndValidateMembersCsv` **server-side** (on `ok:false` return `{ error }`, create nothing) → loop `provisionMember` per row into `wave_id`, skipping existing emails, collecting `BulkResultRow[]` → audit → `revalidatePath` → `{ results, createdCount }`. (depends on T048, T019)
- [x] T050 [US5.1] Add the **bulk** copy group to `lib/strings.ts` (`bulkChooseWave`, `bulkInvalidCsv`, `bulkRowError`, `bulkSubmitLabel`, `bulkResultSummary`, etc.).
- [x] T051 [US5.1] Extend `components/AddMembersModal.tsx` bulk path — file input + client pre-parse (`parseAndValidateMembersCsv`) for fast feedback, a labelled **wave-confirm** step, submit via `useActionState(bulkCreateMembers)`, and a per-row results summary. (depends on T049, T050)

**Checkpoint**: An admin can bulk-import a cohort with server-enforced validation. Add the Phase-5 walkthrough section.

---

## Phase 6 — Polish & Cross-Cutting Concerns

**Purpose**: Quality gates across all stories.

- [ ] T052 [P] Validate responsive/a11y at **320 / 390 / 430 / 768 / desktop** (`learning.md`): the members table scrolls horizontally **inside its wrapper only** (no page/body sideways scroll), the Add Members modal scrolls internally and traps focus, inputs ≥16px, visible focus, the header action stays `shrink-0`.
- [ ] T053 [P] Confirm no CWV regression (LCP<2.5s / CLS<0.1 / INP<200ms) on a mid-tier Android over Slow-4G — the QR is an inline SVG (dimension-reserved, no extra request) and reads are RSC/bounded.
- [ ] T054 Run [quickstart.md](./quickstart.md) end-to-end: single add → onboard → email+password sign-in → QR on home → admin scan → bulk upload (incl. the blank-cell rejection).
- [x] T055 Ensure `npm run build`, `npm run lint`, and `npm test` are all clean (TS strict, no `any`).
- [x] T056 Write/finalize `specs/006-add-members/walkthrough.md` — one section per implemented phase with desktop **and** mobile golden-path steps (Principle VII).
- [x] T057 [P] Append any new mobile/responsiveness learnings discovered during implementation to `learning.md`.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** (setup + list): start immediately. T002 depends on T001; T011 depends on T009/T010. T003–T007 are parallel.
- **Phase 2** (single add): depends on Phase 1 schema (T002) and the page/table (T011). Within: tests (T012–T016) → helpers (T017–T019) → action (T020) → strings (T021) → modal (T022) → page wiring (T023).
- **Phase 3** (onboarding + login): depends on Phase 2 (members exist to onboard) for a full loop, but the student-auth code is independently implementable after Phase 1. Within: gate (T027) → actions (T028) → forms (T029/T030) → pages (T031–T033) → proxy (T034) → strings (T035) → config (T036).
- **Phase 4** (QR + info page): depends on Phase 2 (member identity) and Phase 3 (a member can sign in to see the home). Within: `renderQrSvg` (T040) → component (T041) → dashboard (T042); info page (T043) is parallel to the QR work.
- **Phase 5** (bulk): depends on Phase 2's `provisionMember` (T019) + actions file (T020). Within: csv (T048) → action (T049) → strings (T050) → modal bulk path (T051).
- **Phase 6**: after the desired phases are complete.

### Story Independence

- **US1.1** stands alone (list + template).
- **US2.1** needs the Phase-1 schema + page; otherwise independent.
- **US3.1** (student auth) can be built right after Phase 1; a full demo needs a member from US2.1.
- **US4.1** needs US2.1 (identity) + US3.1 (login to view the home).
- **US5.1** needs US2.1's creation helper; otherwise independent.

### Within Each User Story

- Tests are written FIRST and confirmed FAILING before implementation (Principle II).
- Pure helpers (`lib/members/*`, `lib/auth/studentGate`) before the Server Actions that use them; actions before the components that call them; components before the page wiring.

---

## Parallel Opportunities

- **Phase 1 setup**: T003, T004, T005, T006 run in parallel (distinct files); T001→T002 and T007 alongside.
- **Phase 2 tests**: T012–T016 in parallel; then helpers T017 & T018 in parallel.
- **Phase 3**: T024–T026 (tests) parallel; T029 & T030 (forms) parallel after the gate/actions.
- **Phase 4**: T037–T039 (tests) parallel; T041 parallel with T043.
- **Phase 5**: T045–T047 (tests) parallel.

### Parallel Example: Phase 2 tests

```bash
Task: "validation.test.ts — field validators"        # T012
Task: "qr.test.ts — memberInfoUrl shape"              # T013
Task: "createMember.test.ts — gate/dup/invite/insert" # T014
Task: "resendMemberInvite.test.ts — pending-only"     # T015
Task: "AddMembersModal.test.tsx — chooser/required"   # T016
```

---

## Implementation Strategy

### MVP First (Phases 1–3)

1. Phase 1 — Members list + schema foundation. **STOP & VALIDATE** (list renders, template downloads, route gated).
2. Phase 2 — Single add (member created, invited). **STOP & VALIDATE**.
3. Phase 3 — Onboarding + email/password login. **STOP & VALIDATE** → this is the demo-able MVP: an admin adds a member who then logs in.

### Incremental Delivery

4. Phase 4 — QR on the home + admin member-info page. Demo the scan flow.
5. Phase 5 — Bulk upload. Demo a cohort import.
6. Phase 6 — Quality gates + walkthrough, per phase.

---

## Notes

- **Service-role key** is used only server-side, only inside `provisionMember` (called by
  `createMember`/`bulkCreateMembers`), and only **after** `assertAdminSession` — never in
  client/request-rendered output.
- **Wave == `tenants` row** (confirmed). Member JWT carries `app_metadata.tenant_id` so the
  existing `students` RLS enforces wave isolation; **no new policy**.
- **No member removal/editing** in this feature (out of scope).
- Commit after each task or logical group; verify tests fail before implementing.
