# Quickstart: Redis Caching & Persistent Sessions

**Feature**: 007-redis-cache-sessions

## Prerequisites

- Existing app running (`npm run dev`), Supabase env vars set (see `CLAUDE.md` → Environment).
- An **Upstash Redis** database (free tier is fine). From the Upstash console, copy the
  **REST** URL and token.

## 1. Environment variables

Add to `.env.local` (server-only — **no** `NEXT_PUBLIC_` prefix):

```bash
UPSTASH_REDIS_REST_URL=https://<your-db>.upstash.io
UPSTASH_REDIS_REST_TOKEN=<your-rest-token>
```

> If these are **absent**, the app still runs exactly as today — the cache helper becomes a
> pass-through (graceful degradation). Caching is purely additive.

Confirm the **persistent-session window**: in the Supabase dashboard → Authentication →
Sessions, ensure the refresh-token / session timeout matches the intended window (~30 days)
so the persistent cookie and the server agree.

## 2. Install the dependency

```bash
npm install @upstash/redis
```

## 3. Verify persistent sessions (Phase 1)

1. Sign in as an admin (and separately as a student).
2. **Fully close** the browser/tab, then reopen the app URL.
3. Expected: you land on your dashboard **already signed in** — no sign-in prompt.
4. Sign out, close, reopen → you are correctly sent back to sign-in.
5. (Dev check) In DevTools → Application → Cookies, the `sb-*` auth cookies show a future
   **Expires / Max-Age** (not "Session").

## 4. Verify caching (Phase 2)

1. Open the admin **Instructors** (or **Members**) list — first load reads from Supabase.
2. Reload the same page — it should load faster (served from Redis). Data is identical.
3. Add or remove a record via the UI, then reload the list → the change appears immediately
   (write-through invalidation), confirming no stale data.
4. **Wave isolation**: as a student, your dashboard shows only your own data; it is cached
   under a per-user/per-wave key, so no other wave's data can ever be served to you.
5. **Outage drill**: temporarily set a bad `UPSTASH_REDIS_REST_TOKEN` (or unset the vars)
   and reload — pages still render from Supabase with no error.

## 5. Run the checks

```bash
npm run build      # TS strict + compile
npm run lint       # clean
npm test           # full suite incl. cross-wave cache-isolation + cookie-persistence + degradation tests
```

All must pass — this feature must not regress any existing behavior (FR-012).

## Notes / gotchas

- The cache stores only **already-authorized, non-secret** read results; it holds no
  passwords or tokens and is safe to flush at any time (e.g. `redis-cli FLUSHDB` on the
  Upstash console) — the next page load simply repopulates it.
- Never import `lib/cache/redis.ts` into a Client Component (it is server-only).
- Cache keys come **only** from `lib/cache/keys.ts`; do not hand-write key strings, so the
  audience-isolation rule stays in one place.
