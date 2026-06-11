# Data Model: Error Logging (009)

**Migration**: `supabase/migrations/0012_error_logs.sql` (next after `0011`)

## Table: `public.error_logs`

One row per recorded failure. Append-only; no application-side mutation path exists.

| Column        | Type          | Constraints                                                        | Notes |
|---------------|---------------|--------------------------------------------------------------------|-------|
| `id`          | `uuid`        | PK, `default gen_random_uuid()`                                    | |
| `occurred_at` | `timestamptz` | `not null default now()`                                           | Index: `(occurred_at desc)` for newest-first paging |
| `surface`     | `text`        | `not null check (surface in ('admin','student','system'))`         | Which panel the failure belongs to; `system` for non-panel paths |
| `origin`      | `text`        | `not null check (origin in ('server','client'))`                   | Where the error was raised |
| `severity`    | `text`        | `not null default 'error' check (severity in ('warning','error','fatal'))` | `fatal` = uncaught (instrumentation); `error` = handled-but-unexpected; `warning` = degraded-but-recovered |
| `operation`   | `text`        | `not null` — truncated to **200** chars in the RPC                 | Function/action identifier, e.g. `createMember`, `onRequestError:/admin/members` |
| `message`     | `text`        | `not null default ''` — truncated to **2,000** chars               | Error message |
| `stack`       | `text`        | nullable — truncated to **8,000** chars                            | Stack trace / underlying cause chain |
| `context`     | `jsonb`       | nullable — serialized JSON capped at **4,000** chars               | Redacted, allow-listed scalars only (see contracts) |
| `user_id`     | `uuid`        | nullable, `references auth.users(id) on delete set null`           | **Derived from `auth.uid()` in the RPC — never a parameter.** NULL = anonymous. `set null` keeps entries readable after user removal (spec: Key Entities) |
| `user_role`   | `text`        | nullable                                                           | From `auth.jwt()->'app_metadata'->>'role'` |
| `tenant_id`   | `uuid`        | nullable, `references public.tenants(id) on delete set null`       | From `auth.jwt()->'app_metadata'->>'tenant_id'` (students only) |
| `environment` | `text`        | nullable                                                           | `VERCEL_ENV ?? NODE_ENV` at write time |

### Indexes

- `error_logs_occurred_at_idx` on `(occurred_at desc)` — drives the paginated list and the retention purge.

## Row-Level Security

RLS **enabled**. Policies:

| Policy | Command | Role(s) | Rule |
|--------|---------|---------|------|
| `error_logs_admin_select` | `SELECT` | `authenticated` | `is_admin()` (existing helper reading the JWT) |
| *(none)* | `INSERT` / `UPDATE` / `DELETE` | — | **No policies.** Request code cannot write or mutate directly; immutability (FR-008) is structural. |

Students, anonymous callers, and even admins get zero write capability through the
table; admins get read-only SELECT. The denial case (student/anon SELECT → 0 rows) is
covered in `tests/integration/rls.test.ts`.

## Function: `public.log_error(...)` — the only write path

`SECURITY DEFINER`, `set search_path = public`, mirroring `log_admin_auth_event`
(migration `0002`). `revoke all from public; grant execute to anon, authenticated`.

```text
log_error(
  p_surface     text,      -- validated against the same check set
  p_origin      text,
  p_severity    text,
  p_operation   text,      -- left(p_operation, 200)
  p_message     text,      -- left(p_message, 2000)
  p_stack       text,      -- left(p_stack, 8000)
  p_context     text,      -- left(p_context, 4000) then ::jsonb (invalid JSON → stored as {"raw": <text>})
  p_environment text
) returns void
```

Inside the function body — **never from parameters**:

- `user_id    := auth.uid()`
- `user_role  := auth.jwt() -> 'app_metadata' ->> 'role'`
- `tenant_id  := nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid`

An unauthenticated caller (bare anon client in `instrumentation.ts`) produces NULLs →
the entry is recorded as anonymous (FR-003). A caller cannot attribute an entry to
another user (tamper-proof identity).

## Retention

Daily `pg_cron` job (created in the same migration):

```sql
select cron.schedule(
  'purge-error-logs',
  '17 3 * * *',  -- daily, off-peak
  $$delete from public.error_logs where occurred_at < now() - interval '90 days'$$
);
```

Fallback when `pg_cron` is unavailable: run the inner DELETE manually (documented in
`quickstart.md`). Nothing in the app depends on the purge having run.

## Relationships

- `error_logs.user_id → auth.users.id` (`on delete set null`) — optional; entries
  outlive removed users.
- `error_logs.tenant_id → public.tenants.id` (`on delete set null`) — optional; records
  the wave context of student-originated errors. **Not** a visibility scope: the table
  is admin-only regardless of tenant (admins see all tenants, consistent with the
  existing model).

## State

No state machine — rows are immutable from creation until retention purge.
