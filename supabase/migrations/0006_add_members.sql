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
