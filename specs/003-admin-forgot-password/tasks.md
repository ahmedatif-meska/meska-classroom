---
description: "Task list for Admin Forgot Password & Reset"
---

# Tasks: Admin Forgot Password & Reset

**Input**: Design documents from `specs/003-admin-forgot-password/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/reset-contracts.md](./contracts/reset-contracts.md)

**Tests**: REQUIRED (Principle II, NON-NEGOTIABLE). All recovery logic — the pure validators,
the neutral/admin-only request path, the new-password update path, and the confirm Route
Handler — is pure or Supabase-mockable, so each ships deterministic unit/component tests,
written first and confirmed failing before implementation.

**Organization** (Principle VII): `## Phase N — <name>` mirrors [plan.md](./plan.md);
`### User Story N.x` matches the plan's story numbering (US1.1, US3.1, US2.1, US4.1).
Phase-level acceptance criteria and test scenarios live in plan.md.

**Builds on `002-admin-auth`** (already implemented): reuses `lib/supabase/*`,
`lib/auth/adminGate.ts` (`assertAdminSession`), `app/admin/actions.ts`, the
`log_admin_auth_event` RPC, `proxy.ts` (unchanged), and the existing `lib/strings.ts` / brand
tokens. No new dependency is added.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[Story]**: maps to the plan's user stories (US1.1, US3.1, US2.1, US4.1)

---

## Phase 1 — Request a reset link (forgot-password)

**Purpose**: Deliver the admin-only, non-enumerating request flow — the entry point of
recovery. Independently testable without the change-password page: assert that every request
returns the identical neutral confirmation and that only an administrator's email triggers a
send.

### Shared setup (prerequisite for both stories in this phase — no story label)

- [X] T001 Add `NEXT_PUBLIC_SITE_URL` (name only, with a localhost example) to `.env.example` and confirm `.env.local` stays git-ignored
- [X] T002 [P] Add all recovery copy from [contracts/reset-contracts.md](./contracts/reset-contracts.md) C7 to `lib/strings.ts` (`forgotTitle`, `forgotSubtitle`, `forgotEmailRequired`, `forgotSubmitLabel`, `forgotSendingLabel`, `resetLinkSent`, `backToSignInLabel`, `resetTitle`, `newPasswordLabel`, `confirmPasswordLabel`, `resetPasswordTooShort`, `resetPasswordMismatch`, `resetSubmitLabel`, `resetUpdatingLabel`, `resetUpdateFailed`, `resetSuccess`, `resetLinkInvalid`, `requestNewLinkLabel`)
- [X] T003 [P] Write migration `supabase/migrations/0003_password_reset.sql` per [data-model.md](./data-model.md): create `public.is_admin_email(p_email text) returns boolean` (`SECURITY DEFINER`, `set search_path = public`, true iff an `admin_profiles` row has `lower(email)=lower(p_email)` and `role='admin'`; `revoke all` from `public`, `grant execute` to `anon, authenticated`); drop & recreate the `admin_auth_events` `reason` CHECK to add `'reset_requested','reset_done','reset_invalid'`
- [ ] T004 Apply migration `0003` and configure Supabase Auth (dashboard or Supabase MCP, per [quickstart.md](./quickstart.md) §2–§3): allow-list `${NEXT_PUBLIC_SITE_URL}/admin/auth/confirm` + `http://localhost:3000/admin/auth/confirm`; point the **Reset Password** email template at `/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery`; set min password length to 8; confirm recovery rate limits (depends on T003)

### User Story 1.1: Request a reset link from the sign-in page (Priority: P1) 🎯 MVP

**Goal**: An admin can open `/admin/forgot-password` from the sign-in page, submit their
email, and receive the neutral confirmation.

**Independent Test**: Click "Forgot password?" on `/admin`, submit the seeded admin email, and
confirm a reset email is sent and the neutral confirmation is shown.

#### Tests for User Story 1.1 (REQUIRED — Principle II) ⚠️

> Write first; confirm they FAIL before implementation.

- [X] T005 [P] [US1.1] Unit test `tests/lib/auth/passwordReset.test.ts` for `validateEmailField`: empty/whitespace/non-string → `{ok:false}` with `forgotEmailRequired`; a non-empty trimmed email → `{ok:true}` (FR-002)
- [X] T006 [P] [US1.1] Component test `tests/components/ForgotPasswordForm.test.tsx` (mock `next/link` + the action): email input is `required`, renders the pending/sending label, and renders the `resetLinkSent` confirmation from action state

#### Implementation for User Story 1.1

- [X] T007 [P] [US1.1] Create `lib/auth/passwordReset.ts` exporting the pure `validateEmailField(email)` returning `{ok:true} | {ok:false; error}` (mirrors `validateLoginFields` shape), using `strings.forgotEmailRequired`
- [X] T008 [US1.1] Add the `requestPasswordReset(prevState, formData)` Server Action to `app/admin/actions.ts` (`'use server'`) per contract C1 happy path: `validateEmailField` → trim+lowercase → call `resetPasswordForEmail(email, { redirectTo: \`${process.env.NEXT_PUBLIC_SITE_URL}/admin/auth/confirm\` })`; return `{ sent: true }` (gate + audit added in T012/T013); define a `RequestResetState` type
- [X] T009 [P] [US1.1] Create `components/ForgotPasswordForm.tsx` (`'use client'`, `useActionState` over `requestPasswordReset`): required email input, submit button with `forgotSubmitLabel`/`forgotSendingLabel`, `resetLinkSent` rendered in a `role="alert"` region, and a `backToSignInLabel` link to `/admin` — reusing the 002 input/button token styling
- [X] T010 [US1.1] Create `app/admin/forgot-password/page.tsx` (Server Component) reusing the admin card layout from `app/admin/page.tsx`, with `forgotTitle`/`forgotSubtitle` and `<ForgotPasswordForm />`
- [X] T011 [US1.1] In `components/AdminLoginForm.tsx`, replace the dead `<button type="button">{strings.forgotPasswordLabel}</button>` with a `next/link` `<Link href="/admin/forgot-password">` (preserve the existing classes/focus styles)

### User Story 3.1: Admin-only & non-enumerating request (Priority: P2)

**Goal**: Recovery issues a link only for an administrator's email and returns the identical
neutral confirmation for admin, non-admin, and unknown emails; the request is audited.

**Independent Test**: Submit a student email, an unknown email, and the admin email; confirm
all three return the byte-identical confirmation and only the admin case calls
`resetPasswordForEmail`.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [X] T012 [P] [US3.1] Server Action test `tests/app/admin/requestPasswordReset.test.ts` (mock `lib/supabase/server`): when `is_admin_email` RPC returns true → `resetPasswordForEmail` is called; when false → it is **not** called; the returned state is identical in both cases (SC-002); empty email is rejected before any RPC/auth call (FR-002); a `reset_requested` event is logged via `log_admin_auth_event` in every accepted case (FR-015)

#### Implementation for User Story 3.1

- [X] T013 [US3.1] Extend `requestPasswordReset` in `app/admin/actions.ts` to gate on `supabase.rpc('is_admin_email', { p_email: email })`: call `resetPasswordForEmail` only when true; always return the same neutral `{ sent: true }` state (FR-003, FR-004) (depends on T008, T003)
- [X] T014 [US3.1] Widen the `logEvent` reason union in `app/admin/actions.ts` to include `'reset_requested' | 'reset_done' | 'reset_invalid'` and record `reset_requested` (outcome `success` for admin, `denied` otherwise) in `requestPasswordReset`; the reason is never returned to the client (FR-015) (depends on T013)

**Checkpoint**: The request flow is independently functional and testable. Capture Phase 1 in
`specs/003-admin-forgot-password/walkthrough.md` before sign-off (Principle VII).

---

## Phase 2 — Set the new password (reset-password)

**Purpose**: Verify the link, render the change-password page, apply the new password, revoke
other sessions, and fail safely on bad links. Independently testable with a mocked
`verifyOtp`/`updateUser`.

### User Story 2.1: Set a new password from the reset link (Priority: P1)

**Goal**: From a valid admin reset link, an admin lands on the change-password page, submits a
valid matching password, and is returned to sign-in able to authenticate with it (old password
rejected, other sessions revoked).

**Independent Test**: With a valid recovery session, submit a matching ≥8-char password and
confirm `updateUser` then `signOut({scope:'global'})` then redirect to `/admin`; sign in with
the new password.

#### Tests for User Story 2.1 (REQUIRED — Principle II) ⚠️

- [X] T015 [P] [US2.1] Unit test in `tests/lib/auth/passwordReset.test.ts` for `validateNewPassword(password, confirm)`: missing → fail; `<8` chars → `resetPasswordTooShort`; mismatch → `resetPasswordMismatch`; valid matching ≥8 → `{ok:true}` (FR-007, SC-006)
- [X] T016 [P] [US2.1] Server Action test `tests/app/admin/updateAdminPassword.test.ts` (mock `lib/supabase/server`): invalid/mismatched/short input is rejected before `updateUser` (SC-006); on valid input `updateUser({password})` is called, then `signOut({scope:'global'})`, then a redirect to `/admin`; a `reset_done` event is logged (FR-008, FR-012, FR-013, SC-005, SC-007, FR-015)
- [X] T017 [P] [US2.1] Component test `tests/components/ResetPasswordForm.test.tsx`: both password fields are `required`, the pending/updating label renders, and a validation error from action state renders in a `role="alert"` region

#### Implementation for User Story 2.1

- [X] T018 [P] [US2.1] Add the pure `validateNewPassword(password, confirm)` to `lib/auth/passwordReset.ts` (both present → length ≥ 8 → equal), using `resetPasswordTooShort`/`resetPasswordMismatch` (depends on T007)
- [X] T019 [US2.1] Add the `updateAdminPassword(prevState, formData)` Server Action to `app/admin/actions.ts` per contract C2: require a valid admin recovery session (`getUser` + `assertAdminSession`, else reject to invalid-link); `validateNewPassword`; `updateUser({ password })`; on success `signOut({ scope: 'global' })` + `redirect('/admin')`; on `updateUser` error return `resetUpdateFailed`; log `reset_done`/`reset_invalid` (depends on T018, T014)
- [X] T020 [P] [US2.1] Create `components/ResetPasswordForm.tsx` (`'use client'`, `useActionState` over `updateAdminPassword`): required `password` + `confirm` inputs, submit button with `resetSubmitLabel`/`resetUpdatingLabel`, errors in a `role="alert"` region — reusing 002 token styling
- [X] T021 [US2.1] Create `app/admin/reset-password/page.tsx` (Server Component) reusing the admin card: render `<ResetPasswordForm />` with `resetTitle` when a valid admin recovery session exists; otherwise render the invalid-link state (see T024) (depends on T020)

### User Story 4.1: Single-use, expiring, fail-safe links (Priority: P2)

**Goal**: Only a valid, unexpired, unused recovery link for an administrator reaches the
change-password form; invalid/expired/used/tampered links and non-admin recovery sessions land
on a clear invalid-link state with a "Request a new link" affordance, changing no password.

**Independent Test**: Hit `/admin/auth/confirm` with an expired/used/malformed token (and with
a non-admin session) and confirm a redirect to `/admin/reset-password?error=link` with no
password change; render the invalid-link state.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [X] T022 [P] [US4.1] Route Handler test `tests/app/admin/confirmRoute.test.ts` (mock `lib/supabase/server`): a valid recovery `token_hash` whose session passes `assertAdminSession` → `verifyOtp({type:'recovery',token_hash})` then redirect to `/admin/reset-password`; a failed `verifyOtp` or a non-admin session → sign out + redirect to `/admin/reset-password?error=link` and a `reset_invalid` event (SC-003, FR-009, FR-010, FR-015)

#### Implementation for User Story 4.1

- [X] T023 [US4.1] Create `app/admin/auth/confirm/route.ts` (`GET`) per contract C4: read `token_hash` + `type`, `verifyOtp`, then `assertAdminSession`; on success redirect to `/admin/reset-password`; on any failure (missing/invalid/expired/used token or non-admin) `signOut` + redirect to `/admin/reset-password?error=link` and log `reset_invalid` (depends on T014)
- [X] T024 [US4.1] In `app/admin/reset-password/page.tsx`, render the invalid-link state — `resetLinkInvalid` plus a `requestNewLinkLabel` link to `/admin/forgot-password` — whenever `?error=link` is present or there is no valid admin recovery session (depends on T021)

**Checkpoint**: The full request → link → change-password flow works end to end. Capture
Phase 2 in `specs/003-admin-forgot-password/walkthrough.md` before sign-off (Principle VII).

---

## Phase 3 — Polish & Cross-Cutting Concerns

- [ ] T025 [P] Validate Quality Gates (Principle IV): `/admin/forgot-password` and `/admin/reset-password` at **320 / 390 / 430 / 768px and desktop** — no horizontal scroll/clip/overlap; inputs ≥16px on mobile; visible focus on every field/button; confirmation, validation, and invalid-link messages announced (`role="alert"`)
- [ ] T026 [P] Run `npm run build` (clean) and `npm run lint` (clean), then `npm test` (all suites green)
- [ ] T027 Run the [quickstart.md](./quickstart.md) §5 verification table end to end against a configured Supabase project (golden path + non-admin/unknown + invalid/expired link + other-session revocation)
- [X] T028 Write `specs/003-admin-forgot-password/walkthrough.md` covering both phases per Principle VII (how to run, route/component paths, numbered desktop + mobile verification, known gaps)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** has no dependency on Phase 2 and is a shippable MVP increment (request flow).
- **Phase 2** depends on Phase 1 shared setup (T002 strings, T003/T004 migration & audit
  widening, and the `requestPasswordReset` audit-union change T014 that `updateAdminPassword`
  and the confirm route reuse). The change-password experience is only meaningful once links
  can be requested.
- **Phase 3 (Polish)** depends on Phases 1 and 2.

### Within Phase 1

- Shared setup: T001, T002, T003 are parallel `[P]`; **T004 depends on T003**.
- US1.1: tests T005, T006 `[P]` first → T007 `[P]` → **T008 depends on T007** →
  T009 `[P]` (depends on T008 for the action import) → **T010 depends on T009** →
  T011 `[P]` (independent file).
- US3.1: **T013 depends on T008 + T003**; **T014 depends on T013**; test T012 `[P]` written
  first.

### Within Phase 2

- US2.1: tests T015, T016, T017 `[P]` first → **T018 depends on T007** →
  **T019 depends on T018 + T014** → T020 `[P]` → **T021 depends on T020**.
- US4.1: test T022 `[P]` first → **T023 depends on T014** → **T024 depends on T021**.

> Same-file sequencing: `app/admin/actions.ts` (T008→T013→T014→T019),
> `lib/auth/passwordReset.ts` (T007→T018), and `app/admin/reset-password/page.tsx`
> (T021→T024) are edited by multiple tasks — run those in the listed order, not in parallel.

### Parallel opportunities

- Phase 1 shared setup: T001 + T002 + T003 together.
- US1.1 tests: T005 + T006 together; then T007 + T009 + T011 are independent files.
- Phase 2 tests: T015 + T016 + T017 (+ T022) together; implementation T020 parallel with the
  `route.ts`/page work on different files.

---

## Implementation Strategy

### MVP first (Phase 1 only)

1. Complete Phase 1 shared setup (T001–T004).
2. Complete US1.1 (T005–T011) and US3.1 (T012–T014).
3. **STOP and VALIDATE**: admins can request a link; admin/non-admin/unknown requests are
   indistinguishable (SC-002). This is a shippable, demoable increment.

### Incremental delivery

1. Phase 1 → request flow (MVP).
2. Phase 2 → link verification + change-password + session revocation → full end-to-end
   recovery.
3. Phase 3 → responsive/a11y gates, quickstart validation, walkthrough.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- All recovery logic ships deterministic tests written first (Principle II); there is no new
  wave-scoped read, so no new cross-wave denial test is required — admin-only enforcement is
  covered by the `is_admin_email` (T012) and `assertAdminSession`/confirm (T022) tests.
- The reason category in audit rows is never returned to the client (FR-004/FR-015); every
  request shows the neutral `resetLinkSent`, every bad link the generic `resetLinkInvalid`.
- Commit after each task or logical group; `proxy.ts` and all 002 behavior remain unchanged.
