# Phase 0 Research: Admin Authentication & Account Separation

**Feature**: `002-admin-auth` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

This is the **first backend feature** for Meska Classroom. Per constitution Principle VI
("Scope & bootstrapping"), it introduces and must specify authentication/session
management, encryption in transit/at rest, and audit logging. The decisions below resolve
every NEEDS CLARIFICATION from the Technical Context.

---

## R1 — Identity platform & why a backend now

- **Decision**: Use **Supabase Cloud** (project `fghcfihgfgqoodylwcks`) as the system of
  record for credentials, roles, sessions, and tenant-scoped data. Credentials are stored
  and verified by Supabase Auth (GoTrue); the app never hashes or stores passwords itself.
- **Rationale**: The feature requires verifying passwords, issuing sessions, gating an
  admin-only surface **server-side**, and isolating tenant data — none of which a
  frontend-only app can do safely (Principle VI forbids client-only enforcement). Supabase
  was explicitly mandated by the requester. Using its managed Auth avoids re-implementing
  password hashing (bcrypt) and JWT issuance — a security best practice.
- **Alternatives considered**:
  - *Hand-rolled auth (custom table + bcrypt + JWT)* — rejected: re-implements security-
    critical primitives Supabase already provides and audits.
  - *NextAuth/Auth.js credentials provider over a custom DB* — rejected: still needs a
    backend, adds a second auth abstraction, and does not give us Postgres RLS for tenant
    isolation, which is the constitution's core guarantee.
- **Consequence**: Adding a backend + the Supabase SDKs is the one architectural addition
  this feature makes; it is recorded in the plan's **Complexity Tracking**.

## R2 — Admin ↔ student separation ("the most important rule")

- **Decision**: Separate the two populations **structurally**, on three layers:
  1. **Credential layer** — administrators are the only identities provisioned in Supabase
     Auth (`auth.users`). Students are **not** in `auth.users`; they live in a
     `public.students` roster table (consistent with the 001 student flow, which joins by
     name + Student ID + room, not email/password).
  2. **Profile layer** — `public.admin_profiles` (one row per admin, FK → `auth.users.id`)
     and `public.students` are **distinct tables** with distinct RLS. A query over one
     population can never return a member of the other.
  3. **Role layer** — each admin's `auth.users.app_metadata.role = 'admin'`, set
     server-side with the service-role key (users cannot modify `app_metadata`). This claim
     flows into the JWT automatically and is the authority for gating.
- **Rationale**: This is the canonical Supabase pattern and gives separation that is true
  at rest (different tables), in identity (students absent from the credential store), and
  in authorization (role claim). It directly satisfies FR-005 and makes US2's "admin only"
  rule enforceable rather than cosmetic.
- **Alternatives considered**:
  - *One `profiles` table with a `type` column* — rejected: a single shared table is the
    opposite of "separated"; one mistaken filter leaks across populations.
  - *Two separate Supabase projects (one per population)* — rejected: massive operational
    overhead, breaks shared tenant data and cross-population tests, unjustified.

## R3 — Role claim & JWT

- **Decision**: Store the role in **`app_metadata.role`** (`'admin'`), set at seed time via
  the Auth Admin API. Supabase embeds `app_metadata` in the access-token JWT, so the role
  is available to middleware, Server Actions, and Postgres RLS (`auth.jwt() ->
  'app_metadata' ->> 'role'`) without an extra round-trip.
- **Rationale**: `app_metadata` is server-controlled and tamper-proof from the client,
  unlike `user_metadata`. No custom Access Token Hook is needed for a single role, keeping
  the surface minimal ("JWT if needed" → needed, and satisfied by the built-in claim).
- **Alternatives considered**: *Custom Access Token Hook (Postgres function) to inject
  claims* — deferred; unnecessary for one static role, adds a DB function to maintain.
  *Look up role from `admin_profiles` on every request* — rejected: extra query per request
  when the JWT already carries the fact.

## R4 — Where authentication runs (App Router integration)

- **Decision**: Use **`@supabase/ssr`** with cookie-based sessions.
  - The admin login `<form>` (currently a static `action="/admin/dashboard"`) is replaced by
    a **Server Action** that calls `signInWithPassword`, enforces the admin-role gate, and
    `redirect()`s to `/admin/dashboard` on success.
  - **Middleware** (`middleware.ts`) refreshes the session and protects `/admin/dashboard`
    (and future admin routes): no valid admin session → redirect to `/admin`.
  - Three Supabase client factories in `lib/supabase/`: a **browser** client, a **server**
    client (RSC/Server Action, cookie-bound), and an **admin** client (service-role, server
    only, used solely by the seed script — never imported into request code).
- **Rationale**: `@supabase/ssr` is the current official pattern for Next.js App Router;
  it keeps tokens in `httpOnly` cookies (not readable by JS), refreshes them in middleware,
  and works with RSC. Server Action keeps the credential check entirely server-side
  (Principle VI).
- **Alternatives considered**: *Client-side `signInWithPassword` + client redirect* —
  rejected: role gate would run on the client, violating server-side enforcement; tokens
  would live in `localStorage` (XSS-exposed). *Route Handler (`/api/...`) instead of a
  Server Action* — viable but a Server Action is less surface area and idiomatic for a form.

## R5 — Admin-only enforcement & generic failures (US2, FR-003/FR-004)

- **Decision**: After `signInWithPassword` succeeds, the Server Action reads the resulting
  session's `app_metadata.role`. If it is not `'admin'` (or no `admin_profiles` row exists),
  it **signs the session out immediately** and returns the **same generic error** used for
  wrong-password and unknown-email cases: *"Invalid credentials or insufficient access."*
  No branch reveals which condition failed (FR-004, SC-006).
- **Rationale**: Prevents privilege escalation (a valid non-admin must not hold an admin
  session even briefly server-side) and prevents account/role enumeration.
- **Validation**: The decision is a pure function `assertAdminSession(session)` →
  deterministically unit-testable for the three denial cases and the allow case.

## R6 — Multi-tenancy & isolation (FR-008, SC-005)

- **Decision**: Introduce a minimal `public.tenants` table; tenant-scoped tables
  (`students`, and future content) carry a `tenant_id` FK. **RLS** enforces isolation:
  - Student/anon roles can read only rows whose `tenant_id` matches their JWT's tenant
    claim (claim wiring lands with the future student-auth feature).
  - **Admins (super-admin, per spec assumption) bypass tenant scoping** — a policy branch
    `auth.jwt()->'app_metadata'->>'role' = 'admin'` grants full read ("full control",
    FR-007).
  - `service_role` bypasses RLS (used only by seeding).
- **Rationale**: Postgres RLS is the server-side, non-bypassable boundary the constitution
  demands. Keeping `tenants` minimal avoids building the full student/wave domain here
  (Simplicity).
- **Scope honesty**: Live student-session cross-tenant denial attaches to the student-auth
  feature (as 001 deferred wave tests). This feature still **ships the RLS policies** and a
  **claims-simulated denial test** (set `request.jwt.claims` for tenant A, assert zero
  tenant-B rows), so the boundary is real and tested now, not client-only.

## R7 — Seeding the bootstrap admin (FR-006)

- **Decision**: A one-shot, **idempotent** Node script `scripts/seed-admin.ts` using the
  service-role admin client: look up `ahmedatif@meska.ai`; if absent, `auth.admin.createUser`
  with `email_confirm: true`, password from `SEED_ADMIN_PASSWORD` env, and
  `app_metadata: { role: 'admin' }`; then `upsert` the matching `admin_profiles` row. Run
  via `npm run seed:admin`.
- **Rationale**: The Auth Admin API creates a confirmed user with a properly hashed password
  in one call; idempotency makes re-runs safe and avoids overwriting a rotated password.
- **Alternatives considered**: *SQL insert into `auth.users`* — rejected: bypasses GoTrue
  invariants (hashing, identities rows) and is fragile across Supabase versions.

## R8 — Schema delivery (migrations)

- **Decision**: SQL migrations under `supabase/migrations/` (timestamped files): tables,
  constraints, and RLS policies. Applied via the Supabase SQL editor (or CLI if installed) —
  documented in `quickstart.md`. The seed script runs after migrations.
- **Rationale**: Plain SQL files are reviewable, versioned, and tool-agnostic; they do not
  assume the Supabase CLI is installed locally.

## R9 — Secrets & configuration

- **Decision**: Environment variables only:
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — client-safe (RLS-guarded).
  - `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_PASSWORD` — **server-only**, used solely by the
    seed script; never imported into client or request code.
  - `.env.local` is git-ignored; `.env.example` documents the names (no values).
- **⚠️ Security action**: The service-role key, anon key, and admin password were shared in
  chat and MUST be treated as compromised — **rotate the service-role key (and anon key) in
  the Supabase dashboard and change the seed password** before/at first deploy. None of
  these values are committed.

## R10 — Encryption, sessions & audit (Principle VI bootstrapping)

- **In transit**: All Supabase traffic is HTTPS/TLS 1.2+ (enforced by Supabase). The app is
  served over HTTPS in production; cookies are `Secure` + `httpOnly` + `SameSite=Lax`.
- **At rest**: Supabase encrypts Postgres storage (AES-256) and hashes passwords with bcrypt
  (GoTrue) — the app stores no plaintext credentials (FR-011).
- **Session management**: Short-lived access JWT (~1h) + rotating refresh token, both in
  `httpOnly` cookies; middleware refreshes; sign-out clears cookies and revokes the session.
- **Audit logging (minimal)**: An `public.admin_auth_events` table records admin sign-in
  outcomes (`success` / `denied`, timestamp, reason-category, no password) for traceability.
  Kept intentionally small; broader audit scope attaches to later features.

## R11 — Testing strategy (Principle II, NON-NEGOTIABLE)

- **Deterministic unit tests** (Vitest, already established in 001), with the Supabase client
  **mocked**:
  - `assertAdminSession` — allow admin; deny student-role; deny wrong-password; deny
    unknown-email (all → identical generic message).
  - Mandatory-field validation — empty email / empty password / both empty rejected before
    any auth call (FR-002).
  - Login Server Action — success path redirects to `/admin/dashboard`; each denial path
    returns the generic error and creates no session.
- **Component test** — admin form: both inputs `required`; submitting empty blocks and shows
  the required-field message (US3).
- **RLS / isolation tests** — SQL-claims-simulated denial run against the project (or
  pgTAP), gated behind env creds and self-cleaning: admin-bypass returns rows; a tenant-A
  claim returns zero tenant-B rows (SC-005); a student-population read returns no admin and
  vice-versa (SC-004). Documented as integration-tier in `quickstart.md`.
- **Rationale**: Authorization decisions live in pure, mockable TS so the guarantees are
  deterministically covered; RLS — the actual server boundary — is verified at the claims
  level. This honors "behavior the platform guarantees MUST be covered" without making the
  suite depend on flaky live network calls for the unit tier.

---

### Resolved unknowns

| Unknown (Technical Context) | Resolution |
|-----------------------------|------------|
| Backend / identity platform | Supabase Cloud + Supabase Auth (R1) |
| Admin/student separation | Separate tables + students absent from `auth.users` + role claim (R2) |
| Role/JWT mechanism | `app_metadata.role` in the access JWT (R3) |
| App Router auth integration | `@supabase/ssr`, Server Action + middleware (R4) |
| Tenant isolation | `tenant_id` + RLS, admin bypass (R6) |
| Seeding | Idempotent admin-API script (R7) |
| Secrets handling | env-only, rotate leaked keys (R9) |
| Encryption/session/audit | TLS + bcrypt + httpOnly cookies + `admin_auth_events` (R10) |
| Test approach | mocked-client unit + claims-simulated RLS (R11) |
