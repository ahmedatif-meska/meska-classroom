# Data Model: Wave Management

**Feature**: 008-wave-management | **Date**: 2026-06-08

A **wave is a `public.tenants` row** (`wave == tenant`). New child tables denormalize
`tenant_id` (the wave) so every student read policy is the flat `tenant_id =
jwt_tenant_id()` — identical to the existing `students` policy (research R2). New
migration: **`supabase/migrations/0008_waves.sql`** (one file; applied after 0007).

---

## 1. `tenants` (the wave) — evolved in place

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | existing |
| `name` | text not null | existing — the wave name |
| `created_at` | timestamptz | existing — **drives Waves-list ordering (desc)** |
| `description_html` | text (new, nullable) | sanitized rich text; shown on student dashboard |
| `type` | text not null (new) | `check (type in ('online','offline'))` |

**Migration ordering for `type` (table must be empty of legacy rows first):**
1. `delete from public.tenants where name in ('Online','Offline');` — remove the two seed
   reference waves (no members reference them; fresh roster per spec).
2. `alter table public.tenants add column if not exists description_html text;`
3. `alter table public.tenants add column if not exists type text;`
4. `alter table public.tenants add constraint tenants_type_check check (type in ('online','offline'));`
5. `alter table public.tenants alter column type set not null;` *(safe because the table is
   empty after step 1; documented assumption — see spec).* 

RLS on `tenants` already exists (0002): admin all; tenant-scoped caller sees only its own
row. The new student read of its own wave description is already covered by
`tenants_select` (`id = jwt_tenant_id()`). No policy change needed for `tenants`.

---

## 2. `wave_weeks`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK default gen_random_uuid() | |
| `tenant_id` | uuid not null → `tenants(id)` on delete cascade | the wave |
| `position` | int not null | ordering within the wave (1, 2, 3 …) |
| `title` | text | optional (e.g. "Week 1") |
| `description_html` | text | optional, sanitized |
| `created_at` | timestamptz not null default now() | |

Index: `(tenant_id, position)`. Ordering: `position asc`.

## 3. `wave_materials`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid not null → `tenants(id)` on delete cascade | the wave (for flat RLS) |
| `week_id` | uuid not null → `wave_weeks(id)` on delete cascade | |
| `title` | text not null | |
| `file_path` | text not null | object path in `wave-materials` bucket |
| `created_at` | timestamptz not null default now() | |

## 4. `wave_assignments`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid not null → `tenants(id)` on delete cascade | the wave |
| `week_id` | uuid not null → `wave_weeks(id)` on delete cascade | |
| `title` | text not null | |
| `instructions_html` | text | optional, sanitized |
| `due_at` | timestamptz | optional due date |
| `created_at` | timestamptz not null default now() | |

## 5. `wave_submissions`

| Column | Type | Notes |
|--------|------|-------|
| `id` | uuid PK | |
| `tenant_id` | uuid not null → `tenants(id)` on delete cascade | the wave |
| `assignment_id` | uuid not null → `wave_assignments(id)` on delete cascade | |
| `student_id` | uuid not null → `students(id)` on delete cascade | the submitter |
| `file_path` | text not null | object path in `assignment-submissions` bucket |
| `submitted_at` | timestamptz not null default now() | |

Constraint: **`unique (assignment_id, student_id)`** → latest-wins via upsert (research R8).

---

## 6. Relationships

```
tenants (wave) 1──* wave_weeks 1──* wave_materials
                              1──* wave_assignments 1──* wave_submissions *──1 students
tenants (wave) 1──* students (existing)
```

---

## 7. RLS policies (the wave-isolation boundary — Principle VI)

All four child tables enable RLS. Helpers `is_admin()` / `jwt_tenant_id()` are from 0002.

**`wave_weeks`, `wave_materials`, `wave_assignments`** (identical shape):
```sql
-- read: admin sees all; a student sees only its own wave's rows
create policy <t>_select on public.<t>
  for select using (public.is_admin() or tenant_id = public.jwt_tenant_id());
-- write: admin only (authoring)
create policy <t>_write on public.<t>
  for all using (public.is_admin()) with check (public.is_admin());
```

**`wave_submissions`** (students write their own; admins read all):
```sql
-- admin: full access (review/download/cleanup)
create policy submissions_admin_all on public.wave_submissions
  for all using (public.is_admin()) with check (public.is_admin());
-- student: read OWN submissions in OWN wave
create policy submissions_student_select on public.wave_submissions
  for select using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
-- student: insert OWN submission in OWN wave
create policy submissions_student_insert on public.wave_submissions
  for insert with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
-- student: update (re-submit) OWN submission
create policy submissions_student_update on public.wave_submissions
  for update using (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  ) with check (
    tenant_id = public.jwt_tenant_id()
    and student_id = (select id from public.students where user_id = auth.uid())
  );
```

**Cross-wave denial (NON-NEGOTIABLE test, Principle II/VI)**: a tenant-A student JWT must
return zero rows for tenant-B weeks/materials/assignments/submissions — added to
`tests/integration/rls.test.ts`.

---

## 8. Storage RLS (`storage.objects`) — files obey the same boundary

Buckets are **private** and created by the operator in the dashboard. Policies live in the
migration. Path encodes the wave id first (research R4).

**`wave-materials`** — path `‹wave_id›/‹week_id›/‹file›`:
```sql
create policy wave_materials_admin_all on storage.objects
  for all
  using (bucket_id = 'wave-materials' and public.is_admin())
  with check (bucket_id = 'wave-materials' and public.is_admin());
create policy wave_materials_student_read on storage.objects
  for select
  using (
    bucket_id = 'wave-materials'
    and (storage.foldername(name))[1] = public.jwt_tenant_id()::text
  );
```

**`assignment-submissions`** — path `‹wave_id›/‹assignment_id›/‹student_id›/‹file›`:
```sql
create policy submissions_admin_all on storage.objects
  for all
  using (bucket_id = 'assignment-submissions' and public.is_admin())
  with check (bucket_id = 'assignment-submissions' and public.is_admin());
create policy submissions_student_rw on storage.objects
  for all
  using (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = public.jwt_tenant_id()::text
    and (storage.foldername(name))[3] = (select id::text from public.students where user_id = auth.uid())
  )
  with check (
    bucket_id = 'assignment-submissions'
    and (storage.foldername(name))[1] = public.jwt_tenant_id()::text
    and (storage.foldername(name))[3] = (select id::text from public.students where user_id = auth.uid())
  );
```

Reads use short-lived **signed URLs**; on a private bucket the signed URL is only issued
when the caller passes the `select` policy above — so a Wave-A student can never obtain a
URL for a Wave-B object.

---

## 9. Validation rules (pure, shared client/server — `lib/waves/validation.ts`)

- **Wave**: `name` required (non-empty trimmed); `type ∈ {online, offline}`.
- **Week**: `position` is a positive integer; `title`/`description_html` optional.
- **Assignment**: `title` required; `instructions_html` optional; `due_at` optional/parseable.
- **Material file**: type ∈ {pdf, ppt, pptx}; `0 < size ≤ 25 MB`.
- **Submission file**: type ∈ {pdf, ppt, pptx, doc, docx}; `0 < size ≤ 25 MB`.
