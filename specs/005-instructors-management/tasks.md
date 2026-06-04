---
description: "Task list for Instructors Management"
---

# Tasks: Instructors Management

**Input**: Design documents from `specs/005-instructors-management/`

**Prerequisites**: [plan.md](./plan.md), [spec.md](./spec.md), [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/instructors-management-contracts.md](./contracts/instructors-management-contracts.md)

**Tests**: REQUIRED (Principle II, NON-NEGOTIABLE). The field/image validators, the HTML
**sanitizer** (injection inputs), the create/update/remove Server Actions (admin-gate denial,
image-reject, sanitize-on-write, upload/insert/update/delete), and the list/form/editor
rendering are pure or Supabase-mockable, so each ships deterministic unit/component tests,
written first and confirmed failing before implementation. No student/wave-scoped read is
introduced, so there is no cross-wave denial test; the equivalent required denial test is the
**per-action `assertAdminSession` gate** plus the RLS-backed list.

**Organization** (Principle VII): `## Phase N — <name>` mirrors [plan.md](./plan.md);
`### User Story N.x` matches the plan's story numbering (US1.1, US2.1, US3.1, US4.1).
Phase-level acceptance criteria and test scenarios live in plan.md.

**Builds on `002-admin-auth` + `004-admin-management`** (already implemented): reuses
`lib/supabase/server.ts` (cookie-bound RLS client — now also for Storage), `lib/auth/adminGate.ts`
(`assertAdminSession`), the `DashboardShell` nav generalization, the `AddAdminModal`/
`RemoveAdminDialog` client-island patterns, `lib/adminNav.tsx`, `proxy.ts`, and
`lib/strings.ts` / brand tokens. **Adds two things** (Complexity Tracking): a Supabase **Storage**
bucket (`instructor-images`, public-read, `is_admin()` write) and **one** server-side HTML
**sanitizer** dependency. **No service-role usage and no new env var.**

> **Conventions adopted from prior features (do not re-litigate):**
> - **No route-level `loading.tsx`.** Per `004-admin-management` (task T010), a route `loading.tsx`
>   replaces the whole `DashboardShell` (sidebar included) with a bare "Loading…" on every tab
>   switch, which looks slow and breaks the static-sidebar requirement. The fast RSC read needs no
>   skeleton; empty + error states still apply. (This intentionally diverges from the plan's
>   mention of `loading.tsx`.)
> - **Mobile list = deliberate card transform** (R6). `learning.md` Bug 3 warns that an *accidental*
>   squish reads as broken; the instructor list — photo + name + formatted preview per row — is a
>   chosen card design below `sm` (not an accidental reflow) and must be genuinely beautiful with
>   no horizontal **page** scroll. Horizontal scroll is the alternative if the cards disappoint.

## Format: `[ID] [P?] [Story] Description with file path`

- **[P]**: parallelizable (different file, no dependency on an incomplete task)
- **[Story]**: maps to the plan's user stories (US1.1, US2.1, US3.1, US4.1)

---

## Phase 1 — Instructors page: navigation, list & infrastructure

**Purpose**: Deliver the surface and the read — the **Instructors** sidebar entry and the page
listing every instructor (photo, name, clamped formatted-description preview, added date) with
empty + error states and a mobile card transform — plus the foundational infra the later phases
need (migration `0005`, the `instructor-images` bucket + storage policy, the `next.config.ts`
image host, and the proxy matcher entry). Independently testable without add/edit/remove: seed an
instructor row and assert the list renders it; confirm an unauthenticated caller is redirected.

### Shared setup (prerequisite for the phase — no story label)

- [X] T001 [P] Write migration `supabase/migrations/0005_instructors.sql` per [data-model.md](./data-model.md): `create table if not exists public.instructors (id uuid primary key default gen_random_uuid(), name text not null, description_html text, image_path text, created_at timestamptz not null default now(), updated_at timestamptz not null default now())`; `alter table public.instructors enable row level security`; `create policy instructors_select ... for select using (public.is_admin())` and `create policy instructors_write ... for all using (public.is_admin()) with check (public.is_admin())`; `create policy instructor_images_admin_write on storage.objects for all using (bucket_id='instructor-images' and public.is_admin()) with check (bucket_id='instructor-images' and public.is_admin())`. **Do NOT create the bucket in SQL** — the operator creates the public `instructor-images` bucket in the dashboard (clarified 2026-06-04); the migration adds only the table + RLS + the storage **write** policy
- [X] T002 [P] Add **all** Instructors copy from [contracts/instructors-management-contracts.md](./contracts/instructors-management-contracts.md) C5 (group C9) to `lib/strings.ts` in one edit (`instructorsNavLabel`, `instructorsTitle`, `instructorsSubtitle`, `instructorsAddLabel`, `instructorsColImage`/`…Name`/`…Description`/`…Added`/`…Actions`, `instructorsEmptyNote`, `instructorFormAddTitle`, `instructorFormEditTitle`, `instructorNameLabel`, `instructorImageLabel`, `instructorImageHelp`, `instructorDescriptionLabel`, `instructorFormSubmitLabel`, `instructorFormSubmittingLabel`, `instructorsNameRequired`, `instructorsImageInvalid`, `instructorsImageUploadFailed`, `instructorsSaveFailed`, `instructorsForbidden`, `removeInstructorTitle`, `removeInstructorConfirm`, `removeInstructorSubmitLabel`, `removeInstructorSubmittingLabel`, `instructorsRemoveFailed`, `rteBold`, `rteItalic`, `rteUnderline`, `rteBulletList`, `rteNumberList`, `rteFontSize`; reuse the existing `cancelLabel`/`closeLabel`)
- [X] T003 [P] Add the matcher entry `"/admin/instructors/:path*"` to the `config.matcher` array in `proxy.ts` so the new top-level route is admin-protected (the `proxy` body is unchanged)
- [X] T004 [P] Add `images.remotePatterns` to `next.config.ts` per [research.md](./research.md) R4: `{ protocol: 'https', hostname: <your-project-ref>.supabase.co, pathname: '/storage/v1/object/public/**' }` so `next/image` may load instructor photos from the public bucket
- [ ] T005 Confirm the operator-created **public** `instructor-images` bucket exists, then apply migration `0005` (dashboard or Supabase MCP, per [quickstart.md](./quickstart.md) §1–§2); verify the `instructor_images_admin_write` policy is present on `storage.objects` (depends on T001; requires the operator's bucket)

### User Story 1.1: Instructors page lists every instructor (Priority: P1) 🎯 MVP

**Goal**: An admin opens **Instructors** from the sidebar and sees every instructor as a
row/card with photo, name, a clamped formatted-description preview, and added date; an empty
list shows a friendly empty state.

**Independent Test**: Seed an instructor row, sign in, click **Instructors**, and confirm it
renders (photo/name/preview/added); with no rows confirm the empty state; visit
`/admin/instructors` signed out and confirm the redirect to `/admin`.

#### Tests for User Story 1.1 (REQUIRED — Principle II) ⚠️

> Write first; confirm they FAIL before implementation.

- [X] T006 [P] [US1.1] Component/RSC test `tests/app/admin/instructors/instructorsPage.test.tsx` (mock `lib/supabase/server` + `next/link` + `next/image`): renders a row per `instructors` record with photo, name, a clamped description preview, and added date; an empty result renders `instructorsEmptyNote`; the read is performed via the cookie/RLS `createClient()` (no service-role client is constructed)

#### Implementation for User Story 1.1

- [X] T007 [P] [US1.1] Create `components/InstructorTable.tsx` (Server Component) per contract C3: columns Image (`next/image` thumbnail, `loading="lazy"`, reserved dimensions), Name, Description (render the already-sanitized `description_html` with a line-clamp preview, R8), Added (`created_at`), Actions (edit + remove slots — wired in Phases 3/4); at `< sm` render each row as a deliberate stacked **card** (R6, see learning.md Bug 3 — beautiful, not an accidental squish), no horizontal **page** scroll at 320px; each row carries the `data-instructor-row` test hook; render `instructorsEmptyNote` when the list is empty
- [X] T008 [P] [US1.1] Append a third `NavItem` `{ label: strings.instructorsNavLabel, href: '/admin/instructors', icon: <…> }` to `adminNavItems` in `lib/adminNav.tsx` (add a small inline SVG icon consistent with the existing entries)
- [X] T009 [US1.1] Create `app/admin/instructors/page.tsx` (RSC): read `instructors` via `createClient()` (cookie-bound, RLS) ordered by `created_at desc`; render `DashboardShell` with `navItems={adminNavItems}` and `activeHref='/admin/instructors'`, a header (`instructorsTitle`/`instructorsSubtitle` + an **Add Instructor** trigger placeholder) using the `flex items-start justify-between` + `shrink-0` action / `min-w-0` title pattern (learning.md Bug 2), and `<InstructorTable>` (depends on T007, T008)

**Checkpoint**: The list is independently functional and testable. Capture Phase 1 in
`specs/005-instructors-management/walkthrough.md` before sign-off (Principle VII).

---

## Phase 2 — Add instructor: image upload + rich-text description

**Purpose**: Deliver creation — the **Add Instructor** button → shared `InstructorFormModal`, the
`RichTextEditor` island, the pure `validation.ts` helpers, the server `sanitize.ts` wrapper (+
the new sanitizer dependency), and the gated `createInstructor` Server Action (validate name →
validate image → upload to Storage → sanitize description → insert). Independently testable with a
mocked Supabase/storage client.

### User Story 2.1: Add an instructor with an image and a formatted description (Priority: P1)

**Goal**: An admin opens the form, enters a name, uploads a previewed image, writes a formatted
description, and saves; the instructor appears in the list. Empty name and bad images are
rejected; the description is sanitized server-side; Cancel creates nothing.

**Independent Test**: Open the form, submit a valid name + allowed image + formatted description →
the row appears with the photo and preserved formatting; submit an empty name or a `.gif`/
oversized file → rejected with no row; submit a `<script>`-laced description → stored stripped.

#### Tests for User Story 2.1 (REQUIRED — Principle II) ⚠️

- [X] T010 [P] [US2.1] Unit test `tests/lib/instructors/validation.test.ts`: `validateInstructorFields` — empty/whitespace name → fail `instructorsNameRequired`; valid → `{ok:true}` with the name trimmed (FR-010). `validateImageFile` — a disallowed MIME (e.g. `image/gif`) → fail; size `> MAX_IMAGE_BYTES` → fail; an allowed `image/png|jpeg|webp` within the limit → `{ok:true}` (FR-007). Assert the `ALLOWED_IMAGE_TYPES` / `MAX_IMAGE_BYTES` boundaries
- [X] T011 [P] [US2.1] Unit test `tests/lib/instructors/sanitize.test.ts`: `sanitizeDescription` strips `<script>`, `on*=` handlers, `javascript:` URLs, and disallowed tags/attributes/inline `style`; **preserves** the allowed tags (`b,strong,i,em,u,p,br,ul,ol,li`) and a `span` carrying an allowed font-size class; **drops** a `span` class not in `FONT_SIZE_CLASSES` (FR-009, SC-007)
- [X] T012 [P] [US2.1] Server Action test `tests/app/admin/instructors/createInstructor.test.ts` (mock `lib/supabase/server`, including `storage.from('instructor-images').upload`): no admin session → `instructorsForbidden` before any upload/insert (FR-015); empty name → `instructorsNameRequired`, no upload/insert; a disallowed/oversized image → `instructorsImageInvalid`, no upload/insert; a valid submission → `storage…upload` called, `sanitizeDescription` applied, an `instructors` insert with `{ name, description_html, image_path }`, then `revalidatePath('/admin/instructors')`; assert no service-role client is constructed

#### Implementation for User Story 2.1

- [X] T013 [P] [US2.1] Create `lib/instructors/validation.ts` (pure, no Supabase/Next imports) per contract C2: `validateInstructorFields(name)`, `validateImageFile({type,size})`, and the exported `ALLOWED_IMAGE_TYPES` (`['image/png','image/jpeg','image/webp']`) + `MAX_IMAGE_BYTES` (`5*1024*1024`), returning the `FieldValidation` union with `instructorsNameRequired` / `instructorsImageInvalid`
- [X] T014 [P] [US2.1] Add the HTML sanitizer dependency (e.g. `sanitize-html` + its `@types`) to `package.json` and create `lib/instructors/sanitize.ts` (server) per contract C2: `sanitizeDescription(input)` applying the R2/R3 allowlist (tags `b,strong,i,em,u,p,br,ul,ol,li,span`; only `class` on `span`, restricted to the exported `FONT_SIZE_CLASSES`; everything else stripped) and `export const FONT_SIZE_CLASSES`
- [X] T015 [P] [US2.1] Create `components/RichTextEditor.tsx` (`'use client'`) per contract C3: a `contentEditable` surface + a toolbar of real `<button type="button">` controls (`rteBold`/`rteItalic`/`rteUnderline`/`rteBulletList`/`rteNumberList`/`rteFontSize`) with `aria-label`s and visible focus; applies bold/italic/underline/lists via `document.execCommand` and font size by wrapping the selection in a `span` with one of the `FONT_SIZE_CLASSES` (R3); mirrors the editor's HTML into a hidden `name="description_html"` field on input/submit; keyboard-operable
- [X] T016 [P] [US2.1] Create `components/InstructorFormModal.tsx` (`'use client'`, `useActionState`) per contract C3: a shared **add/edit** dialog that **renders its own trigger** — an **Add Instructor** button when no `instructor` prop is given, an **Edit** control when one is (mirroring how `AddAdminModal` owns its trigger). Fields: Name (`instructorNameLabel`, ≥16px), image file input + live `<img>` preview + a client-side type/size pre-check reusing `ALLOWED_IMAGE_TYPES`/`MAX_IMAGE_BYTES`, and `<RichTextEditor>` (`instructorDescriptionLabel`, seeded from `instructor.description_html` in edit mode). States: idle / submitting (`instructorFormSubmittingLabel`, disabled) / field-error / image-error (`role="alert"`) / success (closes + list revalidates). Cancel + close (×) dismiss without saving and discard the picked image (FR-012); `role="dialog"`, labelled, focus-trapped, `Esc` closes, scrolls internally (depends on T013, T015)
- [X] T017 [US2.1] Create `app/admin/instructors/actions.ts` with `createInstructor(prevState, formData)` per contract C1: `assertAdminSession` (else `instructorsForbidden`) → `validateInstructorFields` → if an image File is present, `validateImageFile` (else `instructorsImageInvalid`) then `createClient().storage.from('instructor-images').upload(<uuid>.<ext>, file)` (else `instructorsImageUploadFailed`) capturing `image_path` → `sanitizeDescription(formData.get('description_html'))` → insert `instructors` `{ name, description_html, image_path }` via the cookie/RLS client (else `instructorsSaveFailed`) → `revalidatePath('/admin/instructors')` → return `{ saved: true }`; define and export `InstructorFormState` (depends on T013, T014)
- [X] T018 [US2.1] Mount `<InstructorFormModal>` (create mode, no `instructor` prop) as the **Add Instructor** trigger in the `app/admin/instructors/page.tsx` header, replacing the placeholder from T009 (depends on T009, T016, T017)

**Checkpoint**: An admin can add an instructor (image + formatted, sanitized description) and see
it in the list. Update `specs/005-instructors-management/walkthrough.md` for Phase 2 before
sign-off (Principle VII).

---

## Phase 3 — Edit instructor

**Purpose**: Deliver editing — the per-row **Edit** action opens the shared `InstructorFormModal`
pre-populated, and the gated `updateInstructor` Server Action persists changes (name, replaced
image with old-object cleanup, re-sanitized description). Independently testable with a mocked
client.

### User Story 3.1: Edit an existing instructor (Priority: P2)

**Goal**: An admin opens an instructor's edit form (pre-filled), changes the name / image /
description, and saves; the list reflects every change. Cancel changes nothing; clearing the name
is blocked.

**Independent Test**: Open Edit on a seeded instructor → form pre-filled; change name + replace
image + re-format description → list updates; Cancel → unchanged; clear the name → blocked.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [X] T019 [P] [US3.1] Server Action test `tests/app/admin/instructors/updateInstructor.test.ts` (mock `lib/supabase/server`, including `storage.from`): no admin session → `instructorsForbidden` before any write (FR-015); missing `id` or empty name → blocked with no update; a **new** image → `validateImageFile` + upload + `image_path` repointed and a best-effort remove of the prior object attempted (R11); **no** new image → the existing `image_path` is preserved; `sanitizeDescription` runs; the update sets `updated_at`; `revalidatePath` is called

#### Implementation for User Story 3.1

- [X] T020 [US3.1] Add `updateInstructor(prevState, formData)` to `app/admin/instructors/actions.ts` per contract C1: `assertAdminSession` (else `instructorsForbidden`) → require `id` → `validateInstructorFields` → if a new image File is present, `validateImageFile` + upload + set `image_path` to the new path and best-effort `storage…remove([oldPath])` (R11), else keep the existing `image_path` → `sanitizeDescription` → `update instructors set name, description_html, image_path, updated_at = now() where id = :id` via the cookie/RLS client (else `instructorsSaveFailed`) → `revalidatePath('/admin/instructors')` → `{ saved: true }` (depends on T017)
- [X] T021 [US3.1] In `components/InstructorTable.tsx`, render `<InstructorFormModal instructor={row}>` (edit mode, its own per-row **Edit** trigger) in the Actions cell of every row (depends on T007, T016, T020)

**Checkpoint**: Add → edit round-trips correctly (incl. image replacement + re-sanitize). Update
`specs/005-instructors-management/walkthrough.md` for Phase 3 before sign-off (Principle VII).

---

## Phase 4 — Remove instructor

**Purpose**: Deliver lifecycle removal — a per-row **Remove** control with explicit in-page
confirmation and the gated `removeInstructor` Server Action (delete row + best-effort storage
cleanup). Independently testable with a mocked client.

### User Story 4.1: Remove an instructor with a confirmation step (Priority: P2)

**Goal**: An admin removes an instructor after confirming; the instructor disappears and does not
reappear. Cancel removes nothing; a failed storage cleanup does not block the removal.

**Independent Test**: Trigger Remove on a row → confirm → it disappears; Cancel → it stays.

#### Tests for User Story 4.1 (REQUIRED — Principle II) ⚠️

- [X] T022 [P] [US4.1] Server Action test `tests/app/admin/instructors/removeInstructor.test.ts` (mock `lib/supabase/server`, including `storage.from`): no admin session → `instructorsForbidden` before any delete (FR-015); a valid `id` → reads `image_path`, deletes the `instructors` row, attempts a storage-object remove, and `revalidatePath` → `{ removed: true }`; when the storage remove **fails**, the row is still deleted and `{ removed: true }` is returned (R11)

#### Implementation for User Story 4.1

- [X] T023 [US4.1] Add `removeInstructor(prevState, formData)` to `app/admin/instructors/actions.ts` per contract C1: `assertAdminSession` (else `instructorsForbidden`) → require `id` (else `instructorsForbidden`) → read the row's `image_path` (cookie/RLS) → `delete from instructors where id = :id` (else `instructorsRemoveFailed`) → best-effort `storage.from('instructor-images').remove([image_path])` (R11 — failure does not fail the action) → `revalidatePath('/admin/instructors')` → `{ removed: true }`; define and export `RemoveInstructorState` (depends on T017)
- [X] T024 [P] [US4.1] Create `components/RemoveInstructorDialog.tsx` (`'use client'`, `useActionState` over `removeInstructor`): an in-page accessible confirm dialog (NOT native `confirm()` — browser-modal constraint) showing the instructor's name + `removeInstructorConfirm`, a destructive `removeInstructorSubmitLabel`/`removeInstructorSubmittingLabel` button and Cancel; a hidden `id` input; error in a `role="alert"` region; Cancel removes nothing — reusing the `RemoveAdminDialog` token styling
- [X] T025 [US4.1] Wire the per-row **Remove** control in `components/InstructorTable.tsx` to `<RemoveInstructorDialog>` for every row (depends on T007, T024)

**Checkpoint**: Full list → add → edit → remove lifecycle works. Update
`specs/005-instructors-management/walkthrough.md` for Phase 4 before sign-off (Principle VII).

---

## Phase 5 — Polish & Cross-Cutting Concerns

- [ ] T026 [P] Validate Quality Gates (Principle IV): `/admin/instructors` list + Add/Edit modal + `RichTextEditor` toolbar + Remove dialog at **320 / 390 / 430 / 768px and desktop** — deliberate card transform with **no horizontal page scroll**, clipping, or overlap; image thumbnails lazy-load and reserve space (no CLS); the description preview is clamped; inputs ≥16px on mobile; **every** control (incl. each toolbar button) shows visible focus and is keyboard-operable; the modal is focus-trapped and scrolls internally; text/controls meet WCAG 2.1 AA contrast; errors/success announced (`role="alert"`)
- [X] T027 [P] Run `npm run build` (clean) and `npm run lint` (clean), then `npm test` (all suites green)
- [ ] T028 Run the [quickstart.md](./quickstart.md) §"Verify" steps end to end against a configured Supabase project (golden path: list → add → edit → remove; plus the empty state, name-required, unsupported/oversized image rejection, `<script>`/handler sanitization, and route protection)
- [X] T029 Write/finalize `specs/005-instructors-management/walkthrough.md` covering all four phases per Principle VII (how to run; route/component paths; numbered desktop + mobile verification; known gaps — e.g. no student-facing instructors page yet, one image per instructor, font-size limited to a fixed class set)

---

## Dependencies & Execution Order

### Phase dependencies

- **Phase 1** (list, nav & infra) is a shippable MVP increment; it needs the shared setup
  (migration `0005` + bucket/policy, strings, proxy matcher, image host).
- **Phase 2** (add) depends on Phase 1 (the list/page to add into) and on the `instructors` table
  + bucket from T001/T005; it introduces `app/admin/instructors/actions.ts`, the validators, the
  sanitizer, and the form/editor islands.
- **Phase 3** (edit) depends on Phase 2 (the shared `InstructorFormModal` and the
  `actions.ts`/`createInstructor` foundation it extends).
- **Phase 4** (remove) depends on Phase 1 (`InstructorTable`) and Phase 2 (`actions.ts`).
- **Phase 5 (Polish)** depends on Phases 1–4.

### Within Phase 1

- Shared setup: T001, T002, T003, T004 are parallel `[P]`; **T005 depends on T001**.
- US1.1: test T006 `[P]` first → T007 `[P]` (table) + T008 `[P]` (nav item) → **T009 depends on
  T007 + T008**.

### Within Phase 2

- US2.1: tests T010, T011, T012 `[P]` first → T013 `[P]` (validators) + T014 `[P]` (sanitizer/dep)
  + T015 `[P]` (editor) → **T016 depends on T013 + T015** → **T017 depends on T013 + T014** →
  **T018 depends on T009 + T016 + T017**.

### Within Phase 3

- US3.1: test T019 `[P]` first → **T020 depends on T017** → **T021 depends on T007 + T016 + T020**.

### Within Phase 4

- US4.1: test T022 `[P]` first → **T023 depends on T017** → T024 `[P]` →
  **T025 depends on T007 + T024**.

> **Same-file sequencing** (edit in order, not in parallel): `app/admin/instructors/actions.ts`
> (T017 → T020 → T023); `components/InstructorTable.tsx` (T007 → T021 → T025);
> `app/admin/instructors/page.tsx` (T009 → T018); `lib/strings.ts` is a single edit (T002).

### Parallel opportunities

- Phase 1 shared setup: T001 + T002 + T003 + T004 together.
- Phase 2: T010 + T011 + T012 together; then T013 + T014 + T015 are independent files (and T016
  starts once T013 + T015 land).
- Phase 4: T022 first; T024 parallel with the `removeInstructor` action (T023).

---

## Implementation Strategy

### MVP first (Phase 1 only)

1. Complete the shared setup (T001–T005).
2. Complete US1.1 (T006–T009).
3. **STOP and VALIDATE**: an admin can open **Instructors** and see the full, admin-only list
   (photo/name/preview/added) with the empty state and a beautiful mobile card layout. Shippable,
   demoable increment.

### Incremental delivery

1. Phase 1 → list, navigation & infrastructure (MVP).
2. Phase 2 → add instructor (image upload + sanitized rich-text description).
3. Phase 3 → edit instructor (reuses the form; image replacement + re-sanitize).
4. Phase 4 → remove instructor (confirmation + storage cleanup) → full lifecycle.
5. Phase 5 → responsive/a11y gates, quickstart validation, walkthrough.

---

## Notes

- [P] = different files, no dependency on an incomplete task.
- All Instructors logic ships deterministic tests written first (Principle II). No new
  student/wave-scoped read is introduced, so no cross-wave denial test is required — admin-only
  enforcement is covered by the `assertAdminSession` gate tests (T012, T019, T022) and the
  `instructors`/`storage.objects` RLS; the list's admin-only read is asserted in T006.
- **No service-role client** is constructed anywhere in this feature; all writes (rows **and**
  Storage objects) go through the cookie/RLS client under `is_admin()` policies (R5). Tests assert
  the service-role key never appears in client/request-rendered output.
- **Sanitization is the trust boundary**: the description is sanitized server-side in
  `createInstructor`/`updateInstructor` before persistence (FR-009) and re-sanitized on render as
  defense-in-depth. The editor's `execCommand` quirks can never produce unsafe stored markup.
- **No route-level `loading.tsx`** (per the 004 learning above) — the fast RSC read needs none;
  empty + error states remain.
- Image type/size is enforced **both** client-side (T016 pre-check) and server-side (T017/T020
  via `validateImageFile`) per Principle V.
- Commit after each task or logical group; `proxy.ts` body and all 002/004 behavior remain intact.
