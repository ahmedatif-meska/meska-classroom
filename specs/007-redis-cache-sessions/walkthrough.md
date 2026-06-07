# Walkthrough: Redis Caching & Persistent Sessions (007)

Covers the two implemented phases. A phase is not "done" until a reviewer follows its
golden-path verification end-to-end on desktop **and** mobile (Principle IV/VII).

## How to run

```bash
npm install                 # @upstash/redis is now a dependency
# .env.local — Supabase vars (as before) PLUS (optional) the cache backend:
#   UPSTASH_REDIS_REST_URL=...
#   UPSTASH_REDIS_REST_TOKEN=...
npm run dev                 # http://localhost:3000
```

- **Without** the two `UPSTASH_*` vars the app runs exactly as before — the cache helper
  is a no-op pass-through (graceful degradation). Add them to exercise caching.
- Checks: `npm test` · `npm run lint` · `npm run build` — all green.

---

## Phase 2 — Persistent sessions (US1)

**What changed**

- `lib/supabase/cookieOptions.ts` (NEW) — `withPersistentMaxAge()` adds a ~30-day
  `maxAge` to any auth cookie that lacks an explicit expiry, so the Supabase refresh
  token survives the app being closed. It leaves an explicit expiry untouched (notably
  sign-out's `maxAge: 0`).
- `lib/supabase/server.ts`, `proxy.ts` — apply it in the cookie `setAll` write paths.

**Golden-path verification**

1. Sign in as an admin at `/admin`. → Land on `/admin/dashboard`.
2. **Fully close** the browser, reopen `http://localhost:3000/admin/dashboard`. → You are
   still signed in; **no** sign-in prompt. (Repeat for a student at `/student`.)
3. DevTools → Application → Cookies: the `sb-*` cookies show a future **Expires/Max-Age**
   (not "Session").
4. Sign out (sidebar) → close → reopen. → You are correctly sent back to sign-in.
5. **Mobile** (responsive 390px / a phone): repeat steps 1–2; the sign-in card and
   dashboard render with no horizontal scroll and the session persists identically.

**Known gaps**

- T008 (manual): confirm the Supabase project's refresh-token/session lifetime is ≥ the
  30-day cookie window (Dashboard → Authentication → Sessions) so server and cookie agree.

---

## Phase 3 — Redis cache for read-heavy pages (US2.1 / US2.2 / US2.3)

**What changed**

- `lib/cache/keys.ts` (NEW) — audience-scoped key builders: `adminListKey(resource)` and
  `studentKey(tenantId, userId, resource)` (both ids mandatory — wave-isolation invariant).
- `lib/cache/redis.ts` (NEW) — `cached(key, loader, {ttlSeconds=60})` read-through and
  `invalidate(...keys)`, both guarded (≤200ms timeout, graceful fallback, no-op without env).
- Read paths wrapped: `app/admin/instructors/page.tsx`, `app/admin/members/page.tsx`
  (members + waves), `app/student/dashboard/page.tsx` (per-user/per-wave key).
- Write-through invalidation added to `app/admin/members/actions.ts`
  (`createMember`, `bulkCreateMembers`, `resendMemberInvite`, `removeMember` + the removed
  student's profile key) and `app/admin/instructors/actions.ts` (create/update/remove).

**Golden-path verification** (with `UPSTASH_*` set)

1. Open `/admin/instructors`. First load reads Supabase. Reload → faster, identical data.
2. Add an instructor → the list shows it immediately on return (invalidation), not after a
   delay. Remove it → it disappears immediately.
3. Open `/admin/members`; add/remove a member → the roster reflects it immediately.
4. Sign in as a student → `/student/dashboard` shows the QR; reload is fast and shows only
   that student's data.
5. **Wave isolation**: confirm (via `tests/integration/cacheIsolation.test.ts`) that a
   Wave B request never receives a Wave A cached entry — keys cannot collide.
6. **Outage drill**: set a bad `UPSTASH_REDIS_REST_TOKEN` (or unset both) → every page
   still renders from Supabase with no error.
7. **Mobile** (390px and a phone): the instructor/member tables use contained horizontal
   scroll (unchanged); caching is invisible and introduces no layout shift.

**Known gaps / notes**

- The cache stores only already-authorized, non-secret read results; safe to flush anytime.
- T025 (manual): run `quickstart.md` end-to-end against a real Upstash db.
- T026 (manual): confirm no Core Web Vitals regression on a mid-tier Android / Slow-4G
  (the ≤200ms cache timeout keeps Redis off the critical path).
