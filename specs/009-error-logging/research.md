# Research: Error Logging (009)

**Date**: 2026-06-11 | **Spec**: [spec.md](./spec.md)

All Technical Context unknowns are resolved below. Each decision records the choice, why, and the alternatives rejected.

## R1. Where errors actually surface in this codebase (capture mechanism)

**Finding**: Server Actions in this repo do **not** throw on failure. They follow a
result-object discipline: the Supabase JS client returns `{ data, error }` (it does not
throw), gates return `{ ok: false }`, and actions convert any unexpected underlying
failure into a generic friendly string (e.g. `strings.memberMgmtForbidden`). A grep
confirms only 2 `catch` blocks across all `app/**/actions.ts`. Therefore a global
"unhandled exception" hook alone would miss the majority of real failures — they are
swallowed into friendly messages today.

**Decision**: Dual-path capture.

1. **Explicit `logError()` helper** (`lib/errors/log.ts`) called at every point where
   code converts an unexpected underlying failure into a generic user-facing message —
   i.e. wherever a Supabase `error` object or a `result.ok === false` from a
   service-role call is currently discarded. This is the workhorse path (FR-001).
2. **`instrumentation.ts` → `onRequestError`** (Next.js 15+ convention, supported in
   Next 16; file does not exist yet — new at repo root) for genuinely uncaught server
   exceptions in Server Components, Server Actions, and route handling. Logged with
   severity `fatal`. This is the safety net that makes coverage comprehensive
   ("an error from *any* function gets logged").

**Rationale**: (1) alone misses real crashes; (2) alone misses ~all current failure
paths. Together they satisfy SC-001 without rearchitecting the result-object style.

**Alternatives considered**:
- *Wrap every Server Action in a higher-order `withErrorLogging()`*: invasive (touches
  every action signature), still misses `lib/` code paths that swallow errors, and
  catches nothing in actions that don't throw. Rejected.
- *Third-party error tracker (Sentry et al.)*: the requirement is explicitly an
  **in-database** error log under our control; adds a vendor, env vars, and client
  bundle weight. Rejected.
- *Only `onRequestError`*: misses swallowed Supabase errors (most failures). Rejected.

## R2. Write path to the database

**Decision**: A `SECURITY DEFINER` RPC `public.log_error(...)`, mirroring the existing
`log_admin_auth_event` pattern (migration `0002`): function owned by the migration role,
`revoke all … from public`, `grant execute … to anon, authenticated`. The `error_logs`
table gets **no INSERT/UPDATE/DELETE policies at all** — the RPC is the only write path
from request code, and immutability (FR-008) falls out structurally.

**Identity is derived inside the RPC, never trusted from parameters**: `user_id` from
`auth.uid()`, `user_role` / `tenant_id` from `auth.jwt() -> 'app_metadata'`. A caller
cannot spoof another user into a log entry; an unauthenticated caller yields NULLs
(recorded as anonymous, FR-003).

**Rationale**: matches the established audit-write pattern in this codebase; request
code never needs the service-role key; tamper-proof identity for free.

**Alternatives considered**:
- *Anon INSERT policy on the table*: opens a direct write surface and trusts
  client-supplied identity columns. Rejected.
- *Service-role client for writes*: forbidden in request/client code by CLAUDE.md and
  the established privilege model. Rejected.

## R3. Supabase client inside `onRequestError`

**Finding**: `onRequestError` runs outside a React request context — `cookies()` is not
available, so the cookie-bound `lib/supabase/server.ts` client cannot be used.

**Decision**: a bare `@supabase/supabase-js` anon client (URL + anon key,
`persistSession: false`) created lazily inside instrumentation. The RPC needs no JWT;
the entry is recorded as anonymous with severity `fatal` and the failing route path as
context. Surface is derived from the request pathname (`/admin/**` → `admin`,
`/student/**` → `student`, else `system`).

**Alternatives considered**: parsing the session cookie manually from
`request.headers` to recover the user — fragile, duplicates `@supabase/ssr` internals,
and the uncaught-crash path rarely needs per-user attribution. Rejected as not worth it.

## R4. Awaited vs. fire-and-forget log writes

**Decision**: `logError()` **awaits** the RPC, wrapped in its own `try/catch` whose
catch only `console.error`s (FR-006 / SC-005). It is called exclusively on failure
paths, so the success path cost is zero (SC-003).

**Rationale**: on Vercel the function instance may be frozen as soon as the response is
sent — a floating (`void`) promise is silently dropped, which would make SC-001
unverifiable in production. One small awaited RPC on an already-failed request is an
acceptable latency trade.

**Alternatives considered**: `void logError(...)` fire-and-forget (unreliable on
serverless, see above); `waitUntil` (not exposed for Server Actions). Rejected.

## R5. Redaction strategy (FR-005, SC-004)

**Decision**: allow-list first, deny-list as defense in depth, both in a pure,
unit-testable serializer (`lib/errors/serialize.ts`):

- Context is **constructed, never dumped**: callers pass a small explicit object
  (operation inputs they choose, e.g. `{ email }` for a member-create failure). Raw
  `FormData`, request bodies, headers, cookies, and `File` objects are never accepted
  by the API (the TS types take `Record<string, string | number | boolean | null>`).
- The serializer additionally **drops any key** matching a deny pattern
  (`/password|token|secret|cookie|authorization|api[_-]?key/i`) and truncates values.
- Stack traces and messages pass through as-is (they originate from our code, not user
  secrets) but are truncated (R6).

**Rationale**: an allow-list of caller-chosen scalars makes "a password can't get in"
the default; the deny-list catches a careless future call site; both are deterministic
pure functions testable per SC-004 (inject secrets → assert absence).

**Alternatives considered**: logging full request payloads with global scrubbing —
larger leak surface, scrubbing regexes are perpetually incomplete. Rejected.

## R6. Truncation bounds (FR-010)

**Decision**: `operation` ≤ 200 chars, `message` ≤ 2,000, `stack` ≤ 8,000, serialized
`context` JSON ≤ 4,000. Enforced **twice**: in the TS serializer (keeps payloads small)
and via `left()` inside the RPC (server-side authority, mirrors the bucket-limit
precedent from feature 008: client checks are UX, the server enforces).

## R7. Retention (FR-009)

**Decision**: a daily `pg_cron` job created in the migration
(`create extension if not exists pg_cron`) running
`delete from public.error_logs where occurred_at < now() - interval '90 days'`.
`pg_cron` is available on Supabase projects. If the extension cannot be enabled on a
given environment, the fallback is the same DELETE statement run manually/on a
schedule from the Supabase dashboard — documented in `quickstart.md`. App behavior does
not depend on the purge.

**Alternatives considered**: app-side opportunistic deletes on admin page load (adds
write load to a read path, unreliable timing); Edge Function on a schedule (new
deployment surface for one SQL statement). Rejected.

## R8. Client-side crash reporting (US3, FR-012)

**Decision**: a `reportClientError` **Server Action** (`app/actions.ts`, new file —
there are deliberately no API route handlers in this architecture), called best-effort
from the existing `error.tsx` components in a `useEffect`. The action sanitizes via the
same serializer, calls the same RPC (identity again derived from the JWT server-side),
and swallows its own failures. The error screen's retry UX is unaffected if the report
never sends (offline/blocked).

**Rationale**: stays inside the "no API routes, all mutations are Server Actions" rule;
reuses the entire server pipeline. Flooding risk is bounded by truncation limits and
small row size; rate limiting is out of scope (noted in spec assumptions, can layer on
the existing Upstash infra later if needed).

## R9. Admin viewing surface (US2, FR-011)

**Decision**: RSC-first pages, mirroring the members pattern:
- `/admin/errors` — newest-first list, paginated **50/page** via `?page=` searchParam,
  rendered as a contained-horizontal-scroll table (the documented `AdminTable` mobile
  strategy: `overflow-x-auto`, `min-w`, page/body never scrolls sideways).
- `/admin/errors/[id]` — full detail (message, stack in a `<pre>` with contained
  scroll, context, user, environment), since stack traces cannot live in a table row.
- "Errors" entry added to `lib/adminNav.tsx` (single source of truth for admin nav).
- Reads use the cookie-bound server client; RLS (`is_admin()` SELECT policy) is the
  non-bypassable boundary; the page additionally self-gates like other admin pages.

**Alternatives considered**: expandable `<details>` rows inside the table (breaks table
semantics and the contained-scroll strategy); a richer filter/search UI (out of scope
per spec assumptions). Rejected.

## R10. Severity & environment values

**Decision**: `severity ∈ {warning, error, fatal}`, default `error`; `fatal` is used by
`onRequestError` (uncaught crash), `error` by handled-but-unexpected failures,
`warning` reserved for degraded-but-recovered situations (e.g. invite send failed after
the member row was created — today's `inviteFailed: true` path). `environment` is
`process.env.VERCEL_ENV ?? process.env.NODE_ENV` captured at write time.
