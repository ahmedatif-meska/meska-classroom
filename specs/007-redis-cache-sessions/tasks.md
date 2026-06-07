---

description: "Task list for 007-redis-cache-sessions"
---

# Tasks: Redis Caching & Persistent Sessions

**Input**: Design documents from `specs/007-redis-cache-sessions/`

**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/cache-and-session-contracts.md

**Tests**: REQUIRED (constitution Principle II — NON-NEGOTIABLE). The one tenant-scoped
cached path (student dashboard) MUST ship the cross-wave access-denial test (Principle VI).

**Organization**: `## Phase N` → `### User Story N.x` → atomic `- [ ]` items (Principle VII).
Phase acceptance criteria and test scenarios live in `plan.md`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on an incomplete task)
- **[Story]**: US1 (persistent sessions), US2.1 / US2.2 / US2.3 (caching)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Add the cache dependency and configuration; no behavior change yet.

- [x] T001 Install the Upstash client: `npm install @upstash/redis` (updates `package.json` / `package-lock.json`)
- [x] T002 [P] Add the server-only env vars `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to local `.env.local`, and document them in `CLAUDE.md` → Environment (no `NEXT_PUBLIC_` prefix)
- [x] T003 [P] Verify `.gitignore` already excludes `.env*` (it does) — confirm no secret can be committed

**Checkpoint**: Dependency available; absent env vars must leave the app behaving exactly as today.

---

## Phase 2 — Persistent sessions (fix re-login)

**Goal**: Users stay signed in after closing and reopening the app. (plan Phase 1; spec US1)

**Independent Test**: Sign in, fully close the app, reopen within the window → land authenticated with no prompt; sign out → reopen requires sign-in.

### User Story 1.1: As a returning admin or student, I want to stay signed in after I close and reopen the app, so that I don't log in every time (Priority: P1) 🎯 MVP

#### Tests for User Story 1.1 (REQUIRED — Principle II) ⚠️

> Write FIRST and ensure they FAIL before implementation.

- [x] T004 [P] [US1] Add `tests/session/cookiePersistence.test.ts`: assert the `setAll` cookie adapter writes Supabase auth cookies with a persistent future `maxAge`/`expires` (not a session cookie), for both the server client and `proxy`
- [x] T005 [P] [US1] Add a `proxy` test asserting an authenticated user reopening (cookies present) is NOT redirected to sign-in, and an explicitly signed-out user IS sent to sign-in (extend `tests/middleware.test.ts` or add a sibling)

#### Implementation for User Story 1.1

- [x] T006 [US1] In `lib/supabase/server.ts`, set persistent cookie options in `setAll` (default `maxAge` ≈ 30 days, `httpOnly`, `secure` in prod, `sameSite: 'lax'`, `path: '/'`) while preserving any options Supabase already supplies
- [x] T007 [US1] Apply the same persistent cookie options in `proxy.ts` `setAll` (the session-refresh write path) so rotated tokens are persisted too
- [ ] T008 [US1] Confirm/align the Supabase project refresh-token (session) lifetime to ~30 days in the Supabase dashboard so cookie and server agree (config task — record the value in `quickstart.md`)
- [x] T009 [US1] Run the existing auth/role/RLS suites and confirm no regression (FR-012): `npx vitest run tests/app/admin tests/app/student tests/middleware.test.ts`

**Checkpoint**: Persistent sessions work for both panels; sign-out and expiry still force re-login. Produce the Phase 2 section of `walkthrough.md`.

---

## Phase 3 — Redis cache for read-heavy pages (wave-safe)

**Goal**: Faster repeat loads for admin and student reads, with wave isolation, write-through invalidation, and graceful degradation. (plan Phase 2; spec US2/US3)

**Independent Test**: Load a cached list twice (2nd faster, identical data); edit → change shows next load; as a student you only ever see your own wave; with Redis down, pages still render.

### Cache foundation (shared by all Phase 3 stories — blocks US2.1/US2.2/US2.3)

> Pure key logic is split from the I/O client so isolation rules are unit-testable (mirrors `lib/auth/*`).

- [x] T010 [P] [US2.3] Write `tests/lib/cache/keys.test.ts` FIRST: `adminListKey` shape; `studentKey` includes BOTH `tenantId` and `userId`; `studentKey` rejects/sentinels a missing id (no audience dimension may be dropped — Principle VI)
- [x] T011 [US2.3] Create `lib/cache/keys.ts` (pure, no I/O) implementing `adminListKey(resource)` and `studentKey(tenantId, userId, resource)` per `contracts/cache-and-session-contracts.md`
- [x] T012 [P] [US2.3] Write `tests/lib/cache/redis.test.ts` FIRST (mock `@upstash/redis`): cold miss runs loader + stores; warm hit returns stored value with loader parity; on Redis throw / missing env, `cached()` returns the loader result WITHOUT throwing and `invalidate()` is a no-op
- [x] T013 [US2.3] Create `lib/cache/redis.ts`: server-only Upstash client + `cached(key, loader, {ttlSeconds=60})` read-through and `invalidate(...keys)`, each guarded with a ≤200ms timeout and graceful fallback (FR-011); no-op pass-through when env vars are absent

### User Story 2.1: As a returning admin, I want instructor and member lists to load faster on repeat visits (Priority: P2)

#### Tests for User Story 2.1 (REQUIRED) ⚠️

- [x] T014 [P] [US2.1] Add a test (mock Upstash) asserting the instructor-list read returns cache-hit parity with the source result and uses key `admin:instructors:list`

#### Implementation for User Story 2.1

- [x] T015 [US2.1] Wrap the instructor read in `app/admin/instructors/page.tsx` with `cached(adminListKey("instructors"), loader)` (loader = the existing Supabase query)
- [x] T016 [US2.1] Wrap the member-roster and waves reads in `app/admin/members/page.tsx` with `cached(adminListKey("members"), …)` and `cached(adminListKey("waves"), …)` (keep the existing `Promise.all` shape)

### User Story 2.2: As a student, I want my dashboard to load faster while only ever seeing my own wave's data (Priority: P1 — correctness)

#### Tests for User Story 2.2 (REQUIRED — cross-wave denial, Principle VI) ⚠️

- [x] T017 [P] [US2.2] Add `tests/integration/cacheIsolation.test.ts`: cache Wave A's `student:{A}:{userA}:profile`, then request as a Wave B user → assert Wave B receives only its own data and NEVER Wave A's cached entry

#### Implementation for User Story 2.2

- [x] T018 [US2.2] Wrap the own-profile read in `app/student/dashboard/page.tsx` with `cached(studentKey(tenantId, userId, "profile"), loader)`, deriving `tenantId` from the JWT `app_metadata.tenant_id` and `userId` from the authenticated user; skip caching if either is absent

### User Story 2.3: As the ops lead, I want the cache to never serve stale data after an edit and never break the app if Redis is down (Priority: P1 — correctness)

#### Tests for User Story 2.3 (REQUIRED) ⚠️

- [x] T019 [P] [US2.3] Add a test asserting that after `removeMember`, the next member-list read does NOT include the removed member (invalidation wired)
- [x] T020 [P] [US2.3] Add a degradation test: a cached page renders correctly from the source when the Upstash client throws (no user-facing error)

#### Implementation for User Story 2.3

- [x] T021 [US2.3] In `app/admin/members/actions.ts`, call `invalidate(adminListKey("members"))` after the DB write in `createMember`, `bulkCreateMembers`, `resendMemberInvite`, and `removeMember` (and the affected `studentKey(...)` in `removeMember`), alongside the existing `revalidatePath`
- [x] T022 [US2.3] In `app/admin/instructors/actions.ts`, call `invalidate(adminListKey("instructors"))` after the DB write in `createInstructor`, `updateInstructor`, and `removeInstructor`

**Checkpoint**: Caching is live, wave-isolated, self-invalidating, and outage-safe. Produce the Phase 3 section of `walkthrough.md`.

---

## Phase 4 — Polish & Cross-Cutting Concerns

- [x] T023 Run `npm run build` and `npm run lint` — both clean (Principle I / Quality Gate 1)
- [x] T024 Run the full suite `npm test` — all pass, including the new cache-isolation, invalidation, degradation, and cookie-persistence tests (Quality Gate 2)
- [ ] T025 [P] Execute `quickstart.md` end-to-end: verify persistent login (close/reopen) and the caching + outage drill
- [ ] T026 [P] Confirm no Core Web Vitals regression on mobile (LCP<2.5s / CLS<0.1 / INP<200ms) — caching must not add critical-path latency (Quality Gate 5)
- [x] T027 Write `specs/007-redis-cache-sessions/walkthrough.md` covering Phase 2 and Phase 3 (run commands, env, routes/files touched, numbered golden-path verification on desktop AND mobile, known gaps) per Principle VII

---

## Dependencies & Execution Order

### Phase order

- **Phase 1 (Setup)**: start immediately.
- **Phase 2 (Persistent sessions)**: independent of caching — can be done in parallel with Phase 3 and is the recommended MVP (delivers the user's top pain fix alone).
- **Phase 3 (Caching)**: the Cache foundation (T010–T013) BLOCKS US2.1/US2.2/US2.3.
- **Phase 4 (Polish)**: after the phases you intend to ship.

### Within Phase 3

- T010–T013 (foundation) before T014–T022.
- US2.1 (T014–T016), US2.2 (T017–T018), US2.3 invalidation (T021–T022) are independent once the foundation exists; US2.3 tests T019–T020 depend on the read paths + invalidation they assert.

### Story independence

- **US1** ships value with zero caching work (just the session fix) → MVP candidate.
- **US2.1 / US2.2** each independently testable; **US2.3** is the correctness/guardrail layer over both.

---

## Parallel Opportunities

- T002, T003 in parallel (Setup).
- T004, T005 in parallel (session tests, different files).
- T010 and T012 in parallel (different test files); T014, T017 in parallel.
- T021 and T022 touch different action files → parallel.

---

## Implementation Strategy

### MVP first

1. Phase 1 (Setup) → 2. Phase 2 (Persistent sessions) → **STOP & VALIDATE** (the top user pain is fixed and shippable on its own) → demo.

### Incremental delivery

3. Phase 3 foundation (T010–T013) → US2.1 (admin lists) → validate → US2.2 (student, wave-safe) → validate cross-wave denial → US2.3 (invalidation + degradation) → validate.
4. Phase 4 polish + walkthrough → ship.

---

## Notes

- The cache stores only already-authorized, non-secret read results; safe to flush anytime.
- All cache keys come from `lib/cache/keys.ts` only — never hand-write key strings.
- `lib/cache/redis.ts` is server-only; never import it into a Client Component.
- Mark each task `[X]` in this file as it completes; commit after each logical group.
