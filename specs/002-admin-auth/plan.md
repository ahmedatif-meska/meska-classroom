# Implementation Plan: Admin Authentication & Account Separation

**Branch**: `002-admin-auth` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/002-admin-auth/spec.md`

## Summary

Add real authentication behind the existing Admin sign-in surface and establish Meska
Classroom's **first backend**. Administrators sign in with email + password (both
mandatory); the server verifies credentials, **enforces an admin-only role gate**, and only
then grants an admin session and routes to `/admin/dashboard`. The defining rule —
**administrators and students are separate populations in the database** — is realized
structurally: admins are the only identities in Supabase Auth (`auth.users`) and own
`admin_profiles`; students live in a separate `students` roster table and are absent from the
credential store. Multi-tenant data is isolated by Postgres **Row-Level Security**, with the
super-admin bypassing tenant scope ("full control"). A bootstrap admin
(`ahmedatif@meska.ai`) is seeded idempotently. Because this is the first backend feature, the
plan also specifies the auth/session, encryption, and minimal-audit controls the
constitution defers to it (Principle VI bootstrapping). Full Phase 0/1 detail lives in
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/auth-contracts.md](./contracts/auth-contracts.md), and
[quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.2.4 (React Compiler enabled),
Next.js 16.2.6 (App Router).

**Primary Dependencies**: Next.js, React, Tailwind v4 (existing). **New (this feature)**:
`@supabase/supabase-js`, `@supabase/ssr` — see Constitution Check / Complexity Tracking / R1,
R4.

**Storage**: **Supabase Cloud** (Postgres + Supabase Auth) — project `fghcfihgfgqoodylwcks`.
Tables: `tenants`, `admin_profiles`, `students`, `admin_auth_events`; auth in `auth.users`.

**Testing**: Vitest + React Testing Library (jsdom, established in 001) for deterministic
unit/component tests with a mocked Supabase client; SQL-claims-simulated RLS tests
(integration tier, env-gated, self-cleaning) for isolation guarantees. (R11)

**Target Platform**: Web — latest two major Chrome/Edge/Firefox/Safari (desktop) + iOS
Safari and Chrome on Android (latest two); mobile-first from 320px.

**Project Type**: Web application (Next.js App Router) **+ backend-as-a-service** (Supabase) —
the first backend in the project.

**Performance Goals**: Sign-in is a single Server Action round-trip; meet mobile CWV budget
**LCP < 2.5s, CLS < 0.1, INP < 200ms** on a mid-tier Android over Slow-4G. Login form is
server-rendered; only the small interactive form island ships client JS. Middleware adds one
lightweight session refresh per protected navigation.

**Constraints**: Server-side enforcement of role and tenant isolation (never client-only);
no plaintext credentials; generic auth failures (no enumeration); WCAG 2.1 AA; English-only
LTR; brand only via tokens; all UI copy via `lib/strings.ts`.

**Scale/Scope**: 1 seeded admin initially; 4 new tables; 1 Server Action, 1 middleware, 3
Supabase client factories, 1 seed script; ~4 new strings. Reads are bounded by RLS + future
pagination.

## Constitution Check

*GATE: evaluated against constitution v2.0.0. Must pass before Phase 0 and re-checked after
Phase 1.*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, build+lint clean, App Router + `@/*`, shared logic in `lib/`, no manual memo, tolerate long/AI text | **PASS** — Supabase clients in `lib/supabase/`, gate logic in `lib/auth/`, copy in `lib/strings.ts`; no hand memoization; error text tolerates any length. |
| II — Testing (NON-NEGOTIABLE) | Guaranteed behavior covered by deterministic isolated tests; bug fixes ship a failing-first test | **PASS** — admin-gate, mandatory-field, and Server-Action paths are pure/mockable and unit-tested deterministically; RLS denial covered by claims-simulated tests (R11). |
| III — UX Consistency | Brand tokens, consistent loading/empty/**error** states, context-aware logo, canonical logo, English/LTR | **PASS** — reuses the 001 admin card + tokens; adds defined error (generic `role="alert"`) and signing-in states; all copy centralized; logo unchanged (stays admin-context). |
| IV — Mobile-First / Responsive / A11y | Usable 320→desktop, touch targets, visible focus, WCAG AA, inputs ≥16px mobile | **PASS** — existing form already mobile-first and token-styled; validated 320/390/430/768/desktop in the walkthrough; error announced to AT. |
| V — Performance | RSC-first, bounded reads, CWV budget stated | **PASS** — server-rendered form, single Server Action; reads RLS-bounded (pagination attaches to data-listing features); budget stated above. |
| VI — Wave Isolation & Tenant Boundaries (NON-NEGOTIABLE) | Tenant-scoped reads filtered **server-side**; cross-boundary denial tested; admin capabilities role-gated server-side. **This is the first backend feature → it MUST specify auth/session, encryption, audit.** | **PASS (now ACTIVE)** — RLS enforces tenant isolation server-side; admin role-gate is server-side (Server Action + middleware); cross-tenant + cross-population denial tested (R6, R11). Bootstrapping controls specified: TLS in transit, bcrypt + AES-256 at rest, httpOnly-cookie JWT sessions, `admin_auth_events` audit (R10). |
| VII — Artifact Structure (NON-NEGOTIABLE) | plan = Phase → Story → Acceptance Criteria → Test Scenarios; walkthrough per phase | **PASS** — see Implementation Phases; each phase ships a `walkthrough.md`. |

**Tech-constraint check**: This feature adds a **backend (Supabase)** and the
`@supabase/*` SDKs — the project's first. The constitution explicitly anticipates this
("No backend … is wired up yet. Adding any … MUST be justified in the feature plan, with the
rejected simpler alternative recorded") and assigns the auth/encryption/audit bootstrapping
to "the first backend feature." It is therefore an **anticipated, justified** addition,
recorded in **Complexity Tracking** with the rejected simpler alternative.

**Result**: PASS (no unjustified violations). Tracked external action: rotate the leaked
Supabase keys and admin password before sign-off (R9).

## Project Structure

### Documentation (this feature)

```text
specs/002-admin-auth/
├── plan.md                    # This file
├── research.md                # Phase 0 — decisions R1–R11
├── data-model.md              # Phase 1 — tables, RLS, seed data
├── quickstart.md              # Phase 1 — configure, seed, run, verify
├── contracts/
│   └── auth-contracts.md      # Phase 1 — Server Action, middleware, RLS, config, copy
├── checklists/
│   └── requirements.md        # spec quality checklist (from /speckit-specify)
├── spec.md
├── tasks.md                   # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md             # per implemented phase (/speckit-implement, Principle VII)
```

### Source Code (repository root)

```text
app/
└── admin/
    ├── page.tsx               # MODIFY: form bound to signInAdmin Server Action (required inputs, error state)
    ├── actions.ts             # NEW: 'use server' — signInAdmin, signOutAdmin
    └── dashboard/
        └── page.tsx           # MODIFY (light): sign-out control; protected by middleware

proxy.ts                       # NEW: refresh session + protect /admin/dashboard (Next 16 proxy convention)

lib/
├── supabase/
│   ├── client.ts              # NEW: browser client (anon)
│   ├── server.ts              # NEW: server/RSC client (cookie-bound, anon)
│   └── admin.ts               # NEW: service-role client (server-only; seed use only)
├── auth/
│   └── adminGate.ts           # NEW: assertAdminSession() + mandatory-field validation (pure)
└── strings.ts                 # MODIFY: add admin auth copy (C6)

scripts/
└── seed-admin.ts              # NEW: idempotent bootstrap-admin seeding (service role)

supabase/
└── migrations/
    ├── 0001_init_identity.sql # NEW: tenants, admin_profiles, students, admin_auth_events
    └── 0002_rls_policies.sql  # NEW: enable RLS + policies (admin bypass, tenant scope)

tests/
├── lib/auth/adminGate.test.ts        # NEW: gate + validation (deterministic)
├── app/admin/signInAdmin.test.ts     # NEW: Server Action success/denial paths (mocked)
├── components/AdminLoginForm.test.tsx# NEW: required inputs + error rendering
└── integration/rls.test.ts           # NEW: claims-simulated isolation (env-gated)

.env.example                   # NEW: documents env var names (no values)
package.json                   # MODIFY: deps + "seed:admin" script
```

**Structure Decision**: Next.js App Router frontend + Supabase backend. Authentication runs
server-side only: a Server Action (`app/admin/actions.ts`) owns credential verification and
the admin-role gate; `proxy.ts` (Next 16 `proxy`, replaces deprecated `middleware`) protects admin routes; three client factories in
`lib/supabase/` separate anon-browser, anon-server, and service-role (seed) concerns so the
service key never reaches request or client code. Schema + RLS live in versioned SQL under
`supabase/migrations/`. This isolates the new backend surface and keeps the constitution's
server-side-enforcement guarantee structural.

## Implementation Phases

### Phase 1 — Identity foundation: schema, tenancy & seeded admin

Establishes the backend so there is something to authenticate against: Supabase wiring,
the four tables with RLS, the role claim, and the idempotently-seeded bootstrap admin. This
phase makes the **separation** and **tenant-isolation** guarantees real and testable at the
data layer — independently verifiable without the login UI (via the seed script + RLS
tests). Implements spec **User Story 4 (P1)** and the provisioning half of **User Story 1**.

#### User Story 1.1: As the Meska ops lead, I want a bootstrap administrator account provisioned in the database with full-control privileges, so that the platform has an administrator from first launch.

- Description: Add `.env.example` + env loading; `lib/supabase/{client,server,admin}.ts`;
  migrations `0001`/`0002` (tenants, admin_profiles, students, admin_auth_events + RLS);
  `scripts/seed-admin.ts` and the `seed:admin` npm script; install `@supabase/*`.

#### User Story 4.1: As the platform, I want administrators and students stored as separate, RLS-isolated populations, so that admin identities can never be resolved through student data and tenants cannot read each other's data.

- Description: Encode the separation invariants (admins only in `auth.users`/`admin_profiles`
  with `role='admin'` CHECK; students only in `students`) and the RLS policies (admin bypass;
  student/anon scoped to tenant claim). Add claims-simulated isolation tests.

#### Acceptance Criteria (for the phase)

- [ ] Running `npm run seed:admin` creates `ahmedatif@meska.ai` with `app_metadata.role='admin'`, confirmed, and a matching `admin_profiles` row; a second run makes no duplicate and does not overwrite the password (idempotent, FR-006).
- [ ] `admin_profiles` rejects any non-`admin` role (CHECK), and students are absent from `auth.users` — the two populations are disjoint (FR-005).
- [ ] RLS is enabled on `admin_profiles`, `students`, `tenants`, `admin_auth_events`; an admin (super-admin) read returns rows across tenants; a tenant-A claim returns **zero** tenant-B rows (FR-008, SC-005).
- [ ] A `students` read returns no `admin_profiles` row and vice-versa (SC-004).
- [ ] The service-role key and seed password are referenced only in server-only code (`scripts/`, `lib/supabase/admin.ts`); `.env.local` is git-ignored; `.env.example` lists names only (R9).
- [ ] `npm run build` passes and `npm run lint` is clean.

#### Test Scenarios (for the phase)

1. **Given** an empty project, **When** `seed:admin` runs, **Then** the admin exists with role `admin` and an `admin_profiles` row; **When** it runs again, **Then** no duplicate is created (idempotent).
2. **Given** the seeded data and a second tenant with its own student, **When** a caller presents a JWT claim scoped to tenant A, **Then** a `students` read returns only tenant-A rows and zero tenant-B rows (cross-tenant denial, SC-005).
3. **Given** the seeded data, **When** the `students` population is read, **Then** no administrator appears; **When** `admin_profiles` is read by a non-admin claim, **Then** zero rows return (separation, SC-004).
4. **Given** an attempt to insert a row into `admin_profiles` with `role='student'`, **When** executed, **Then** the CHECK constraint rejects it.

---

### Phase 2 — Admin login: authentication, role gate & mandatory fields

Wires the existing admin login form to real authentication: mandatory email + password,
server-side credential verification, the **admin-only** role gate with generic failures,
session cookies, route protection, success redirect, and sign-out. Implements spec **User
Story 1 (P1)**, **User Story 2 (P1)**, and **User Story 3 (P2)**.

#### User Story 1.2: As an administrator, I want to sign in with my email and password and land on the admin dashboard, so that I can do administrative work.

- Description: Replace the static form `action` with the `signInAdmin` Server Action;
  `lib/auth/adminGate.ts`; `proxy.ts` protecting `/admin/dashboard`; success
  `redirect('/admin/dashboard')`; sign-out action + control on the dashboard.

#### User Story 2.1: As the platform, I want the admin login to accept administrators only and fail generically, so that students, wrong passwords, and unknown emails are all denied without leaking which failed.

- Description: After `signInWithPassword`, run `assertAdminSession`; on non-admin, sign out
  in-request; return the single generic message for all denial branches; record
  `admin_auth_events`.

#### User Story 3.1: As an administrator, I want both fields required, so that I cannot submit an empty login.

- Description: `required` on both inputs (client) + server-side empty-field rejection before
  any auth call; field-level required message.

#### Acceptance Criteria (for the phase)

- [ ] Submitting the correct admin email + password sets an admin session (httpOnly cookies) and redirects to `/admin/dashboard` (US1, FR-009).
- [ ] Visiting `/admin/dashboard` without a valid admin session redirects to `/admin` (FR-010).
- [ ] A valid **non-admin** credential is denied, leaves **no** session, and yields the **same** generic message as a wrong password and an unknown email (US2, FR-003/FR-004, SC-002/SC-006).
- [ ] Submitting with an empty email and/or password is blocked **before** any authentication call, with a required-field message (US3, FR-002, SC-003).
- [ ] On success the admin context stays in the admin panel (logo → admin home); sign-out clears the session and re-protects the dashboard (FR-012).
- [ ] The error state is announced to assistive tech (`role="alert"`); form validated at 320/390/430/768/desktop with ≥16px inputs and visible focus (Principle IV).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** the seeded admin, **When** correct credentials are submitted, **Then** the response redirects to `/admin/dashboard` and an admin session cookie is set (golden path).
2. **Given** a seeded non-admin auth user, **When** its valid credentials are submitted at the admin login, **Then** authentication is denied, no session is created, and the message equals the generic failure string (admin-only denial).
3. **Given** the seeded admin, **When** a wrong password (and separately an unknown email) is submitted, **Then** each is denied with the **identical** generic message (no enumeration, SC-006).
4. **Given** the login form, **When** submitted with empty email, empty password, then both, **Then** each is blocked before any auth call with a required-field message (mandatory fields).
5. **Given** no admin session, **When** `/admin/dashboard` is requested directly, **Then** the request is redirected to `/admin` (route protection).
6. **Given** the login screen at 320px, **When** rendered, **Then** no horizontal scroll/overlap and both fields + button are reachable with visible focus. *(manual, walkthrough)*

## Complexity Tracking

> One justified addition: the project's first backend. The constitution anticipates and
> requires this in the first backend feature, so it is recorded — not a silent deviation.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Add a backend (**Supabase**) + `@supabase/supabase-js`, `@supabase/ssr` | Verifying passwords, issuing sessions, gating an admin-only surface server-side, and isolating tenant data are impossible frontend-only; Supabase was the mandated platform (R1, R4). | A frontend-only or mocked auth cannot store credentials securely or enforce role/tenant gating server-side (Principle VI) — it would make the core guarantee cosmetic. Hand-rolled auth re-implements audited security primitives (bcrypt, JWT, RLS) unnecessarily. |
| Service-role seed script | The Auth Admin API is the only safe way to create a confirmed user with a hashed password and server-set role (R7). | Direct SQL into `auth.users` bypasses GoTrue invariants and is version-fragile. |
