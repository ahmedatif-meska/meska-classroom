-- 0012_error_logs.sql — Feature 009 (Error Logging)
--
-- Central error log: every unexpected error in the app is recorded here with
-- maximal safe detail. Writes happen ONLY through the SECURITY DEFINER RPC
-- `log_error` (mirrors `log_admin_auth_event`, 0002); the table has no client
-- write policies at all, so entries are immutable from the application.
-- Reads are admin-only (`is_admin()`); students/anon see zero rows.

-- ---------------------------------------------------------------------------
-- Table
-- ---------------------------------------------------------------------------

create table public.error_logs (
  id          uuid primary key default gen_random_uuid(),
  occurred_at timestamptz not null default now(),
  surface     text not null default 'system'
              check (surface in ('admin', 'student', 'system')),
  origin      text not null default 'server'
              check (origin in ('server', 'client')),
  severity    text not null default 'error'
              check (severity in ('warning', 'error', 'fatal')),
  operation   text not null,
  message     text not null default '',
  stack       text,
  context     jsonb,
  -- Identity is derived from the caller's JWT inside log_error — never from
  -- parameters. `on delete set null` keeps entries readable after the
  -- referenced user/wave is removed.
  user_id     uuid references auth.users (id) on delete set null,
  user_role   text,
  tenant_id   uuid references public.tenants (id) on delete set null,
  environment text
);

create index error_logs_occurred_at_idx
  on public.error_logs (occurred_at desc);

-- ---------------------------------------------------------------------------
-- RLS — admin-only SELECT; NO insert/update/delete policies (immutable from
-- the app; the RPC below is the only write path for request code).
-- ---------------------------------------------------------------------------

alter table public.error_logs enable row level security;

create policy error_logs_admin_select
  on public.error_logs
  for select
  to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------------
-- log_error — the only write path. SECURITY DEFINER so anon/authenticated
-- callers can record an entry without any table-level write grant.
--
-- Hardening: identity comes from the JWT (un-spoofable); free-text fields are
-- truncated server-side (operation 200 / message 2000 / stack 8000 /
-- context 4000); invalid enum params are coerced, and invalid context JSON is
-- wrapped — logging must never throw back into the caller.
-- ---------------------------------------------------------------------------

create or replace function public.log_error(
  p_surface     text,
  p_origin      text,
  p_severity    text,
  p_operation   text,
  p_message     text,
  p_stack       text,
  p_context     text,
  p_environment text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_context jsonb;
begin
  begin
    v_context := left(p_context, 4000)::jsonb;
  exception
    when others then
      v_context := jsonb_build_object('raw', left(p_context, 4000));
  end;

  insert into public.error_logs
    (surface, origin, severity, operation, message, stack, context,
     user_id, user_role, tenant_id, environment)
  values (
    case when p_surface  in ('admin', 'student', 'system')  then p_surface  else 'system' end,
    case when p_origin   in ('server', 'client')            then p_origin   else 'server' end,
    case when p_severity in ('warning', 'error', 'fatal')   then p_severity else 'error'  end,
    coalesce(left(p_operation, 200), 'unknown'),
    coalesce(left(p_message, 2000), ''),
    left(p_stack, 8000),
    v_context,
    auth.uid(),
    auth.jwt() -> 'app_metadata' ->> 'role',
    nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid,
    left(p_environment, 50)
  );
end;
$$;

revoke all on function public.log_error(text, text, text, text, text, text, text, text) from public;
grant execute on function public.log_error(text, text, text, text, text, text, text, text) to anon, authenticated;

-- ---------------------------------------------------------------------------
-- Retention — purge entries older than 90 days, daily at 03:17 UTC.
-- If pg_cron is unavailable in an environment, run the inner DELETE manually
-- (see specs/009-error-logging/quickstart.md); nothing depends on the purge.
-- ---------------------------------------------------------------------------

create extension if not exists pg_cron;

select cron.schedule(
  'purge-error-logs',
  '17 3 * * *',
  $$delete from public.error_logs where occurred_at < now() - interval '90 days'$$
);
