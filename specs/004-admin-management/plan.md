# Implementation Plan: Admin Management

**Branch**: `004-admin-management` | **Date**: 2026-06-03 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/004-admin-management/spec.md`

> **Revision (post-`/speckit-analyze`)**: folds in all six analysis findings — CG1 (re-send
> invite), U1 (invite-dispatch-failure feedback), F1 (last-admin guard counts **active**
> admins), U2 (explicit list `loading.tsx`), I1 (FR-001 "add" not "rename"), F2 (documented
> invite→role-claim ordering). See research R1/R5/R10/R12 and Complexity Tracking.

## Summary

Give administrators a self-service **Admin Management** surface inside the admin dashboard
to list, invite, re-invite, and remove administrators — building entirely on the identity
foundation of `002-admin-auth` and the magic-link primitives of `003-admin-forgot-password`.
A new sidebar entry, **Admin Management**, opens a page that lists every administrator (name,
email, role, status, created date) read through the cookie-bound server client (RLS
`admin_profiles_select` = `is_admin()`), with the current admin's own row marked. An
**Add Admin** button opens a **Create New Admin** modal (first name, last name, email, role
fixed to "Admin"); on submit a gated Server Action uses the Supabase **Admin API**
(`inviteUserByEmail`) to create the auth user, set `app_metadata.role='admin'`, insert a
`pending` `admin_profiles` row, and email a single-use magic link — informing the creator if
that email could not be dispatched. Pending admins expose a **Resend invite** control (fresh
link, prior one invalidated). The new admin follows the link, reuses the existing
`/admin/auth/confirm` interstitial + `/admin/reset-password` set-password page (generalized to
accept `type=invite`), sets a password, and their status flips to `active`. A per-row
**Remove** action (with confirmation) calls a gated Server Action that deletes the auth user
(cascading the profile), guarded so an admin can neither remove themselves nor leave the
platform with **zero active administrators**.

The one architectural expansion over 002/003 — and the single Complexity Tracking item — is
that creating, re-inviting, and removing administrators requires the Supabase **Admin API**, so
the service-role client (previously seed-only) is now used inside **admin-session-gated** Server
Actions. The only schema change is migration `0004` (add `first_name`, `last_name`, `status` to
`admin_profiles`; widen the audit `reason` CHECK). Full Phase 0/1 detail lives in
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/admin-management-contracts.md](./contracts/admin-management-contracts.md), and
[quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.2.4 (React Compiler enabled),
Next.js 16.2.6 (App Router).

**Primary Dependencies**: Next.js, React, Tailwind v4, `@supabase/supabase-js`,
`@supabase/ssr` — **all already installed in 002; no new dependency**.

**Storage**: Supabase Cloud (Postgres + Supabase Auth) — reused. Invite tokens are
GoTrue-managed (single-use, time-limited; not modeled). Schema delta: migration `0004`
(add `first_name`, `last_name`, `status` columns to `admin_profiles` + widen the
`admin_auth_events` reason CHECK with `admin_created` / `admin_removed` / `admin_reinvited`).

**Testing**: Vitest + React Testing Library (jsdom) with a mocked Supabase client (both the
cookie-bound and the admin/service-role client) for pure helpers, Server Actions, and forms —
same tiers as 002/003.

**Target Platform**: Web — latest two major Chrome/Edge/Firefox/Safari (desktop) + iOS Safari
and Chrome on Android (latest two); mobile-first from 320px.

**Project Type**: Web application (Next.js App Router) + Supabase backend (existing).

**Performance Goals**: Each action (list read, invite, resend, remove) is a single Server
Action / RSC round-trip; meet the mobile CWV budget **LCP < 2.5s, CLS < 0.1, INP < 200ms** on a
mid-tier Android over Slow-4G. The list page is server-rendered with an explicit `loading.tsx`;
only the small interactive islands (Add-Admin modal, resend, remove-confirm) ship client JS.
The admin list is bounded (ordered by `created_at`, capped/paginatable — R8); no new proxy cost
(the proxy matcher gains one entry, `/admin/admins/:path*`, to protect the new top-level route).

**Constraints**: Server-side enforcement of the admin-only gate on every action (never
client-only); the service-role Admin API is reachable only from Server Actions that first pass
`assertAdminSession`; no plaintext credentials (new admin sets their own password via magic
link); duplicate-email rejection before any create; self-removal and last-**active**-admin
removal blocked server-side; WCAG 2.1 AA; English-only LTR; brand only via tokens; all UI copy
via `lib/strings.ts`.

**Scale/Scope**: Tens of administrators (full list shown; bounded read, pagination deferred).
4 new Server Actions (create, resend, remove, plus generalizing confirm/update for invite); 1
list page + `loading.tsx`; 1 modal island + 1 resend island + 1 remove-confirm island; 1 pure
validator module; 1 migration (3 ALTERs); a `navItems` prop added to `DashboardShell`; ~19 new
strings; seed-script updated to set `status='active'`.

## Constitution Check

*GATE: evaluated against constitution v2.0.0. Must pass before Phase 0 and re-checked after
Phase 1.*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, build+lint clean, App Router + `@/*`, shared logic in `lib/`, no manual memo, tolerate long/AI text | **PASS** — validators in `lib/auth/adminManagement.ts`, copy in `lib/strings.ts`, Supabase via existing `lib/supabase/*`; no hand memoization; name/email cells truncate and tolerate any length. |
| II — Testing (NON-NEGOTIABLE) | Guaranteed behavior covered by deterministic isolated tests | **PASS** — pure validators, the create/resend/remove Server Actions (admin-gate, duplicate-email, dispatch-failure, self/last-active-admin guards, invite/delete calls), and the list/modal rendering are mockable and unit-tested; invite-accept path tested with a mocked `verifyOtp`. |
| III — UX Consistency | Brand tokens, consistent loading/empty/**error** states, context-aware logo, English/LTR | **PASS** — reuses the 002/003 card, tokens, `role="alert"`, and form-island patterns; defines list **loading** (`loading.tsx`) / empty / error, modal validating / submitting / duplicate-email / **invite-not-sent**, resend, and remove confirming states; logo stays admin-context; all copy centralized. |
| IV — Mobile-First / Responsive / A11y | Usable 320→desktop, touch targets, visible focus, WCAG AA, inputs ≥16px mobile, data-heavy view has a documented mobile strategy | **PASS** — the admin **table adopts a card-transform at narrow widths** (documented mobile strategy, R8); modal scrolls internally and traps focus; inputs ≥16px; validated 320/390/430/768/desktop in the walkthrough. |
| V — Performance | RSC-first, bounded reads, CWV budget stated | **PASS** — server-rendered list + `loading.tsx`, small islands, single round-trips; the admin read is ordered + bounded; budget stated above. |
| VI — Wave Isolation & Tenant Boundaries (NON-NEGOTIABLE) | Tenant-scoped reads server-side; admin capabilities role-gated server-side | **PASS** — every Admin Management action is gated server-side: the list relies on `admin_profiles` RLS (`is_admin()`); create/resend/remove Server Actions call `assertAdminSession` **before** touching the Admin API, and the page is protected by the proxy matcher entry `/admin/admins/:path*`. No new tenant-scoped (student/wave) read is introduced, so no new cross-tenant path exists; 002's RLS is unchanged. |
| VII — Artifact Structure (NON-NEGOTIABLE) | plan = Phase → Story → Acceptance Criteria → Test Scenarios; walkthrough per phase | **PASS** — see Implementation Phases; each phase ships a `walkthrough.md`. |

**Tech-constraint check**: No new dependency, state library, or component library is added.
The **one** architectural change is using the existing service-role client inside
admin-gated Server Actions (the Supabase Admin API is the only supported way to create/delete
auth users with a server-set role — the same reason the 002 seed script uses it). This is
recorded in **Complexity Tracking** with the rejected simpler alternative.

**Result**: PASS (one justified expansion, tracked). No NEEDS CLARIFICATION remain after
Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/004-admin-management/
├── plan.md                              # This file
├── research.md                          # Phase 0 — decisions R1–R12
├── data-model.md                        # Phase 1 — migration 0004 delta + reused entities
├── quickstart.md                        # Phase 1 — configure, run, verify
├── contracts/
│   └── admin-management-contracts.md    # Phase 1 — actions, helpers, page/modal, config, copy
├── checklists/
│   └── requirements.md                  # spec quality checklist (from /speckit-specify)
├── spec.md
├── tasks.md                             # Phase 2 output (/speckit-tasks — re-run after this revision)
└── walkthrough.md                       # per implemented phase (/speckit-implement, Principle VII)
```

### Source Code (repository root)

```text
app/
└── admin/
    ├── actions.ts                       # MODIFY: add createAdmin + resendInvite + removeAdmin;
    │                                    #         generalize confirm/update for type=invite + status flip
    ├── dashboard/
    │   ├── page.tsx                     # MODIFY (light): pass navItems + activeHref to DashboardShell
    │   └── admins/
    │       ├── page.tsx                 # NEW: Admin Management list page (RSC, in DashboardShell)
    │       └── loading.tsx              # NEW: list loading state (U2 / FR-019)
    └── auth/
        └── confirm/
            └── page.tsx                 # MODIFY: accept type=invite alongside recovery

components/
├── DashboardShell.tsx                   # MODIFY: accept navItems[] + activeHref (default = Dashboard only)
├── AdminTable.tsx                       # NEW: list table / mobile card-transform + per-row remove + resend
├── AddAdminModal.tsx                    # NEW: client island — "Create New Admin" dialog bound to createAdmin
├── ResendInviteButton.tsx              # NEW: client island — resend invite for a pending admin
└── RemoveAdminDialog.tsx               # NEW: client island — confirm + submit removeAdmin

lib/
├── auth/
│   ├── adminGate.ts                     # REUSE: assertAdminSession (gate every action)
│   └── adminManagement.ts               # NEW: validateNewAdminFields (+ name/status display helpers) (pure)
├── supabase/
│   └── admin.ts                         # REUSE: createAdminClient — now also called by gated Server Actions
└── strings.ts                           # MODIFY: add Admin Management copy (C8)

supabase/
└── migrations/
    └── 0004_admin_management.sql        # NEW: ALTER admin_profiles (+first_name,+last_name,+status);
                                         #      widen admin_auth_events reason CHECK

scripts/
└── seed-admin.ts                        # MODIFY (light): set status='active' (+ optional name split) on upsert

tests/
├── lib/auth/adminManagement.test.ts        # NEW: new-admin field validators + display helper (pure)
├── app/admin/createAdmin.test.ts           # NEW: gate + duplicate-email + invite + pending row + dispatch-fail (mocked)
├── app/admin/resendInvite.test.ts          # NEW: gate + pending-only + fresh invite (mocked)
├── app/admin/removeAdmin.test.ts           # NEW: gate + self-guard + last-ACTIVE-admin guard + delete (mocked)
├── app/admin/confirmInvite.test.ts         # NEW: type=invite verifyOtp + status→active (mocked)
├── app/admin/adminsPage.test.tsx           # NEW: list renders rows, marks current user, empty state
└── components/AddAdminModal.test.tsx       # NEW: required fields + duplicate/error/invite-not-sent + cancel

.env.example                             # (unchanged — NEXT_PUBLIC_SITE_URL + service-role key already present)
```

**Structure Decision**: Next.js App Router + existing Supabase backend. The Admin Management
page lives at `/admin/admins` so it inherits the existing proxy protection
(`/admin/dashboard/:path*`) and the dashboard sidebar shell, with an explicit `loading.tsx`.
Read paths use the cookie-bound server client (RLS-bounded); mutation paths (create, resend,
remove) live in Server Actions that call `assertAdminSession` and only then use the
service-role Admin API (`lib/supabase/admin.ts`) — so the service key never reaches
request-rendered output or the client, and every privileged action is double-gated (proxy +
in-action assertion). The new-admin onboarding reuses the 003 confirm + set-password flow,
generalized for `type=invite`. Pure validators stay in `lib/auth/` for deterministic testing.

## Implementation Phases

### Phase 1 — Admin Management page: navigation & list

Delivers the surface and the read: the **Admin Management** sidebar entry and the page that
lists all administrators (name, email, role, status, created date), marking the current
admin's own row, with defined **loading** (`loading.tsx`) / empty / error states and a mobile
card-transform. Adds migration `0004` (so `status` and names exist to display) and generalizes
`DashboardShell` to take nav items. Implements spec **User Story 1 (P1)**. Independently
testable without add/remove: assert the list renders existing admins and excludes
non-administrators.

#### User Story 1.1: As an administrator, I want an Admin Management page that lists every administrator, so that I can see who has access at a glance.

- Description: Add migration `0004` (ALTER `admin_profiles` add `first_name`, `last_name`,
  `status` default `'pending'` CHECK in (`'pending'`,`'active'`), backfill existing rows to
  `'active'`; widen the audit `reason` CHECK). Add `app/admin/admins/page.tsx` reading
  `admin_profiles` via the cookie-bound server client, rendering `components/AdminTable.tsx`
  (columns name/email/role/status/created; current-user marker by comparing the session user
  id) plus `app/admin/admins/loading.tsx`. Generalize `DashboardShell` to accept
  `navItems[]` + `activeHref`; the admin dashboard page and the admins page pass
  `[Dashboard, Admin Management]` (a **new** nav entry — there is no "Users & Roles" tab in this
  codebase, FR-001). Add the C8 list strings. Update `scripts/seed-admin.ts` to set
  `status='active'`.

#### Acceptance Criteria (for the phase)

- [ ] The admin sidebar shows a **new** **Admin Management** entry that routes to `/admin/admins` (FR-001).
- [ ] The page lists every `admin_profiles` row with name, email, role, status, and created date (FR-002).
- [ ] The row for the currently signed-in administrator is visibly marked (FR-003).
- [ ] The list is read through the cookie-bound server client and returns **only** administrators — no student/non-admin appears (FR-004, SC-007).
- [ ] Visiting `/admin/admins` without a valid admin session redirects to `/admin` (existing proxy matcher, FR-017).
- [ ] The table renders with no horizontal scroll at 320/390/430/768/desktop (card-transform on narrow), with a defined `loading.tsx` and empty state (FR-019, SC-008).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** several seeded administrators, **When** the Admin Management page renders, **Then** each appears as a row with name, email, role, status, and created date (golden path).
2. **Given** the signed-in admin, **When** the list renders, **Then** exactly their own row carries the current-user marker.
3. **Given** seeded students exist, **When** the list is read via the cookie-bound client, **Then** zero student rows appear (RLS-backed separation, SC-007).
4. **Given** no admin session, **When** `/admin/admins` is requested directly, **Then** the request redirects to `/admin` (route protection).
5. **Given** the page at 320px, **When** rendered, **Then** the table adopts the card layout with no horizontal scroll or clipped controls. *(manual, walkthrough)*

---

### Phase 2 — Add & re-invite administrators: invite, magic-link onboarding & delivery feedback

Delivers provisioning: the **Add Admin** button → **Create New Admin** modal, the gated
`createAdmin` Server Action (validate → reject duplicate → Admin-API invite with role claim →
insert `pending` profile → audit → **report invite-dispatch failure**), the new admin's
magic-link onboarding (reusing the 003 confirm + set-password flow generalized for
`type=invite`, flipping status to `active`), and the **Resend invite** control for pending
admins. Implements spec **User Story 2 (P1)** and **User Story 3 (P1)** plus **FR-020/FR-021**.
Independently testable with a mocked Admin API / `verifyOtp`.

#### User Story 2.1: As an administrator, I want to add a new admin through a modal, so that I can grant a colleague access without back-office seeding.

- Description: Add `components/AddAdminModal.tsx` (first name, last name, email, role fixed to
  "Admin"; required-field + email validation; submitting/disabled + error/duplicate states;
  Cancel/close without creating) and the **Add Admin** trigger on the page. Add
  `validateNewAdminFields` to `lib/auth/adminManagement.ts`. Add `createAdmin` to
  `app/admin/actions.ts`: `assertAdminSession` → validate → `is_admin_email` duplicate check →
  `inviteUserByEmail` → `updateUserById` (role claim) → insert `admin_profiles`
  (`status='pending'`, names) → `log_admin_auth_event('admin_created')` → if the invite send
  failed, return `{ created:true, inviteFailed:true }` so the creator is told it wasn't
  delivered (FR-021) → `revalidatePath`. Add the C8 modal strings.

#### User Story 2.2: As an administrator, I want to re-send an invite to a pending admin and be told when an invite failed to send, so that nobody is left with an unusable account.

- Description: Add `components/ResendInviteButton.tsx` and surface it on `AdminTable` rows whose
  status is `pending` only. Add `resendInvite` to `app/admin/actions.ts`: `assertAdminSession`
  → confirm the target is a `pending` admin → `inviteUserByEmail` again (fresh single-use link,
  invalidating the prior one) → `log_admin_auth_event('admin_reinvited')` → return sent/failed
  state. The create modal surfaces the `inviteFailed` outcome from US2.1 with a pointer to
  re-send. Implements **FR-020/FR-021**.

#### User Story 3.1: As a newly invited administrator, I want to set my own password from the emailed magic link and then sign in, so that I can access the admin panel.

- Description: Generalize `app/admin/auth/confirm/page.tsx` to treat `type === 'invite'` as a
  valid link and the confirm Server Action to `verifyOtp({ type })` for both `invite` and
  `recovery`; reuse `/admin/reset-password` + `ResetPasswordForm` to set the password; extend
  `updateAdminPassword` to set `admin_profiles.status='active'` for the current user on success.
  Configure the Supabase **Invite user** email template + ensure `/admin/auth/confirm` is
  allow-listed.

#### Acceptance Criteria (for the phase)

- [ ] Clicking **Add Admin** opens a **Create New Admin** modal with first name, last name, email, and role (fixed to "Admin") (FR-006).
- [ ] Submitting with a missing name or invalid email is blocked with a clear message and creates no account (FR-007, SC-003).
- [ ] Submitting an email that already belongs to an administrator is rejected ("already in use"); no duplicate user or profile is created (FR-008, SC-003).
- [ ] A valid submission, after `assertAdminSession`, creates an auth user with `app_metadata.role='admin'`, inserts a `pending` `admin_profiles` row, sends the invite magic link, and the new admin appears in the list (FR-009, US2).
- [ ] When the invite email cannot be dispatched, the creator is told it was not sent and the pending admin exposes a **Resend invite** control (FR-021).
- [ ] A **Resend invite** action on a pending admin issues a fresh single-use link (invalidating the prior one) and is **not** offered for active admins (FR-020).
- [ ] Cancelling or closing the modal creates nothing (FR-012).
- [ ] Following a valid invite link lands on the set-password page; setting a policy-valid password makes the account `active` and able to sign in; an expired/used link cannot set a password and shows the invalid-link state (FR-010, FR-011, SC-004).
- [ ] An unauthenticated or non-admin caller of `createAdmin`/`resendInvite` is denied before any Admin-API call; the service-role key never appears in client/request-rendered output (FR-017).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** the page, **When** **Add Admin** is clicked, **Then** the **Create New Admin** modal opens with the four fields and role fixed to "Admin" (golden path).
2. **Given** the modal, **When** a valid first/last name and unused email are submitted, **Then** `inviteUserByEmail` is called, a `pending` profile is inserted, an `admin_created` audit row is written, and the new admin appears in the list.
3. **Given** the modal, **When** an email already belonging to an admin is submitted, **Then** `is_admin_email` returns true, no invite/insert happens, and the duplicate message is shown (SC-003).
4. **Given** a create where the invite send returns an error, **When** it completes, **Then** the profile is still `pending` and the creator sees the invite-not-sent message (FR-021).
5. **Given** a `pending` admin, **When** **Resend invite** is triggered, **Then** `inviteUserByEmail` is called again and an `admin_reinvited` audit row is written; **Given** an `active` admin, **Then** the resend control is absent (FR-020).
6. **Given** a valid invite `token_hash` with `type=invite`, **When** the confirm action runs, **Then** `verifyOtp({type:'invite'})` succeeds and routes to `/admin/reset-password`; **When** the password is set, **Then** `updateUser` is called and `admin_profiles.status` becomes `active` (SC-004).
7. **Given** `createAdmin`/`resendInvite` invoked without a valid admin session, **When** it runs, **Then** it returns the denial state before any Admin-API call (FR-017).

---

### Phase 3 — Remove administrator

Delivers lifecycle removal: a per-row **Remove** control with explicit confirmation and the
gated `removeAdmin` Server Action that deletes the auth user (cascading the profile), blocking
self-removal and any removal that would leave **zero active** administrators. Implements spec
**User Story 4 (P2)**. Independently testable with a mocked Admin API.

#### User Story 4.1: As an administrator, I want to remove another admin with a confirmation step, so that I can revoke access safely.

- Description: Add a per-row **Remove** control in `AdminTable` and
  `components/RemoveAdminDialog.tsx` (confirm prompt; submitting/error states; Cancel does
  nothing). Add `removeAdmin` to `app/admin/actions.ts`: `assertAdminSession` → resolve caller
  id → reject if target == caller (self-guard) → **count `status='active'` admins**, and if the
  target is the only active admin (active count ≤ 1) reject (last-active-admin guard) →
  `createAdminClient().auth.admin.deleteUser(targetId)` (cascades `admin_profiles`) →
  `log_admin_auth_event('admin_removed')` → `revalidatePath`. Add the C8 remove strings.

#### Acceptance Criteria (for the phase)

- [ ] Each non-self row exposes a **Remove** control that requires explicit confirmation before acting (FR-013).
- [ ] Confirming removal deletes the auth user and its `admin_profiles` row; the admin disappears from the list and can no longer sign in (FR-014, SC-006).
- [ ] Cancelling the confirmation removes nothing (FR-013).
- [ ] Attempting to remove one's own account is blocked server-side with a clear message (FR-015, SC-005).
- [ ] Attempting to remove the last remaining **active** administrator is blocked server-side; a pending admin does not count toward the minimum (FR-016, SC-005).
- [ ] `removeAdmin` denies an unauthenticated/non-admin caller before any Admin-API call (FR-017).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** ≥2 active admins, **When** an admin confirms removal of another, **Then** `deleteUser(targetId)` is called, an `admin_removed` audit row is written, and the row leaves the list (golden path).
2. **Given** a removed admin, **When** they attempt to sign in, **Then** authentication is denied (no auth user, SC-006).
3. **Given** the confirm dialog, **When** the admin cancels, **Then** `deleteUser` is not called.
4. **Given** an admin, **When** they attempt to remove their own row, **Then** the action is rejected before any Admin-API call with the self-removal message (SC-005).
5. **Given** exactly one **active** administrator (optionally plus a pending one), **When** removal of that last active admin is attempted, **Then** the last-active-admin guard rejects it before any Admin-API call (SC-005, FR-016).
6. **Given** `removeAdmin` invoked without a valid admin session, **When** it runs, **Then** it returns the denial state before any Admin-API call (FR-017).

## Complexity Tracking

> One justified expansion: the service-role Admin API is now reached from request-time Server
> Actions (gated by `assertAdminSession`). The constitution requires backend additions to be
> justified with the rejected simpler alternative recorded.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| Use the service-role Admin API (`createAdminClient`) inside admin-gated Server Actions (`createAdmin`, `resendInvite`, `removeAdmin`) — previously seed-only | Creating an auth user with a server-set `role` claim + sending/re-sending an invite link, and deleting an auth user, are only possible through the Supabase Admin API (GoTrue invariants) — exactly why 002's seed uses it. The list and duplicate-check stay on the anon/RLS path; only create/resend/remove need the privileged client. | A pure SQL `SECURITY DEFINER` RPC cannot create or delete `auth.users` safely (bypasses GoTrue). A soft-delete-only model (flag `admin_profiles`) leaves a still-signable orphaned auth user unless the role claim is also revoked — which *also* needs the Admin API — so it is more code for a weaker guarantee. Risk is contained by calling `assertAdminSession` before any privileged call and keeping the key server-only (no `NEXT_PUBLIC_` prefix, never imported into client code). |
