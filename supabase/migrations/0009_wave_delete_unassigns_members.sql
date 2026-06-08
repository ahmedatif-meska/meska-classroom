-- 0009_wave_delete_unassigns_members.sql
-- Feature 008 follow-up. Deleting a wave (tenant) must KEEP its members and simply
-- clear their wave assignment, rather than cascade-deleting the member rows. So
-- students.tenant_id becomes nullable and its FK switches from ON DELETE CASCADE to
-- ON DELETE SET NULL: when a wave is removed, each assigned member survives with a
-- null wave (unassigned). The students_select RLS policy already reads
-- `tenant_id = jwt_tenant_id()`, which is simply never true for a null tenant_id, so
-- an unassigned member is visible only to admins — no policy change needed.

alter table public.students alter column tenant_id drop not null;

alter table public.students drop constraint students_tenant_id_fkey;
alter table public.students
  add constraint students_tenant_id_fkey
  foreign key (tenant_id) references public.tenants (id) on delete set null;
