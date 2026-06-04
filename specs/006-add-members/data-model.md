# Data Model — Add Members (Phase 1)

One migration: **`supabase/migrations/0006_add_members.sql`**. It evolves `public.students` into
the authenticated member record, seeds the two waves as `tenants` rows, and widens the audit
CHECK. **No new table, no new RLS policy** — wave isolation reuses the existing `students` /
`jwt_tenant_id()` policy from 0002 (research R2). Member `auth.users` rows are created at runtime
by the service-role Admin API (not in this migration).

> Migrations in this project are applied as raw SQL (the Supabase `migrations` table is empty;
> see quickstart). The file is additive and idempotent (`if not exists` / guarded seeds).

## Entities

### `public.students` (evolved) — the Member

| Column | Type | Notes |
|--------|------|-------|
| `id` | `uuid` PK | existing; default `gen_random_uuid()`. **The member-info URL key** (`/admin/members/<id>`). |
| `tenant_id` | `uuid` FK → `tenants.id` | existing; **the member's wave**. Drives `jwt_tenant_id()` isolation. |
| `student_code` | `text` | existing, NOT NULL, unique within `(tenant_id, student_code)`. Set to `email` at insert. |
| `full_name` | `text` | existing; collected on the form / CSV. |
| `created_at` | `timestamptz` | existing; list order key (`desc`). |
| **`user_id`** | `uuid` unique FK → `auth.users.id` `on delete cascade` | **NEW** — links the member to their auth user. |
| **`email`** | `text` | **NEW** — login identifier; unique on `lower(email)`. |
| **`whatsapp`** | `text` | **NEW** — WhatsApp mobile (stored as provided, trimmed). |
| **`status`** | `text` NOT NULL default `'pending'` check in (`'pending'`,`'active'`) | **NEW** — `pending` until the member sets a password, then `active`. |

**Indexes/constraints added**: `create unique index students_email_lower_key on public.students
(lower(email)) where email is not null;`

**RLS (unchanged, from 0002)**:
- `students_select`: `is_admin() OR tenant_id = jwt_tenant_id()` — admin sees all; a member sees
  only their own wave. **This is the wave-isolation boundary** (cross-wave denial tested).
- `students_write`: `is_admin()` — only admins insert/update members (member provisioning is
  admin-driven; the actual insert runs on the service-role Admin client after the gate).

### `public.tenants` (seed only) — the Wave

Two idempotent seed rows — **Offline** and **Online** — inserted if absent. No schema change.
The wave dropdown reads `tenants` (admins select all via `tenants_select`). Future waves are new
rows (the "create wave" feature), requiring no migration here.

### `public.admin_auth_events` (CHECK widened) — Audit

Reason CHECK widened to add `member_created` and `member_reinvited` alongside the existing admin
reasons. No column change; `outcome` (`success`/`denied`) reused.

## Member lifecycle (status)

```
(admin creates) ──> pending ──(member sets password via invite link)──> active
       │                                                                   │
   invite email                                                     can sign in to
   dispatched                                                       the student panel
```

A `pending` member cannot sign in (no password set). Re-invite (`resendMemberInvite`) issues a
fresh single-use link for a `pending` member and is offered only while `pending`.

## JWT claims (set at provisioning, via service-role `updateUserById`)

```
app_metadata = { role: 'student', tenant_id: <waveId> }
```

`role: 'student'` → fails `assertAdminSession` (keeps members out of admin surfaces);
`tenant_id` → resolves `jwt_tenant_id()` so `students_select` bounds the member to their wave.

## Migration SQL (`0006_add_members.sql`)

```sql
-- 0006_add_members.sql
-- Feature 006-add-members — evolve students into the authenticated member record,
-- seed the two waves (tenants), and widen the audit CHECK. Wave isolation reuses the
-- existing students/jwt_tenant_id() RLS from 0002 (no new policy). Member auth.users
-- rows are created at runtime by the service-role Admin API (createMember/bulk).

-- 1) Evolve students into the member record. Columns are nullable/defaulted so any
--    pre-existing roster row stays valid.
alter table public.students add column if not exists user_id  uuid unique references auth.users (id) on delete cascade;
alter table public.students add column if not exists email    text;
alter table public.students add column if not exists whatsapp text;
alter table public.students add column if not exists status   text not null default 'pending';

alter table public.students
  drop constraint if exists students_status_check;
alter table public.students
  add constraint students_status_check check (status in ('pending', 'active'));

-- Global, case-insensitive email uniqueness (login identifier). Partial so legacy
-- email-less rows don't collide.
create unique index if not exists students_email_lower_key
  on public.students (lower(email))
  where email is not null;

-- 2) Seed the two waves as tenants (idempotent by name). The future "create wave"
--    feature inserts more rows here; no schema change needed.
insert into public.tenants (name)
select 'Offline'
where not exists (select 1 from public.tenants where name = 'Offline');

insert into public.tenants (name)
select 'Online'
where not exists (select 1 from public.tenants where name = 'Online');

-- 3) Widen the audit reason CHECK to admit member-provisioning events alongside the
--    sign-in (002), recovery (003), and admin-management (004) reasons.
alter table public.admin_auth_events
  drop constraint if exists admin_auth_events_reason_check;

alter table public.admin_auth_events
  add constraint admin_auth_events_reason_check
  check (reason in (
    'ok', 'bad_credentials', 'not_admin',
    'reset_requested', 'reset_done', 'reset_invalid',
    'admin_created', 'admin_removed', 'admin_reinvited',
    'member_created', 'member_reinvited'
  ));
```

## Notes & open items

- **`student_code`** is kept NOT NULL/unique-within-wave; member inserts set `student_code := email`
  to satisfy it without a destructive change. If the roster later needs a distinct code, revisit.
- **No Storage bucket** — the QR is an inline SVG (research R5), so unlike 005 there is no
  `next.config.ts` image-host change and no storage policy.
- **Within-wave read** is permitted by the existing `students_select` (002 design); a stricter
  self-only policy is an optional follow-up, not required here (research R12).
