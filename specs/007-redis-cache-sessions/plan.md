# Implementation Plan: Redis Caching & Persistent Sessions

**Branch**: `007-redis-cache-sessions` | **Date**: 2026-06-07 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/007-redis-cache-sessions/spec.md`

## Summary

Two independent improvements to the existing Supabase-backed Next.js app:

1. **Persistent sessions (P1)** — fix "I have to log in again after closing the app" by
   making the Supabase auth cookies persistent (a server-side cookie-options fix in the
   `@supabase/ssr` adapters), so the refresh token survives a browser close and the user
   stays signed in for the configured window. **No Redis is involved in sessions.**
2. **Redis cache (P2)** — add an **Upstash Redis** cache layer in front of read-heavy
   server reads (admin instructor/member lists, student dashboard), with **audience-scoped
   cache keys** that preserve wave isolation, **write-through invalidation** on the
   existing mutating Server Actions, a **60s TTL** safety net, and **graceful degradation**
   so a Redis outage is invisible. See [research.md](./research.md) for decisions.

The work is additive and surgical: no route, panel, auth-model, or RLS change. Existing
tests must keep passing (FR-012).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19 (React Compiler on), Next.js 16 App Router

**Primary Dependencies**: existing — `@supabase/ssr`, `@supabase/supabase-js`; **new** —
`@upstash/redis` (HTTP client, server-only)

**Storage**: Supabase Postgres = source of truth (unchanged). Upstash Redis = ephemeral
cache only (no source-of-truth data; safe to flush at any time)

**Testing**: Vitest + React Testing Library (jsdom); Upstash client mocked, no live Redis

**Target Platform**: Vercel serverless (Node) + supported browsers (constitution)

**Project Type**: Web application (Next.js App Router, RSC-first)

**Performance Goals**: repeat load of a cached list ≥50% faster than first load (SC-002);
no regression to LCP < 2.5s / CLS < 0.1 / INP < 200ms on mid-tier Android / Slow-4G

**Constraints**: wave isolation preserved (per-audience keys); cache staleness ≤ 60s;
persistent-session window ~30 days; Redis call timeout ≤ 200ms with source fallback;
cache outage MUST NOT error

**Scale/Scope**: small write volume, read-heavy; admin ops team + per-wave students; 3
cached read paths, ~4 mutating actions wired for invalidation

**New environment variables**: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`
(server-only, no `NEXT_PUBLIC_` prefix). Absent ⇒ cache helper is a no-op pass-through.

## Constitution Check

*GATE: must pass before Phase 0. Re-checked after design (below).*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, `npm run build`/`lint` clean; reuse via `lib/`; no manual memoization | PASS — pure helpers in `lib/cache/`, `lib/supabase/` edits only |
| II — Testing (NON-NEGOTIABLE) | deterministic tests ship; cross-wave denial tested; bug-fix test | PASS — see per-phase Test Scenarios; cross-wave test for student cache; cookie-persistence test |
| III — UX Consistency | no new accent colors; loading/empty/error states intact | PASS — no UI surface change; caching is invisible |
| IV — Mobile/Accessible | 320→desktop, drawer, focus, WCAG AA | PASS — no UI change |
| V — Performance & Resilience | RSC-first, bounded reads, no CWV regression, resilient | PASS — cache improves reads; timeout+fallback protects critical path; budget stated above |
| VI — Wave Isolation (NON-NEGOTIABLE) | server-side wave filtering; cross-wave denial tested; admin gating | PASS — audience-scoped keys (R3); cache sits behind existing gates/RLS; denial tested |
| VII — Artifact Structure (NON-NEGOTIABLE) | phase → story → criteria/tests; walkthrough per phase | PASS — structure below; walkthroughs at implement time |

**Backend-dependency justification (Technology & Platform Constraints)**: Adding Upstash
Redis is a new backend dependency and MUST be justified with the rejected simpler
alternative — see **Complexity Tracking**.

**Result**: PASS. No unjustified violations. Proceed.

## Project Structure

### Documentation (this feature)

```text
specs/007-redis-cache-sessions/
├── plan.md              # This file
├── spec.md              # Feature spec
├── research.md          # Phase 0 decisions
├── data-model.md        # Conceptual entities (cache entry, persisted session)
├── quickstart.md        # Env setup + how to verify
├── contracts/
│   └── cache-and-session-contracts.md   # Helper + key contracts
├── checklists/requirements.md
├── tasks.md             # /speckit-tasks output (not created here)
└── walkthrough.md       # /speckit-implement output (per phase)
```

### Source Code (repository root)

```text
lib/
├── cache/
│   ├── keys.ts          # NEW — pure audience-scoped key builders + isolation rule (unit-tested)
│   └── redis.ts         # NEW — Upstash client + cached()/invalidate() guarded helpers (graceful fallback)
├── supabase/
│   ├── server.ts        # EDIT — persistent cookie options in setAll
│   └── client.ts        # (unchanged)
proxy.ts                 # EDIT — persistent cookie options in setAll (session refresh path)

app/admin/instructors/
├── page.tsx             # EDIT — wrap instructor read in cached()
└── actions.ts           # EDIT — invalidate admin:instructors:list on mutate
app/admin/members/
├── page.tsx             # EDIT — wrap member/wave reads in cached()
└── actions.ts           # EDIT — invalidate admin:members:list (+ student key on remove)
app/student/dashboard/
└── page.tsx             # EDIT — wrap own-profile read in cached() with per-user/tenant key

tests/
├── lib/cache/keys.test.ts          # NEW — key audience/isolation rules
├── lib/cache/redis.test.ts         # NEW — hit/miss + graceful-degradation (mock Upstash)
├── integration/cacheIsolation.test.ts  # NEW — cross-wave denial for cached student read
└── session/cookiePersistence.test.ts   # NEW — auth cookies written persistent
```

**Structure Decision**: Single Next.js app (existing). New code is isolated in
`lib/cache/`; everything else is small, surgical edits to existing read paths and
mutating actions. The pure key logic lives apart from the I/O client so it is
deterministically unit-testable (mirrors `lib/auth/*`).

## Implementation Phases

### Phase 1 — Persistent sessions (fix re-login)

#### User Story 1.1: As a returning admin or student, I want to stay signed in after I close and reopen the app, so that I don't have to log in every time.

- Description: Make the Supabase auth cookies persistent so the refresh token survives a
  browser close; the user is recognized on reopen within the session window. Verify and,
  if needed, align the Supabase project refresh-token lifetime to the 30-day window.
  Explicit sign-out still clears the session; expired/revoked sessions still require login.

#### Acceptance Criteria (for the phase)

- [ ] Auth cookies set on sign-in (server client) and on refresh (`proxy.ts`) are written
      with a persistent, future `Max-Age`/`Expires` — not browser-session cookies.
- [ ] A signed-in admin reopening the app within the window lands authenticated, no prompt.
- [ ] A signed-in student reopening the app within the window lands authenticated.
- [ ] Explicit sign-out clears the session; the next reopen requires sign-in.
- [ ] A session past its max lifetime, or whose account was removed, is denied on reopen.
- [ ] No regression: all existing auth/role/RLS tests still pass (FR-012).

#### Test Scenarios (for the phase)

1. **Given** an admin signs in, **When** the auth cookies are written, **Then** they carry
   a persistent future expiry (assert `Max-Age`/`Expires` present and far future).
2. **Given** a signed-in user closes the app, **When** they reopen within the window,
   **Then** `proxy.ts` resolves a user and they are not redirected to sign-in.
3. **Given** a signed-in user, **When** they sign out and reopen, **Then** they are
   redirected to the sign-in page (no resurrected session).
4. **Given** a member whose account was removed by an admin, **When** they reopen,
   **Then** access is denied and they must sign in (session does not outlive the account).

---

### Phase 2 — Redis cache for read-heavy pages (wave-safe)

#### User Story 2.1: As a returning admin, I want instructor and member lists to load faster on repeat visits, so that day-to-day admin work feels snappy.

- Description: Add `lib/cache/redis.ts` (`cached()` read-through + `invalidate()`, both
  guarded with timeout + graceful fallback) and `lib/cache/keys.ts` (audience-scoped key
  builders). Wrap the instructor and member/wave reads in `cached()`; invalidate the
  matching keys from the existing mutating actions.

#### User Story 2.2: As a student, I want my dashboard to load faster, so that opening it repeatedly is quick — while still only ever seeing my own wave's data.

- Description: Cache the student's own-profile read under a `student:{tenantId}:{userId}`
  key so a cache hit is, by construction, scoped to that one student; never served across
  waves or users.

#### User Story 2.3: As the Meska ops lead, I want the cache to never leak across waves, never serve stale data after an edit, and never break the app if Redis is down, so that performance is added without sacrificing trust or uptime.

- Description: Enforce the audience-key isolation rule (keys encode role + tenant + user);
  write-through invalidation on every mutating action plus a 60s TTL; and a guarded client
  that falls back to the source read on any Redis error/missing config.

#### Acceptance Criteria (for the phase)

- [ ] A cached read returns data identical to a direct source read (parity).
- [ ] Repeat load of a cached list is measurably faster than the first (uncached) load.
- [ ] Cache keys encode the audience: admin keys are admin-scoped; the student key includes
      `tenant_id` **and** `user_id`. No key is shared across waves or roles.
- [ ] A Wave B user is never served a Wave A cached entry (cross-wave denial). **(VI)**
- [ ] After create/edit/remove via a Server Action, the affected key is invalidated, so the
      change shows on the next load (≤ 60s staleness via TTL safety net).
- [ ] With Redis unavailable or unconfigured, every page still renders from the source with
      no user-facing error (graceful degradation).
- [ ] The cache layer never bypasses auth: on a miss, the existing gate/RLS read runs;
      a hit only ever matches the requester's audience key. **(VI / FR-010)**
- [ ] `npm run build`/`lint` clean; existing tests still pass (FR-012). **(I)**

#### Test Scenarios (for the phase)

1. **Given** an empty cache, **When** the instructor list is requested, **Then** it reads
   from Supabase, populates `admin:instructors:list`, and returns correct data (cold path).
2. **Given** a populated `admin:instructors:list`, **When** requested again, **Then** it is
   served from cache and equals the source result (hit parity).
3. **Given** Wave A's student profile is cached under `student:{A}:{userA}:profile`,
   **When** a Wave B user requests their dashboard, **Then** they get only `student:{B}:…`
   data and never Wave A's entry (cross-wave denial). **(VI)**
4. **Given** an admin removes a member, **When** the member list is next requested,
   **Then** the removed member is absent (key invalidated on `removeMember`).
5. **Given** Redis throws on every call (outage), **When** any cached page is requested,
   **Then** it renders correctly from Supabase with no error surfaced (degradation).
6. **Given** the Upstash env vars are unset (local dev), **When** the app runs, **Then**
   `cached()` is a pass-through and behavior is identical to today.

## Complexity Tracking

> Backend-dependency and rejected-alternative justifications required by the constitution
> (Technology & Platform Constraints + Principle VI scope note on session management).

| Decision | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Add **Upstash Redis** as a cache backend | User explicitly requested Redis for performance; a shared cache survives across stateless serverless invocations (Vercel), which per-instance memory cannot | **Next.js native `'use cache'` / `unstable_cache` + `revalidateTag`** (no new infra) was the simpler option and is genuinely strong here; rejected because it is per-deployment/in-process (not a shared store) and the user specifically asked for Redis/Upstash. Recorded so the trade-off is explicit and reversible. |
| Cache **tenant-scoped** student data (not just global admin data) | User asked to cache "admin and student" | Caching only non-tenant data (instructors/waves) was safer; rejected per the user's ask. Mitigated by mandatory `tenant_id`+`user_id` in the key and the cross-wave denial test (Principle VI). |
| **No** Redis-backed session store (sessions stay Supabase-JWT) | Persistent login is achievable with a cookie-persistence fix; a server session store is redundant and risky | A Redis session store was the literal request, but it cannot fix the symptom alone (the browser still needs a persistent cookie), duplicates identity state, and risks revocation/wave drift. Documented in research R1; surfaced to the user for sign-off. |

**Session-management note (Principle VI scope)**: This feature specifies session
persistence — persistent auth cookies with a bounded max lifetime, explicit sign-out
clearing the session, and revocation/expiry denying reopened access. No PII is added to
the cache; the cache holds only already-authorized, non-secret read results and is safe to
flush at any time.
