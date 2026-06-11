# Implementation Plan: Error Logging

**Branch**: `009-error-logging` | **Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/009-error-logging/spec.md`

## Summary

Add a central `public.error_logs` table that records every unexpected error in the app
with maximal safe detail (when, where, what, who, context). Capture is dual-path:
an explicit `logError()` helper at the points where Server Actions and `lib/` code
currently swallow unexpected Supabase failures into generic friendly messages, plus a
new `instrumentation.ts` `onRequestError` hook as the safety net for genuinely uncaught
server exceptions. Writes go through a `SECURITY DEFINER` RPC (`log_error`) that derives
identity from the JWT and truncates fields server-side — mirroring the existing
`log_admin_auth_event` audit pattern. Reads are admin-only via RLS, surfaced on a new
paginated `/admin/errors` page with a per-entry detail view. Client-side rendering
crashes are reported best-effort from the existing `error.tsx` screens through a
`reportClientError` Server Action. Logging never changes user-visible outcomes; its own
failures fall back to the console.

## Technical Context

**Language/Version**: TypeScript (strict) on Next.js 16 App Router, React 19 with React Compiler

**Primary Dependencies**: `@supabase/supabase-js` / `@supabase/ssr` (existing); no new dependencies

**Storage**: Supabase Postgres — new `public.error_logs` table + `log_error` RPC (migration `0012`); retention purge via `pg_cron`

**Testing**: Vitest + React Testing Library (jsdom); live RLS integration tests in `tests/integration/` (skip without creds)

**Target Platform**: Vercel (serverless) + Supabase; mobile-first web 320px → desktop

**Project Type**: Web application (single Next.js project, existing structure)

**Performance Goals**: zero added cost on success paths (logging fires on failure paths only); `/admin/errors` reads bounded to 50 rows/page

**Constraints**: no API route handlers (Server Actions only); no service-role usage in request code; log writes must never throw into callers; secrets never persisted; fields truncated (operation 200 / message 2,000 / stack 8,000 / context 4,000 chars)

**Scale/Scope**: 1 migration, 1 new `lib/errors/` module (~3 files), 1 instrumentation file, 2 admin routes + nav entry, 1 global Server Action, wiring into ~5 existing `actions.ts` files / `lib` helpers

## Constitution Check

*GATE: evaluated against constitution v2.2.0 — PASS (initial and post-design re-check). No violations; Complexity Tracking is empty.*

- **I. Code Quality**: TS strict, no `any`; new pure logic lives in `lib/errors/`; `npm run build` + `npm run lint` clean per phase. No manual memoization (React Compiler). Long content (stack traces) rendered in contained-scroll `<pre>` blocks so user/AI-generated length cannot break layout.
- **II. Testing (NON-NEEGOTIABLE)**: each phase ships deterministic tests — pure serializer/redaction units, action tests with mocked `@/lib/supabase/*`, and a live RLS denial test (student/anon cannot read `error_logs`) added to `tests/integration/rls.test.ts` pattern. Vitest tooling already established (feature 002).
- **III. UX Consistency**: new admin pages use existing tokens, `DashboardShell`, `AdminTable` conventions, and copy from `lib/strings.ts`; loading/empty/error states defined for `/admin/errors` (empty state: "No errors recorded"). English-only LTR. Logo/header behavior inherited from the shell.
- **IV. Mobile-First & Accessible**: `/admin/errors` documented mobile strategy = **contained horizontal scroll** (AdminTable pattern — `overflow-x-auto`, `min-w`, page/body never scrolls sideways); detail page stacks vertically with the stack trace in a contained-scroll `<pre>`. Validated at 320/390/430/768/desktop; WCAG 2.1 AA; touch-friendly row links with visible focus.
- **V. Performance**: RSC-first — phases 1–2 add **zero client JS** (list + detail are Server Components); phase 3 adds only a `useEffect` in existing `error.tsx` client components. Reads paginated (50/page). Logging adds ≤1 RPC on failure paths only; success paths untouched → no Core Web Vitals impact. **Per-feature budget**: error-list page payload ≤ 50 rows; no new client bundles on any happy path.
- **VI. Wave Isolation (NON-NEGOTIABLE)**: `error_logs` is admin-only — SELECT policy `is_admin()`, no client write policies at all (writes only via `SECURITY DEFINER` RPC). Students/anon read attempts return zero rows; the denial case is tested. Entries record `tenant_id` for student-originated errors. `/admin/errors` self-gates and is added to the `proxy.ts` protected matcher group (already covered by `/admin/**`).
- **VII. Artifact Structure (NON-NEGOTIABLE)**: this plan nests acceptance criteria and test scenarios at the phase level; `tasks.md` will follow Phase → User Story → atomic items; each implemented phase ships `walkthrough.md` in `specs/009-error-logging/`.
- **Architecture constraints**: no new backend components, vendors, or libraries; the only new platform surface is `instrumentation.ts` (a standard Next.js convention file, not an architectural addition). No API routes. Service-role key untouched.

## Project Structure

### Documentation (this feature)

```text
specs/009-error-logging/
├── plan.md              # This file
├── research.md          # Phase 0 output (complete)
├── data-model.md        # Phase 1 output (complete)
├── quickstart.md        # Phase 1 output (complete)
├── contracts/
│   └── error-logging-contracts.md
├── checklists/
│   └── requirements.md
├── tasks.md             # /speckit-tasks output (not created by /speckit-plan)
└── walkthrough.md       # per implemented phase (/speckit-implement)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0012_error_logs.sql            # table + RLS + log_error RPC + pg_cron purge

instrumentation.ts                 # NEW (repo root) — onRequestError safety net

lib/errors/
├── serialize.ts                   # pure: serializeError, sanitizeContext, truncation bounds
├── log.ts                         # logError(): RPC call, never throws, console fallback
└── report.ts                      # buildClientErrorReport(): pure shaping for client reports

app/actions.ts                     # NEW — reportClientError Server Action (global, ungated)

app/admin/errors/
├── page.tsx                       # newest-first paginated list (RSC)
└── [id]/page.tsx                  # full-detail view (RSC)

lib/adminNav.tsx                   # + "Errors" nav item
lib/strings.ts                     # + error-log copy constants

app/**/actions.ts, lib/members/create.ts, lib/instructors/*  # wire logError at swallow points
app/admin/error.tsx, app/student/error.tsx                   # + report effect (phase 3)

tests/
├── lib/errors/serialize.test.ts
├── lib/errors/log.test.ts
├── lib/errors/report.test.ts
├── app/reportClientError.test.ts
├── app/admin/errors/page.test.tsx
└── integration/rls.test.ts        # + error_logs denial cases
```

**Structure Decision**: single existing Next.js project; all new code follows the
established layout — pure domain logic in `lib/errors/` (Supabase-free where possible,
for deterministic unit tests), colocated Server Action, RSC pages under
`app/admin/errors/`, migration `0012` next in sequence.

## Implementation Phases

### Phase 1 — Capture foundation (server-side errors land in the table)

#### User Story 1.1: As the Meska ops team, I want every unexpected server-side error automatically recorded with full detail, so that production failures can be diagnosed without reproduction.

- Description: Migration `0012` creates `public.error_logs` (per data-model.md) with
  RLS (admin-only SELECT, no client write policies), the `log_error` SECURITY DEFINER
  RPC (identity from JWT, `left()` truncation), and the daily `pg_cron` 90-day purge.
  `lib/errors/serialize.ts` provides the pure serializer/redactor; `lib/errors/log.ts`
  provides `logError()` (awaited RPC, own try/catch, console fallback — never throws).
  `instrumentation.ts` registers `onRequestError` to log uncaught server exceptions as
  `fatal` via a bare anon client. Existing swallow points in `app/**/actions.ts`,
  `lib/members/create.ts`, and the auth confirm flows call `logError()` where an
  unexpected Supabase `error` is currently converted to a generic message — user-visible
  behavior unchanged.

#### Acceptance Criteria (for the phase)

- [ ] Migration `0012` applies cleanly after `0011`; `error_logs` exists with RLS enabled.
- [ ] `error_logs` has no INSERT/UPDATE/DELETE policies; the only request-code write path is the `log_error` RPC.
- [ ] `log_error` derives `user_id`, `user_role`, `tenant_id` from the caller's JWT; parameters cannot spoof identity.
- [ ] Field truncation (operation 200 / message 2,000 / stack 8,000 / context 4,000) is enforced inside the RPC.
- [ ] An unexpected failure in a wired Server Action produces exactly one `error_logs` row including timestamp, operation identifier, message, stack/cause, severity, surface, and acting user (or anonymous).
- [ ] The user-facing result of every wired action is byte-identical to before (same friendly messages, same state shapes).
- [ ] `serializeError`/`sanitizeContext` strip keys matching the secret deny-list and never accept `FormData`/`File`; covered by unit tests injecting passwords/tokens (SC-004).
- [ ] `logError()` swallows its own failures (RPC rejection → `console.error`, caller unaffected) — covered by a unit test (SC-005).
- [ ] An uncaught exception during server rendering/action execution is recorded via `onRequestError` with severity `fatal` and surface derived from the route path.
- [ ] A student or anonymous caller selecting from `error_logs` gets zero rows (Principle VI denial case, integration-tested).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** an admin session and a mocked Supabase insert failure inside `createMember`, **When** the action runs, **Then** the action returns the existing generic error state AND `log_error` was invoked once with operation `createMember`, the message and stack from the underlying error, and surface `admin`.
2. **Given** a context object containing `{ password: "x", email: "a@b.c" }`, **When** `sanitizeContext` runs, **Then** `password` is absent and `email` is retained.
3. **Given** the `log_error` RPC itself rejects, **When** `logError()` is awaited, **Then** it resolves without throwing and the original action's returned state is unchanged.
4. **Given** a message longer than 2,000 chars, **When** it is logged, **Then** the stored row's message is exactly the truncated bound (RPC-level, verified in the live integration test).
5. **Given** an anonymous Supabase client (live integration), **When** it selects from `error_logs`, **Then** zero rows return; **and given** it calls `log_error`, **Then** a row is created with NULL user attribution.
6. **Given** an uncaught exception thrown in a server component under `/admin/**`, **When** `onRequestError` fires, **Then** a `fatal`, `server`, `admin`-surface row is recorded and the user still sees the standard error screen.

### Phase 2 — Admin error log view

#### User Story 2.1: As an administrator, I want to browse recorded errors newest-first and open any entry's full detail, so that I can diagnose a reported issue without database access.

- Description: `/admin/errors` (RSC) lists entries newest-first, 50 per page via
  `?page=`, in a contained-scroll table (time, severity, surface/origin, operation,
  truncated message, user); each row links to `/admin/errors/[id]` showing every
  captured field, with the stack trace in a contained-scroll `<pre>`. "Errors" is added
  to `lib/adminNav.tsx`; copy added to `lib/strings.ts`; loading/empty states defined.
  Both pages self-gate on the admin session (RLS remains the hard boundary).

#### Acceptance Criteria (for the phase)

- [ ] `/admin/errors` renders entries newest-first, bounded to 50 rows per page, with working older/newer navigation.
- [ ] Each list row shows when, severity, surface, operation, a truncated message, and the acting user (or "Anonymous"); rows link to the detail page.
- [ ] `/admin/errors/[id]` shows all captured fields; the stack trace scrolls inside its own element — the page/body never scrolls horizontally (Principle IV strategy: contained scroll).
- [ ] The empty state ("no errors recorded") and `loading.tsx` state render correctly.
- [ ] A non-admin (student or anonymous) reaching either route is denied: redirected by `proxy.ts` (`/admin/**` matcher) and, defense-in-depth, sees zero data via RLS.
- [ ] Both pages are Server Components adding zero client JavaScript.
- [ ] Layout verified at 320 / 390 / 430 / 768px and desktop; nav item appears in the drawer and sidebar; WCAG AA contrast and visible focus on links.
- [ ] All copy comes from `lib/strings.ts`.
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** 60 seeded entries (mocked read), **When** an admin opens `/admin/errors`, **Then** the 50 newest render in descending time order and a link to page 2 exists.
2. **Given** zero entries, **When** an admin opens `/admin/errors`, **Then** the empty-state copy from `lib/strings.ts` renders.
3. **Given** an entry with a NULL user (anonymous), **When** the admin opens its detail page, **Then** the actor renders as the anonymous label and all other fields display.
4. **Given** a student session (live integration), **When** it selects the entry an admin can see, **Then** zero rows return (cross-role denial, Principle VI).
5. **Given** a 7,000-character stack trace, **When** the detail page renders at 320px, **Then** the trace scrolls within its `<pre>` and the page body has no horizontal scroll.

### Phase 3 — Client-side crash reporting

#### User Story 3.1: As the Meska ops team, I want browser rendering crashes reported into the same error log, so that failures that never reach the server are still visible.

- Description: `reportClientError` Server Action in `app/actions.ts` accepts a
  pre-shaped report (`lib/errors/report.ts` builds it: page path, message, stack —
  sanitized and truncated client-side too), passes it through the same serializer, and
  records it via `logError()` with origin `client` (identity derived from the JWT
  server-side; anonymous allowed). The existing `app/admin/error.tsx` and
  `app/student/error.tsx` gain a `useEffect` that fires the report once per error
  instance, best-effort — any reporting failure is swallowed and the retry UX is
  untouched.

#### Acceptance Criteria (for the phase)

- [ ] A rendering crash that mounts a panel `error.tsx` results in one `error_logs` row with origin `client`, the page path, message, and available stack.
- [ ] The error screen and its retry button render and function identically whether or not the report succeeds (offline/blocked included).
- [ ] Reports from signed-in users carry their identity/role (JWT-derived server-side); anonymous crashes record as anonymous.
- [ ] `reportClientError` sanitizes and truncates exactly like server-side logging; injected secret-shaped values are absent from stored rows.
- [ ] The report fires once per error instance (no loop on re-render/reset).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** a thrown rendering error in a student page, **When** `error.tsx` mounts, **Then** `reportClientError` is called once with the page path and error message, and the standard error UI renders.
2. **Given** `reportClientError` rejects (network failure mocked), **When** the error screen mounts, **Then** no unhandled rejection surfaces and the retry button still resets the boundary.
3. **Given** a report whose context includes a token-like key, **When** the action processes it, **Then** the stored entry omits it.
4. **Given** the same error instance re-renders, **When** the effect re-runs, **Then** no duplicate report is sent.

## Complexity Tracking

No constitution violations — table intentionally left empty.
