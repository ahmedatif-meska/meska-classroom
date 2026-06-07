# Research: Redis Caching & Persistent Sessions

**Feature**: 007-redis-cache-sessions | **Date**: 2026-06-07

This document resolves the open technical questions from `spec.md` and records the
decisions that shape the plan. Two independent workstreams: **(A) persistent sessions**
(fix the re-login-on-reopen pain) and **(B) a Redis cache** for read-heavy pages.

---

## R1 — Root cause of "I have to log in again after closing the app"

**Decision**: Treat this as an **auth-cookie persistence** problem in the existing
Supabase session, fixed natively in `@supabase/ssr` cookie options — **not** by adding a
Redis-backed session store.

**Findings from the code**:

- Sign-in runs in the `signInAdmin` / student Server Actions via the **cookie-bound
  server client** (`lib/supabase/server.ts`), which writes Supabase's `sb-*` auth cookies
  using `cookieStore.set(name, value, options)`.
- `proxy.ts` calls `supabase.auth.getUser()` on every protected request, which validates
  and **refreshes** the session, re-writing rotated tokens onto the response.
- The session is a **stateless Supabase JWT** (access token ~1h) plus a long-lived
  **refresh token**. Staying logged in across an app close depends entirely on the
  **refresh-token cookie surviving the browser being closed** — i.e. it must be a
  *persistent* cookie (with `Max-Age`/`Expires`), not a *session* cookie.
- If the auth cookies are written without an explicit persistent `maxAge`/`expires`, the
  browser drops them on close, so the next open has no refresh token → forced re-login.
  This matches the reported symptom exactly.

**Fix direction**: Ensure the Supabase auth cookies are persistent by passing explicit,
long-lived cookie options (`maxAge`, `sameSite: 'lax'`, `secure`, `httpOnly`, `path: '/'`)
in the `setAll` adapters of **both** the server client (`lib/supabase/server.ts`) and the
`proxy.ts` client, and confirm the Supabase project's refresh-token lifetime matches the
30-day persistent window. This is server-side, surgical, and does not change the auth
model. Verify with a test that asserts the auth cookies carry a future `Max-Age`/`Expires`.

**Why not a Redis session store**: Supabase auth is stateless-JWT. A server-side Redis
session would be *redundant* with the refresh-token mechanism and could not fix the
symptom on its own — the **browser still needs a persistent token** to be recognized on
reopen. Adding one would duplicate identity state, create a second place for sessions to
drift out of sync with `auth.users` (a wave-isolation and revocation hazard), and add
infra for no benefit. Recorded as a rejected alternative (see plan Complexity Tracking).

**Alternatives considered**:
- *Redis/Upstash session store keyed by an opaque cookie* — rejected (above): redundant
  with Supabase refresh tokens, adds revocation/sync risk, still needs a persistent cookie.
- *Longer access-token TTL* — rejected: weakens security (longer-lived bearer token) and
  doesn't address cookie persistence, which is the actual cause.

---

## R2 — Redis provider & client for Vercel serverless

**Decision**: **Upstash Redis** via the **`@upstash/redis`** HTTP client (user-selected).

**Rationale**:
- The app deploys on **Vercel serverless** (no long-lived process / connection pool). A
  TCP Redis client (`ioredis`) leaks connections across serverless invocations; Upstash's
  HTTP/REST client is stateless per request and designed for this model.
- Configured purely with env vars (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
  — server-only, no `NEXT_PUBLIC_` prefix, matching the existing service-role-key handling.
- Works from Server Components and Server Actions (the only places we cache).

**Alternatives considered**:
- *Vercel KV* — viable (also Redis-compatible) but the user explicitly chose Upstash.
- *`ioredis` against a self-hosted Redis* — rejected for Vercel serverless (connection
  churn, cold-start latency, no pooling).

---

## R3 — What to cache, and the cache-key isolation rule (Principle VI)

**Decision**: Cache **read-heavy server-rendered reads** behind keys that **encode the
full audience** of the data. The non-negotiable rule:

> A cache key MUST include every dimension that determines who is allowed to see the
> value — at minimum the **role**, and for tenant-scoped data the **`tenant_id`** (and
> `user_id` where the read is per-user). A cached entry is only ever served to a request
> whose audience exactly matches its key.

**Read paths and their keys** (from the code):

| Read | Where | Audience | Key shape | Isolation |
|------|-------|----------|-----------|-----------|
| Instructor list | `app/admin/instructors/page.tsx` | admin (global; not wave-scoped) | `admin:instructors:list` | admin-gated; global |
| Member roster + waves | `app/admin/members/page.tsx` | admin (sees all tenants by design) | `admin:members:list`, `admin:waves:list` | admin-gated; global |
| Student's own row (for QR) | `app/student/dashboard/page.tsx` | one student | `student:{tenantId}:{userId}:profile` | per-tenant + per-user |

**Key facts that make this safe**:
- Admin pages already read across all tenants *because the admin role is entitled to*
  (RLS `is_admin()`); their cache keys are admin-scoped, never served to students.
- The only tenant-scoped cached read (student dashboard) carries `tenant_id` **and**
  `user_id` in the key, so Wave A can never receive Wave B's entry.
- The cache layer sits **after** the existing auth gate / RLS read on a miss — it never
  bypasses authorization (FR-010). On a hit, the key match *is* the authorization scope.

**Rationale**: This keeps Principle VI intact by construction and makes the cross-wave
denial directly testable (populate as Wave A, request as Wave B, assert no hit).

**Alternatives considered**:
- *Cache the rendered HTML / whole RSC payload* — rejected: coarser, harder to invalidate
  precisely, higher cross-audience risk.
- *Cache only non-tenant data (instructors/waves)* — safest, but the user asked for both
  admin and student caching, so we include the student read with strict per-user keys.

---

## R4 — Invalidation strategy (bounded staleness, FR-008)

**Decision**: **Write-through invalidation** — every Server Action that mutates a cached
entity deletes (or rewrites) the affected key(s) immediately after the DB write, alongside
the existing `revalidatePath` calls. A short **TTL (default 60s)** is a safety net for any
missed invalidation, satisfying the ≤60s staleness window (SC-004).

**Touch points** (existing mutating actions, from the code):
- Members: `createMember`, `bulkCreateMembers`, `resendMemberInvite`, `removeMember`
  (`app/admin/members/actions.ts`) → invalidate `admin:members:list` (+ the affected
  student's `student:*` profile key on removal).
- Instructors: create/update/remove (`app/admin/instructors/actions.ts`) → invalidate
  `admin:instructors:list`.
- Waves/tenants change (if/when added) → invalidate `admin:waves:list`.

**Rationale**: The actions already call `revalidatePath` on the same events, so cache
invalidation slots into a proven choke point — no new event plumbing. TTL bounds the blast
radius of any human error.

**Alternatives considered**:
- *TTL-only (no write-through)* — rejected: up to 60s of stale data after every edit is a
  visibly worse admin experience and risks showing removed members.
- *Pub/sub invalidation* — rejected: over-engineered for a single-region, low-write app.

---

## R5 — Graceful degradation (FR-011)

**Decision**: Wrap every cache read/write in a guard that, on **any** Redis error,
timeout, or missing config, **falls back to the source-of-truth read** and continues. A
cache outage MUST be invisible to users and MUST NOT throw. A small per-call timeout
(e.g. 200ms) prevents a slow Redis from regressing LCP/INP.

**Rationale**: Constitution Principle V (performance/resilience) and FR-011. The cache is
an optimization, never a dependency on the critical path. If `@upstash/redis` env vars are
absent (e.g. local dev without Upstash), the helper is a no-op pass-through, so the app
runs exactly as today.

**Alternatives considered**:
- *Hard dependency on Redis* — rejected: a cache outage would take down the app, the
  opposite of "without destroying any part."

---

## R6 — Testing approach (Principle II, NON-NEGOTIABLE)

**Decision**: Unit-test the pure cache-key/policy logic and the session-cookie options in
isolation (no live Redis); mock the Upstash client for the cache helper; add the cross-wave
denial test for the cached student read; add a graceful-degradation test (Redis throws →
source read still returns).

- Keep a **pure, dependency-free `lib/cache/keys.ts`** (key builders + audience rules) so
  isolation guarantees are deterministically unit-testable, mirroring `lib/auth/*`.
- Mock `@upstash/redis` the way `@supabase/*` is mocked in existing tests.
- Session: a `proxy`/cookie test asserting auth cookies are written with a persistent,
  future expiry.

**Rationale**: Matches the established test patterns in `tests/` and satisfies the
non-negotiable cross-wave-denial requirement for the one tenant-scoped cached path.
