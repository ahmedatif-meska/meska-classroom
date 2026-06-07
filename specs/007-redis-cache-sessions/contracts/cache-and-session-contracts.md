# Contracts: Cache & Session Helpers

**Feature**: 007-redis-cache-sessions | **Date**: 2026-06-07

Internal contracts (this app has no external/public API). These define the new `lib/cache/`
helpers and the session-cookie behavior so implementation and tests agree.

---

## `lib/cache/keys.ts` (pure — no I/O, unit-tested)

Single source of truth for audience-scoped cache keys. Mirrors the `lib/auth/*` pattern
(pure, Supabase-free, deterministically testable).

```ts
// Admin (global, not wave-scoped) keys
export function adminListKey(resource: "instructors" | "members" | "waves"): string;
// → `admin:${resource}:list`

// Student (tenant + user scoped) key — BOTH ids are mandatory
export function studentKey(
  tenantId: string,
  userId: string,
  resource: "profile"
): string;
// → `student:${tenantId}:${userId}:${resource}`
```

**Contract / invariants**:
- `studentKey` MUST throw (or return a sentinel that the caller treats as "do not cache")
  if `tenantId` or `userId` is missing/empty — never produce a key that omits an audience
  dimension (Principle VI).
- Keys are stable and collision-free across resources and audiences.
- No admin key is ever derivable from student inputs or vice-versa.

---

## `lib/cache/redis.ts` (guarded I/O — Upstash, mocked in tests)

```ts
// Read-through cache. On hit → return parsed value. On miss → run loader,
// store under key with ttl, return its result. On ANY redis error/timeout or
// missing config → run loader and return WITHOUT throwing (graceful fallback).
export async function cached<T>(
  key: string,
  loader: () => Promise<T>,
  opts?: { ttlSeconds?: number } // default 60
): Promise<T>;

// Best-effort invalidation. Deletes key(s). Never throws; a failure is logged
// and ignored (the TTL is the safety net).
export async function invalidate(...keys: string[]): Promise<void>;
```

**Contract / invariants**:
- `cached()` MUST return loader-parity: a hit equals what the loader would have returned
  (subject to the staleness window).
- `cached()` and `invalidate()` MUST NOT throw under any Redis failure, timeout, or absent
  `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` — they degrade to source reads /
  no-ops (FR-011).
- A per-call timeout (≤ 200ms) bounds critical-path latency (Principle V).
- The Upstash client is **server-only** (no `NEXT_PUBLIC_`); never imported into client code.
- `cached()` runs only **after** the page/action's existing auth gate or inside an
  RLS-bound read — it never replaces authorization (FR-010).

### Usage shape (read path)

```ts
const instructors = await cached(adminListKey("instructors"), () =>
  supabase.from("instructors").select(...).order(...).then(r => r.data ?? [])
);
```

### Usage shape (invalidation, in a mutating action)

```ts
// after the DB write + existing revalidatePath(...)
await invalidate(adminListKey("members"));
```

---

## Session cookie contract (`lib/supabase/server.ts` + `proxy.ts`)

The `setAll` cookie adapters MUST write Supabase auth cookies as **persistent** cookies:

| Option | Value | Why |
|--------|-------|-----|
| `maxAge` / `expires` | persistent, future (≈ refresh-token lifetime, ~30 days) | survive app close → no re-login (FR-001) |
| `httpOnly` | `true` | not readable by JS |
| `secure` | `true` (prod) | HTTPS only |
| `sameSite` | `lax` | standard for auth nav |
| `path` | `/` | available app-wide |

**Contract / invariants**:
- Persisted login MUST apply to both admin and student sessions (FR-002).
- Explicit sign-out MUST clear these cookies (FR-003); reopen then requires sign-in.
- A session past its lifetime or for a removed account MUST be denied on reopen (FR-005) —
  enforced by the existing `getUser()` validation in `proxy.ts`; this change does not
  weaken it.
- This is the only session change: **no** server-side / Redis session store is introduced.
