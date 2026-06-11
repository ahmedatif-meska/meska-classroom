-- 0015_instructors_student_read.sql
-- Feature 010-student-home-weeks — surface instructors to students on Home.
--
-- Instructors are GLOBAL display data (the public.instructors table has no
-- tenant_id; see migration 0005). Making them readable by ANY authenticated user
-- (admins + students) is therefore not a wave-scoped leak under Principle VI,
-- which governs wave-scoped MEMBER data. Instructor WRITES stay admin-only, and
-- the instructor-images bucket remains public-read (operator-set) — both
-- UNCHANGED from 0005. This widens SELECT only.

drop policy if exists instructors_select on public.instructors;
create policy instructors_select on public.instructors
  for select using (auth.uid() is not null);

-- instructors_write (admin-only, migration 0005) is intentionally left UNCHANGED.
-- instructor_images_admin_write (admin-only writes; public reads) is UNCHANGED.
