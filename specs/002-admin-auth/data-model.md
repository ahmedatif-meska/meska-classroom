# Phase 1 Data Model: Admin Authentication & Account Separation

**Feature**: `002-admin-auth` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

Derived from the spec's Key Entities and the research decisions (R2, R3, R6, R10). The
guiding rule: **administrators and students never share a table**, and tenant-scoped reads
are bounded by Row-Level Security (RLS).

## Schema overview

```
auth.users (Supabase-managed)            public.tenants
  id            uuid  PK                   id          uuid PK
  email         text  UNIQUE               name        text
  encrypted_password text  (bcrypt)        created_at  timestamptz
  app_metadata  jsonb  → { role: 'admin' }
  ...                                     public.students        (separate population)
        │ 1                                 id          uuid PK
        │                                   tenant_id   uuid FK → tenants.id
        │ 1                                 student_code text  (e.g. "STU-001")
        ▼                                   full_name   text
public.admin_profiles                       created_at  timestamptz
  id (=auth.users.id) uuid PK/FK
  email        text   (mirror, UNIQUE)    public.admin_auth_events  (minimal audit)
  display_name text                         id          bigint PK
  role         text   CHECK = 'admin'       email       text
  full_control boolean DEFAULT true         outcome     text CHECK IN ('success','denied')
  created_at   timestamptz                  reason      text  (category, never a password)
  updated_at   timestamptz                  created_at  timestamptz
```

## Entities

### `auth.users` (managed by Supabase Auth — not created by us)

The credential store. **Only administrators are provisioned here** in this feature.

| Field | Notes |
|-------|-------|
| `id` | uuid, primary key; referenced by `admin_profiles.id`. |
| `email` | unique; the admin's sign-in identity (`ahmedatif@meska.ai`). |
| `encrypted_password` | bcrypt hash, managed by GoTrue. App never reads/writes it. |
| `app_metadata.role` | `'admin'` — set server-side at seed time; tamper-proof; flows into the JWT. |
| `email_confirmed_at` | set by seeding (`email_confirm: true`) so the admin can sign in immediately. |

### `public.admin_profiles`

Application-side administrator record. One row per admin, 1:1 with `auth.users`.

| Field | Type | Rules |
|-------|------|-------|
| `id` | uuid | PK **and** FK → `auth.users.id` (`ON DELETE CASCADE`). |
| `email` | text | UNIQUE, NOT NULL; mirror of the auth email for joins/listing. |
| `display_name` | text | NOT NULL; defaults to the email local-part at seed. |
| `role` | text | NOT NULL, `CHECK (role = 'admin')` — this table holds admins only. |
| `full_control` | boolean | NOT NULL DEFAULT `true` (FR-007). |
| `created_at` / `updated_at` | timestamptz | NOT NULL DEFAULT `now()`. |

- **Separation invariant**: no `student_*` identity is ever inserted here (role CHECK + the
  fact that students are not auth users).

### `public.students` (separate population — skeleton for isolation)

The learner roster, tenant-scoped. **Not** in `auth.users`; created here only enough to make
the separation (US4) and tenant-isolation (SC-005) guarantees real and testable. Full
student/wave domain is a later feature.

| Field | Type | Rules |
|-------|------|-------|
| `id` | uuid | PK DEFAULT `gen_random_uuid()`. |
| `tenant_id` | uuid | NOT NULL, FK → `tenants.id`. Isolation key. |
| `student_code` | text | NOT NULL; e.g. `STU-001`. UNIQUE within a tenant (`UNIQUE (tenant_id, student_code)`). |
| `full_name` | text | NOT NULL. |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()`. |

### `public.tenants`

The multi-tenant isolation boundary (FR-008).

| Field | Type | Rules |
|-------|------|-------|
| `id` | uuid | PK DEFAULT `gen_random_uuid()`. |
| `name` | text | NOT NULL. |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()`. |

### `public.admin_auth_events` (minimal audit — R10)

| Field | Type | Rules |
|-------|------|-------|
| `id` | bigint | PK GENERATED ALWAYS AS IDENTITY. |
| `email` | text | the attempted identity (lower-cased). |
| `outcome` | text | `CHECK (outcome IN ('success','denied'))`. |
| `reason` | text | category only: `'ok' \| 'bad_credentials' \| 'not_admin'`. **Never** stores a password. |
| `created_at` | timestamptz | NOT NULL DEFAULT `now()`. |

> Note: failure `reason` is recorded server-side for traceability but is **never** returned
> to the client — the user always sees one generic message (FR-004, SC-006).

## Row-Level Security (the server-side boundary)

RLS is **enabled** on `admin_profiles`, `students`, `tenants`, and `admin_auth_events`.
Helper expression: `is_admin()` ≡ `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`.

| Table | SELECT policy | Write policy |
|-------|---------------|--------------|
| `admin_profiles` | `is_admin()` only (no anon/student access) | `is_admin()` (service-role bypasses for seed) |
| `students` | `is_admin()` **OR** `tenant_id = <jwt tenant claim>` | admins only (this feature) |
| `tenants` | `is_admin()` **OR** `id = <jwt tenant claim>` | admins only |
| `admin_auth_events` | `is_admin()` only | inserted via service-role/server only |

- **Admin (super-admin)** → `is_admin()` true → full read across tenants (FR-007).
- **Student/anon** → bounded to their tenant claim; cannot see `admin_profiles` at all
  (separation, SC-004).
- **`service_role`** → bypasses RLS; used exclusively by `scripts/seed-admin.ts`.

## Validation & state

- **Email**: trimmed + lower-cased before lookup (edge case: case/whitespace). Uniqueness
  enforced by `auth.users` and mirrored UNIQUE on `admin_profiles.email`.
- **Mandatory fields** (FR-002): the login Server Action rejects empty `email`/`password`
  before calling Supabase; the form marks both `required`.
- **Session state transitions**:
  `unauthenticated → (valid admin credentials) → admin session → (sign-out / expiry) → unauthenticated`.
  A valid **non-admin** credential never reaches "admin session": the server signs it out in
  the same request (R5) and emits a `denied/not_admin` audit row.

## Seed data (FR-006)

| Record | Value |
|--------|-------|
| `auth.users` | email `ahmedatif@meska.ai`, password from `SEED_ADMIN_PASSWORD`, `app_metadata.role='admin'`, confirmed. |
| `admin_profiles` | `id` = the new auth id, `email` mirror, `display_name='ahmedatif'`, `role='admin'`, `full_control=true`. |

Seeding is **idempotent**: if the user already exists, it is left as-is (no duplicate, no
password overwrite).
