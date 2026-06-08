---
description: "Task list for Wave Management implementation"
---

# Tasks: Wave Management

**Input**: Design documents from `specs/008-wave-management/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/wave-management-contracts.md, quickstart.md

**Tests**: REQUIRED (constitution Principle II — NON-NEGOTIABLE). Every wave-scoped path ships its cross-wave access-denial test (Principle VI). Write tests first and confirm they FAIL before implementing.

**Organization**: `## Phase N` → `### User Story N.x` → atomic `- [ ]` items (Principle VII). Story labels `[US1.1]…[US4.2]` map to the user stories in `plan.md`. Phase-level acceptance criteria and test scenarios live in `plan.md`.

**Stack/paths** (from plan.md): Next.js 16 App Router, TS strict, Supabase (Postgres + Auth + Storage), Vitest. Domain logic pure in `lib/waves/`; admin surface under `app/admin/waves/`; student surface extends `app/student/dashboard/`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: the user story the task serves (Setup/Foundational/Polish carry no story label)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: copy, nav, and the operator-provisioned buckets that everything else relies on.

- [x] T001 [P] Add all Wave-Management UI copy to `lib/strings.ts` (waves nav label; list title/subtitle + empty state; create/edit form labels & buttons; name/type validation messages; week, material, assignment labels; upload type/size error messages; delete-blocked message; student wave-section + submission copy).
- [x] T002 [P] Add a **Waves** nav item (label + icon) to `lib/adminNav.tsx` (single source of truth for the admin sidebar).
- [x] T003 **[Operator]** In the Supabase dashboard, create two **PRIVATE** Storage buckets — `wave-materials` and `assignment-submissions` (mirrors how `instructor-images` was created, but private). The migration adds policies, not the buckets (see `quickstart.md`).

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: schema + RLS (rows and files), pure shared logic, and route protection. **⚠️ No user story can begin until this phase is complete.**

- [x] T004 Create migration `supabase/migrations/0008_waves.sql` per `data-model.md`: (a) `delete from public.tenants where name in ('Online','Offline')`; (b) add `tenants.description_html` and `tenants.type` (+ `tenants_type_check` for `online`/`offline`, then `set not null`); (c) create `wave_weeks`, `wave_materials`, `wave_assignments`, `wave_submissions` with FKs (`on delete cascade`), the `(tenant_id, position)` index, and `wave_submissions` `unique (assignment_id, student_id)`; (d) enable RLS + table policies (admin all; student `tenant_id = jwt_tenant_id()`; submissions student-own select/insert/update); (e) Storage RLS for both buckets using `(storage.foldername(name))[1] = jwt_tenant_id()::text` (+ student-id folder for submissions).
- [x] T005 Apply migration `0008_waves.sql` to the Supabase project (MCP `apply_migration`); if generated types are used, regenerate them.
- [x] T006 [P] Implement `lib/waves/validation.ts` (pure): `validateWaveFields(name, type)`, `validateMaterialFile({type,size})` (PDF/PPT/PPTX, ≤25 MB), `validateSubmissionFile({type,size})` (+ DOC/DOCX), and an `extensionForType` helper — mirrors `lib/instructors/validation.ts`.
- [x] T007 [P] Implement `lib/waves/files.ts` (pure): bucket name constants, `materialPath(waveId, weekId, ext)`, `submissionPath(waveId, assignmentId, studentId, ext)` (wave id ALWAYS first segment), and a thin `signedUrl(supabase, bucket, path)` wrapper.
- [x] T008 [P] Unit tests `tests/lib/waves/validation.test.ts`: required name; type ∈ {online,offline}; allowed/blocked material & submission MIME types; size boundary (0, 25 MB, >25 MB).
- [x] T009 [P] Unit tests `tests/lib/waves/files.test.ts`: wave-id-first path invariant for both builders; extension mapping.
- [x] T010 Add `"/admin/waves/:path*"` to `config.matcher` in `proxy.ts` (admin-gated like the other `/admin/**` groups).
- [x] T011 Extend `tests/integration/rls.test.ts` with the **cross-wave denial** case (NON-NEGOTIABLE, Principle VI) for `wave_weeks`, `wave_materials`, `wave_assignments`, and `wave_submissions`: a Wave-A student JWT returns 0 Wave-B rows; admin sees all; a student cannot insert a submission into another wave or read another student's submission.

**Checkpoint**: schema, isolation, pure logic, and routing ready — user stories can begin.

---

## Phase 3 — Wave foundation (create, list, student description)

**Purpose**: the MVP — admins create/list waves; students see their wave's description. Phase acceptance criteria & scenarios: `plan.md` Phase 1.

### User Story 1.1: Admin creates a wave and sees it listed (Priority: P1) 🎯 MVP

**Goal**: An admin creates a wave (name, rich-text description, Online/Offline type) and it appears as the newest card in the Waves list.

**Independent Test**: Sign in as admin → create a wave → it tops the list and survives reload.

#### Tests for User Story 1.1 (write first, ensure they FAIL) ⚠️

- [x] T012 [P] [US1.1] Test `createWave` in `tests/app/admin/waves/createWave.test.ts`: success path (inserts name/type, sanitized description, invalidates `adminListKey("waves")`); rejects missing name; rejects missing/invalid type; strips `<script>` from description; **non-admin denial** (generic error).
- [x] T013 [P] [US1.1] Test the list page in `tests/app/admin/waves/wavesPage.test.tsx`: renders cards newest-first; empty state when none; create button present.
- [x] T014 [P] [US1.1] Test `tests/components/WaveForm.test.tsx`: client-side validation pre-check (name/type), type control, hidden sanitized-HTML field wiring.

#### Implementation for User Story 1.1

- [x] T015 [US1.1] Implement `createWave` in `app/admin/waves/actions.ts`: `getUser()` + `assertAdminSession` → `validateWaveFields` → `sanitizeDescription` (reuse `lib/instructors/sanitize`) → insert into `tenants` → `revalidatePath("/admin/waves")` → `invalidate(adminListKey("waves"))`.
- [x] T016 [P] [US1.1] Create `components/WaveForm.tsx` (client; name input, `RichTextEditor` description, Online/Offline selector, submit/cancel) and `components/WaveCard.tsx` (server; name, type badge, description snippet, link to `/admin/waves/[id]`).
- [x] T017 [US1.1] Create `app/admin/waves/page.tsx` (RSC: list waves ordered `created_at desc` as `WaveCard`s, empty state, **Create wave** button) plus `loading.tsx`, `error.tsx` (`'use client'`), and `not-found.tsx` in `app/admin/waves/`.
- [x] T018 [US1.1] Create `app/admin/waves/new/page.tsx` (renders `WaveForm` wired to `createWave`; redirect to `/admin/waves` on success).

### User Story 1.2: Student sees their wave's description on the dashboard (Priority: P1)

**Goal**: A student sees only their own wave's sanitized description on their dashboard.

**Independent Test**: Enroll a student in a wave with a description → it shows; a different wave's description never shows.

#### Tests for User Story 1.2 (write first) ⚠️

- [x] T019 [P] [US1.2] Extend `tests/app/student/studentDashboard.test.tsx`: renders own wave description; empty state when none; **does not render another wave's description** (cross-wave denial).

#### Implementation for User Story 1.2

- [x] T020 [US1.2] Extend `app/student/dashboard/page.tsx` to read the caller's wave (`tenants` row, RLS-scoped by `id = jwt_tenant_id()`) and render its sanitized `description_html` with a clear empty state.

**Checkpoint**: MVP — waves can be created, listed, and a student sees their description. Add the Phase 1 section to `walkthrough.md`.

---

## Phase 4 — Weeks & materials (authoring + student download)

**Purpose**: admins structure a wave into weeks and upload PDF/PPT materials; students download their wave's materials. Acceptance criteria & scenarios: `plan.md` Phase 2.

### User Story 2.1: Admin adds weeks and uploads materials (Priority: P2)

**Goal**: Admin adds weeks (optional description) and uploads materials (PDF/PPT, ≤25 MB) under a wave.

**Independent Test**: Open a wave → add a week + a material → both persist under the correct week on reload.

#### Tests for User Story 2.1 (write first) ⚠️

- [x] T021 [P] [US2.1] Test `tests/app/admin/waves/weeks.test.ts`: `addWeek`/`updateWeek`/`removeWeek` (admin-gated; sanitized week description; position ordering; non-admin denial).
- [x] T022 [P] [US2.1] Test `tests/app/admin/waves/materials.test.ts`: `addMaterial` uploads to a `‹wave_id›/‹week_id›/…` path + inserts row; rejects disallowed type/oversize (server-authoritative); `removeMaterial` deletes row + best-effort removes object.
- [x] T023 [P] [US2.1] Test `tests/components/WeekEditor.test.tsx`: client pre-validation rejects bad material type/size before upload; week add/edit UI.

#### Implementation for User Story 2.1

- [x] T024 [US2.1] Add `addWeek`/`updateWeek`/`removeWeek` and `addMaterial`/`removeMaterial` to `app/admin/waves/actions.ts` (admin-gated; sanitize week description; `validateMaterialFile`; upload via `lib/waves/files.ts` to `wave-materials`; insert; best-effort cleanup mirroring `removeImage`; `removeWeek` cleans child material objects before delete).
- [x] T025 [P] [US2.1] Create `components/WeekEditor.tsx` (client; add/edit/remove weeks, list a week's materials) and `components/MaterialUpload.tsx` (client; titled file input with shared `validateMaterialFile` pre-check).
- [x] T026 [US2.1] Create/extend `app/admin/waves/[id]/page.tsx` (RSC: load wave + its weeks + materials ordered by `position`; render `WeekEditor`).

### User Story 2.2: Student downloads their wave's materials (Priority: P2)

**Goal**: A student downloads materials of their own wave only.

**Independent Test**: As an enrolled student, download a material; confirm a Wave-B material path yields no URL.

#### Tests for User Story 2.2 (write first) ⚠️

- [x] T027 [P] [US2.2] Test `tests/app/student/studentWaveContent.test.tsx`: renders own wave's weeks/materials with download links; **no signed URL for another wave's material** (cross-wave denial).

#### Implementation for User Story 2.2

- [x] T028 [US2.2] Create `components/StudentWaveContent.tsx` (server; renders the student's wave weeks and per-material download links via short-lived signed URLs from `lib/waves/files.ts`) and integrate it into `app/student/dashboard/page.tsx`.

**Checkpoint**: weeks + materials authored and downloadable, isolated per wave. Add the Phase 2 section to `walkthrough.md`.

---

## Phase 5 — Assignments & submissions

**Purpose**: admins add assignments and review submissions; students upload submissions (latest-wins). Acceptance criteria & scenarios: `plan.md` Phase 3.

### User Story 3.1: Admin adds assignments and reviews submissions (Priority: P2)

**Goal**: Admin adds an assignment (title + instructions + optional due date) and can view/download student submissions. No grading.

**Independent Test**: Add an assignment; after a student submits, view/download the submission on the wave page.

#### Tests for User Story 3.1 (write first) ⚠️

- [x] T029 [P] [US3.1] Test `tests/app/admin/waves/assignments.test.ts`: `addAssignment`/`updateAssignment`/`removeAssignment` (admin-gated; sanitized instructions; optional `due_at`).
- [x] T030 [P] [US3.1] Test `tests/app/admin/waves/submissionsReview.test.ts`: admin lists submissions for an assignment and gets a signed download URL; non-admin denied.

#### Implementation for User Story 3.1

- [x] T031 [US3.1] Add `addAssignment`/`updateAssignment`/`removeAssignment` (sanitize instructions; parse `due_at`) and an admin submission-download URL helper to `app/admin/waves/actions.ts`.
- [x] T032 [P] [US3.1] Create `components/AssignmentForm.tsx` (client) and render assignments + their submissions list (with download links) within `app/admin/waves/[id]/page.tsx`.

### User Story 3.2: Student uploads an assignment submission (Priority: P2)

**Goal**: A student uploads one submission file per assignment in their own wave (latest replaces previous).

**Independent Test**: Upload a submission; confirm the admin sees it; confirm re-upload replaces it; confirm a Wave-B assignment cannot be submitted to.

#### Tests for User Story 3.2 (write first) ⚠️

- [x] T033 [P] [US3.2] Test `tests/app/student/submitAssignment.test.ts`: validates file; uploads to `‹wave_id›/‹assignment_id›/‹student_id›/…`; upserts `wave_submissions` on `(assignment_id, student_id)` (latest-wins); **denies submitting to another wave's assignment** and reading another student's submission (cross-wave / cross-student denial).

#### Implementation for User Story 3.2

- [x] T034 [US3.2] Implement `submitAssignment` in `app/student/dashboard/actions.ts` (student-gated; resolve own `students.id` + `tenant_id`; `validateSubmissionFile`; upload with `upsert: true` to `assignment-submissions`; upsert `wave_submissions`; `revalidatePath("/student/dashboard")`).
- [x] T035 [US3.2] Add a submission upload control + "your current submission" display to `components/StudentWaveContent.tsx` (small client island wired to `submitAssignment`).

**Checkpoint**: full assignment loop works end-to-end with isolation. Add the Phase 3 section to `walkthrough.md`.

---

## Phase 6 — Manage & inline create

**Purpose**: edit/safely-delete waves and content; create a wave inline from add-members. Acceptance criteria & scenarios: `plan.md` Phase 4.

### User Story 4.1: Admin edits and safely deletes waves and content (Priority: P2)

**Goal**: Edit a wave's name/description/type; delete is blocked while the wave has members or weeks.

**Independent Test**: Edit a wave (student sees the change); deleting a non-empty wave is refused; an empty wave deletes.

#### Tests for User Story 4.1 (write first) ⚠️

- [x] T036 [P] [US4.1] Test `tests/app/admin/waves/manageWave.test.ts`: `updateWave` persists name/description/type + invalidates cache; `deleteWave` is **blocked** when members or weeks exist (no deletion, clear error) and **succeeds** when empty.

#### Implementation for User Story 4.1

- [x] T037 [US4.1] Implement `updateWave` and `deleteWave` in `app/admin/waves/actions.ts` (`deleteWave` counts `students` and `wave_weeks` for the wave → block with message if either > 0; else delete; revalidate + invalidate `adminListKey("waves")`).
- [x] T038 [US4.1] Add edit UI (reuse `WaveForm` in edit mode wired to `updateWave`) and a delete control to `app/admin/waves/[id]/page.tsx`; create `components/RemoveWaveDialog.tsx` (client, mirrors `RemoveInstructorDialog`).

### User Story 4.2: Admin creates a wave inline while adding members (Priority: P3)

**Goal**: From the add-members wave chooser, a "Create wave" option reaches the same create page; the new wave is then selectable.

**Independent Test**: In Add Members, pick "Create wave" → land on `/admin/waves/new` → after creating, the wave appears in the chooser.

#### Tests for User Story 4.2 (write first) ⚠️

- [x] T039 [P] [US4.2] Extend `tests/components/AddMembersModal.test.tsx`: the wave chooser shows a "Create wave" option that navigates to `/admin/waves/new`.

#### Implementation for User Story 4.2

- [x] T040 [US4.2] Add a "Create wave" option to the wave selector in `components/AddMembersModal.tsx` (navigates to `/admin/waves/new`; the newly created wave is picked up because `createWave` invalidates `adminListKey("waves")`).

**Checkpoint**: manage + inline-create complete. Add the Phase 4 section to `walkthrough.md`.

---

## Phase 7 — Polish & Cross-Cutting Concerns

- [ ] T041 [P] Validate Quality Gates (Principle IV) at **320 / 390 / 430 / 768px + desktop** for `/admin/waves`, `/admin/waves/new`, `/admin/waves/[id]`, and the student dashboard: cards reflow to one column, ≥16px inputs, visible focus, labelled controls, no page-level horizontal scroll, sidebar drawer intact.
- [ ] T042 [P] Run `quickstart.md` end-to-end (admin authoring + student download/submit + the wave-isolation checks).
- [x] T043 Run `npm run build`, `npm run lint`, and `npm test` — all clean (Principle I/II).
- [x] T044 Write `specs/008-wave-management/walkthrough.md` with one section per implemented phase (run commands, route/component paths, numbered desktop + mobile golden-path, known gaps) per Principle VII.
- [ ] T045 [P] Confirm no Core Web Vitals regression on mobile (RSC-first, lazy file links, bounded/ordered reads) per Principle V.

---

## Dependencies & Execution Order

### Phase dependencies
- **Phase 1 (Setup)**: no dependencies. T003 (buckets) must be done before any upload task runs (T022/T024, T030–T035).
- **Phase 2 (Foundational)**: depends on Setup; **blocks all user stories**. T005 (apply migration) gates every DB/Storage task. T011 depends on T004/T005.
- **Phases 3–6 (stories)**: depend on Phase 2. In priority order P1 → P2 → P3; may run in parallel across developers once Phase 2 is done.
- **Phase 7 (Polish)**: after the desired stories are complete.

### Story dependencies
- **US1.1** then **US1.2** (both P1) — US1.2 only needs the `tenants.description_html` column (Phase 2).
- **US2.1 → US2.2** (download needs materials authored). **US3.1 ↔ US3.2** (admin review needs a submission; student submit needs an assignment — implement 3.1 then 3.2).
- **US4.1** edits/deletes content created by earlier stories. **US4.2** only needs US1.1's create page.

### Within a story
- Tests first (must FAIL) → models/actions → components → page wiring.

### Parallel opportunities
- Setup: T001, T002 in parallel (T003 is operator-side).
- Foundational: T006, T007, T008, T009 in parallel; T004→T005→T011 sequential.
- Each story's `[P]` test tasks run together; components in different files run together.

---

## Parallel Example: Foundational pure logic

```bash
Task: "Implement lib/waves/validation.ts (T006)"
Task: "Implement lib/waves/files.ts (T007)"
Task: "Unit tests tests/lib/waves/validation.test.ts (T008)"
Task: "Unit tests tests/lib/waves/files.test.ts (T009)"
```

## Parallel Example: User Story 1.1 tests

```bash
Task: "createWave action test (T012)"
Task: "waves list page test (T013)"
Task: "WaveForm component test (T014)"
```

---

## Implementation Strategy

### MVP first (Phase 3 = User Story 1.1 + 1.2)
1. Phase 1 Setup → 2. Phase 2 Foundational (CRITICAL) → 3. Phase 3 → **stop & validate**: an admin creates/lists waves and a student sees the description. Deploy/demo.

### Incremental delivery
Phase 2 ready → US1.1/1.2 (MVP) → US2.1/2.2 (weeks+materials) → US3.1/3.2 (assignments+submissions) → US4.1/4.2 (manage + inline). Each phase ships its `walkthrough.md` section and is independently testable.

---

## Notes
- `[P]` = different files, no incomplete dependency. `[Story]` maps to `plan.md` user stories.
- Every wave-scoped path carries its cross-wave denial test (T011 + per-story denial tests) — NON-NEGOTIABLE.
- No service-role and no new dependencies (research R3); reuse `sanitizeDescription`, `RichTextEditor`, and the instructor upload/cleanup patterns.
- Commit after each task or logical group; stop at any checkpoint to validate independently.
