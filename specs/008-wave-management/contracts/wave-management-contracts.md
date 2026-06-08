# Contracts: Wave Management

**Feature**: 008-wave-management | **Date**: 2026-06-08

This app has **no API route handlers** — the contracts are **Server Actions** (in colocated
`actions.ts`) and the **Storage object-path** convention. Every admin action begins with
`getUser()` + `assertAdminSession(...)` (generic denial on failure); every student action
begins with `getUser()` + `assertStudentSession(...)`. All run on the cookie/RLS client.

Shared result shape: `{ saved?: true } | { removed?: true } | { error: string }`
(mirrors `InstructorFormState` / `RemoveInstructorState`). All copy comes from
`lib/strings.ts`.

---

## Admin Server Actions — `app/admin/waves/actions.ts`

### `createWave(prev, formData) → WaveFormState`
- **Auth**: admin. **Inputs**: `name` (req), `description_html` (opt), `type` ∈ {online,offline}.
- **Behavior**: `validateWaveFields` → `sanitizeDescription(description_html)` →
  `insert into tenants {name, description_html, type}`.
- **On success**: `revalidatePath("/admin/waves")`; `invalidate(adminListKey("waves"))`;
  return `{ saved: true }` (page may redirect to `/admin/waves`).
- **Errors**: invalid name/type → field error; insert failure → generic save error.

### `updateWave(prev, formData) → WaveFormState`
- **Auth**: admin. **Inputs**: `id` (req), `name`, `description_html`, `type`.
- **Behavior**: validate → sanitize → `update tenants set … where id`.
- **On success**: revalidate `/admin/waves` and `/admin/waves/[id]`; invalidate waves key.

### `deleteWave(prev, formData) → RemoveState`  *(block-while-non-empty, R11)*
- **Auth**: admin. **Inputs**: `id`.
- **Behavior**: count `students` where `tenant_id = id` and count `wave_weeks` where
  `tenant_id = id`; **if either > 0 → return `{ error: wavesDeleteBlocked }`** (no delete).
  Else `delete from tenants where id`.
- **On success**: revalidate `/admin/waves`; invalidate waves key; `{ removed: true }`.

### `addWeek(prev, formData) → WeekState`
- **Auth**: admin. **Inputs**: `wave_id` (req), `title` (opt), `description_html` (opt),
  `position` (server-assigned = current max+1 if omitted).
- **Behavior**: sanitize description → `insert into wave_weeks {tenant_id: wave_id, …}`.

### `updateWeek` / `removeWeek(prev, formData)`
- **Auth**: admin. **Inputs**: `id` (+ `wave_id` for revalidate). `removeWeek` cascades to
  its materials/assignments (FK) and best-effort removes their Storage files first.

### `addMaterial(prev, formData) → MaterialState`
- **Auth**: admin. **Inputs**: `wave_id`, `week_id`, `title` (req), `file` (req).
- **Behavior**: `validateMaterialFile({type,size})` (server-authoritative) →
  upload to `wave-materials` at `‹wave_id›/‹week_id›/‹uuid›.‹ext›` →
  `insert into wave_materials {tenant_id, week_id, title, file_path}`.
- **Errors**: bad type/size → field error; upload failure → generic; (best-effort delete of
  the just-uploaded object if the row insert fails).

### `removeMaterial(prev, formData)`
- **Auth**: admin. **Inputs**: `id`. Delete row → best-effort remove its Storage object.

### `addAssignment` / `updateAssignment` / `removeAssignment(prev, formData)`
- **Auth**: admin. **Inputs**: `wave_id`, `week_id`, `title` (req), `instructions_html`
  (opt), `due_at` (opt). Sanitize instructions; insert/update/delete `wave_assignments`.

### `signMaterialUrl(path) → string | null`  *(admin download helper, optional)*
- Returns a short-lived signed URL for a material (admins already pass the Storage policy).

---

## Student Server Action — `app/student/dashboard/actions.ts` (or `app/student/actions.ts`)

### `submitAssignment(prev, formData) → SubmissionState`
- **Auth**: student. **Inputs**: `assignment_id` (req), `file` (req).
- **Behavior**: resolve the caller's `students.id` and `tenant_id` from the session;
  confirm the assignment belongs to the caller's wave (RLS already enforces this on read);
  `validateSubmissionFile({type,size})` → upload to `assignment-submissions` at
  `‹wave_id›/‹assignment_id›/‹student_id›/submission.‹ext›` with `upsert: true` →
  **upsert** `wave_submissions` on `(assignment_id, student_id)` (latest-wins).
- **On success**: revalidate `/student/dashboard`; `{ saved: true }`.
- **Denial**: a student MUST NOT submit to another wave's assignment — enforced by both the
  Storage `with check` policy and the table insert policy (returns generic error).

### Download (materials & own submissions, student side)
- The RSC reads the student's wave weeks/materials, and for each material issues a
  `createSignedUrl` against `wave-materials` (the student's session passes the wave-scoped
  Storage `select` policy). A Wave-B path yields no URL.

---

## Storage object-path contract (the file-level isolation invariant)

| Bucket | Path | Who writes | Who reads |
|--------|------|-----------|-----------|
| `wave-materials` | `‹wave_id›/‹week_id›/‹uuid›.‹ext›` | admin | admin + students where `foldername[1] == tenant` |
| `assignment-submissions` | `‹wave_id›/‹assignment_id›/‹student_id›/submission.‹ext›` | the owning student | admin + that student |

**Invariant**: the FIRST path segment is always the wave id, so `(storage.foldername(name))[1]
= jwt_tenant_id()::text` is the file-level equivalent of the row-level `tenant_id =
jwt_tenant_id()`. The path builders live in `lib/waves/files.ts` and are unit-tested.

---

## Cache contract

- `adminListKey("waves")` (existing) — the members wave dropdown `{id,name}` list. Every
  `createWave` / `updateWave` / `deleteWave` MUST `invalidate(adminListKey("waves"))`.
- No other cache keys are introduced by this feature (research R10).
