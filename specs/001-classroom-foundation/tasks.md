---

description: "Task list for Meska Classroom Foundation (Student & Admin Panels)"
---

# Tasks: Meska Classroom Foundation (Student & Admin Panels)

**Input**: Design documents from `specs/001-classroom-foundation/`

**Prerequisites**: plan.md (required), spec.md (required), research.md, data-model.md, contracts/ui-contracts.md, quickstart.md

**Tests**: REQUIRED per constitution Principle II (NON-NEGOTIABLE). The guaranteed behavior here is **panel isolation** (the header logo resolves to the correct panel home and the shell never emits a cross-panel link); it ships with deterministic Vitest + React Testing Library tests. There are **no wave-scoped paths** in this feature, so the cross-wave denial test (Principle VI) is N/A here and not waived.

**Organization**: Per constitution Principle VII (NON-NEGOTIABLE), phases mirror `plan.md`: `## Phase N — <name>` → `### User Story N.x` → atomic `- [ ]` items. Phase-level acceptance criteria and test scenarios live in `plan.md`. Phase 1 delivers the shared shell + the Student panel as the MVP; Phase 2 adds the Admin panel and reuses the Phase 1 foundation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: `[US1.1]` / `[US2.1]` — maps to the plan's user stories
- Exact file paths are included in each task

## Path Conventions

Next.js App Router, repository root: routes in `app/`, shared UI in `components/`, config/copy in `lib/`, static assets in `public/`, tests in `tests/`. Path alias `@/*` → repo root.

---

## Phase 1 — Branded shell & Student panel

**Purpose**: Establish the shared, branded, English/LTR, mobile-first shell (tokens, logo header, panel config, test tooling) and deliver the **Student panel** end-to-end — a viable MVP. Phase acceptance criteria & test scenarios: see `plan.md` → Phase 1.

### User Story 1.1: As a student, I want a branded Student home with a persistent header whose logo always returns me to the Student home (Priority: P1) 🎯 MVP

**Goal**: A student can reach `/student` — an on-brand, accessible, responsive home inside the shared shell whose logo links to `/student`, with defined loading/empty/error/not-found states.

**Independent Test**: With only Phase 1 built, visit `/student`; confirm the persistent Meska-logo header, the logo returns to `/student` from anywhere in the panel, no link points to `/admin`, the states render, and the screen holds from 320px → desktop.

#### Setup & Shared Foundation (delivered with this MVP phase; reused by Phase 2)

- [x] T001 [US1.1] Add test dependencies and a `test` script (`"test": "vitest run"`, `"test:watch": "vitest"`) to `package.json`, then install: `vitest`, `jsdom`, `@testing-library/react`, `@testing-library/jest-dom`, `@testing-library/user-event`, `@vitejs/plugin-react`
- [x] T002 [P] [US1.1] Create `vitest.config.ts` at repo root: `jsdom` environment, `@vitejs/plugin-react`, `setupFiles: ['./vitest.setup.ts']`, and resolve alias `@` → repo root
- [x] T003 [P] [US1.1] Create `vitest.setup.ts` importing `@testing-library/jest-dom`
- [x] T004 [P] [US1.1] Replace `app/globals.css` brand tokens: under `@theme` add `--color-brand: #1B5BFF`, `--color-page: #EEF3F8`, `--color-surface: #FFFFFF`, `--color-ink: #0A1B2E`; remove the boilerplate `--background`/`--foreground` pair and the `prefers-color-scheme: dark` block; set `body` background to `--color-page` and text to `--color-ink`
- [x] T005 [P] [US1.1] Update `app/layout.tsx`: set `metadata` title "Meska Classroom" and a real description; keep `lang="en"` (LTR); ensure `<body>` uses the page background; remove now-unused boilerplate if any
- [x] T006 [P] [US1.1] Create `lib/strings.ts` — flat object of English UI copy constants (`studentPanelName`, `adminPanelName`, `entryTitle`, `logoAlt`, `logoAriaLabel`, `loadingLabel`, `emptyHomeBody`, `notFoundTitle`, `notFoundBackLabel`, `errorTitle`, `errorRetryLabel`)
- [x] T007 [P] [US1.1] Create `lib/panels.ts` — `Panel` type (`id: 'student' | 'admin'`, `home`, `nameKey`) and `PANELS` where `home` is **derived** as `` `/${id}` `` (never hand-written), so it can never point cross-panel
- [x] T008 [P] [US1.1] Add a placeholder `public/MeskaLogo.png` at the intended logo dimensions (clearly a placeholder); record that it MUST be replaced by the official asset before sign-off (see T032 / research R6)

#### Tests for User Story 1.1 (write FIRST — they MUST fail before implementation)

- [x] T009 [P] [US1.1] `tests/lib/panels.test.ts` — assert `PANELS.student.home === '/student'`, `PANELS.admin.home === '/admin'`, and that each panel's `home` matches `/${id}` (no cross-panel reference)
- [x] T010 [P] [US1.1] `tests/components/Logo.test.tsx` — rendering `<Logo homeHref="/student" />` produces a single focusable link to `/student`, wrapping `MeskaLogo.png`, with a non-empty accessible label and meaningful `alt`
- [x] T011 [P] [US1.1] `tests/components/PanelShell.student.test.tsx` — rendering the shell for `PANELS.student` yields a `<header>` landmark, the logo target is `/student`, and **no** rendered link resolves to any `/admin` path (panel isolation)

#### Implementation for User Story 1.1

- [x] T012 [US1.1] Create `components/Logo.tsx` (Server Component) — `next/image` of `MeskaLogo.png` with explicit `width`/`height` (CLS-safe), wrapped in a `Link` to `homeHref`, with `aria-label`/`alt` from `lib/strings.ts` and a visible brand focus ring (`--color-brand`); depends on T006, T007, T008
- [x] T013 [US1.1] Create `components/Header.tsx` (Server Component) — a `<header>` landmark rendering `<Logo homeHref={panel.home} />` and the panel context label; structurally identical across panels (only `panel.home` varies); depends on T012, T006, T007
- [x] T014 [US1.1] Create `components/PanelShell.tsx` (Server Component) — renders `<Header panel={panel} />` then a semantic `<main>` styled with brand tokens, page background `--color-page`, mobile-first and usable from 320px; tolerates long/AI content; depends on T013, T004
- [x] T015 [P] [US1.1] Create `app/not-found.tsx` — global branded not-found with a working link back to `/` (the entry); uses tokens + `lib/strings.ts`; depends on T004, T006
- [x] T016 [US1.1] Create `app/student/layout.tsx` — wraps children in `<PanelShell panel={PANELS.student}>`; depends on T014, T007
- [x] T017 [US1.1] Create `app/student/page.tsx` — Student home: branded welcome + scaffold framing future sections, including a defined in-page **empty** state; copy from `lib/strings.ts`; depends on T016, T006
- [x] T018 [P] [US1.1] Create `app/student/loading.tsx` — defined loading state for the Student segment; depends on T004, T006
- [x] T019 [P] [US1.1] Create `app/student/error.tsx` (`'use client'`) — defined error boundary with retry; depends on T006
- [x] T020 [P] [US1.1] Create `app/student/not-found.tsx` — Student-scoped not-found with a working link back to `/student`; depends on T006
- [x] T021 [US1.1] Create `app/page.tsx` — pre-panel entry: branded, header logo links to `/`, with a link to the Student panel (Admin link added in Phase 2); depends on T004, T006
- [x] T022 [US1.1] Run `npm run build`, `npm run lint`, and `npm test`; make the Phase 1 suite green and the build/lint clean; depends on T009–T021

**Checkpoint**: Student panel is independently functional and tested. Produce the Phase 1 section of `specs/001-classroom-foundation/walkthrough.md` (T037) before sign-off (Principle VII).

---

## Phase 2 — Admin panel & panel isolation

**Purpose**: Add the **Admin panel** reusing the Phase 1 shell, complete the entry chooser, and prove the two panels never cross (both directions). Phase acceptance criteria & test scenarios: see `plan.md` → Phase 2.

### User Story 2.1: As a Meska ops admin, I want a branded Admin home — consistent with the Student shell but a distinct panel whose logo returns me to the Admin home (Priority: P2)

**Goal**: An admin can reach `/admin` — an on-brand home inside the same shared shell whose logo links to `/admin`, with defined loading/empty/error/not-found states, and the root `/` entry links to both panels.

**Independent Test**: Visit `/admin`; confirm the persistent header, the logo returns to `/admin`, no link points to `/student` (and the reciprocal holds for the Student panel), the states render, and `/` links to both panels.

#### Tests for User Story 2.1 (write FIRST — they MUST fail before implementation)

- [x] T023 [P] [US2.1] `tests/components/PanelShell.admin.test.tsx` — rendering the shell for `PANELS.admin` yields a `<header>` landmark, logo target `/admin`, and **no** rendered link resolves to any `/student` path; include the reciprocal assertion that the Student shell emits no `/admin` link (both-direction isolation)
- [x] T024 [P] [US2.1] `tests/app/entry.test.tsx` — rendering `app/page.tsx` exposes working links to both `/student` and `/admin`, and its header logo target is `/`

#### Implementation for User Story 2.1

- [x] T025 [US2.1] Create `app/admin/layout.tsx` — wraps children in `<PanelShell panel={PANELS.admin}>`; depends on T014, T007
- [x] T026 [US2.1] Create `app/admin/page.tsx` — Admin home: branded welcome + scaffold framing wave/content/submission management, with a defined in-page **empty** state and a clear Admin context label; copy from `lib/strings.ts`; depends on T025, T006
- [x] T027 [P] [US2.1] Create `app/admin/loading.tsx` — defined loading state for the Admin segment; depends on T004, T006
- [x] T028 [P] [US2.1] Create `app/admin/error.tsx` (`'use client'`) — defined error boundary with retry; depends on T006
- [x] T029 [P] [US2.1] Create `app/admin/not-found.tsx` — Admin-scoped not-found with a working link back to `/admin`; depends on T006
- [x] T030 [US2.1] Update `app/page.tsx` to add the Admin panel link alongside the Student link; depends on T021 (same file)
- [x] T031 [US2.1] Run `npm run build`, `npm run lint`, and `npm test`; make the full suite green and build/lint clean; depends on T023–T030

**Checkpoint**: Both panels are independently functional and tested, with isolation verified both directions. Produce the Phase 2 section of `walkthrough.md` (T037) before sign-off.

---

## Phase 3 — Polish & Cross-Cutting Concerns

**Purpose**: Quality-gate validation and hand-off artifacts across both panels (no new features).

- [ ] T032 [P] Replace the placeholder `public/MeskaLogo.png` with the official canonical Meska mark (same dimensions); **blocks phase sign-off** (Principle III / research R6)
- [ ] T033 Validate responsive layout for `/`, `/student`, and `/admin` at **320 / 390 / 430 / 768px and desktop**, portrait and landscape — no horizontal scroll, clipping, or overlap (Quality Gate 3)
- [ ] T034 Validate accessibility on both panels: brand/ink contrast ≥ 4.5:1 (UI/focus ≥ 3:1), visible focus, keyboard-only logo activation, `<header>`/`<main>` landmarks, meaningful logo `alt` (WCAG 2.1 AA)
- [ ] T035 Validate performance of the panel homes: LCP < 2.5s, CLS < 0.1, INP < 200ms on a mid-tier Android over Slow-4G (logo dimensions reserved)
- [ ] T036 Execute `specs/001-classroom-foundation/quickstart.md` end-to-end and confirm every "verify manually" item passes
- [x] T037 [P] Write `specs/001-classroom-foundation/walkthrough.md` with a Phase 1 and a Phase 2 section per Principle VII (how to run, implemented routes/components, numbered desktop + mobile golden-path verification, known gaps)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1** — no dependencies; starts immediately. Its Setup & Foundation tasks (T001–T008) are the blocking prerequisites for everything else.
- **Phase 2** — depends on Phase 1's shared foundation (tokens T004, `lib/` T006–T007, `components/` T012–T014, entry T021). Admin screens reuse `PanelShell`.
- **Phase 3** — depends on Phases 1 and 2 being functionally complete.

### Within Phase 1 (User Story 1.1)

- T001 → enables running tests (T009–T011, T022).
- T002, T003 depend on T001 (deps present to execute, though files can be created in parallel).
- Foundation files T004–T008 are independent of each other ([P]).
- Tests T009–T011 are written before implementation and must fail.
- Components build bottom-up: T012 (Logo) → T013 (Header) → T014 (PanelShell).
- Student routes T016–T021 depend on T014; T015/T018/T019/T020 are [P] (separate files).
- T022 is the gate (build + lint + test).

### Within Phase 2 (User Story 2.1)

- Tests T023–T024 first (must fail).
- T025 (admin layout) depends on the Phase 1 `PanelShell` (T014); T026 depends on T025; T027–T029 are [P]; T030 edits the shared entry file (after T021).
- T031 is the gate.

### Story Independence

- US1.1 (Student) is a complete MVP on its own.
- US2.1 (Admin) reuses the shared foundation from US1.1 but is independently testable; the only shared edit is `app/page.tsx` (entry link), isolated to T030.

---

## Parallel Execution Examples

```bash
# Phase 1 — shared foundation files (after T001):
Task: T002 Create vitest.config.ts
Task: T003 Create vitest.setup.ts
Task: T004 Replace app/globals.css with brand tokens
Task: T005 Update app/layout.tsx metadata
Task: T006 Create lib/strings.ts
Task: T007 Create lib/panels.ts
Task: T008 Add placeholder public/MeskaLogo.png

# Phase 1 — write the failing tests together:
Task: T009 tests/lib/panels.test.ts
Task: T010 tests/components/Logo.test.tsx
Task: T011 tests/components/PanelShell.student.test.tsx

# Phase 2 — admin state files together (after T025/T026):
Task: T027 app/admin/loading.tsx
Task: T028 app/admin/error.tsx
Task: T029 app/admin/not-found.tsx
```

---

## Implementation Strategy

### MVP First (Phase 1 only)

1. Complete Setup & Foundation (T001–T008).
2. Write failing tests (T009–T011).
3. Build the shell + Student panel (T012–T021).
4. Make it green (T022). **STOP and validate** the Student panel independently — this is a demoable MVP.

### Incremental Delivery

1. Phase 1 → Student MVP, validated.
2. Phase 2 → Admin panel + both-direction isolation, validated.
3. Phase 3 → quality gates + walkthroughs, sign-off (replace the logo placeholder).

---

## Notes

- `[P]` = different files, no dependency on an incomplete task.
- `[US1.1]`/`[US2.1]` map tasks to the plan's user stories for traceability; Phase 1 foundation tasks carry `[US1.1]` because they are delivered with the MVP and reused by Phase 2.
- Write tests before implementation and confirm they fail first (Principle II).
- No wave-scoped paths exist → no cross-wave denial test in this feature (Principle VI), explicitly not waived.
- Commit after each task or logical group; do not advance past a phase checkpoint until its tests are green.
