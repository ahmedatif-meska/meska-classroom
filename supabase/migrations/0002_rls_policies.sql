-- 0002_rls_policies.sql
-- Feature 002-admin-auth — Row-Level Security: the server-side, non-bypassable
-- boundary (constitution Principle VI). The super-admin (role=admin) has full
-- control; students/anon are bounded to their tenant claim; service_role bypasses
-- RLS (used only by the seed script).

-- Authoritative role check, read from the tamper-proof app_metadata JWT claim.
create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select coalesce(
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin',
    false
  );
$$;

-- Tenant claim carried in the JWT (wired up by the future student-auth feature).
create or replace function public.jwt_tenant_id()
returns uuid
language sql
stable
as $$
  select nullif(auth.jwt() -> 'app_metadata' ->> 'tenant_id', '')::uuid;
$$;

alter table public.tenants           enable row level security;
alter table public.admin_profiles    enable row level security;
alter table public.students          enable row level security;
alter table public.admin_auth_events enable row level security;

-- admin_profiles: admins only. No student/anon may read or resolve admins.
create policy admin_profiles_select on public.admin_profiles
  for select using (public.is_admin());
create policy admin_profiles_write on public.admin_profiles
  for all using (public.is_admin()) with check (public.is_admin());

-- tenants: admin sees all; a tenant-scoped caller sees only their own tenant.
create policy tenants_select on public.tenants
  for select using (public.is_admin() or id = public.jwt_tenant_id());
create policy tenants_write on public.tenants
  for all using (public.is_admin()) with check (public.is_admin());

-- students: admin sees all tenants (full control); a tenant-scoped caller sees
-- only rows in their own tenant — zero cross-tenant leakage.
create policy students_select on public.students
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());
create policy students_write on public.students
  for all using (public.is_admin()) with check (public.is_admin());

-- admin_auth_events: admins only (writes happen via the SECURITY DEFINER RPC below).
create policy admin_auth_events_select on public.admin_auth_events
  for select using (public.is_admin());

-- Audit insert path: a SECURITY DEFINER function lets the login Server Action record
-- an outcome without the service-role key (which never reaches request code) and
-- without granting a broad INSERT policy that anon could abuse.
create or replace function public.log_admin_auth_event(
  p_email text, p_outcome text, p_reason text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.admin_auth_events (email, outcome, reason)
  values (lower(p_email), p_outcome, p_reason);
end;
$$;

revoke all on function public.log_admin_auth_event(text, text, text) from public;
grant execute on function public.log_admin_auth_event(text, text, text) to anon, authenticated;
