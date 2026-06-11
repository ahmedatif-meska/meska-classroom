# Data Model: Student Home & Weeks Navigation

This feature introduces **no new tables** and **no new columns**. It reuses existing entities (features 005 and 008) and changes exactly one access policy. This document records the entities as they are consumed by the student surfaces, the read shapes, and the single RLS change.

## Entities (existing — consumed read-only by students)

### Instructor — `public.instructors` (feature 005)
- `id uuid` (pk), `name text`, `description_html text` (sanitized rich text), `image_path text` (object in public `instructor-images`), `created_at timestamptz`, `updated_at timestamptz`.
- **No `tenant_id`** → global/shared display data.
- Student read shape: `select id, name, description_html, image_path order by created_at desc`.
- **Access change**: see "RLS change" below. Students gain SELECT; writes stay admin-only.

### Tenant (Wave) — `public.tenants` (feature 008)
- Used fields: `id`, `name` (drives "You are in wave [name]"), `description_html` (sanitized, shown on Home).
- Student read shape (unchanged): own wave only, `eq("id", tenantId)` under RLS `id = jwt_tenant_id()`.

### Student (member) — `public.students`
- Used fields: `id`, `full_name` (greeting), `user_id`, `tenant_id`.
- Student read shape (unchanged): own row via `eq("user_id", userId)`.

### Week — `public.wave_weeks` (feature 008)
- Used fields: `id`, `tenant_id`, `title` (nullable), `position` (order), `description_html` (nullable).
- Student read shapes:
  - **Nav**: `select id, title, position where tenant_id = <own> order by position asc` (build Weeks group).
  - **Week view**: load the one week by `id` (RLS confines to own wave; app also 404s if the row doesn't resolve for the caller).

### Material (Resource) — `public.wave_materials` (feature 008)
- Used fields: `id`, `week_id`, `tenant_id`, `title`, `file_path` (in private `wave-materials`).
- Student read shape (week view): `select id, week_id, title, file_path where tenant_id = <own> and week_id = <weekId>`.
- Download: `signedUrl(supabase, MATERIALS_BUCKET, file_path)` — wave-folder Storage policy returns a link only for the caller's own wave (else null).

### Assignment — `public.wave_assignments` (feature 008)
- Used fields: `id`, `week_id`, `tenant_id`, `title`, `file_path` (nullable), `instructions_html` (nullable), `due_at` (nullable).
- Student read shape (week view): `select id, week_id, title, file_path, instructions_html, due_at where tenant_id = <own> and week_id = <weekId> order by created_at asc`.
- Download: same `signedUrl` over the shared `wave-materials` bucket.

### Submission — `public.wave_submissions` (feature 008)
- Used fields: `assignment_id`, `student_id`.
- Student read shape (week view): `select assignment_id where student_id = <own>` → drives "Submitted/Replace" state.
- Write: unchanged — handled by the existing `SubmitAssignment` browser→Storage flow + Server Action that validates the path (Principle V).

## RLS change (the only schema/policy change)

Migration `supabase/migrations/0015_instructors_student_read.sql`:

```sql
-- 0015_instructors_student_read.sql
-- Feature 010-student-home-weeks — surface instructors to students on Home.
-- Instructors are GLOBAL display data (no tenant_id); making them readable by any
-- authenticated user (admins + students) is not a wave-scoped leak (Principle VI).
-- Writes stay admin-only; instructor-images bucket remains public-read (unchanged).

drop policy if exists instructors_select on public.instructors;
create policy instructors_select on public.instructors
  for select using (auth.uid() is not null);

-- instructors_write (admin-only, migration 0005) is intentionally left UNCHANGED.
-- instructor_images_admin_write (admin-only writes; public reads) is UNCHANGED.
```

### Authorization matrix (instructors)

| Actor | SELECT | INSERT/UPDATE/DELETE |
|-------|:------:|:--------------------:|
| Admin | ✅ (was ✅) | ✅ (unchanged) |
| Student (authenticated) | ✅ **(new)** | ❌ (denied) |
| Anonymous | ❌ | ❌ |

## Wave-isolation invariants (unchanged, reaffirmed)

- Every student read of weeks/materials/assignments filters `tenant_id = jwt_tenant_id()` (RLS) and is additionally narrowed by `week_id` in the week view.
- The new week route MUST resolve the week within the caller's wave or return not-found — never render another wave's week.
- File downloads keep the `(storage.foldername(name))[1] = jwt_tenant_id()::text` wave-folder policy via `signedUrl` (null for foreign paths).
- Submissions remain readable/writable only by their owning student (and admins) — unchanged.

## Derived/display rules

- **Greeting name**: `students.full_name || user.email || ""`.
- **Wave label**: `"You are in wave " + tenants.name` (empty/unassigned → "not in a wave yet" state).
- **Week label**: `title` when set, else `"Week " + position`.
- **Materials group label**: shown to students as **"Resources"** (the underlying entity remains `wave_materials`).
- **Rich text** (wave + instructor descriptions): always `sanitizeDescription(...)` before render.
