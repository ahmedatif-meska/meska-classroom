# Data Model: Redis Caching & Persistent Sessions

**Feature**: 007-redis-cache-sessions | **Date**: 2026-06-07

This feature adds **no Postgres schema changes**. Supabase remains the source of truth.
The entities below are conceptual: the shape of cache entries and the persisted session.

---

## Entity: Cache Entry (Upstash Redis)

A stored copy of an already-authorized read result. Ephemeral — safe to flush anytime.

| Field | Type | Notes |
|-------|------|-------|
| key | string | **Audience-scoped** (see rule below). The only authorization-relevant field. |
| value | JSON | The cached read result (same shape the page already renders). |
| ttl | seconds | Default **60s** safety net; write-through invalidation is the primary freshness mechanism. |

### Cache-key audience rule (Principle VI — NON-NEGOTIABLE)

A key MUST encode every dimension that determines who may see the value:

```
admin (global, not wave-scoped):   admin:<resource>:list
  e.g.  admin:instructors:list
        admin:members:list
        admin:waves:list

student (tenant + user scoped):    student:<tenantId>:<userId>:<resource>
  e.g.  student:<tenantId>:<userId>:profile
```

- A cached entry is served **only** to a request whose computed key is byte-identical.
- A miss falls through to the existing gated/RLS source read (cache never bypasses auth).
- Therefore Wave A's `student:A:…` key can never match a Wave B request → no cross-wave leak.

### Known cached reads

| Resource | Source read (existing) | Key | Invalidated by |
|----------|------------------------|-----|----------------|
| Instructor list | `app/admin/instructors/page.tsx` | `admin:instructors:list` | instructor create/update/remove actions |
| Member roster | `app/admin/members/page.tsx` | `admin:members:list` | `createMember`, `bulkCreateMembers`, `resendMemberInvite`, `removeMember` |
| Wave list | `app/admin/members/page.tsx` | `admin:waves:list` | tenant changes (future) |
| Student profile (QR) | `app/student/dashboard/page.tsx` | `student:{tenantId}:{userId}:profile` | `removeMember` (that user); member edits |

### State / lifecycle

`absent → populated (on first read) → invalidated (on related write) → repopulated (next read)`;
TTL expiry also returns an entry to `absent`. No persistent state; an outage/flush only
costs a recompute from Supabase.

---

## Entity: Persisted Session (Supabase Auth, cookie-bound)

Unchanged model — Supabase stateless JWT + refresh token in cookies. This feature changes
only **cookie persistence**, not the session shape.

| Aspect | Value | Notes |
|--------|-------|-------|
| Identity | Supabase `auth.users` + JWT `app_metadata` (`role`, `tenant_id`) | Source of truth for authz; unchanged. |
| Access token | short-lived JWT (~1h) | Refreshed by `proxy.ts` on each protected request. |
| Refresh token | long-lived, in a **persistent** cookie | **The change**: cookie carries a future `Max-Age`/`Expires` so it survives app close. |
| Persistent window | ~30 days (rolling) | Aligns cookie lifetime with Supabase project refresh-token lifetime. |
| Sign-out | clears auth cookies | Next reopen requires fresh sign-in. |
| Revocation/expiry | account removal or lifetime end | `getUser()` fails → denied on reopen; session never outlives the account. |

No Redis or other store backs the session; there is no new session table or record.
