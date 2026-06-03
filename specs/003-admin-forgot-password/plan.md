# Implementation Plan: Admin Forgot Password & Reset

**Branch**: `003-admin-forgot-password` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/003-admin-forgot-password/spec.md`

## Summary

Add self-service password recovery for the administrator population established in
`002-admin-auth`. From the admin sign-in, an admin opens a **forgot-password** page, submits
their email, and — only if the email belongs to an administrator — receives a single-use,
time-limited reset link, while every request returns the **same neutral confirmation** so
account existence is never disclosed. The link lands on a server-side **confirm** Route
Handler that verifies the recovery token and establishes a short-lived admin recovery session,
then routes to a **change-password** page; on submit, the new password (validated + confirmed)
is applied and **all other sessions are revoked**, returning the admin to sign-in. Recovery is
built on Supabase Auth's recovery primitives (`resetPasswordForEmail` → `verifyOtp` →
`updateUser`) — no custom token store — and reuses 002's Supabase clients, `app_metadata.role`
gate, audit RPC, and pure-helper testing. The only schema change is migration `0003`
(an `is_admin_email` helper + widened audit categories). Full Phase 0/1 detail lives in
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/reset-contracts.md](./contracts/reset-contracts.md), and
[quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.2.4 (React Compiler enabled),
Next.js 16.2.6 (App Router).

**Primary Dependencies**: Next.js, React, Tailwind v4, `@supabase/supabase-js`,
`@supabase/ssr` — **all already installed in 002; no new dependency**.

**Storage**: Supabase Cloud (Postgres + Supabase Auth) — reused. Recovery tokens are
GoTrue-managed (not modeled). Schema delta: migration `0003` (function `is_admin_email` +
widened CHECK on `admin_auth_events`).

**Testing**: Vitest + React Testing Library (jsdom) with a mocked Supabase client for pure
helpers, Server Actions, the confirm Route Handler, and the forms — same tiers as 002.

**Target Platform**: Web — latest two major Chrome/Edge/Firefox/Safari (desktop) + iOS Safari
and Chrome on Android (latest two); mobile-first from 320px.

**Project Type**: Web application (Next.js App Router) + Supabase backend (existing).

**Performance Goals**: Each step is a single Server Action / Route Handler round-trip; meet the
mobile CWV budget **LCP < 2.5s, CLS < 0.1, INP < 200ms** on a mid-tier Android over Slow-4G.
The forgot-password and change-password pages are server-rendered; only the small interactive
form islands ship client JS. No new middleware/proxy cost (matcher unchanged).

**Constraints**: Server-side enforcement of the admin-only gate and link verification (never
client-only); no plaintext credentials; neutral, non-enumerating responses; new password
validated before any mutation; other sessions revoked on change; WCAG 2.1 AA; English-only
LTR; brand only via tokens; all UI copy via `lib/strings.ts`.

**Scale/Scope**: 2 new Server Actions, 1 Route Handler, 2 pages + 2 client form islands, 2
pure helpers, 1 migration (1 function + 1 ALTER), ~18 new strings, 1 one-line change to
`AdminLoginForm` and `.env.example`. Supabase Auth config (redirect allow-list, email
template, password policy, rate limits).

## Constitution Check

*GATE: evaluated against constitution v2.0.0. Must pass before Phase 0 and re-checked after
Phase 1.*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, build+lint clean, App Router + `@/*`, shared logic in `lib/`, no manual memo, tolerate long/AI text | **PASS** — validators in `lib/auth/`, copy in `lib/strings.ts`, Supabase via existing `lib/supabase/*`; no hand memoization; messages tolerate any length. |
| II — Testing (NON-NEGOTIABLE) | Guaranteed behavior covered by deterministic isolated tests | **PASS** — pure validators + the neutral-response, admin-only-gate, and update paths are mockable and unit-tested; confirm route tested with mocked `verifyOtp`. |
| III — UX Consistency | Brand tokens, consistent loading/empty/**error** states, context-aware logo, English/LTR | **PASS** — reuses the admin card, tokens, and `role="alert"` pattern from 002; defines sending / success / validation / invalid-link states; logo stays admin-context; all copy centralized. |
| IV — Mobile-First / Responsive / A11y | Usable 320→desktop, touch targets, visible focus, WCAG AA, inputs ≥16px mobile | **PASS** — new forms reuse the 002 mobile-first input/button styling; validated 320/390/430/768/desktop in the walkthrough; messages announced to AT. |
| V — Performance | RSC-first, bounded reads, CWV budget stated | **PASS** — server-rendered pages, small form islands, single round-trips, no extra proxy work; budget stated above. |
| VI — Wave Isolation & Tenant Boundaries (NON-NEGOTIABLE) | Tenant-scoped reads server-side; admin capabilities role-gated server-side | **PASS** — admin-only recovery enforced server-side twice: `is_admin_email` RPC (request) and `assertAdminSession` on the recovery session (confirm). No new tenant-scoped read is introduced, so no new cross-tenant path exists; 002's RLS is unchanged. |
| VII — Artifact Structure (NON-NEGOTIABLE) | plan = Phase → Story → Acceptance Criteria → Test Scenarios; walkthrough per phase | **PASS** — see Implementation Phases; each phase ships a `walkthrough.md`. |

**Tech-constraint check**: No new backend, dependency, state library, or component library is
added — this feature is built entirely on infrastructure 002 already justified. **No new
architectural additions**, so Complexity Tracking is empty.

**Result**: PASS (no violations). No NEEDS CLARIFICATION remain after Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/003-admin-forgot-password/
├── plan.md                       # This file
├── research.md                   # Phase 0 — decisions R1–R10
├── data-model.md                 # Phase 1 — migration 0003 delta + reused entities
├── quickstart.md                 # Phase 1 — configure, run, verify
├── contracts/
│   └── reset-contracts.md        # Phase 1 — actions, route handler, helpers, config, copy
├── checklists/
│   └── requirements.md           # spec quality checklist (from /speckit-specify)
├── spec.md
├── tasks.md                      # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md                # per implemented phase (/speckit-implement, Principle VII)
```

### Source Code (repository root)

```text
app/
└── admin/
    ├── actions.ts                # MODIFY: add requestPasswordReset + updateAdminPassword Server Actions
    ├── forgot-password/
    │   └── page.tsx              # NEW: request-link page (renders ForgotPasswordForm)
    ├── reset-password/
    │   └── page.tsx              # NEW: change-password page; renders form or invalid-link state
    └── auth/
        └── confirm/
            └── route.ts          # NEW: GET — verifyOtp(recovery) + admin check → redirect

components/
├── AdminLoginForm.tsx            # MODIFY (1 line): "Forgot password?" button → Link to /admin/forgot-password
├── ForgotPasswordForm.tsx        # NEW: client island bound to requestPasswordReset
└── ResetPasswordForm.tsx         # NEW: client island bound to updateAdminPassword

lib/
├── auth/
│   ├── adminGate.ts              # REUSE: assertAdminSession (confirm-side gate)
│   └── passwordReset.ts          # NEW: validateEmailField + validateNewPassword (pure)
└── strings.ts                    # MODIFY: add recovery copy (C7)

supabase/
└── migrations/
    └── 0003_password_reset.sql   # NEW: is_admin_email() + widen admin_auth_events CHECK

tests/
├── lib/auth/passwordReset.test.ts        # NEW: email + new-password validators (pure)
├── app/admin/requestPasswordReset.test.ts# NEW: neutral response + admin-only send (mocked)
├── app/admin/updateAdminPassword.test.ts # NEW: validation + update + global signOut (mocked)
├── app/admin/confirmRoute.test.ts        # NEW: verifyOtp success/failure → redirect (mocked)
└── components/ResetForms.test.tsx        # NEW: required inputs + state rendering

.env.example                      # MODIFY: add NEXT_PUBLIC_SITE_URL (name only)
```

**Structure Decision**: Next.js App Router + existing Supabase backend. The mutation logic
lives in Server Actions (`app/admin/actions.ts`) and the cookie-setting token exchange in a
Route Handler (`app/admin/auth/confirm/route.ts`), mirroring 002's separation
(action = mutation, route handler = cookie write, page = render). Admin-only enforcement is
server-side on both ends (`is_admin_email` RPC + `assertAdminSession`). `proxy.ts` is
unchanged — the recovery routes are intentionally outside the `/admin/dashboard` matcher
because the recovery session is established mid-flow. Pure validators stay in `lib/auth/` for
deterministic testing.

## Implementation Phases

### Phase 1 — Request a reset link (forgot-password)

Delivers the entry point: the admin-only, non-enumerating request flow. Adds migration `0003`
(the `is_admin_email` gate + audit categories), the forgot-password page/form, the
`requestPasswordReset` Server Action, the email validator, the config (`NEXT_PUBLIC_SITE_URL`,
redirect allow-list, recovery email template), and wires the existing "Forgot password?"
control to the new page. Implements spec **User Story 1 (P1)** and the request side of **User
Story 3 (P2)**. Independently testable without the change-password page (assert neutral
responses and that only admin emails trigger a send).

#### User Story 1.1: As an administrator who forgot my password, I want to request a reset link from the sign-in page, so that I can begin recovering access.

- Description: Add `app/admin/forgot-password/page.tsx` + `components/ForgotPasswordForm.tsx`;
  change the `AdminLoginForm` "Forgot password?" button to a `Link`; add `requestPasswordReset`
  to `app/admin/actions.ts` calling `resetPasswordForEmail` with the absolute `redirectTo`;
  add `validateEmailField`; add the C7 request-side strings; add `NEXT_PUBLIC_SITE_URL` to
  `.env.example`.

#### User Story 3.1: As the platform, I want password recovery to be admin-only and to never reveal whether an email maps to an administrator, so that the admin/student separation and anti-enumeration guarantees hold.

- Description: Add migration `0003` (`is_admin_email` SECURITY DEFINER RPC + widened
  `admin_auth_events` CHECK); gate the send on `is_admin_email`; return the **same** neutral
  confirmation for every request; record `reset_requested` via the existing audit RPC.

#### Acceptance Criteria (for the phase)

- [ ] Clicking "Forgot password?" on `/admin` navigates to `/admin/forgot-password` (FR-001).
- [ ] Submitting an empty email is blocked before any backend call with a required-field message (FR-002).
- [ ] Submitting an administrator's email issues a reset link and shows the neutral confirmation (FR-001, US1).
- [ ] Submitting a non-admin or unknown email shows the **identical** neutral confirmation and issues **no** usable link (FR-003, FR-004, SC-002).
- [ ] `is_admin_email` returns true only for an `admin_profiles` row with `role='admin'`; the service-role key is not used in request code (FR-010).
- [ ] A `reset_requested` row is recorded via `log_admin_auth_event`; no password is stored and no reason is returned to the client (FR-015).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** the admin sign-in, **When** "Forgot password?" is activated, **Then** the browser navigates to `/admin/forgot-password` (golden path).
2. **Given** the forgot-password form, **When** the seeded admin email is submitted, **Then** `resetPasswordForEmail` is called and the neutral confirmation is shown.
3. **Given** the form, **When** a student/unknown email is submitted, **Then** `resetPasswordForEmail` is **not** called and the message is byte-identical to the admin case (no enumeration, SC-002).
4. **Given** the form, **When** an empty email is submitted, **Then** submission is blocked before any backend call with the required-field message (FR-002).
5. **Given** any submission, **When** it completes, **Then** a `reset_requested` audit row exists and the reason is never present in the returned state (FR-015).

---

### Phase 2 — Set the new password (reset-password)

Delivers the completion: verifying the link, the change-password page, applying the new
password, and revoking other sessions — plus link-integrity failure handling. Adds the confirm
Route Handler, the reset-password page/form, the `updateAdminPassword` Server Action, the
new-password validator, and the C7 reset-side strings. Implements spec **User Story 2 (P1)**,
**User Story 4 (P2)**, and the confirm-side of **User Story 3**. Independently testable with a
mocked `verifyOtp`/`updateUser`.

#### User Story 2.1: As an administrator, I want to set a new password from my reset link and then sign in with it, so that I regain access.

- Description: Add `app/admin/auth/confirm/route.ts` (`verifyOtp` → `assertAdminSession` →
  redirect); add `app/admin/reset-password/page.tsx` + `components/ResetPasswordForm.tsx`; add
  `updateAdminPassword` to `actions.ts` (validate → `updateUser({ password })` →
  `signOut({ scope:'global' })` → `redirect('/admin')`); add `validateNewPassword`.

#### User Story 4.1: As the platform, I want reset links to be single-use, expiring, and to fail safely, so that a leaked or stale link cannot change a password.

- Description: Confirm route maps invalid/expired/used/tampered tokens and non-admin recovery
  sessions to the invalid-link state (`?error=link`) and a `reset_invalid` audit row; the
  reset-password page renders the invalid-link state (with "Request a new link") whenever there
  is no valid admin recovery session.

#### Acceptance Criteria (for the phase)

- [ ] Opening a valid, unexpired admin reset link establishes a recovery session and lands on `/admin/reset-password` with the new-password form (FR-006, US2).
- [ ] Submitting a new password that is `< 8` chars, empty, or doesn't match its confirmation is blocked before any change with a clear message (FR-007, SC-006).
- [ ] A valid submission applies the new password (`updateUser`) and then revokes all sessions (`signOut({ scope:'global' })`) and redirects to `/admin` (FR-008, FR-012, FR-013, SC-005, SC-007).
- [ ] After a successful reset, the new password authenticates and the previous password is rejected (SC-005).
- [ ] An expired, already-used, malformed, or non-admin link yields the invalid-link state and a "Request a new link" affordance; **no** password changes (FR-005, FR-009, FR-010, SC-003).
- [ ] A `reset_done` row is recorded on success and a `reset_invalid` row on rejection; no reason is returned to the client (FR-015).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** a valid admin recovery `token_hash`, **When** `/admin/auth/confirm` is hit, **Then** `verifyOtp` succeeds and the response redirects to `/admin/reset-password` (golden path).
2. **Given** a valid recovery session, **When** a matching password of length ≥ 8 is submitted, **Then** `updateUser` is called, followed by `signOut({ scope:'global' })`, then a redirect to `/admin` (SC-005, SC-007).
3. **Given** the change-password form, **When** a `< 8`-char or mismatched password is submitted, **Then** it is blocked before `updateUser` with the correct validation message (SC-006).
4. **Given** an expired/used/malformed `token_hash` (or a non-admin recovery session), **When** `/admin/auth/confirm` is hit, **Then** it redirects with `error=link`, records `reset_invalid`, and no password changes (SC-003, FR-009/FR-010).
5. **Given** `/admin/reset-password?error=link` (or no recovery session), **When** rendered, **Then** the invalid-link state with "Request a new link" is shown and no form submits a change.
6. **Given** the reset-password screen at 320px, **When** rendered, **Then** no horizontal scroll/overlap and both fields + button are reachable with visible focus. *(manual, walkthrough)*

## Complexity Tracking

> No constitution violations. This feature adds no backend, dependency, or architectural
> element beyond what `002-admin-auth` already justified, so there is nothing to track here.
