# Feature Specification: Redis Caching & Persistent Sessions

**Feature Branch**: `007-redis-cache-sessions`

**Created**: 2026-06-07

**Status**: Draft

**Input**: User description: "i want to add caching in the code use redis for performance optimization and i need to store sessions to[o] so i no[longer] need to login each time. analyze the code and apply it carefully without destroying any part"

## Clarifications

### Session 2026-06-07

- Q: What is the real problem behind "store sessions so I don't log in each time"? → A: After closing the app and reopening it, the user is forced to sign in again. The goal is to stay signed in across app close/reopen.
- Q: What data should caching speed up? → A: Both admin-side and student-side data.
- Q: Where should the cache/session store be hosted? → A: Upstash Redis (the app deploys on Vercel serverless).

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Stay signed in across app close and reopen (Priority: P1)

An administrator or a student signs in once. Later they fully close the app (close the browser/tab or the device), then come back hours or days later and reopen it. They land back on their dashboard already authenticated — they are not sent to the sign-in screen and do not re-enter their credentials. They remain signed in until they explicitly sign out or their session reaches its maximum allowed lifetime.

**Why this priority**: This is the user's primary pain point ("when I close the app and reopen it I need to login again"). It directly affects every returning user on every visit and is the most visible win.

**Independent Test**: Sign in, close the app completely, reopen it after a delay, and confirm the user lands authenticated on their panel home without re-entering credentials. Sign out and confirm the next reopen requires sign-in again.

**Acceptance Scenarios**:

1. **Given** an admin who signed in earlier and then closed the app, **When** they reopen the app within the allowed session window, **Then** they are taken to the admin dashboard already authenticated with no sign-in prompt.
2. **Given** a student who signed in earlier and then closed the app, **When** they reopen the app within the allowed session window, **Then** they are taken to the student dashboard already authenticated.
3. **Given** a signed-in user, **When** they explicitly sign out and then reopen the app, **Then** they are required to sign in again.
4. **Given** a user whose session has exceeded its maximum lifetime or has been revoked, **When** they reopen the app, **Then** they are required to sign in again.

---

### User Story 2 - Faster repeat loads of admin and student pages (Priority: P2)

A returning admin opens the instructor and member lists repeatedly throughout the day; a student opens their dashboard repeatedly. After the first load, subsequent loads of the same data feel noticeably faster because frequently-read data is served from a cache instead of being recomputed/refetched from scratch every time.

**Why this priority**: Performance optimization is the second explicit ask. It improves the experience for both populations but is secondary to simply staying logged in.

**Independent Test**: Load a cacheable admin list (e.g. instructors) twice in succession and confirm the second load is measurably faster, while the displayed data is identical to a direct read.

**Acceptance Scenarios**:

1. **Given** an admin viewing a read-heavy list (instructors or members), **When** they revisit the same list shortly after, **Then** the data is served faster than the first (uncached) load and is identical to the source data.
2. **Given** a student viewing their dashboard, **When** they revisit it shortly after, **Then** cacheable parts load faster while still showing only data for their own wave.

---

### User Story 3 - Cached data stays correct and wave-isolated (Priority: P1)

Whatever is cached must never leak one wave's data to another wave's users, and must never show data that is meaningfully out of date after an admin changes it. A student in Wave A must never be served Wave B's roster from the cache, and an admin who edits an instructor must see the updated value, not a stale cached one.

**Why this priority**: Wave isolation is a NON-NEGOTIABLE project constraint, and the user explicitly required applying this "without destroying any part." Correctness of cached data is therefore as critical as the login feature itself — a cache that leaks or serves stale authorization-relevant data is worse than no cache.

**Independent Test**: Populate the cache as a Wave A user, then request the same logical data as a Wave B user, and confirm Wave B never receives Wave A's cached entries. Separately, edit a record as admin and confirm the change is reflected within the allowed staleness window.

**Acceptance Scenarios**:

1. **Given** Wave A data has been cached, **When** a Wave B user requests their data, **Then** they receive only Wave B data and never any Wave A cached entry.
2. **Given** an admin edits or removes a record, **When** the related cached view is next requested, **Then** the change is reflected within the defined staleness window (cache is invalidated/refreshed on write).
3. **Given** the cache/session store is temporarily unavailable, **When** any user uses the app, **Then** the app still works by reading from the source of truth and authenticating normally, with no user-facing error.

---

### Edge Cases

- **Cache/store outage**: If the cache or session backing store is unreachable, the app MUST degrade gracefully — fall back to direct source-of-truth reads and the existing authentication path — never block the user or surface an error.
- **Explicit sign-out**: Signing out MUST end the session everywhere so a subsequent reopen requires fresh sign-in; no stale session may "resurrect" the user.
- **Session expiry / revocation**: A session past its maximum lifetime, or one revoked (e.g. member removed by an admin), MUST NOT allow continued access on reopen.
- **Stale-after-write**: A record edited or deleted by an admin must not continue to appear (or appear with old values) beyond the defined staleness window.
- **Cold cache**: First request for a given key (nothing cached yet) MUST return correct data from the source and populate the cache.
- **Role/tenant change**: If a user's role or wave assignment changes, cached and session-derived authorization MUST NOT grant access the user no longer has.

## Requirements *(mandatory)*

### Functional Requirements

**Persistent sessions**

- **FR-001**: The system MUST keep an authenticated user signed in after they fully close and later reopen the app, without re-entering credentials, until sign-out or session-lifetime expiry.
- **FR-002**: The system MUST apply persistent sessions to both administrators and students (members).
- **FR-003**: The system MUST end a session completely on explicit sign-out, so the next reopen requires a fresh sign-in.
- **FR-004**: The system MUST enforce a bounded maximum session lifetime, after which the user must sign in again (security boundary on "stay logged in").
- **FR-005**: The system MUST immediately deny access to a session whose underlying account has been removed or whose role/wave no longer authorizes the requested area (no longer-lived session may outlive the user's authorization).

**Caching**

- **FR-006**: The system MUST cache frequently-read admin-side and student-side data to make repeat loads of the same data faster than the first load.
- **FR-007**: The system MUST serve cached data that is identical to what a direct read from the source of truth would return (no silent divergence beyond the allowed staleness window).
- **FR-008**: The system MUST invalidate or refresh affected cached data when the underlying data is created, edited, or removed, so changes appear within the defined staleness window.

**Isolation, authorization & resilience (the "don't destroy anything" guardrails)**

- **FR-009**: The cache MUST be partitioned per wave/tenant so that no user can ever be served another wave's data from the cache — existing wave-isolation guarantees MUST be fully preserved.
- **FR-010**: The cache and session layers MUST NOT bypass existing authorization — server-side role gates and row-level security remain the authoritative, non-bypassable boundary; caching is a performance layer on top of already-authorized reads.
- **FR-011**: The system MUST continue to function (reads from source of truth, normal authentication) when the cache/session store is unavailable, with no user-facing errors.
- **FR-012**: The feature MUST NOT regress any existing behavior — current sign-in, role gating, password reset, member onboarding, instructor management, and wave-isolation behavior MUST continue to pass their existing tests.

### Key Entities *(include if feature involves data)*

- **Persisted session**: Represents a returning user's authenticated state across app restarts. Key attributes (conceptual): which user it belongs to, their role and wave, when it was issued, when it expires, and whether it has been revoked. Must be invalidatable on sign-out and on account removal.
- **Cache entry**: A stored copy of a frequently-read result. Key attributes (conceptual): a key that includes the owning wave/tenant (and role scope where relevant), the cached value, and a freshness/expiry marker. Must be invalidated when its source data changes.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After signing in, a user can close and reopen the app and remain signed in (no credential re-entry) for at least the defined persistent-session window (assumed 30 days of activity — see Assumptions).
- **SC-002**: Repeat loads of a cached admin or student view are at least 50% faster than the first (uncached) load of the same data, with no change to the data shown.
- **SC-003**: Zero cross-wave data exposure: in testing, a user of one wave is never served another wave's data from the cache (verified by an automated isolation test).
- **SC-004**: After an admin creates, edits, or removes a record, the change is reflected in the relevant view within the defined staleness window (assumed ≤ 60 seconds, typically immediate on next load).
- **SC-005**: When the cache/session store is forced offline, the app remains fully usable (users can sign in and load data) with no user-facing errors.
- **SC-006**: Re-login complaints after app reopen drop to zero for sessions within the persistent window.

## Assumptions

- **Redis via Upstash** is the chosen backing store for both caching and (where applicable) server-side session support, selected by the user; the app deploys on Vercel serverless.
- **Supabase Auth remains the identity source of truth.** This feature extends/persists sessions and adds a performance cache on top of the existing auth and row-level-security model — it does **not** replace Supabase Auth or the RLS wave-isolation boundary.
- **Likely root cause of the re-login issue**: the existing auth session is being stored as a non-persistent (browser-session) cookie that is cleared when the app closes. The persistent-session requirement (FR-001) is satisfied primarily by ensuring the session token persists in the browser with an appropriate lifetime; a server-side store is a supporting mechanism, not a substitute for that token. (To be confirmed and addressed in the plan phase.)
- **Persistent-session window** defaults to 30 days of activity (idle/rolling) before re-authentication is required; the absolute maximum and idle behavior are tunable and will be finalized in planning. This balances "don't make me log in every time" against security.
- **Staleness window** for cached data defaults to ≤ 60 seconds, with write-through invalidation so most changes appear immediately on the next load.
- **Cacheable data scope** initially targets read-heavy lists already in the app (e.g. instructors, member rosters, and student dashboard reads); tenant-scoped data is cached only with per-wave keys (FR-009).
- This feature reuses the existing Supabase-backed data layer and server-action architecture; no change to the public route structure or panel separation is intended.
