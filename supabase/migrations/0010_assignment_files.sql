-- 0010_assignment_files.sql
-- Feature 008 follow-up — assignments are now admin-uploaded files (like
-- materials), authored by bulk upload with no title/instructions/due. Add a
-- file_path; `title` now stores the original filename. instructions_html and
-- due_at are kept (nullable) for backward compatibility with any pre-existing
-- rows but are no longer authored. Student submissions are unchanged — a student
-- still downloads the assignment file and uploads their own submission.
alter table public.wave_assignments add column if not exists file_path text;
