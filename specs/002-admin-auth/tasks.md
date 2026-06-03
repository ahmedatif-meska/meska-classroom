---
description: "Task list for Admin Authentication & Account Separation"
---

# Tasks: Admin Authentication & Account Separation

**Input**: Design documents from `specs/002-admin-auth/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md), [contracts/auth-contracts.md](./contracts/auth-contracts.md)

**Tests**: REQUIRED (Principle II, NON-NEGOTIABLE). Phase 2 logic is pure/mockable →
deterministic unit/component tests written first. Phase 1 isolation guarantees are verified
by env-gated, self-cleaning **integration** tests (claims-simulated RLS) — the only way to
exercise Postgres RLS — per [research.md](./research.md) R11.

**Organization** (Principle VII): `## Phase N — <name>` mirrors [plan.md](./plan.md);
`### User Story N.x` matches the plan's story numbering. Phase-level acceptance criteria and
test scenarios live in plan.md.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[Story]**: maps to the plan's user stories (US1.1, US4.1, US1.2, US2.1, US3.1)

---

## Phase 1 — Identity foundation: schema, tenancy & seeded admin

**Purpose**: Stand up the first backend (Supabase wiring, four tables + RLS, seeded
bootstrap admin) and prove admin↔student separation and tenant isolation at the data layer.
Independently verifiable via the seed script + integration tests, with **no login UI**.

### Shared setup (prerequisite for both stories in this phase — no story label)

- [X] T001 Install `@supabase/supabase-js` and `@supabase/ssr`, and add the `"seed:admin": "tsx scripts/seed-admin.ts"` script in `package.json` (add `tsx` as a dev dependency)
- [X] T002 [P] Create `.env.example` at repo root documenting env var **names only** (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_PASSWORD`) and confirm `.env.local` is in `.gitignore`
- [X] T003 [P] Create the browser (anon) Supabase client in `lib/supabase/client.ts`
- [X] T004 [P] Create the server/RSC (cookie-bound, anon) Supabase client in `lib/supabase/server.ts`
- [X] T005 [P] Create the service-role (server-only) admin client in `lib/supabase/admin.ts` (used solely by the seed script; never imported into request/client code)

### User Story 1.1: Provision the bootstrap administrator (Priority: P1) 🎯 MVP

**Goal**: A seeded `ahmedatif@meska.ai` admin with `app_metadata.role='admin'` and a matching
`admin_profiles` row exists from first launch; seeding is idempotent.

**Independent Test**: Run `npm run seed:admin` against a configured project and confirm the
admin + profile exist with the admin role; re-run and confirm no duplicate and no password
overwrite.

#### Implementation for User Story 1.1

- [X] T006 [US1.1] Write migration `supabase/migrations/0001_init_identity.sql` — create `tenants`, `admin_profiles` (PK/FK→`auth.users.id`, `role` CHECK `= 'admin'`, `full_control` default true, unique `email`), `students` (FK→`tenants.id`, unique `(tenant_id, student_code)`), and `admin_auth_events`, per [data-model.md](./data-model.md)
- [X] T007 [US1.1] Write the idempotent `scripts/seed-admin.ts` using `lib/supabase/admin.ts`: if `ahmedatif@meska.ai` is absent, `auth.admin.createUser` with `email_confirm:true`, password from `SEED_ADMIN_PASSWORD`, `app_metadata:{role:'admin'}`; then upsert the `admin_profiles` row; log created/skipped (FR-006)

#### Tests for User Story 1.1 (REQUIRED — integration tier, env-gated, self-cleaning)

- [X] T008 [P] [US1.1] Integration test `tests/integration/seedAdmin.test.ts` — running the seed twice yields exactly one admin user + one `admin_profiles` row with `role='admin'` and `full_control=true`, and the second run does not overwrite the password (idempotency, FR-006). Skips with a clear message when `.env.local` creds are absent.

### User Story 4.1: Separate, RLS-isolated admin and student populations (Priority: P1)

**Goal**: Admins (only in `auth.users`/`admin_profiles`) and students (only in `students`)
are disjoint; RLS isolates tenants and bars non-admins from `admin_profiles`; the super-admin
bypasses tenant scope.

**Independent Test**: With two tenants seeded, a tenant-A claim reads only tenant-A students
and zero tenant-B rows; an `admin_profiles` read by a non-admin claim returns nothing; an
admin claim reads across tenants.

#### Implementation for User Story 4.1

- [X] T009 [US4.1] Write migration `supabase/migrations/0002_rls_policies.sql` — enable RLS on all four tables; add the `is_admin()` helper (`auth.jwt()->'app_metadata'->>'role' = 'admin'`); SELECT policies: `admin_profiles` admin-only; `students`/`tenants` admin-OR-matching-tenant-claim; writes admin-only; `admin_auth_events` admin-only read (per [data-model.md](./data-model.md))

#### Tests for User Story 4.1 (REQUIRED — integration tier, env-gated, self-cleaning)

- [X] T010 [P] [US4.1] Integration test `tests/integration/rls.test.ts` (claims-simulated): (a) tenant-A claim returns only tenant-A students, **zero** tenant-B rows (SC-005); (b) a `students` read returns no `admin_profiles` row and an `admin_profiles` read by a non-admin claim returns zero rows (SC-004); (c) an admin claim returns rows across tenants; (d) inserting `role='student'` into `admin_profiles` is rejected by the CHECK constraint. Creates and cleans its own fixtures; skips without creds.

**Checkpoint**: Identity foundation is independently verifiable. Capture Phase 1 in
`specs/002-admin-auth/walkthrough.md` before sign-off (Principle VII).

---

## Phase 2 — Admin login: authentication, role gate & mandatory fields

**Purpose**: Wire the existing admin form to real, server-side authentication: mandatory
fields, credential verification, an admin-only role gate with generic failures, sessions,
route protection, success redirect, and sign-out.

### User Story 1.2: Administrator signs in and reaches the dashboard (Priority: P1) 🎯 MVP

**Goal**: Correct admin credentials set an httpOnly admin session and redirect to
`/admin/dashboard`; protected routes are inaccessible without a valid admin session.

**Independent Test**: Submit the seeded admin's correct credentials → redirected to
`/admin/dashboard` with a session cookie; visit `/admin/dashboard` signed out → redirected to
`/admin`.

#### Tests for User Story 1.2 (REQUIRED — write first, ensure they FAIL) ⚠️

- [X] T011 [P] [US1.2] Unit test `tests/app/admin/signInAdmin.test.ts` — with a mocked Supabase client returning a valid admin session, `signInAdmin` redirects to `/admin/dashboard` (golden path, FR-009)
- [X] T012 [P] [US1.2] Test `tests/middleware.test.ts` — a request to `/admin/dashboard` with no admin session is redirected to `/admin`; with a valid admin session it is allowed (FR-010)

#### Implementation for User Story 1.2

- [X] T013 [P] [US1.2] Add admin-auth copy keys to `lib/strings.ts` (`adminEmailRequired`, `adminAuthFailed`, `adminSigningIn`, `adminSignOutLabel`) per contract C6
- [X] T014 [US1.2] Create `lib/auth/adminGate.ts` — pure `assertAdminSession(session)` (admin role only) and `validateLoginFields(email,password)` (non-empty), returning the generic-failure/required messages from `lib/strings.ts`
- [X] T015 [US1.2] Create `app/admin/actions.ts` (`'use server'`) — `signInAdmin` (validate fields → `signInWithPassword` via `lib/supabase/server.ts` → `assertAdminSession`; on success `redirect('/admin/dashboard')`) and `signOutAdmin` (clear session, redirect `/admin`)
- [X] T016 [US1.2] Create `proxy.ts` (Next 16 `proxy` convention — replaces deprecated `middleware`) — refresh the Supabase session and protect `/admin/dashboard` (matcher excludes the public `/admin` sign-in); redirect to `/admin` when no valid admin session
- [X] T017 [US1.2] Modify `app/admin/page.tsx` — bind the form to `signInAdmin` via `useActionState` (client island), remove the static `action="/admin/dashboard"`, render the returned error in a `role="alert"` region
- [X] T018 [US1.2] Modify `app/admin/dashboard/page.tsx` — add a sign-out control bound to `signOutAdmin` using `strings.adminSignOutLabel`

### User Story 2.1: Admin login accepts administrators only, fails generically (Priority: P1)

**Goal**: Valid non-admin credentials, wrong passwords, and unknown emails are all denied
with the **same** generic message and leave no session; outcomes are audited server-side.

**Independent Test**: Submit a seeded non-admin's valid credentials, a wrong password, and an
unknown email → each denied, no session, identical message; `admin_auth_events` records the
reason category (not shown to the user).

#### Tests for User Story 2.1 (REQUIRED — write first, ensure they FAIL) ⚠️

- [X] T019 [P] [US2.1] Unit test `tests/lib/auth/adminGate.test.ts` — `assertAdminSession` allows an admin-role session and denies a student-role session; the denial maps to the generic `adminAuthFailed` message (FR-003)
- [X] T020 [P] [US2.1] Unit test in `tests/app/admin/signInAdmin.test.ts` — (a) valid non-admin credentials → signed out, no session, returns `adminAuthFailed`; (b) wrong password and (c) unknown email return the **identical** `adminAuthFailed` string (no enumeration, SC-002/SC-006)

#### Implementation for User Story 2.1

- [X] T021 [US2.1] In `app/admin/actions.ts`, on a successful password verify with a non-admin role, sign the session out **in-request** before returning the generic error (no admin session ever persists), per contract C1 / research R5
- [X] T022 [US2.1] In `app/admin/actions.ts`, write an `admin_auth_events` row for each attempt (`success/ok`, `denied/bad_credentials`, `denied/not_admin`) via a server client; never include the password and never surface the reason to the client

### User Story 3.1: Both fields mandatory on the admin login (Priority: P2)

**Goal**: Empty email and/or password is blocked before any authentication call, with a
required-field message.

**Independent Test**: Submit with empty email, empty password, then both → each blocked
pre-auth with the required message; no network auth call is made.

#### Tests for User Story 3.1 (REQUIRED — write first, ensure they FAIL) ⚠️

- [X] T023 [P] [US3.1] Unit test in `tests/lib/auth/adminGate.test.ts` — `validateLoginFields` rejects empty email, empty password, and both-empty with `adminEmailRequired`, and passes when both are present (FR-002, SC-003)
- [X] T024 [P] [US3.1] Component test `tests/components/AdminLoginForm.test.tsx` — both inputs carry `required`; submitting empty surfaces the required-field message and triggers no action call; the error region has `role="alert"` (US3, Principle IV a11y)

#### Implementation for User Story 3.1

- [X] T025 [US3.1] Ensure `app/admin/page.tsx` marks both inputs `required`, and `signInAdmin` in `app/admin/actions.ts` calls `validateLoginFields` and returns early **before** any `signInWithPassword` call (server-side mandatory enforcement, FR-002)

**Checkpoint**: Phase 2 stories are independently functional and testable. Update
`specs/002-admin-auth/walkthrough.md` with Phase 2 before sign-off (Principle VII).

---

## Phase 3 — Polish & Cross-Cutting Concerns

**Purpose**: Verify the quality gates and finalize hand-off.

- [ ] T026 [P] Manual responsive & a11y validation of `/admin` and `/admin/dashboard` at 320/390/430/768px and desktop — no horizontal scroll/clip/overlap, inputs ≥16px on mobile, visible focus on both fields and submit, generic error announced (Principle IV)
- [ ] T027 Rotate the leaked Supabase service-role key, anon key, and admin password; apply migrations and run `npm run seed:admin`; walk through every row of [quickstart.md](./quickstart.md) §6 (R9 / sign-off blocker)
- [X] T028 [P] Confirm no secrets are committed: `.env.local` git-ignored, `.env.example` lists names only, service-role key referenced only in `scripts/` + `lib/supabase/admin.ts`
- [X] T029 Verify `npm run build` passes, `npm run lint` is clean, and `npm test` (unit/component green; integration tier exercised with creds present)
- [X] T030 Write `specs/002-admin-auth/walkthrough.md` covering Phase 1 and Phase 2 per Principle VII (how to run, routes/components, numbered golden-path verification desktop + mobile, known gaps → student-auth feature)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** (Identity foundation): shared setup (T001–T005) first; then US1.1 (T006–T008) and US4.1 (T009–T010). Migrations (T006, T009) and the seed (T007) must exist before their integration tests (T008, T010) can pass.
- **Phase 2** (Admin login): depends on Phase 1 (needs the seeded admin + schema + Supabase clients). Within it, US1.2 establishes the shared login machinery (adminGate, actions, middleware, form); US2.1 and US3.1 add their tests + refinements on top.
- **Phase 3** (Polish): depends on Phases 1–2.

### Story dependencies

- **US1.1** and **US4.1** are independent (different SQL/script files) once setup is done; the RLS test (US4.1) assumes the schema from US1.1's migration exists.
- **US1.2** (P1) is the Phase-2 MVP and creates `adminGate.ts`/`actions.ts`/`proxy.ts` that **US2.1** and **US3.1** extend. US2.1 and US3.1 are independently testable but share `app/admin/actions.ts` with US1.2 (sequential edits, not parallel).

### Within a story

- Tests written first and confirmed failing (Phase 2 — pure/mockable) before implementation.
- Pure logic (`adminGate.ts`) before its consumers (`actions.ts`, form).

---

## Parallel Opportunities

- **Setup**: T002, T003, T004, T005 are different files → run in parallel after T001.
- **Phase 2 tests**: T011, T012 (US1.2); T019, T020 (US2.1); T023, T024 (US3.1) — different test files, parallelizable within their story.
- **Cross-file impl**: T013 (`strings.ts`) is parallel to T014 (`adminGate.ts`). T015/T021/T022/T025 all edit `app/admin/actions.ts` → **sequential**.

### Parallel example: Phase 1 setup

```bash
Task: "Create browser Supabase client in lib/supabase/client.ts"      # T003
Task: "Create server Supabase client in lib/supabase/server.ts"        # T004
Task: "Create service-role admin client in lib/supabase/admin.ts"      # T005
Task: "Create .env.example documenting env var names"                  # T002
```

---

## Implementation Strategy

### MVP scope

**Phase 1 setup + US1.1 + US4.1, then Phase 2 US1.2.** That delivers a seeded, separated,
RLS-isolated identity foundation and a working admin sign-in to the dashboard — the
minimum that demonstrates the feature end-to-end.

### Incremental delivery

1. Phase 1 setup → US1.1 (seeded admin) → US4.1 (separation/RLS) → **validate at the data layer**.
2. Phase 2 US1.2 (login + protection) → **demo the golden path (MVP!)**.
3. US2.1 (admin-only generic failures) → US3.1 (mandatory fields) → each tested independently.
4. Phase 3 polish → quality gates + walkthrough → sign-off (after key rotation, T027).

---

## Notes

- [P] = different files, no incomplete dependency. Tasks editing `app/admin/actions.ts` (T015, T021, T022, T025) are intentionally **not** [P].
- Integration tests (T008, T010) require `.env.local` and run against the cloud project; they self-clean and skip cleanly without creds — keep the unit/component tier deterministic and offline.
- **T027 is a sign-off blocker**: the leaked secrets must be rotated before this feature is considered done.
- Commit after each task or logical group; produce the phase `walkthrough.md` before declaring a phase done (Principle VII).
