# Phase 1 Contracts: Admin Authentication & Account Separation

**Feature**: `002-admin-auth` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

The interfaces this feature exposes: the **admin sign-in Server Action**, the **route
protection** behavior, the **data-access (RLS) contract**, and the **configuration**
surface. These are the contracts `/speckit-tasks` and the tests bind to.

---

## C1 — Admin sign-in Server Action

**Identifier**: `signInAdmin(prevState, formData)` — a Server Action bound to the admin
login `<form>` (replaces the current static `action="/admin/dashboard"`).

**Input** (`FormData`):

| Field | Required | Notes |
|-------|----------|-------|
| `email` | yes | trimmed, lower-cased server-side |
| `password` | yes | never logged, never echoed |

**Behavior (decision table)**:

| Condition | Result | User-visible message | Audit `outcome/reason` | Session |
|-----------|--------|----------------------|------------------------|---------|
| `email` or `password` empty | reject, **no** auth call | "Email and password are required." (field-level) | — | none |
| credentials invalid (wrong password / unknown email) | reject | generic: "Invalid credentials or insufficient access." | `denied/bad_credentials` | none |
| credentials valid **but** role ≠ `admin` | sign out immediately, reject | **same** generic message | `denied/not_admin` | none |
| credentials valid **and** role = `admin` | `redirect('/admin/dashboard')` | — | `success/ok` | admin session set (httpOnly cookies) |

**Contract guarantees**:

- The three denial branches are **indistinguishable** to the caller (FR-004, SC-006).
- The role check is **server-side** and happens before any redirect (Principle VI).
- Returns a serializable `{ error?: string }` state for the failed cases; never returns
  tokens or role data to the client.

**Pure helper (unit-testable)**:

```
assertAdminSession(session): { ok: true } | { ok: false; reason: 'not_admin' }
// ok only when session.user.app_metadata.role === 'admin'
```

## C2 — Route protection (middleware)

**Surface**: `proxy.ts` (Next 16 `proxy` convention, replaces deprecated `middleware`) matching `/admin/dashboard` (and future `/admin/*` protected
routes; the `/admin` sign-in page itself is public).

| Request state | Outcome |
|---------------|---------|
| valid admin session | refresh tokens, allow |
| no session / non-admin session | `redirect('/admin')` (sign-in) |
| expired access token, valid refresh | refreshed, allowed |

**Guarantee**: no admin-only route renders without a valid admin session (FR-010). Enforced
server-side at the edge, not in the client component.

## C3 — Data-access contract (RLS)

Callers reach data through Supabase clients; Postgres RLS is the authority. Contract per
caller identity:

| Caller (JWT role) | `admin_profiles` | `students` | `tenants` | `admin_auth_events` |
|-------------------|------------------|-----------|-----------|---------------------|
| `admin` (super-admin) | read all | read all tenants | read all | read all |
| student/anon (tenant T) | **none** | only `tenant_id = T` | only `id = T` | none |
| `service_role` (seed only) | full | full | full | insert |

**Guarantees**:

- SC-004: a `students` read never returns an admin row and an `admin_profiles` read never
  returns a student — the tables are disjoint populations.
- SC-005: a student/anon caller scoped to tenant A receives **zero** rows belonging to
  tenant B.

## C4 — Configuration contract (environment)

| Variable | Exposure | Used by |
|----------|----------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | all Supabase clients |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client + server | browser/server request clients (RLS-guarded) |
| `SUPABASE_SERVICE_ROLE_KEY` | **server only** | `scripts/seed-admin.ts` only |
| `SEED_ADMIN_PASSWORD` | **server only** | seed script (bootstrap admin password) |

**Guarantees**: the service-role key and seed password are never imported into client or
request-handling code; `.env.local` is git-ignored; `.env.example` lists names only.

## C5 — Seed contract

**Identifier**: `npm run seed:admin` → `scripts/seed-admin.ts`.

- Creates (if absent) `ahmedatif@meska.ai` with `app_metadata.role='admin'`, confirmed, and
  the matching `admin_profiles` row.
- **Idempotent**: re-running makes no duplicate and does not overwrite a rotated password.
- Requires migrations applied first (C-tables exist).

## C6 — UI copy contract (additions to `lib/strings.ts`)

New centralized strings (no inline literals, per constitution III / CLAUDE.md):

| Key | Value (English, LTR) |
|-----|----------------------|
| `adminEmailRequired` | "Email and password are required." |
| `adminAuthFailed` | "Invalid credentials or insufficient access." |
| `adminSigningIn` | "Signing in…" |
| `adminSignOutLabel` | "Sign out" |

Existing keys reused: `emailLabel`, `passwordLabel`, `signInLabel`, `protectedAccessNote`.
