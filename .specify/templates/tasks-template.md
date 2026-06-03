---

description: "Task list template for feature implementation"
---

# Tasks: [FEATURE NAME]

**Input**: Design documents from `/specs/[###-feature-name]/`

**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: REQUIRED. Per the constitution (Principle II — NON-NEGOTIABLE), behavior the platform guarantees ships with deterministic tests, and every wave-scoped path MUST include the cross-wave access-denial test (Principle VI). Include test tasks in every story; a bug fix MUST include a test that failed before it.

**Organization**: Per the constitution (Principle VII — NON-NEGOTIABLE), tasks are grouped `## Phase N — <name>` → `### User Story N.x: <title>` → atomic `- [ ]` items. A phase groups the stories signed off together; stories stay independently implementable and testable.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/`, `tests/` at repository root
- **Web app**: `backend/src/`, `frontend/src/`
- **Mobile**: `api/src/`, `ios/src/` or `android/src/`
- Paths shown below assume single project - adjust based on plan.md structure

<!--
  ============================================================================
  IMPORTANT: The tasks below are SAMPLE TASKS for illustration purposes only.

  The /speckit-tasks command MUST replace these with actual tasks based on:
  - User stories from spec.md (with their priorities P1, P2, P3...)
  - Feature requirements from plan.md
  - Entities from data-model.md
  - Endpoints from contracts/

  Tasks MUST follow the constitution's Principle VII hierarchy:
  `## Phase N — <name>` → `### User Story N.x: <title>` → atomic `- [ ]` items.
  A phase groups the user stories that are signed off together; each story stays:
  - Implemented independently
  - Tested independently (tests are REQUIRED, not optional — Principle II)
  - Delivered as an MVP increment

  DO NOT keep these sample tasks in the generated tasks.md file.
  ============================================================================
-->

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Project initialization and basic structure

- [ ] T001 Create project structure per implementation plan
- [ ] T002 Initialize [language] project with [framework] dependencies
- [ ] T003 [P] Configure linting and formatting tools

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story can be implemented

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

Examples of foundational tasks (adjust based on your project):

- [ ] T004 Setup database schema and migrations framework
- [ ] T005 [P] Implement authentication/authorization framework
- [ ] T006 [P] Setup API routing and middleware structure
- [ ] T007 Create base models/entities that all stories depend on
- [ ] T008 Configure error handling and logging infrastructure
- [ ] T009 Setup environment configuration management

**Checkpoint**: Foundation ready - user story implementation can now begin in parallel

---

## Phase 3 — [Feature phase name, e.g. Core student experience]

**Purpose**: [What this phase delivers as a signed-off unit. Acceptance criteria and test scenarios for the phase live in plan.md — see Principle VII.]

### User Story 3.1: [Title] (Priority: P1) 🎯 MVP

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

#### Tests for User Story 3.1 (REQUIRED — Principle II) ⚠️

> **NOTE: Write these tests FIRST, ensure they FAIL before implementation.**
> For any wave-scoped path, include the cross-wave access-denial test (Principle VI).

- [ ] T010 [P] [US3.1] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T011 [P] [US3.1] Integration test for [user journey] in tests/integration/test_[name].py
- [ ] T012 [P] [US3.1] Cross-wave denial test for [wave-scoped query] (if applicable)

#### Implementation for User Story 3.1

- [ ] T013 [P] [US3.1] Create [Entity1] model in src/models/[entity1].py
- [ ] T014 [P] [US3.1] Create [Entity2] model in src/models/[entity2].py
- [ ] T015 [US3.1] Implement [Service] in src/services/[service].py (depends on T013, T014)
- [ ] T016 [US3.1] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T017 [US3.1] Add validation and error handling

### User Story 3.2: [Title] (Priority: P2)

**Goal**: [Brief description of what this story delivers]

**Independent Test**: [How to verify this story works on its own]

#### Tests for User Story 3.2 (REQUIRED — Principle II) ⚠️

- [ ] T018 [P] [US3.2] Contract test for [endpoint] in tests/contract/test_[name].py
- [ ] T019 [P] [US3.2] Integration test for [user journey] in tests/integration/test_[name].py

#### Implementation for User Story 3.2

- [ ] T020 [P] [US3.2] Create [Entity] model in src/models/[entity].py
- [ ] T021 [US3.2] Implement [Service] in src/services/[service].py
- [ ] T022 [US3.2] Implement [endpoint/feature] in src/[location]/[file].py
- [ ] T023 [US3.2] Integrate with User Story 3.1 components (if needed)

**Checkpoint**: Phase 3 stories are independently functional and testable. Produce `specs/[###-feature]/walkthrough.md` for this phase per Principle VII before sign-off.

---

[Add more phases as needed, following the same `## Phase N — <name>` → `### User Story N.x` pattern.]

---

## Phase N — Polish & Cross-Cutting Concerns

**Purpose**: Improvements that affect multiple user stories

- [ ] TXXX [P] Documentation updates in docs/
- [ ] TXXX Code cleanup and refactoring
- [ ] TXXX Performance optimization across all stories (no LCP/CLS/interaction regression on mobile)
- [ ] TXXX [P] Additional unit tests in tests/unit/
- [ ] TXXX Security hardening
- [ ] TXXX Validate Quality Gates: responsive at 320/390/430/768px + desktop, LTR and RTL
- [ ] TXXX Run quickstart.md validation
- [ ] TXXX Write/finalize `specs/[###-feature]/walkthrough.md` for each implemented phase (Principle VII)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - can start immediately
- **Foundational (Phase 2)**: Depends on Setup completion - BLOCKS all user stories
- **User Stories (Phase 3+)**: All depend on Foundational phase completion
  - User stories can then proceed in parallel (if staffed)
  - Or sequentially in priority order (P1 → P2 → P3)
- **Polish (Final Phase)**: Depends on all desired user stories being complete

### User Story Dependencies

- **User Story 1 (P1)**: Can start after Foundational (Phase 2) - No dependencies on other stories
- **User Story 2 (P2)**: Can start after Foundational (Phase 2) - May integrate with US1 but should be independently testable
- **User Story 3 (P3)**: Can start after Foundational (Phase 2) - May integrate with US1/US2 but should be independently testable

### Within Each User Story

- Tests MUST be written and FAIL before implementation (required — Principle II)
- Models before services
- Services before endpoints
- Core implementation before integration
- Story complete before moving to next priority

### Parallel Opportunities

- All Setup tasks marked [P] can run in parallel
- All Foundational tasks marked [P] can run in parallel (within Phase 2)
- Once Foundational phase completes, all user stories can start in parallel (if team capacity allows)
- All tests for a user story marked [P] can run in parallel
- Models within a story marked [P] can run in parallel
- Different user stories can be worked on in parallel by different team members

---

## Parallel Example: User Story 1

```bash
# Launch all tests for the user story together:
Task: "Contract test for [endpoint] in tests/contract/test_[name].py"
Task: "Integration test for [user journey] in tests/integration/test_[name].py"

# Launch all models for User Story 1 together:
Task: "Create [Entity1] model in src/models/[entity1].py"
Task: "Create [Entity2] model in src/models/[entity2].py"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL - blocks all stories)
3. Complete Phase 3: User Story 1
4. **STOP and VALIDATE**: Test User Story 1 independently
5. Deploy/demo if ready

### Incremental Delivery

1. Complete Setup + Foundational → Foundation ready
2. Add User Story 1 → Test independently → Deploy/Demo (MVP!)
3. Add User Story 2 → Test independently → Deploy/Demo
4. Add User Story 3 → Test independently → Deploy/Demo
5. Each story adds value without breaking previous stories

### Parallel Team Strategy

With multiple developers:

1. Team completes Setup + Foundational together
2. Once Foundational is done:
   - Developer A: User Story 1
   - Developer B: User Story 2
   - Developer C: User Story 3
3. Stories complete and integrate independently

---

## Notes

- [P] tasks = different files, no dependencies
- [Story] label maps task to specific user story for traceability
- Each user story should be independently completable and testable
- Verify tests fail before implementing
- Commit after each task or logical group
- Stop at any checkpoint to validate story independently
- Avoid: vague tasks, same file conflicts, cross-story dependencies that break independence
