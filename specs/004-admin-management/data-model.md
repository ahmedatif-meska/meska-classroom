# Phase 1 Data Model: Admin Management

This feature adds **no new tables**. It extends the existing `admin_profiles` and
`admin_auth_events` from `002-admin-auth`. Invite tokens are owned by Supabase Auth (GoTrue) —
single-use, time-limited, unguessable — and are not modeled here.

---

## Migration `0004_admin_management.sql` (the only schema delta)

### `admin_profiles` — three new columns

| Column | Type | Notes |
|--------|------|-------|
| `first_name` | `text` (nullable) | Collected in the Create New Admin modal. Nullable so existing rows are valid. |
| `last_name` | `text` (nullable) | As above. |
| `status` | `text not null default 'pending'` | `check (status in ('pending','active'))`. Lifecycle below. |

Backfill on apply: set `status='active'` for all pre-existing rows (they already have
passwords / can sign in). The bootstrap admin remains `active`.

```sql
alter table public.admin_profiles add column if not exists first_name text;
alter table public.admin_profiles add column if not exists last_name  text;
alter table public.admin_profiles add column if not exists status text not null default 'pending';
alter table public.admin_profiles
  add constraint admin_profiles_status_check check (status in ('pending','active'));
update public.admin_profiles set status = 'active' where status <> 'active';
```

> Existing columns reused as-is: `id` (PK → `auth.users(id) on delete cascade`), `email`
> (`not null unique`), `display_name`, `role` (`check (role = 'admin')`), `full_control`,
> `created_at`, `updated_at`.

### `admin_auth_events` — widened reason CHECK

```sql
alter table public.admin_auth_events drop constraint if exists admin_auth_events_reason_check;
alter table public.admin_auth_events add constraint admin_auth_events_reason_check
  check (reason in (
    'ok', 'bad_credentials', 'not_admin',
    'reset_requested', 'reset_done', 'reset_invalid',
    'admin_created', 'admin_removed', 'admin_reinvited'
  ));
```

No column changes; `outcome` (`success`/`denied`) is reused. Writes still go through the
existing `log_admin_auth_event(p_email, p_outcome, p_reason)` SECURITY DEFINER RPC.

**RLS**: unchanged. `admin_profiles_select` / `admin_profiles_write` already gate the table to
`is_admin()`; the new columns inherit those policies. No new policy is required.

---

## Entities

### Administrator (`admin_profiles` row + `auth.users` record)

The unit listed, created, and removed.

| Field | Source | Used for |
|-------|--------|----------|
| id | `admin_profiles.id` = `auth.users.id` | current-user marker; remove target |
| name | `first_name` + `last_name` → fallback `display_name` → email local-part | Name column / modal |
| email | `admin_profiles.email` (unique, lowercased) | Email column; duplicate check; sign-in |
| role | `admin_profiles.role` (always `'admin'`) | Role column (single role this feature) |
| status | `admin_profiles.status` (`pending` \| `active`) | Status column |
| created | `admin_profiles.created_at` | Created column |

**Validation rules** (from spec / FR):
- `first_name`, `last_name`: required, non-empty after trim (FR-007).
- `email`: required, syntactically valid, trimmed + lowercased (FR-007, FR-018); unique among
  current admins (FR-008) — enforced by the `is_admin_email` pre-check **and** the
  `email unique` constraint backstop.
- `role`: fixed to `'admin'`; the modal offers only "Admin" (FR-005), and the DB CHECK
  `role = 'admin'` enforces it.

**State transitions** (`status`):

```
(invite created) ──> pending ──(invited admin sets password via magic link)──> active
                                                                                  │
(bootstrap/seed admin) ─────────────────────────────────────────────────────────┘ (starts active)

removed ──> row deleted (auth.users delete cascades admin_profiles); not a status value
```

### Administrator invitation (GoTrue-owned, not modeled)

A single-use, time-limited magic-link token created by `inviteUserByEmail`. Verified once, on
an explicit click, via `verifyOtp({ type:'invite', token_hash })`. No application table; its
lifecycle (issued → used/expired) lives entirely in Supabase Auth. **Re-sending** an invite
(FR-020, `resendInvite`) issues a fresh token and invalidates the prior one; the target admin
stays `pending` (the status only flips to `active` once a password is set). If the original
send fails (FR-021), the profile is still created `pending` and the creator is told to re-send.

### Audit event (`admin_auth_events` row)

Best-effort, server-only record of `admin_created` / `admin_removed` / `admin_reinvited` (plus
the existing sign-in and recovery reasons). Never returned to the client; never stores a
password.

---

## Invariants preserved

- **Admin/student separation** (002): administrators remain the only identities in `auth.users`
  / `admin_profiles`; the list reads `admin_profiles` under `is_admin()` RLS, so no student can
  appear (SC-007).
- **Role immutability**: `role` stays server-set and CHECK-constrained to `'admin'`.
- **Never zero *active* admins**: enforced by the `removeAdmin` last-active-admin guard (R10,
  counts `status='active'`), not the schema — at least one administrator able to sign in always
  survives a removal.
- **Consistency across stores**: the `on delete cascade` FK keeps `admin_profiles` and
  `auth.users` in lockstep on removal.
