# Tasks: Student Home & Weeks Navigation

**Input**: Design documents from `/specs/010-student-home-weeks/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED (Principle II — NON-NEGOTIABLE). Every wave-scoped path ships its cross-wave access-denial test (Principle VI). Write tests first and ensure they fail before implementing.

**Organization** (Principle VII): `## Phase N — <name>` → `### User Story N.x` → atomic `- [ ]` items. Phase-level acceptance criteria and Given/When/Then test scenarios live in `plan.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: e.g. US1.1, US2.1, US2.2, US3.1 (maps to plan.md stories)
- Exact file paths included in each description

**Note on scaffolding**: This is a brownfield change to an existing Next.js App Router project — there is no separate Setup/Foundational phase. The shared student-nav helper (`lib/students/nav.tsx`) is introduced in Phase 1 (Home entry only) and extended in Phase 2 (Weeks group); copy is added per-phase to `lib/strings.ts`.

---

## Phase 1 — Home reshape

**Purpose**: Rename Dashboard→Home, greet the student, label the wave, remove materials/assignments from Home, keep QR. MVP slice. (Acceptance criteria & scenarios: plan.md Phase 1.)

### User Story 1.1: Personalized Home (renamed from Dashboard) (Priority: P1) 🎯 MVP

**Goal**: The student sees a "Home" panel that greets them by name and frames their wave, with no materials/assignments on Home.

**Independent Test**: Sign in as a student in a named wave → nav + heading read "Home", greeting "Welcome to [name] 👋", wave line "You are in wave [name]", no materials/assignments on Home, QR present.

#### Tests for User Story 1.1 (REQUIRED — Principle II) ⚠️

- [x] T001 [P] [US1.1] Update `tests/app/student-dashboard.test.tsx` to assert: nav/heading read "Home"; greeting shows the student name with the 👋 emoji and falls back to email when name is absent; wave line reads "You are in wave [wave name]"; **no** material or assignment is rendered on Home; QR section present. (Write to fail first.)

#### Implementation for User Story 1.1

- [x] T002 [US1.1] Add Home/greeting/wave-label copy keys to `lib/strings.ts`: `studentHomeNavLabel` ("Home"), `studentHomeGreetingPrefix` ("Welcome to "), `studentHomeGreetingSuffix` (" 👋"), `studentHomeWaveLabelPrefix` ("You are in wave "), `studentNoWaveNote` (unassigned/empty wave state).
- [x] T003 [US1.1] Create `lib/students/nav.tsx` exporting `buildStudentNav(supabase, tenantId)` returning the **Home** `NavItem` (`href: "/student/dashboard"`, icon). (Weeks group added in Phase 2.)
- [x] T004 [US1.1] Update `app/student/dashboard/page.tsx`: pass `navItems={await buildStudentNav(...)}` and `activeHref="/student/dashboard"` to `DashboardShell`; replace the "Dashboard"/subtitle heading with the composed greeting (`full_name || email`); relabel the wave section to "You are in wave [name]" (keep sanitized description + empty state); **remove** `<StudentWaveContent/>` so no materials/assignments show on Home; keep the QR section.
- [x] T005 [US1.1] Run `npm run build` + `npm run lint` clean and the updated `student-dashboard` test green; visually verify Home at 320/390/430/768/desktop.

**Checkpoint**: Home is an independently shippable MVP. Capture Phase 1 in `walkthrough.md` before sign-off.

---

## Phase 2 — Weeks navigation & per-week content

**Purpose**: Collapsible **Weeks** sidebar group of the student's own wave weeks; selecting a week opens a per-week view with **Resources** and **Assignments** disclosures. (Acceptance criteria & scenarios: plan.md Phase 2.)

### User Story 2.1: Collapsible Weeks list of my wave's weeks (Priority: P1)

**Goal**: A keyboard-accessible, drawer-aware Weeks disclosure listing exactly the caller's wave's weeks.

**Independent Test**: Student in a wave with 2 weeks → expanding Weeks shows exactly "Week 1"/"Week 2" in order; a wave with 0 weeks shows an empty state; never another wave's weeks.

#### Tests for User Story 2.1 (REQUIRED — Principle II) ⚠️

- [x] T006 [P] [US2.1] Create `tests/components/DashboardShell.test.tsx`: a `NavItem` with `children` renders a disclosure with `aria-expanded`/`aria-controls`; toggle shows/hides children; group auto-expands when a child matches `activeHref`; keyboard (Enter/Space) operates the toggle; a flat nav (admin `adminNavItems`) renders unchanged.
- [x] T007 [P] [US2.1] Add a `tests/lib/studentNav.test.ts` unit test for `buildStudentNav`: weeks ordered by `position`, labelled `title || "Week N"`, empty children when `tenantId` is null or no weeks. (Pure-data assertions with a mocked supabase client.)

#### Implementation for User Story 2.1

- [x] T008 [US2.1] Extend `NavItem` in `components/DashboardShell.tsx` with optional `children?: NavItem[]`; when present render a disclosure group (`<button>` label + chevron, `aria-expanded`/`aria-controls`, visible focus, `useState` open), indented child `<Link>`s that close the mobile drawer on click, auto-expanded when any child `href === resolvedActive`; items without `children` render exactly as today (admin nav unaffected).
- [x] T009 [US2.1] Extend `buildStudentNav` in `lib/students/nav.tsx` to append a **Weeks** group whose `children` are the caller's wave weeks (query `wave_weeks` `eq tenant_id` `order position asc`; label `title || "Week " + position`; `href: "/student/dashboard/weeks/<id>"`); empty `children` when `tenantId` is null or there are no weeks.
- [x] T010 [US2.1] Add Weeks copy keys to `lib/strings.ts`: `studentWeeksNavLabel` ("Weeks"), `studentWeeksEmptyNote` (no weeks yet).

### User Story 2.2: Per-week Resources & Assignments (Priority: P1)

**Goal**: A wave-self-gated week route showing the week's downloadable Resources (materials) and Assignments (downloads + submit).

**Independent Test**: Open a week with a material + assignment → Resources lists/downloads the material; Assignments lists/downloads + lets the student submit. A foreign `weekId` → 404; a foreign material path → null URL.

#### Tests for User Story 2.2 (REQUIRED — Principle II) ⚠️

- [x] T011 [P] [US2.2] Create `tests/app/student-week.test.tsx`: the week view renders **Resources** and **Assignments** disclosures with the week's items; **cross-wave denial** — a `weekId` belonging to another wave triggers `notFound()` and renders no foreign content; a wave-B material path yields a null signed URL (no download).

#### Implementation for User Story 2.2

- [x] T012 [US2.2] Create `components/StudentWeekContent.tsx` (RSC) taking `{ tenantId, weekId, studentId }`: fetch the week's `wave_materials` and `wave_assignments` (`eq tenant_id`, `eq week_id`) and the student's `wave_submissions`; render a **Resources** `<details>` (materials via `signedUrl(MATERIALS_BUCKET, …)`, empty state when none) and an **Assignments** `<details>` (assignments via signed URL + `<SubmitAssignment/>`, due date + sanitized instructions, empty state when none).
- [x] T013 [US2.2] Create `app/student/dashboard/weeks/[weekId]/page.tsx` (RSC): get user/tenant; load the week by `id` scoped to the caller's wave and call `notFound()` if it does not resolve; render `DashboardShell` with `buildStudentNav(...)` and `activeHref="/student/dashboard/weeks/<weekId>"`, the `StudentFooter`, and `<StudentWeekContent/>`.
- [x] T014 [US2.2] Add per-week copy keys to `lib/strings.ts`: `studentResourcesLabel` ("Resources"), `studentWeekNoMaterials`, `studentWeekNoAssignments` (reuse existing `studentAssignmentsLabel`, `studentDueLabel`, `materialDownloadLabel`, submit strings).
- [x] T015 [US2.2] Remove `components/StudentWaveContent.tsx` and its (now-removed) import from `app/student/dashboard/page.tsx`; confirm no other references remain.
- [x] T016 [US2.2] Confirm `proxy.ts` matcher `"/student/dashboard/:path*"` already gates the week route (expect **no change**); verify a non-student is redirected and a student reaches the page.

**Checkpoint**: Weeks navigation + per-week content are independently functional. Capture Phase 2 in `walkthrough.md` before sign-off.

---

## Phase 3 — Instructors on Home

**Purpose**: Surface admin-managed instructors to students on Home via a view-only section, backed by one RLS read-policy revision. (Acceptance criteria & scenarios: plan.md Phase 3.)

### User Story 3.1: Instructors shown on Home (Priority: P2)

**Goal**: Home shows the admin-created instructors (photo, name, sanitized bio); students cannot manage them.

**Independent Test**: Admin creates two instructors → student Home shows both; admin removes one → it disappears for the student; a student instructor write is denied.

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

- [x] T017 [P] [US3.1] Update `tests/integration/rls.test.ts`: under a **student** session `select` from `instructors` is allowed; `insert/update/delete` on `instructors` is **denied**; under **anon** `select` is denied; (re)assert cross-wave `wave_weeks`/`wave_materials` select denial.
- [x] T018 [P] [US3.1] Update `tests/app/student-dashboard.test.tsx`: Home renders the **About instructors** section listing instructors, and shows the empty state (or omits the section) when there are none.

#### Implementation for User Story 3.1

- [x] T019 [US3.1] Create `supabase/migrations/0015_instructors_student_read.sql`: drop+recreate `instructors_select` as `for select using (auth.uid() is not null)`; leave `instructors_write` and `instructor_images_admin_write` unchanged (per data-model.md).
- [x] T020 [US3.1] Create `components/StudentInstructors.tsx` (RSC): fetch `instructors` (`id, name, description_html, image_path order by created_at desc`); render cards with a lazy `next/image` photo via `instructorImageUrl` (initial-letter fallback), name, and `sanitizeDescription(description_html)`; friendly empty state (or render nothing) when the list is empty.
- [x] T021 [US3.1] Add copy keys to `lib/strings.ts`: `studentInstructorsTitle` ("About instructors"), `studentInstructorsEmptyNote`.
- [x] T022 [US3.1] Integrate `<StudentInstructors/>` into `app/student/dashboard/page.tsx` below the wave section and above (or beside) the QR section.
- [x] T023 [US3.1] Apply migration `0015` to the Supabase project (CLI/MCP); confirm a student session reads instructors and a student write is denied.

**Checkpoint**: Instructors appear on Home, view-only. Capture Phase 3 in `walkthrough.md` before sign-off.

---

## Phase 4 — Polish & Cross-Cutting Concerns

**Purpose**: Quality gates and the per-phase walkthrough.

- [x] T024 [P] Run `quickstart.md` end-to-end on desktop and mobile (320/390/430/768): Home, Weeks drawer expand/select, per-week Resources/Assignments download + submit, instructors, cross-wave 404.
- [x] T025 [P] Confirm `npm run build` + `npm run lint` are clean and `npm test` is fully green (including cross-wave denial + instructor RLS tests).
- [x] T026 Accessibility/responsive pass: Weeks toggle and Resources/Assignments disclosures keyboard-operable with visible focus and correct `aria-expanded`; no page/body horizontal scroll at any width; ≥16px mobile inputs; verify no CWV regression (LCP/CLS/INP) with lazy instructor images and RSC week view.
- [x] T027 Write `specs/010-student-home-weeks/walkthrough.md` covering each implemented phase (run command/URL, route/component paths, numbered desktop+mobile golden path, known gaps) per Principle VII.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Home reshape)**: No dependencies — start immediately. Introduces `lib/students/nav.tsx` (Home entry) used later.
- **Phase 2 (Weeks)**: Builds on `lib/students/nav.tsx` (T003) and reuses `SubmitAssignment` + `lib/waves/files.ts` (existing). The `DashboardShell` extension (T008) is independent of Phase 1 page work but `buildStudentNav` extension (T009) depends on T003.
- **Phase 3 (Instructors)**: Independent of Phases 1–2 except it edits the same `app/student/dashboard/page.tsx` (T022 after T004) and `lib/strings.ts`. The RLS migration (T019) gates the read tests (T017) and component (T020).
- **Phase 4 (Polish)**: After all desired phases.

### Within Each User Story

- Tests written and failing before implementation (Principle II).
- `lib/strings.ts` keys before the components/pages that reference them.
- `buildStudentNav` (nav helper) before pages that consume it; `DashboardShell` extension before the Weeks group renders.
- Migration `0015` before the instructor read tests pass and before the student instructor component is meaningful.

### Shared-file ordering (NOT parallel with each other)

- `lib/strings.ts` is edited by T002, T010, T014, T021 — apply sequentially (different phases, no `[P]` across them).
- `app/student/dashboard/page.tsx` is edited by T004 (Phase 1) then T022 (Phase 3) — T022 after T004.
- `lib/students/nav.tsx` is created by T003 then extended by T009 — T009 after T003.

### Parallel Opportunities

- Test-authoring tasks across stories are `[P]` where they touch different files: T001, T006, T007, T011, T017, T018.
- Within Phase 2, T008 (`DashboardShell`) and T012 (`StudentWeekContent`) touch different files and can proceed in parallel once their tests exist.
- Phase 3 implementation (T019/T020) is independent of Phase 2 files (except the shared page integration T022).

---

## Parallel Example: Phase 2 tests

```bash
# Author these failing tests together (different files):
Task: "DashboardShell collapsible group test in tests/components/DashboardShell.test.tsx"  # T006
Task: "buildStudentNav unit test in tests/lib/studentNav.test.ts"                          # T007
Task: "Week view + cross-wave denial test in tests/app/student-week.test.tsx"              # T011
```

---

## Implementation Strategy

### MVP First (Phase 1 only)

1. Complete Phase 1 (T001–T005): Home reshape.
2. **STOP and VALIDATE**: Home greets by name, labels the wave, hides materials/assignments, keeps QR.
3. Demo — this alone satisfies user edits #1, #2, #3, #6.

### Incremental Delivery

1. Phase 1 → Home MVP (edits 1/2/3/6).
2. Phase 2 → Weeks nav + per-week Resources/Assignments (edits 4/5).
3. Phase 3 → Instructors on Home (edit 7).
4. Phase 4 → polish, walkthrough, quality gates.

Each phase is independently testable and adds value without breaking the previous.

---

## Notes

- `[P]` = different files, no incomplete-task dependency. Tasks editing `lib/strings.ts`, `app/student/dashboard/page.tsx`, or `lib/students/nav.tsx` are intentionally **not** `[P]` with one another.
- Cross-wave denial tests are mandatory for the week route and instructor read change (Principles II + VI).
- Commit after each task or logical group; verify tests fail before implementing.
- No `proxy.ts` change is expected (T016 verifies this) — the week route is already covered by the existing student matcher.
