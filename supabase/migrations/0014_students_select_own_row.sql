-- 0014_students_select_own_row.sql
-- A member's dashboard QR code is rendered from THEIR OWN students row, and must
-- survive unassignment: deleting a wave nulls students.tenant_id (0009), which made
-- the row invisible to its own user under the wave-scoped select policy — hiding
-- the QR. Let every authenticated user always read their own roster row, keyed by
-- identity (user_id). Visibility of OTHER rows is unchanged: admins see all, members
-- see wave-mates only — Principle VI intact (your own row is never another wave's
-- data, and wave CONTENT policies still require a live wave claim).
drop policy if exists students_select on public.students;
create policy students_select on public.students
  for select using (
    public.is_admin()
    or tenant_id = public.jwt_tenant_id()
    or user_id = auth.uid()
  );
