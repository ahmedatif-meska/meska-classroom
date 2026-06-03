---
description: "Task list for Admin Management"
---

# Tasks: Admin Management

**Input**: Design documents from `specs/004-admin-management/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/admin-management-contracts.md](./contracts/admin-management-contracts.md)

**Tests**: REQUIRED (Principle II, NON-NEGOTIABLE). The field validators, the
create/resend/remove Server Actions (admin-gate, duplicate-email, dispatch-failure, self &
last-active-admin guards), the invite-accept path, and the list/modal rendering are pure or
Supabase-mockable, so each ships deterministic unit/component tests, written first and confirmed
failing before implementation.

**Organization** (Principle VII): `## Phase N — <name>` mirrors [plan.md](./plan.md);
`### User Story N.x` matches the plan's story numbering (US1.1, US2.1, US2.2, US3.1, US4.1).
Phase-level acceptance criteria and test scenarios live in plan.md.

**Builds on `002-admin-auth` + `003-admin-forgot-password`** (already implemented): reuses
`lib/supabase/*` (including the service-role `admin.ts`), `lib/auth/adminGate.ts`
(`assertAdminSession`), `app/admin/actions.ts`, the `log_admin_auth_event` and `is_admin_email`
RPCs, the `/admin/auth/confirm` + `/admin/reset-password` magic-link flow, `proxy.ts`
(unchanged matcher), and `lib/strings.ts` / brand tokens. **No new dependency or env var.**

> This revision incorporates the `/speckit-analyze` findings now in the plan: re-send invite +
> invite-dispatch-failure feedback (US2.2, FR-020/FR-021), the **last-active-admin** guard
> (FR-016), and an explicit list `loading.tsx` (FR-019).

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[Story]**: maps to the plan's user stories (US1.1, US2.1, US2.2, US3.1, US4.1)

---

## Phase 1 — Admin Management page: navigation & list

**Purpose**: Deliver the surface and the read — the **Admin Management** sidebar entry and the
page listing all administrators (name, email, role, status, created), marking the current
admin's own row, with an explicit `loading.tsx`, empty, and error states and a mobile
card-transform. Independently testable without add/remove: assert the list renders existing
admins and excludes non-administrators.

### Shared setup (prerequisite for the phase — no story label)

- [X] T001 [P] Write migration `supabase/migrations/0004_admin_management.sql` per [data-model.md](./data-model.md): `alter table public.admin_profiles add column if not exists first_name text`, `... last_name text`, `... status text not null default 'pending'`; add `constraint admin_profiles_status_check check (status in ('pending','active'))`; `update public.admin_profiles set status='active' where status <> 'active'`; drop & recreate the `admin_auth_events` `reason` CHECK to also admit `'admin_created','admin_removed','admin_reinvited'` (keeping the existing six reasons)
- [X] T002 [P] Add the Admin Management copy from [contracts/admin-management-contracts.md](./contracts/admin-management-contracts.md) C5 to `lib/strings.ts` (`adminMgmtNavLabel`, `adminMgmtTitle`, `adminMgmtSubtitle`, `adminMgmtAddLabel`, `adminMgmtColName`/`…Email`/`…Role`/`…Status`/`…Created`/`…Actions`, `adminMgmtRoleAdmin`, `adminMgmtStatusPending`/`…Active`, `adminMgmtYouBadge`, `adminMgmtEmptyNote`, `createAdminTitle`, `createAdminSubtitle`, `firstNameLabel`, `lastNameLabel`, `adminMgmtRoleHelp`, `createAdminSubmitLabel`, `createAdminSubmittingLabel`, `cancelLabel`, `adminMgmtNameRequired`, `adminMgmtEmailInvalid`, `adminMgmtEmailInUse`, `adminMgmtForbidden`, `removeAdminTitle`, `removeAdminConfirm`, `removeAdminSubmitLabel`, `removeAdminSubmittingLabel`, `adminMgmtNoSelfRemove`, `adminMgmtLastAdmin`, `inviteSentNote`, `adminMgmtInviteNotSent`, `resendInviteLabel`, `resendInviteSendingLabel`, `resendInviteSentNote`, `adminMgmtResendNotPending`, `adminMgmtInviteFailed`)
- [ ] T003 Apply migration `0004` and configure the Supabase **Invite user** email template (dashboard or Supabase MCP, per [quickstart.md](./quickstart.md) §1–§2): point the invite action link at `{{ .SiteURL }}/admin/auth/confirm` (carrying `token_hash` + `type=invite`); confirm `${NEXT_PUBLIC_SITE_URL}/admin/auth/confirm` is still allow-listed (reused from 003) (depends on T001)
- [X] T004 [P] Update `scripts/seed-admin.ts` so the `admin_profiles` upsert sets `status: 'active'` (and, optionally, splits `display_name` into `first_name`/`last_name`); keep it idempotent and password-preserving

### User Story 1.1: Admin Management page lists every administrator (Priority: P1) 🎯 MVP

**Goal**: An admin opens **Admin Management** from the sidebar and sees every administrator
listed with name, email, role, status, and created date, with their own row marked.

**Independent Test**: Sign in, click **Admin Management**, and confirm each seeded admin renders
as a row (own row marked) and no student appears.

#### Tests for User Story 1.1 (REQUIRED — Principle II) ⚠️

> Write first; confirm they FAIL before implementation.

- [X] T005 [P] [US1.1] Unit test `tests/lib/auth/adminManagement.test.ts` for `adminDisplayName`: returns "First Last" when names present; falls back to `display_name`, then to the email local-part; never returns an empty string
- [X] T006 [P] [US1.1] Component/RSC test `tests/app/admin/adminsPage.test.tsx` (mock `lib/supabase/server` + `next/link`): renders a row per `admin_profiles` record with name/email/role/status/created; the row whose `id` equals the session user id carries the `adminMgmtYouBadge` marker; an empty result renders `adminMgmtEmptyNote`; a result containing only admins never renders a non-admin row (SC-007)

#### Implementation for User Story 1.1

- [X] T007 [P] [US1.1] Create `lib/auth/adminManagement.ts` exporting the pure `adminDisplayName(row)` helper per contract C2 (no Supabase/Next imports); `validateNewAdminFields` is added in Phase 2 (T015)
- [X] T008 [US1.1] Generalize `components/DashboardShell.tsx` to accept optional `navItems: { label; href; icon? }[]` + `activeHref` (default = the current single Dashboard item so the student dashboard is unchanged); render each item as a focusable link, marking `href === activeHref` with the existing active styling + `aria-current="page"`
- [X] T009 [P] [US1.1] Create `components/AdminTable.tsx` (Server Component) per contract C3: columns Name (`adminDisplayName`, current row → `adminMgmtYouBadge`), Email, Role chip, Status chip (pending/active), Created (`created_at`), Actions (remove slot + resend slot — wired in Phases 2/3); at `< sm` render each row as a stacked card (R8 mobile strategy), no horizontal scroll at 320px
- [X] T010 [P] [US1.1] ~~Create `app/admin/admins/loading.tsx`~~ **Removed per user feedback**: because each page renders its own `DashboardShell`, a route-level `loading.tsx` replaced the whole sidebar with a bare "Loading…" on every tab switch — slow-looking and contradicting the static-sidebar requirement. The fast RSC read needs no skeleton; navigation now keeps the current UI until the new content is ready (matching `/admin/dashboard`). Empty + error states (FR-019) remain.
- [X] T011 [US1.1] Create `app/admin/admins/page.tsx` (RSC): read `admin_profiles` via `createClient()` (cookie-bound, RLS) ordered by `created_at desc`; resolve the current user id via `getUser()`; render `DashboardShell` with `navItems=[Dashboard → /admin/dashboard, adminMgmtNavLabel → /admin/admins]` and `activeHref='/admin/admins'`, a header (`adminMgmtTitle`/`adminMgmtSubtitle` + Add Admin trigger placeholder), and `<AdminTable>` (depends on T008, T009)
- [X] T012 [US1.1] In `app/admin/dashboard/page.tsx`, pass the same `navItems` + `activeHref='/admin/dashboard'` to `DashboardShell` so the Dashboard ↔ Admin Management nav is consistent (depends on T008)

**Checkpoint**: The list is independently functional and testable. Capture Phase 1 in
`specs/004-admin-management/walkthrough.md` before sign-off (Principle VII).

---

## Phase 2 — Add & re-invite administrators: invite, onboarding & delivery feedback

**Purpose**: Deliver provisioning — the **Add Admin** modal, the gated `createAdmin` Server
Action (validate → reject duplicate → Admin-API invite with role claim → pending profile →
audit → **report invite-dispatch failure**), the **Resend invite** control for pending admins,
and the invited admin's magic-link onboarding (reusing the 003 confirm + set-password flow
generalized for `type=invite`, flipping status to `active`). Independently testable with a
mocked Admin API / `verifyOtp`.

### User Story 2.1: Add a new administrator through a modal (Priority: P1)

**Goal**: An admin opens the **Create New Admin** modal, submits first/last name + a fresh
email, and a pending admin is created and invited; duplicate/invalid input is rejected; an
undeliverable invite is reported; Cancel creates nothing.

**Independent Test**: Open the modal, submit a valid unused email → the new admin appears as
**Pending** and `inviteUserByEmail` is called; submit an existing admin email → rejected with
no invite; simulate a send error → admin still created with an invite-not-sent message.

#### Tests for User Story 2.1 (REQUIRED — Principle II) ⚠️

- [X] T013 [P] [US2.1] Unit test in `tests/lib/auth/adminManagement.test.ts` for `validateNewAdminFields`: empty/whitespace first or last name → fail with `adminMgmtNameRequired`; malformed/empty email → fail with `adminMgmtEmailInvalid`; valid names + email → `{ok:true}` with the email trimmed+lowercased (FR-007, FR-018)
- [X] T014 [P] [US2.1] Server Action test `tests/app/admin/createAdmin.test.ts` (mock `lib/supabase/server` + `lib/supabase/admin`): no admin session → returns `adminMgmtForbidden` before any Admin-API call (FR-017); `is_admin_email`→true → returns `adminMgmtEmailInUse`, no `inviteUserByEmail`/insert (FR-008); valid + unique → `inviteUserByEmail` with the `/admin/auth/confirm` redirect, role claim set to `admin`, an `admin_profiles` insert with `status='pending'`, and an `admin_created` audit row (FR-009); when the invite send returns an error → still inserts the `pending` profile and returns `{ created:true, inviteFailed:true }` (FR-021)

#### Implementation for User Story 2.1

- [X] T015 [P] [US2.1] Add the pure `validateNewAdminFields(firstName, lastName, email)` to `lib/auth/adminManagement.ts` per contract C2 (required trimmed names; valid trimmed+lowercased email), using `adminMgmtNameRequired`/`adminMgmtEmailInvalid` (depends on T007)
- [X] T016 [US2.1] Add the `createAdmin(prevState, formData)` Server Action to `app/admin/actions.ts` per contract C1: `assertAdminSession` (else `adminMgmtForbidden`) → `validateNewAdminFields` → `is_admin_email` duplicate check (else `adminMgmtEmailInUse`) → `createAdminClient().auth.admin.inviteUserByEmail(email, { redirectTo: \`${process.env.NEXT_PUBLIC_SITE_URL}/admin/auth/confirm\`, data: { first_name, last_name } })` (map "user already exists" → `adminMgmtEmailInUse`) → `auth.admin.updateUserById(id, { app_metadata: { role: 'admin' } })` → insert `admin_profiles` `{ id, email, first_name, last_name, display_name, role:'admin', status:'pending' }` → `log_admin_auth_event(email,'success','admin_created')` → `revalidatePath('/admin/admins')` → return `{ created:true, inviteFailed: <send errored> }` (FR-021); widen the `logEvent` reason union with `'admin_created' | 'admin_removed' | 'admin_reinvited'`; define `CreateAdminState` (depends on T015, T001)
- [X] T017 [P] [US2.1] Create `components/AddAdminModal.tsx` (`'use client'`, `useActionState` over `createAdmin`): `role="dialog"` titled `createAdminTitle`/`createAdminSubtitle`; First Name, Last Name, Email (type=email, ≥16px), Role select (only "Admin", `adminMgmtRoleHelp`); submit `createAdminSubmitLabel`/`createAdminSubmittingLabel`; Cancel + close (×) dismiss without creating; error/duplicate in a `role="alert"` region; on `created` closes + revalidates, and when `inviteFailed` shows `adminMgmtInviteNotSent` (success-with-warning) instead of silent success (FR-021); focus-trapped, `Esc` closes, scrolls internally — reusing 002/003 token styling
- [X] T018 [US2.1] Wire the **Add Admin** trigger in `app/admin/admins/page.tsx` to open `<AddAdminModal>` (client island mounted in the page header) (depends on T011, T017)

### User Story 2.2: Re-send invite to a pending admin & surface delivery failures (Priority: P1)

**Goal**: An admin can re-send a fresh invite link to a pending admin, and the resend control
appears only for pending admins; delivery failures from create (US2.1) point here.

**Independent Test**: On a **Pending** admin's row, trigger **Resend invite** → `inviteUserByEmail`
is called again and an `admin_reinvited` audit row is written; the control is absent on
**Active** rows.

#### Tests for User Story 2.2 (REQUIRED — Principle II) ⚠️

- [X] T019 [P] [US2.2] Server Action test `tests/app/admin/resendInvite.test.ts` (mock `lib/supabase/server` + `lib/supabase/admin`): no admin session → `adminMgmtForbidden` before any Admin-API call (FR-017); a non-pending (active) target → `adminMgmtResendNotPending`, no `inviteUserByEmail`; a pending target → fresh `inviteUserByEmail(email,{redirectTo})` + `admin_reinvited` audit + `{sent:true}` (FR-020); a send error → `{error: adminMgmtInviteFailed}`

#### Implementation for User Story 2.2

- [X] T020 [US2.2] Add the `resendInvite(prevState, formData)` Server Action to `app/admin/actions.ts` per contract C1: `assertAdminSession` (else `adminMgmtForbidden`) → load the target `admin_profiles` row (cookie client) and reject if missing or not `status='pending'` (`adminMgmtResendNotPending`) → `createAdminClient().auth.admin.inviteUserByEmail(targetEmail, { redirectTo })` → `log_admin_auth_event(targetEmail,'success','admin_reinvited')` → `revalidatePath(...)` → `{ sent:true }` (or `{ error: adminMgmtInviteFailed }` on send error); define `ResendInviteState` (depends on T016 for the reason-union widening)
- [X] T021 [P] [US2.2] Create `components/ResendInviteButton.tsx` (`'use client'`, `useActionState` over `resendInvite`): hidden `target_id`/`target_email`; `resendInviteLabel`/`resendInviteSendingLabel`; `resendInviteSentNote` / error in a `role="alert"` region — reusing token styling
- [X] T022 [US2.2] In `components/AdminTable.tsx`, render `<ResendInviteButton>` in the Actions cell **only** for rows whose `status === 'pending'` (R12) (depends on T009, T021)

### User Story 3.1: Invited admin sets their own password via the magic link (Priority: P1)

**Goal**: The invited admin follows the emailed link, sets a password, becomes **Active**, and
can sign in; an expired/used link cannot set a password.

**Independent Test**: With a valid invite `token_hash` (`type=invite`), confirm → set-password
→ `admin_profiles.status` becomes `active` and sign-in works; a consumed link shows the
invalid-link state.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [X] T023 [P] [US3.1] Server Action test `tests/app/admin/confirmInvite.test.ts` (mock `lib/supabase/server`): a valid `token_hash` with `type='invite'` whose session passes `assertAdminSession` → `verifyOtp({type:'invite',token_hash})` then redirect to `/admin/reset-password`; a failed `verifyOtp` or non-admin session → `reset_invalid` + redirect to `?error=link`; and `updateAdminPassword` sets `admin_profiles.status='active'` for the current user on a successful `updateUser` (SC-004)

#### Implementation for User Story 3.1

- [X] T024 [US3.1] Generalize `app/admin/auth/confirm/page.tsx` to treat `type === 'invite'` (in addition to `'recovery'`) as a present link, and generalize the confirm Server Action in `app/admin/actions.ts` to call `verifyOtp({ type, token_hash })` with the link's type (guard to the two allowed types); failure path unchanged (`?error=link` + `reset_invalid`) (depends on T016 for the reason-union widening)
- [X] T025 [US3.1] Extend `updateAdminPassword` in `app/admin/actions.ts` so that, after a successful `updateUser({ password })`, it runs `update admin_profiles set status='active' where id = userId` (idempotent for an already-active admin) before the global sign-out + redirect (depends on T024)

**Checkpoint**: Add-admin → invite (or resend) → set-password → active works end to end. Update
`specs/004-admin-management/walkthrough.md` for Phase 2 before sign-off (Principle VII).

---

## Phase 3 — Remove administrator

**Purpose**: Deliver lifecycle removal — a per-row **Remove** control with explicit
confirmation and the gated `removeAdmin` Server Action that deletes the auth user (cascading
the profile), blocking self-removal and any removal that would leave **zero active**
administrators. Independently testable with a mocked Admin API.

### User Story 4.1: Remove another admin with a confirmation step (Priority: P2)

**Goal**: An admin removes another admin after confirming; the removed admin disappears and
cannot sign in; self-removal and last-active-admin removal are blocked.

**Independent Test**: With ≥2 active admins, confirm-remove one → row leaves + sign-in denied;
attempt self-removal and last-active-admin removal → both blocked.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [X] T026 [P] [US4.1] Server Action test `tests/app/admin/removeAdmin.test.ts` (mock `lib/supabase/server` + `lib/supabase/admin`): no admin session → `adminMgmtForbidden` before any Admin-API call (FR-017); `target_id` equals caller id → `adminMgmtNoSelfRemove`, no `deleteUser` (FR-015); target is `active` and the active-admin count ≤ 1 → `adminMgmtLastAdmin`, no `deleteUser` (FR-016); removing a `pending` admin while ≥1 active remains → allowed; otherwise `auth.admin.deleteUser(target_id)` is called and an `admin_removed` audit row is written (FR-014)

#### Implementation for User Story 4.1

- [X] T027 [US4.1] Add the `removeAdmin(prevState, formData)` Server Action to `app/admin/actions.ts` per contract C1: `assertAdminSession` (else `adminMgmtForbidden`) → resolve caller id via `getUser()` → read `target_id`/`target_email` → self-guard (`target_id===callerId` → `adminMgmtNoSelfRemove`) → **last-active-admin guard**: count `admin_profiles where status='active'`, and if the target is `active` and that count ≤ 1 → `adminMgmtLastAdmin` → `createAdminClient().auth.admin.deleteUser(target_id)` → `log_admin_auth_event(target_email,'success','admin_removed')` → `revalidatePath('/admin/admins')` → `{ removed: true }`; define `RemoveAdminState` (depends on T016 for the reason union)
- [X] T028 [P] [US4.1] Create `components/RemoveAdminDialog.tsx` (`'use client'`, `useActionState` over `removeAdmin`): an in-page accessible confirm dialog (NOT native `confirm()`) showing the target name/email + `removeAdminConfirm`, a destructive `removeAdminSubmitLabel`/`removeAdminSubmittingLabel` button and Cancel; passes `target_id`/`target_email` hidden inputs; error in a `role="alert"` region; Cancel removes nothing
- [X] T029 [US4.1] Wire the per-row **Remove** control in `components/AdminTable.tsx` to `<RemoveAdminDialog>` for every non-self row (hide/disable on the current user's own row — the server self-guard is authoritative) (depends on T009, T028)

**Checkpoint**: Full list → add/resend → remove lifecycle works. Update
`specs/004-admin-management/walkthrough.md` for Phase 3 before sign-off (Principle VII).

---

## Phase 4 — Polish & Cross-Cutting Concerns

- [ ] T030 [P] Validate Quality Gates (Principle IV): `/admin/admins` list + Add-Admin modal + Resend + Remove dialog at **320 / 390 / 430 / 768px and desktop** — table → card-transform with no horizontal scroll/clip/overlap; inputs ≥16px on mobile; visible focus on every control; modal focus-trapped and internally scrollable; status chips meet WCAG AA contrast; error/success announced (`role="alert"`)
- [X] T031 [P] Run `npm run build` (clean) and `npm run lint` (clean), then `npm test` (all suites green)
- [ ] T032 Run the [quickstart.md](./quickstart.md) §4–§5 verification end to end against a configured Supabase project (golden path: list → add → invite → set password → active → remove; plus duplicate email, invalid input, resend, invite-not-sent, self-removal, last-active-admin, expired link, route protection)
- [X] T033 Write/finalize `specs/004-admin-management/walkthrough.md` covering all three phases per Principle VII (how to run, route/component paths, numbered desktop + mobile verification, known gaps — e.g. multiple roles / admin editing are out of scope)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** (list & nav) is a shippable MVP increment; it needs the shared setup (migration
  `0004`, strings, seed update).
- **Phase 2** (add/resend/onboarding) depends on Phase 1 (the list to add into +
  `DashboardShell`/page/`AdminTable`) and the migration's `status` column; T016 widens the
  `actions.ts` reason union that Phases 2/3 reuse.
- **Phase 3** (remove admin) depends on Phase 1 (`AdminTable`) and Phase 2 (the `actions.ts`
  reason-union widening in T016).
- **Phase 4 (Polish)** depends on Phases 1–3.

### Within Phase 1

- Shared setup: T001, T002, T004 are parallel `[P]`; **T003 depends on T001**.
- US1.1: tests T005, T006 `[P]` first → T007 `[P]` → **T008** (DashboardShell) →
  T009 `[P]` (AdminTable) + T010 `[P]` (loading) → **T011 depends on T008 + T009** →
  **T012 depends on T008**.

### Within Phase 2

- US2.1: tests T013, T014 `[P]` first → **T015 depends on T007** →
  **T016 depends on T015 + T001** → T017 `[P]` → **T018 depends on T011 + T017**.
- US2.2: test T019 `[P]` first → **T020 depends on T016** → T021 `[P]` →
  **T022 depends on T009 + T021**.
- US3.1: test T023 `[P]` first → **T024 depends on T016** → **T025 depends on T024**.

### Within Phase 3

- US4.1: test T026 `[P]` first → **T027 depends on T016** → T028 `[P]` →
  **T029 depends on T009 + T028**.

> Same-file sequencing: `app/admin/actions.ts` (T016 → T020 → T024 → T025 → T027),
> `lib/auth/adminManagement.ts` (T007 → T015), `components/AdminTable.tsx`
> (T009 → T022 → T029), `components/DashboardShell.tsx` (T008), and
> `app/admin/admins/page.tsx` (T011 → T018) are edited by multiple tasks — run those
> in the listed order, not in parallel.

### Parallel opportunities

- Phase 1 shared setup: T001 + T002 + T004 together.
- US1.1 tests: T005 + T006 together; then T007 + T009 + T010 are independent files.
- Phase 2 tests: T013 + T014 (+ T019, T023) together; T017 + T021 parallel with the
  validator/action work on different files.
- Phase 3: T026 first; T028 parallel with the `removeAdmin` action (T027).

---

## Implementation Strategy

### MVP first (Phase 1 only)

1. Complete the shared setup (T001–T004).
2. Complete US1.1 (T005–T012).
3. **STOP and VALIDATE**: admins can open Admin Management and see the full, admin-only list
   with their own row marked. This is a shippable, demoable increment.

### Incremental delivery

1. Phase 1 → list & navigation (MVP).
2. Phase 2 → add admin + resend + magic-link onboarding → admins can provision colleagues and
   recover failed/expired invites.
3. Phase 3 → remove admin (with self/last-active-admin guards) → full lifecycle.
4. Phase 4 → responsive/a11y gates, quickstart validation, walkthrough.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- All Admin Management logic ships deterministic tests written first (Principle II). No new
  student/wave-scoped read is introduced, so no new cross-wave denial test is required —
  admin-only enforcement is covered by the `assertAdminSession` gate tests (T014, T019, T026)
  and the existing `admin_profiles` RLS; the list's admin-only result is asserted in T006
  (SC-007).
- The service-role key is used **only** inside `createAdmin`/`resendInvite`/`removeAdmin`, after
  `assertAdminSession`; tests assert it is never reached before the gate and never appears in
  client/request-rendered output.
- The last-active-admin guard counts `status='active'` rows (not raw rows), so the platform
  always keeps at least one administrator able to sign in (FR-016).
- The new admin sets their own password via the magic link (confirmed spec decision) — the
  modal collects no password.
- Commit after each task or logical group; `proxy.ts` (matcher unchanged) and all 002/003
  behavior remain intact.
