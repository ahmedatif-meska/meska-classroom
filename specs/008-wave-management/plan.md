# Implementation Plan: Wave Management

**Branch**: `008-wave-management` | **Date**: 2026-06-08 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/008-wave-management/spec.md`

## Summary

Give admins a **Waves** area to create, edit, and manage waves — each wave being the existing
`public.tenants` row evolved with a sanitized rich-text `description_html` and an
Online/Offline `type`. Waves render as newest-first cards; a wave can be created from the
Waves tab or inline from the add-members wave chooser (both reach one create page). Inside a
wave, admins author **weeks**, each with an optional description, **materials** (PDF/PPT
files, students download), and **assignments** (title + instructions + optional due date,
students upload one submission file, admins review/download — no grading). Students see only
their own wave's description, weeks, and materials on their dashboard and submit there.

Technical approach: **reuse the Instructors feature end-to-end** — gated Server Actions on
the cookie/RLS client, pure shared validation, `sanitizeDescription`, the `RichTextEditor`,
Storage upload + best-effort cleanup, and cache invalidation. Wave isolation reuses
`is_admin()` / `jwt_tenant_id()` with `tenant_id` denormalized onto every child table and
encoded as the first Storage path segment. **No service-role and no new architectural layer.**

## Technical Context

**Language/Version**: TypeScript (strict), React 19 (React Compiler on), Next.js 16 App
Router — per `CLAUDE.md`.

**Primary Dependencies**: Supabase (Postgres + Auth + Storage), `@upstash/redis` (existing
007 cache), `sanitize-html` (existing), Tailwind v4. No new dependencies.

**Storage**: Postgres tables (`tenants` evolved; new `wave_weeks`, `wave_materials`,
`wave_assignments`, `wave_submissions`) + two new PRIVATE Storage buckets (`wave-materials`,
`assignment-submissions`). Migration `0008_waves.sql`.

**Testing**: Vitest + React Testing Library (jsdom), per `CLAUDE.md`. Pure-logic unit tests,
mocked Server-Action tests, and `tests/integration/rls.test.ts` extended with the cross-wave
denial case for every new wave-scoped table.

**Target Platform**: Web (mobile-first), supported browsers per constitution.

**Project Type**: Web application (Next.js App Router, two panels).

**Performance Goals**: No regression vs. **LCP < 2.5s / CLS < 0.1 / INP < 200ms** on a
mid-tier Android over Slow-4G. Waves list and wave detail are RSC; uploads/downloads are
on-demand; media (file links) lazy and never block reading content.

**Constraints**: Wave isolation (Principle VI) at both row and file level; uploads enforce
type/size client- AND server-side (Principle V); English-only LTR; brand tokens only.

**Scale/Scope**: Small admin population; tens of waves; per-wave a bounded number of weeks
and a roster-sized number of submissions. Reads are ordered and bounded.

## Constitution Check

*GATE: must pass before Phase 0 and re-checked after design. Result: **PASS** (no
violations; no Complexity Tracking entries needed).*

- **I — Code Quality**: TS strict; `npm run build`/`lint` clean. Shared logic in
  `lib/waves/*`; reuse `sanitizeDescription`, `RichTextEditor`. No manual memoization.
  Components handle long AI/user content (sanitized HTML, truncating cards). ✅
- **II — Testing (NON-NEGOTIABLE)**: Pure validation + path-builder unit tests; mocked
  action tests; **cross-wave denial tests for `wave_weeks`/`wave_materials`/
  `wave_assignments`/`wave_submissions`** in `tests/integration/rls.test.ts`. Each bug fix
  ships a failing-first test. ✅
- **III — UX Consistency**: Brand tokens only; every new view defines loading/empty/error
  states; reuses `DashboardShell`, card/table idioms. ✅
- **IV — Mobile-First/A11y**: Cards reflow to one column; forms use ≥16px inputs; labelled
  controls + visible focus; existing sidebar drawer; validated at 320/390/430/768/desktop;
  no page-level horizontal scroll. ✅
- **V — Performance**: RSC-first; bounded/ordered reads; uploads declare allowed formats +
  25 MB max enforced both sides (`lib/waves/validation.ts`); file links lazy. *Autosave note*:
  the draft-autosave rule targets long text drafts; a submission is a single file upload with
  no in-app draft, so autosave does not apply (research R7). ✅
- **VI — Wave Isolation (NON-NEGOTIABLE)**: `tenant_id` on every child table → flat student
  RLS; first Storage path segment is the wave id → file-level RLS; signed URLs only issue
  when the policy passes; admin actions gated by `assertAdminSession`. Cross-wave denial
  tested. ✅
- **VII — Artifact Structure (NON-NEGOTIABLE)**: This plan is phase → story → acceptance
  criteria → test scenarios; each phase ships a `walkthrough.md`. ✅

**New backend surface justification**: Adding tables/buckets is *within* the Supabase backend
already established in feature 002 and the Storage pattern established in 005 — it is **not** a
new backend, API layer, state library, or component library. Therefore no Complexity Tracking
entry is required (constitution Technology & Platform Constraints).

## Project Structure

### Documentation (this feature)

```text
specs/008-wave-management/
├── plan.md              # This file
├── research.md          # Phase 0 — decisions R1–R12
├── data-model.md        # Phase 1 — tables, RLS, storage RLS, validation
├── quickstart.md        # Phase 1 — setup + golden-path verification
├── contracts/
│   └── wave-management-contracts.md   # Server Actions + Storage path contract
├── checklists/
│   └── requirements.md  # spec quality checklist (all pass)
├── tasks.md             # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md       # one section per implemented phase (/speckit-implement)
```

### Source Code (repository root)

```text
supabase/migrations/
└── 0008_waves.sql                      # tenants columns + 4 tables + table & storage RLS

lib/waves/
├── validation.ts                       # pure: wave fields, material/submission file checks
└── files.ts                            # pure: bucket consts + wave-id-first path builders + signed-URL helper

lib/cache/keys.ts                       # (reuse) adminListKey("waves") — no change needed

app/admin/waves/
├── page.tsx                            # Waves list (cards, newest-first) + Create button
├── loading.tsx · error.tsx · not-found.tsx
├── actions.ts                          # createWave/updateWave/deleteWave/add*/update*/remove*
├── new/page.tsx                        # create-wave page (name, RichTextEditor, type)
└── [id]/page.tsx                       # manage: edit wave + weeks/materials/assignments + submissions

app/student/dashboard/
├── page.tsx                            # (extend) render wave description + weeks + downloads + submit
└── actions.ts                          # submitAssignment (student-gated)  [or add to app/student/actions.ts]

components/
├── WaveCard.tsx                        # one wave card (name, type badge, snippet)  [Server]
├── WaveForm.tsx                        # create/edit form (reuses RichTextEditor)    [Client]
├── WeekEditor.tsx                      # add/edit weeks + material upload + assignment forms [Client]
├── MaterialUpload.tsx / AssignmentForm.tsx   # client upload/forms with shared validation pre-check
├── StudentWaveContent.tsx             # student-facing weeks/materials/assignment view [Server + small Client island for upload]
└── (reuse) RichTextEditor, DashboardShell, AdminSidebarFooter

lib/adminNav.tsx                        # (extend) add "Waves" nav item
proxy.ts                                # (extend) add "/admin/waves/:path*" to matcher
lib/strings.ts                          # (extend) all new copy

tests/
├── lib/waves/validation.test.ts · files.test.ts
├── app/admin/waves/*.test.ts(x)        # action + page tests (mocked supabase/gates)
├── app/student/submitAssignment.test.ts
├── components/WaveForm.test.tsx · WeekEditor.test.tsx
└── integration/rls.test.ts             # (extend) cross-wave denial for the 4 new tables
```

**Structure Decision**: Follow the established App-Router/`@/`-alias layout. The Waves admin
surface mirrors the Instructors/Members route groups (page + actions + loading/error/not-found);
domain logic is pure in `lib/waves/`; the student surface extends the existing dashboard.

## Implementation Phases

### Phase 1 — Wave foundation (create, list, student description)

#### User Story 1.1: As an admin I want to create a wave and see it listed so that I have a container to assign members and content to
- Description: Migration `0008` (tenants columns + remove seeds); `lib/waves/validation.ts`
  (name/type); Waves nav + `/admin/waves` list (newest-first cards, empty state) +
  `/admin/waves/new` create page (name, `RichTextEditor` description, type) + `createWave`;
  proxy matcher; invalidate `adminListKey("waves")`.

#### User Story 1.2: As a student I want to see my wave's description on my dashboard so that I know what my cohort is about
- Description: Extend the student dashboard RSC to read the caller's wave (`tenants` row via
  `id = jwt_tenant_id()`) and render the sanitized `description_html`, with an empty state.

#### Acceptance Criteria (for the phase)
- [ ] Migration applies cleanly; the two seed waves are gone; `tenants` has `description_html`
      and a NOT NULL `type` constrained to `online`/`offline`.
- [ ] An admin can create a wave with name + description + type; it persists and renders as
      the first card; missing name or type is rejected with an inline message and saves nothing.
- [ ] The description is server-sanitized before storage (unsafe markup is dropped).
- [ ] The Waves area and create action are admin-only; non-admins get a generic denial.
- [ ] A student sees only their own wave's description on the dashboard (empty state if none).
- [ ] `npm run build`/`lint`/`test` pass; views work 320px→desktop with no page h-scroll.

#### Test Scenarios (for the phase)
1. **Given** an admin, **When** they submit name + description + Online, **Then** a wave row
   exists with `type='online'` and sanitized description, and it tops the list.
2. **Given** the create form, **When** name or type is missing, **Then** no row is created and
   a validation message shows.
3. **Given** a description containing a `<script>`, **When** saved, **Then** the stored HTML
   contains no script (sanitizer).
4. **Given** a Wave-A student, **When** they open the dashboard, **Then** they see Wave A's
   description and never Wave B's (cross-wave denial).
5. **Given** a signed-out visitor, **When** they hit `/admin/waves`, **Then** they are denied.

---

### Phase 2 — Weeks & materials (authoring + student download)

#### User Story 2.1: As an admin I want to add weeks and upload materials so that students have content to study
- Description: `wave_weeks` + `wave_materials` tables + RLS; `wave-materials` bucket Storage
  RLS; `lib/waves/files.ts` path builders; `lib/waves/validation.ts` material file check;
  `addWeek/updateWeek/removeWeek`, `addMaterial/removeMaterial` actions; `WeekEditor`/
  `MaterialUpload` on `/admin/waves/[id]` with client pre-validation.

#### User Story 2.2: As a student I want to download my wave's materials so that I can study offline
- Description: `StudentWaveContent` renders the wave's weeks and, per material, a signed-URL
  download link (issued only when the wave-scoped Storage policy passes).

#### Acceptance Criteria (for the phase)
- [ ] Admin can add a week (optional description) and a material (PDF/PPT, ≤25 MB); both
      persist under the correct week and render in order.
- [ ] Disallowed type or oversized file is rejected client- and server-side; nothing stored.
- [ ] Material objects are stored at `‹wave_id›/‹week_id›/…`; removing a material deletes its
      Storage object (best-effort).
- [ ] A student can download materials of their own wave only; a Wave-B path yields no URL.
- [ ] Empty week renders a clear empty state.

#### Test Scenarios (for the phase)
1. **Given** a wave, **When** the admin uploads a 2 MB PDF material, **Then** a row + object
   exist with a `‹wave_id›/‹week_id›/` path.
2. **Given** the upload form, **When** a 30 MB or `.exe` file is chosen, **Then** it is
   rejected with a message and nothing is stored (server check authoritative).
3. **Given** a Wave-A student, **When** the page issues signed URLs, **Then** Wave-A materials
   resolve and a Wave-B material path returns no URL (cross-wave denial).
4. **Given** a material is removed, **When** the action completes, **Then** the row is gone and
   the object cleanup was attempted.

---

### Phase 3 — Assignments & submissions

#### User Story 3.1: As an admin I want to add assignments and review submissions so that I can set and collect work
- Description: `wave_assignments` + `wave_submissions` tables + RLS; `assignment-submissions`
  bucket Storage RLS; `addAssignment/updateAssignment/removeAssignment`; admin submission
  list + signed-URL download on `/admin/waves/[id]`.

#### User Story 3.2: As a student I want to upload my assignment submission so that the admin receives my work
- Description: `submitAssignment` student action (validate file → upload with `upsert` →
  upsert `wave_submissions` on `(assignment_id, student_id)`); upload control in
  `StudentWaveContent`; latest-wins replace.

#### Acceptance Criteria (for the phase)
- [ ] Admin can add an assignment (title + instructions + optional due date) under a week.
- [ ] A student can upload a submission for an assignment in their own wave; the admin can
      view/download it.
- [ ] A student cannot submit to or read another wave's assignment/submission, nor read
      another student's submission (table + Storage policies).
- [ ] Re-uploading replaces the prior submission (one row per assignment+student).
- [ ] Submission upload enforces type/size both sides; no grading/feedback UI exists.

#### Test Scenarios (for the phase)
1. **Given** an assignment in the student's wave, **When** the student uploads a PDF, **Then**
   one `wave_submissions` row exists and the admin can download it.
2. **Given** an existing submission, **When** the student uploads again, **Then** the same row
   is updated (unique constraint) and the object is overwritten.
3. **Given** a Wave-A student, **When** they attempt to submit to a Wave-B assignment, **Then**
   it is denied by the insert/Storage `with check` policy (cross-wave denial).
4. **Given** student X's submission, **When** student Y requests it, **Then** access is denied.

---

### Phase 4 — Manage & inline create

#### User Story 4.1: As an admin I want to edit and safely delete waves and their content so that I can keep them current
- Description: `updateWave` (name/description/type); edit/remove weeks/materials/assignments;
  `deleteWave` **blocked while the wave has members or weeks** with a clear message.

#### User Story 4.2: As an admin I want to create a wave while adding members so that I don't have to context-switch
- Description: Add a "Create wave" option to the add-members wave chooser
  (`AddMembersModal`) that navigates to `/admin/waves/new`; on return the new wave is
  selectable (the dropdown cache is invalidated on create).

#### Acceptance Criteria (for the phase)
- [ ] Editing a wave's name/description/type persists and reflects on the card and student view.
- [ ] Deleting a wave that has any member or week is blocked with an explanation; deleting an
      empty wave succeeds.
- [ ] Editing/removing a week, material, or assignment persists (and removes Storage objects).
- [ ] From add-members, choosing "Create wave" reaches the same create page; the created wave
      is then selectable for the members.

#### Test Scenarios (for the phase)
1. **Given** a wave with a member, **When** the admin deletes it, **Then** it is refused and no
   data is lost (SC-006).
2. **Given** an empty wave, **When** the admin deletes it, **Then** it is removed and the
   dropdown cache is invalidated.
3. **Given** the admin edits the description, **When** an enrolled student reloads, **Then**
   they see the updated description (within cache TTL bounds).
4. **Given** the add-members chooser, **When** the admin picks "Create wave", **Then** they
   land on `/admin/waves/new`, and after creating, the wave appears in the chooser.

## Complexity Tracking

> No constitution violations — this table is intentionally empty. Adding wave tables and two
> private Storage buckets reuses the backend (002) and Storage (005) patterns already in the
> codebase; no new backend, API layer, state library, or component library is introduced.
