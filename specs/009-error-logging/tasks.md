---
description: "Task list for Error Logging implementation"
---

# Tasks: Error Logging

**Input**: Design documents from `specs/009-error-logging/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/error-logging-contracts.md, quickstart.md

**Tests**: REQUIRED (constitution Principle II — NON-NEGOTIABLE). The admin-only read boundary ships its denial test (Principle VI). Write tests first and confirm they FAIL before implementing.

**Organization**: `## Phase N` → `### User Story N.x` → atomic `- [ ]` items (Principle VII). Story labels `[US1.1]`, `[US2.1]`, `[US3.1]` map to the user stories in `plan.md`. Phase-level acceptance criteria and test scenarios live in `plan.md`.

**Stack/paths** (from plan.md): Next.js 16 App Router, TS strict, Supabase (Postgres + Auth), Vitest. Pure domain logic in `lib/errors/`; admin surface under `app/admin/errors/`; migration `supabase/migrations/0012_error_logs.sql`; safety net in `instrumentation.ts` (repo root).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task serves (Setup/Foundational/Polish carry no story label)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: copy and navigation that later phases rely on.

- [x] T001 [P] Add all Error-Logging UI copy to `lib/strings.ts`: "Errors" nav label; list page title/subtitle; empty state ("No errors recorded"); table column labels (time, severity, surface, origin, operation, message, user); anonymous-actor label; detail page section labels (message, stack trace, context, user, environment); older/newer pagination labels.
- [x] T002 [P] Add an **Errors** nav item (label from `lib/strings.ts`, `href: "/admin/errors"`) to `lib/adminNav.tsx` (single source of truth for the admin sidebar/drawer).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema + RLS, the write RPC, the pure serializer, route protection, and the Principle VI denial test. **⚠️ No user story can begin until this phase is complete.**

- [x] T003 Create migration `supabase/migrations/0012_error_logs.sql` per `data-model.md`: (a) `public.error_logs` table (id, occurred_at, surface/origin/severity with checks + defaults, operation, message, stack, context jsonb, user_id FK `on delete set null` to `auth.users`, user_role, tenant_id FK `on delete set null` to `public.tenants`, environment) + `error_logs_occurred_at_idx` on `(occurred_at desc)`; (b) enable RLS with **only** an admin SELECT policy (`is_admin()`) — no INSERT/UPDATE/DELETE policies; (c) `log_error(p_surface, p_origin, p_severity, p_operation, p_message, p_stack, p_context, p_environment)` SECURITY DEFINER RPC mirroring `log_admin_auth_event` (`set search_path = public`, revoke from public, grant execute to anon + authenticated) that derives `user_id`/`user_role`/`tenant_id` from `auth.uid()`/`auth.jwt()` (never parameters), truncates via `left()` (200/2000/8000/4000), coerces invalid enum params to `system`/`server`/`error`, and wraps invalid context JSON as `{"raw": <text>}`; (d) `create extension if not exists pg_cron` + daily `cron.schedule` purging rows older than 90 days.
- [x] T004 Apply migration `0012_error_logs.sql` to the Supabase project (MCP `apply_migration`).
- [x] T005 [P] Implement `lib/errors/serialize.ts` (pure, Supabase-free) per contracts §2: `BOUNDS` constant, `SafeContext` type (scalars only), `truncate(value, max)`, `sanitizeContext(ctx)` (drops keys matching `/password|token|secret|cookie|authorization|api[_-]?key/i`, truncates values), `serializeError(err)` (Error → message + stack with cause chain; non-Error → `String(err)`; truncated; never throws).
- [x] T006 [P] Unit tests `tests/lib/errors/serialize.test.ts`: secret-shaped keys dropped (`password`, `accessToken`, `api_key`, `Authorization`, `cookie`) while safe keys survive; truncation exactly at each bound; non-Error inputs (string, null, object) serialize without throwing; `cause` chain appears in stack; output never exceeds `BOUNDS`.
- [x] T007 Add `"/admin/errors/:path*"` to `config.matcher` in `proxy.ts` (admin-gated like the other `/admin/**` groups).
- [x] T008 Extend `tests/integration/rls.test.ts` (live, skips without creds) with the **admin-only denial** cases (NON-NEGOTIABLE, Principle VI): an anon caller and a student JWT each SELECT zero rows from `error_logs`; the anon caller can invoke `log_error` and the created row has NULL `user_id`/`user_role`/`tenant_id`; a >2,000-char message is stored truncated to exactly 2,000 (RPC-level authority); the service role can read the row back for assertions; self-cleaning.

**Checkpoint**: table, RPC, isolation, pure serializer, and routing ready — user stories can begin.

---

## Phase 3 — Capture foundation (server-side errors land in the table)

**Purpose**: the MVP — every unexpected server-side error is recorded with full detail, user-visible behavior unchanged. Phase acceptance criteria & scenarios: `plan.md` Phase 1.

### User Story 1.1: Every unexpected server-side error is automatically recorded (Priority: P1) 🎯 MVP

**Goal**: `logError()` records handled-but-unexpected failures at existing swallow points; `instrumentation.ts` `onRequestError` records uncaught crashes as `fatal`; users see exactly the same friendly messages as today.

**Independent Test**: Force a Supabase failure inside a wired action → the action returns its existing generic error state AND one `error_logs` row exists with operation, message, stack, surface, and the acting user (quickstart.md steps 1–4).

#### Tests for User Story 1.1 (write first, ensure they FAIL) ⚠️

- [x] T009 [P] [US1.1] Test `logError` in `tests/lib/errors/log.test.ts` (mock `@/lib/supabase/server`): calls `rpc("log_error", …)` once with serialized message/stack, sanitized context, defaults (`severity: 'error'`, `origin: 'server'`), and `p_environment` from `VERCEL_ENV ?? NODE_ENV`; **resolves without throwing when the RPC rejects** and falls back to `console.error`; validation/shape of the RPC params matches contracts §3.
- [x] T010 [P] [US1.1] Extend `tests/app/admin/members/createMember.test.ts` (pattern for wired actions): a mocked Supabase failure path returns the **byte-identical existing generic error state** AND `logError` was called once with `operation: "createMember"`, `surface: "admin"`; a validation rejection and a gate denial call `logError` **zero** times (unexpected-only rule, contracts §3 wiring contract).
- [x] T011 [P] [US1.1] Test `onRequestError` in `tests/instrumentation.test.ts` (mock `@supabase/supabase-js`): logs severity `fatal`, origin `server`, operation `onRequestError:<pathname>`; surface mapping `/admin/**` → `admin`, `/student/**` → `student`, other → `system`; context contains only `{ path, method, routerKind, routeType }` (no headers/cookies/body); its own thrown failure is swallowed.

#### Implementation for User Story 1.1

- [x] T012 [US1.1] Implement `logError()` in `lib/errors/log.ts` per contracts §3: builds the payload via `serializeError`/`sanitizeContext`, awaits the `log_error` RPC on the cookie-bound server client (or an injected client), wraps everything in its own try/catch whose catch only `console.error`s — **never throws, never rejects**.
- [x] T013 [US1.1] Create `instrumentation.ts` at the repo root exporting `onRequestError` per contracts §4: lazy bare `@supabase/supabase-js` anon client (`persistSession: false`), severity `fatal`, route-derived surface, safe context only, outer try/catch so a crash in crash-logging is invisible.
- [x] T014 [US1.1] Wire `logError` into `app/admin/members/actions.ts`: every point where an unexpected Supabase/Admin-API failure is converted to a generic message (`createMember` insert/duplicate-check failures, `resendMemberInvite`, `removeMember`) — placed immediately before the generic return; validation and gate denials untouched.
- [x] T015 [P] [US1.1] Wire `logError` into `app/admin/actions.ts` and `app/admin/instructors/actions.ts` at their unexpected-failure swallow points (same rule as T014).
- [x] T016 [P] [US1.1] Wire `logError` into `app/admin/waves/actions.ts` and `app/student/actions.ts` at their unexpected-failure swallow points (student actions use `surface: "student"`).
- [x] T017 [P] [US1.1] Wire `logError` into `lib/members/create.ts` (`provisionMember`, `sendMemberMagicLink`) so the underlying Admin-API error detail is captured before it is reduced to a result object; use `severity: 'warning'` for the recovered `inviteFailed` path (research R10).
- [x] T018 [P] [US1.1] Wire `logError` into the auth confirmation handlers (`app/admin/auth/confirm/` and `app/student/auth/confirm/`) for unexpected verification failures (anonymous attribution expected). *Resolved as no-wiring-needed: every confirm failure branch is a by-design invalid-link rejection (excluded by the unexpected-only rule); uncaught crashes on those routes are covered by `onRequestError`. Documented in walkthrough.md.*
- [x] T019 [US1.1] Add the Phase 1 section to `specs/009-error-logging/walkthrough.md` (run steps, implemented paths, numbered golden-path verification on desktop AND mobile per quickstart.md 1–4, known gaps → Phase 2 viewing).

**Checkpoint**: forcing any wired failure produces exactly one detailed row; `npm run build && npm run lint && npm test` pass. MVP complete.

---

## Phase 4 — Admin error log view

**Purpose**: admins browse and inspect recorded errors in-app. Phase acceptance criteria & scenarios: `plan.md` Phase 2.

### User Story 2.1: Admin browses errors newest-first and opens full detail (Priority: P2)

**Goal**: `/admin/errors` paginated list (50/page, contained-scroll table) + `/admin/errors/[id]` full detail with contained-scroll stack trace.

**Independent Test**: Seed entries → admin sees them newest-first with working pagination and a detail page; a student/anon is redirected by the proxy and reads zero rows via RLS.

#### Tests for User Story 2.1 (write first, ensure they FAIL) ⚠️

- [x] T020 [P] [US2.1] Test the list page in `tests/app/admin/errors/page.test.tsx` (mock `@/lib/supabase/server`): 60 mocked rows → 50 render newest-first with an older-page link; `?page=` invalid/absent → page 1; zero rows → empty-state copy from `lib/strings.ts`; NULL-user row shows the anonymous label; each row links to `/admin/errors/<id>`.
- [x] T021 [P] [US2.1] Test the detail page in `tests/app/admin/errors/detailPage.test.tsx`: all stored fields render (message, stack, context, severity, surface, origin, environment, user); NULL user → anonymous label; unknown id triggers `notFound()`.

#### Implementation for User Story 2.1

- [x] T022 [US2.1] Create `app/admin/errors/page.tsx` (RSC: `DashboardShell` + `adminNav`, self-gate on the admin session, `range`-paginated read 50/page ordered `occurred_at desc`, contained-horizontal-scroll table per the AdminTable pattern — `overflow-x-auto`, `min-w`, `whitespace-nowrap`; empty state; older/newer links) plus `loading.tsx`, `error.tsx` (`'use client'`), and `not-found.tsx` in `app/admin/errors/`.
- [x] T023 [US2.1] Create `app/admin/errors/[id]/page.tsx` (RSC detail: every stored field; `stack` and pretty-printed `context` in contained-scroll `<pre>` blocks that stay 320px-safe; unknown id → `notFound()`).
- [x] T024 [US2.1] Validate responsive/accessible at 320/390/430/768px + desktop (no page/body horizontal scroll, drawer nav shows the Errors item, visible focus on row links, AA contrast) and add the Phase 2 section to `specs/009-error-logging/walkthrough.md`.

**Checkpoint**: viewing works end-to-end; zero new client JS; all gates pass.

---

## Phase 5 — Client-side crash reporting

**Purpose**: browser rendering crashes land in the same log, best-effort. Phase acceptance criteria & scenarios: `plan.md` Phase 3.

### User Story 3.1: Browser rendering crashes are reported into the error log (Priority: P3)

**Goal**: `error.tsx` screens report the crash once via the `reportClientError` Server Action; the retry UX is untouched even when reporting fails.

**Independent Test**: Force a rendering crash → the standard error screen renders, one `origin: 'client'` row exists with the page path; with the action mocked to reject, the screen and retry still work.

#### Tests for User Story 3.1 (write first, ensure they FAIL) ⚠️

- [x] T025 [P] [US3.1] Test `buildClientErrorReport` in `tests/lib/errors/report.test.ts` (pure): query string stripped from `page` (tokens never leave the browser), message/stack truncated to `BOUNDS`, non-string fields dropped, never throws on weird `error` values.
- [x] T026 [P] [US3.1] Test `reportClientError` in `tests/app/reportClientError.test.ts` (mock `@/lib/errors/log`): valid report → `logError` called once with `origin: 'client'` and surface derived from the page path; malformed/non-string payloads are dropped without logging garbage; the action resolves `void` even when `logError`'s underlying RPC fails.
- [x] T027 [P] [US3.1] Test the reporting hook/effect in `tests/components/useReportClientError.test.tsx`: fires exactly once per error instance (no duplicate on re-render); a rejected action produces no unhandled rejection; the boundary's reset/retry still functions.

#### Implementation for User Story 3.1

- [x] T028 [P] [US3.1] Implement `lib/errors/report.ts` (pure): `ClientErrorReport` type and `buildClientErrorReport(error, pathname)` per contracts §5 (strip query string, truncate, shape-validate).
- [x] T029 [US3.1] Implement `reportClientError` in new `app/actions.ts` (`"use server"`): re-validate the report shape server-side, then `logError({ origin: 'client', surface: <from page path>, … })`; always resolves `void`; ungated (anonymous crashes reportable; identity comes from the JWT inside the RPC).
- [x] T030 [US3.1] Create a small shared client hook `lib/errors/useReportClientError.ts` (`'use client'`: builds the report from the boundary's `error` + `usePathname`, fires once per error instance, `catch`es and ignores failures) and wire it into every existing `error.tsx` (`app/admin/error.tsx`, `app/student/error.tsx`, and the nested ones under `app/admin/waves/` and `app/admin/errors/`).
- [x] T031 [US3.1] Add the Phase 3 section to `specs/009-error-logging/walkthrough.md` (forced-crash verification on desktop AND mobile, offline/report-failure check).

**Checkpoint**: client crashes visible in `/admin/errors`; retry UX unchanged under reporting failure.

---

## Phase 6 — Polish & Cross-Cutting Concerns

**Purpose**: final gates across all stories.

- [ ] T032 [P] Run the full `quickstart.md` golden path end-to-end against the dev environment (force server failure → entry visible; anonymous failure → anonymous label; uncaught crash → `fatal` entry; student read denial). *Automated layers verified live (RPC smoke test, RLS denial suite 4/4, full unit suite); the in-browser golden path is the reviewer's walkthrough run per Principle VII — steps in `walkthrough.md`.*
- [x] T033 Verify Quality Gates: `npm run build`, `npm run lint`, `npm test` all clean; responsive sweep at 320/390/430/768px + desktop; confirm phases 1–2 added zero client JS to happy paths and success-path latency is untouched (logging fires on failure paths only).
- [x] T034 Finalize `specs/009-error-logging/walkthrough.md` covering all three implemented phases (Principle VII) and confirm CLAUDE.md's SPECKIT block still points at this feature.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: none — start immediately; T001 ∥ T002.
- **Foundational (Phase 2)**: T003 → T004 (apply after authoring); T005 ∥ T003; T006 after T005; T007 ∥ everything; T008 after T004. **Blocks all user stories.**
- **Phase 3 (US1.1)**: needs Phase 2. T009–T011 (tests) first, in parallel; T012 before T013–T018; T014–T018 parallel across files; T019 last.
- **Phase 4 (US2.1)**: needs Phase 2 (+ Phase 1 copy/nav). Independent of Phase 3 code, but only meaningful with data — implement after Phase 3. T020–T021 first; T022 → T023 (shared strings/read pattern) → T024.
- **Phase 5 (US3.1)**: needs T012 (`logError`). T025–T027 first; T028 ∥ T025; T029 after T028; T030 after T029; T031 last.
- **Polish (Phase 6)**: after all desired stories.

### Parallel Opportunities

- Phase 1: T001 ∥ T002.
- Phase 2: T003 ∥ T005 ∥ T007; T006 ∥ T008 (different files).
- Phase 3: all three test tasks ∥; wiring tasks T015–T018 ∥ (different files).
- Phases 4 and 5 touch disjoint files and can proceed in parallel once Phase 3 lands.

## Implementation Strategy

**MVP = Phases 1–3** (Setup + Foundational + US1.1): every unexpected server error is captured with full detail — deliverable and verifiable on its own via the database/quickstart even before the viewing UI exists. Then Phase 4 makes the log consumable in-app, Phase 5 adds client crash coverage, Phase 6 closes the gates. Stop and validate at each checkpoint; commit per task or logical group.

## Notes

- [P] = different files, no dependency on an incomplete task.
- Write each story's tests first and watch them fail before implementing (Principle II).
- The wiring rule (contracts §3) is the discipline that makes SC-001 true: log immediately before every generic-message return for an *unexpected* failure; never log by-design rejections.
- Logging must never change action return shapes or messages — T010 pins this.
