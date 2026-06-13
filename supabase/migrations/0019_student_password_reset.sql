-- 0019_student_password_reset.sql
-- Feature 012 (US1) — student self-service password recovery.
-- Adds the member-only gate used by the student forgot-password request flow —
-- the exact mirror of is_admin_email (0003). No new tables: recovery tokens are
-- owned by Supabase Auth (single-use, time-limited, unguessable), and the
-- confirm/set-password flow reuses the existing /student/auth/confirm machinery.

-- Member-only gate for the request side (FR-003). SECURITY DEFINER so the
-- forgot-password Server Action can decide whether an email belongs to a member
-- WITHOUT the service-role key (same trust pattern as is_admin_email). Returns
-- only a boolean, so it never exposes a student row — it cannot be used to read
-- member data. Matches ANY student row (pending or active): a pending member who
-- never set a password can still recover via the same set-password endpoint (R2).
create or replace function public.is_student_email(p_email text)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from public.students
    where lower(email) = lower(p_email)
  );
$$;

revoke all on function public.is_student_email(text) from public;
grant execute on function public.is_student_email(text) to anon, authenticated;
