-- 0003_password_reset.sql
-- Feature 003-admin-forgot-password — admin self-service password recovery.
-- Adds the admin-only gate used by the forgot-password request flow and widens the
-- admin_auth_events audit categories to cover recovery events. No new tables: recovery
-- tokens are owned by Supabase Auth (single-use, time-limited, unguessable).

-- Admin-only gate for the request side (FR-003/FR-010). SECURITY DEFINER so the
-- forgot-password Server Action can decide whether an email belongs to an administrator
-- WITHOUT the service-role key (same trust pattern as log_admin_auth_event). Returns only a
-- boolean, so it never exposes an admin row — it cannot be used to read admin data.
create or replace function public.is_admin_email(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.admin_profiles
    where lower(email) = lower(p_email)
      and role = 'admin'
  );
$$;

revoke all on function public.is_admin_email(text) from public;
grant execute on function public.is_admin_email(text) to anon, authenticated;

-- Widen the audit reason CHECK to admit the recovery categories alongside the sign-in ones
-- (R8). No column changes; outcome ('success','denied') is reused as-is.
alter table public.admin_auth_events
  drop constraint if exists admin_auth_events_reason_check;

alter table public.admin_auth_events
  add constraint admin_auth_events_reason_check
  check (reason in (
    'ok', 'bad_credentials', 'not_admin',
    'reset_requested', 'reset_done', 'reset_invalid'
  ));
