# Research: Wave Management

**Feature**: 008-wave-management | **Date**: 2026-06-08

All decisions below were chosen to **reuse the existing Instructors feature machinery**
(gated Server Action → pure validation → sanitize → Storage upload → cache invalidate, all
on the cookie/RLS client) and the existing **wave == `public.tenants`** isolation model.

---

## R1 — Wave is the existing `tenants` row, evolved in place

- **Decision**: A wave IS a `public.tenants` row. Add two columns to `tenants`:
  `description_html text` and `type text not null check (type in ('online','offline'))`.
  Delete the two pre-seeded generic `Online`/`Offline` rows (reference data, no members).
  Order the Waves list by the existing `created_at desc`.
- **Rationale**: `wave == tenant` is the established model; all wave isolation
  (`is_admin()`, `jwt_tenant_id()`, the student `tenant_id` JWT claim) already keys off
  `tenants.id`. Reusing it means zero new isolation machinery.
- **Alternatives**: A separate `waves` table (rejected — would duplicate the tenant claim
  and every RLS policy, and break the student `app_metadata.tenant_id` linkage).

## R2 — Wave-scoped child tables denormalize `tenant_id`

- **Decision**: `wave_weeks`, `wave_materials`, `wave_assignments`, and `wave_submissions`
  each carry a `tenant_id uuid` (the wave) directly, so the student read policy is the flat
  `tenant_id = jwt_tenant_id()` — identical to the `students` policy, no joins.
- **Rationale**: Flat, fast, hard-to-get-wrong RLS; matches the existing `students` policy
  exactly. The cross-wave denial case is then a single predicate per table.
- **Alternatives**: Resolve the wave by joining `week → wave` inside each policy (rejected —
  slower and easier to write a leaky policy).

## R3 — No service-role; cookie/RLS client only

- **Decision**: Every admin write (wave, week, material, assignment) runs on the
  cookie-bound client under `is_admin()` policies. Student submission writes run on the
  student's cookie client under student policies. The service-role client is **not** used.
- **Rationale**: Instructors proved the cookie/RLS client handles row + Storage writes for
  admins; least privilege per Principle VI. Service-role is reserved for `auth.users`
  provisioning, which this feature never does.
- **Alternatives**: Service-role for uploads (rejected — unnecessary privilege).

## R4 — Two PRIVATE Storage buckets, wave-id encoded in the object path

- **Decision**: Operator creates two **private** buckets in the Supabase dashboard
  (mirroring how `instructor-images` was provisioned); the migration adds only the RLS:
  - **`wave-materials`** — path `‹wave_id›/‹week_id›/‹file›`. Admin write/all; student
    read where `(storage.foldername(name))[1] = jwt_tenant_id()::text`.
  - **`assignment-submissions`** — path `‹wave_id›/‹assignment_id›/‹student_id›/‹file›`.
    Admin read/all; student read+write where the wave folder = their tenant **and** the
    student folder = their own `students.id`.
  - Downloads use short-lived **signed URLs** (`createSignedUrl`), which on a private bucket
    succeed only when the caller passes the Storage `select` policy → wave isolation holds.
- **Rationale**: Public buckets are world-readable; wave materials and student submissions
  are wave-isolated/private data (Principle VI). Path-encoded wave id makes the policy a
  one-line predicate using the existing helpers.
- **Alternatives**: Public bucket with unguessable names (rejected — security by obscurity,
  fails wave isolation); a DB-driven join policy (rejected — Storage RLS can't join cheaply).

## R5 — Reuse `sanitizeDescription` for all rich text

- **Decision**: Reuse `lib/instructors/sanitize.ts#sanitizeDescription` (and the
  `RichTextEditor` component) for the wave description, week description, and assignment
  instructions — server-sanitized before persistence.
- **Rationale**: The sanitizer is general HTML allow-listing, not instructor-specific;
  reusing it avoids a second sanitizer to keep in sync.
- **Alternatives**: A new wave sanitizer (rejected — duplication / drift risk).

## R6 — Pure, shared upload validation (client + server)

- **Decision**: New `lib/waves/validation.ts` mirroring `lib/instructors/validation.ts`,
  exporting pure functions used identically by the client pre-check and the authoritative
  server check (Principle V):
  - `validateWaveFields(name, type)` — name required (trimmed), type ∈ {online, offline}.
  - `validateMaterialFile({type,size})` — allowed types + max size.
  - `validateSubmissionFile({type,size})` — allowed types + max size.
- **Rationale**: Principle V requires format/size enforced both client- and server-side; a
  pure module gives one source of truth that is deterministically unit-testable.

## R7 — Accepted file types & size limit

- **Decision**: Materials accept PDF and PowerPoint:
  `application/pdf`, `application/vnd.ms-powerpoint` (.ppt),
  `application/vnd.openxmlformats-officedocument.presentationml.presentation` (.pptx).
  Submissions accept the same set plus Word
  (`application/msword`, `…wordprocessingml.document`). **Max 25 MB** each.
- **Rationale**: Matches the stated PPT/PDF need with a sensible documents allow-list and a
  generous-but-bounded size for mobile uploads. Limits are decisions, easily tuned.
- **Note on Principle V autosave**: The autosave-draft rule targets long *text* drafts.
  An assignment submission here is a single **file upload**, not in-app text authoring, so
  there is no draft to lose — autosave does not apply. Upload format/size limits DO apply
  and are enforced both sides.

## R8 — Latest-wins submissions (no history)

- **Decision**: `wave_submissions` has `unique (assignment_id, student_id)`; re-submitting
  upserts the row and overwrites the file at a deterministic path
  (`…/‹student_id›/submission.‹ext›`, `upsert: true`).
- **Rationale**: Spec assumes one current submission per student; simplest correct model.
- **Alternatives**: Submission history table (rejected — out of scope for v1).

## R9 — Routes, nav, and route protection

- **Decision**:
  - `app/admin/waves/page.tsx` — Waves list (cards, newest-first, Create button).
  - `app/admin/waves/new/page.tsx` — create-wave page (name, description RTE, type). This
    is the single creation surface both entry points reach.
  - `app/admin/waves/[id]/page.tsx` — manage a wave: edit fields + author weeks, materials,
    assignments, and review submissions.
  - Each `waves` route group ships `loading.tsx` / `error.tsx` / `not-found.tsx`.
  - Add `Waves` to `lib/adminNav.tsx`.
  - Add `"/admin/waves/:path*"` to the `proxy.ts` matcher (admin-gated like the others).
  - Extend `app/student/dashboard/page.tsx` in place to render the wave description, weeks,
    material downloads, and assignment submission.
- **Rationale**: Mirrors the existing per-panel route conventions; a dedicated create page
  satisfies the spec's "direct to same wave creation page" from the add-members flow.

## R10 — Caching

- **Decision**: Keep caching the **members wave dropdown** under the existing
  `adminListKey("waves")` (shape `{id,name}`) and **invalidate it on every wave
  create/edit/delete**. The Waves management pages and the student wave-content read are
  **not** cached in this feature (admin pages are low-traffic; student content avoids
  per-user invalidation staleness).
- **Rationale**: Reuses the 007 cache where it already exists without introducing a
  per-user invalidation problem for wave content. The student read is RSC and bounded.
- **Alternatives**: Cache student wave content under `studentKey(...,"wave")` relying on the
  60 s TTL (deferred — acceptable later, unnecessary complexity now).

## R11 — Deletion: block-while-non-empty + best-effort file cleanup

- **Decision**: `deleteWave` first counts members (`students` in the wave) and content
  (weeks); if any exist, it refuses with a clear message. Deleting a material / assignment /
  submission also best-effort removes its Storage object (mirrors `removeImage` — a failed
  cleanup never fails the action). FK `on delete cascade` protects against orphaned rows if
  a parent is ever removed.
- **Rationale**: Prevents orphaned members and files (Principle VI / SC-006); reuses the
  proven best-effort cleanup pattern.

## R12 — Testing approach

- **Decision**:
  - Pure unit tests for `lib/waves/validation.ts` (name/type, material/submission file).
  - Pure unit tests for the Storage path builders (wave-id-first invariant).
  - Server-action tests mocking `@/lib/supabase/*` + the admin/student gates (mirrors the
    instructors/members action tests).
  - Extend `tests/integration/rls.test.ts` with the **cross-wave denial** case for
    `wave_weeks`, `wave_materials`, `wave_assignments`, and `wave_submissions`
    (Principle II + VI, NON-NEGOTIABLE).
- **Rationale**: Matches the established test layout and the non-negotiable testing gates.
