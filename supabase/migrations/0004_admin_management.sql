-- 0004_admin_management.sql
-- Feature 004-admin-management — admin lifecycle (list, invite, resend, remove).
-- Extends admin_profiles with the columns the management list displays and the
-- pending→active lifecycle; widens the audit reason CHECK with the management events.
-- No new tables: invite tokens are owned by Supabase Auth (single-use, time-limited).

-- New columns on admin_profiles. Nullable names keep existing rows valid; status
-- defaults to 'pending' for newly invited admins and is backfilled to 'active' for
-- everyone already provisioned (they can already sign in).
alter table public.admin_profiles add column if not exists first_name text;
alter table public.admin_profiles add column if not exists last_name  text;
alter table public.admin_profiles add column if not exists status text not null default 'pending';

alter table public.admin_profiles
  drop constraint if exists admin_profiles_status_check;
alter table public.admin_profiles
  add constraint admin_profiles_status_check check (status in ('pending', 'active'));

-- Backfill: every pre-existing admin (e.g. the bootstrap admin) is active.
update public.admin_profiles set status = 'active' where status <> 'active';

-- Widen the audit reason CHECK to admit the management events alongside the
-- sign-in (002) and recovery (003) reasons. outcome ('success','denied') is reused.
alter table public.admin_auth_events
  drop constraint if exists admin_auth_events_reason_check;

alter table public.admin_auth_events
  add constraint admin_auth_events_reason_check
  check (reason in (
    'ok', 'bad_credentials', 'not_admin',
    'reset_requested', 'reset_done', 'reset_invalid',
    'admin_created', 'admin_removed', 'admin_reinvited'
  ));
