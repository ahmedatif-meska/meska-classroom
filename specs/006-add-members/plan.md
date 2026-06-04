# Implementation Plan: Add Members

**Branch**: `006-add-members` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/006-add-members/spec.md`

## Summary

Add a **Members** tab to the admin panel that lets administrators provision **students** —
single (form) or in **bulk** (CSV) — assign them to a **wave**, generate a per-member **QR
code**, and send each an **onboarding email** with a single-use link to set a password; the
member then signs in to the **student panel with their email + password**. This is the
platform's **first student-authentication feature**, and it deliberately reuses the existing
002/004 stack rather than inventing new primitives:

- **A member is an `auth.users` user + a `public.students` row.** Creation runs the same
  proven path as `createAdmin` (004): after `assertAdminSession`, the **service-role Admin
  API** `inviteUserByEmail` creates the auth user and dispatches the managed single-use invite,
  the immutable claims `app_metadata = { role: 'student', tenant_id: <waveId> }` are set, and a
  `pending` `students` row is inserted. The member sets their own password via the emailed link.
- **A "wave" is a `public.tenants` row** — the isolation boundary that 0001/0002 already built
  ("wired up by the future student-auth feature"). Two waves, **Offline** and **Online**, are
  seeded. Wave isolation is enforced by the **existing** `students` RLS
  (`is_admin() OR tenant_id = jwt_tenant_id()`) and the `jwt_tenant_id()` claim this feature
  finally activates — **no new RLS machinery**.
- **Login is email + password.** The student sign-in page (today a placeholder posting straight
  to the dashboard) becomes a real `signInWithPassword` form; the onboarding/set-password flow
  mirrors 003/004 but lands under `/student` (`/student/auth/confirm` → `/student/set-password`).
- **The QR encodes the admin-only member-info URL** `${SITE_URL}/admin/members/<id>`, rendered
  as an inline SVG via a new `qrcode` dependency (no external image service). Scanning it opens
  the member-information page, which is gated to admins by the proxy.

This feature carries **three** items in Complexity Tracking: (1) **service-role Admin API**
usage for member provisioning (reuse of the 004 pattern, now for the student population), (2)
**one new dependency `qrcode`** for local QR rendering, and (3) the **first student auth
sessions** + student-route protection. The only schema change is migration `0006_add_members.sql`
(evolve `students`; seed the two waves; widen the audit CHECK). Full Phase 0/1 detail lives in
[research.md](./research.md), [data-model.md](./data-model.md),
[contracts/add-members-contracts.md](./contracts/add-members-contracts.md), and
[quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.2.4 (React Compiler enabled),
Next.js 16.2.6 (App Router).

**Primary Dependencies**: Next.js, React, Tailwind v4, `@supabase/supabase-js`, `@supabase/ssr`
(all installed) **plus one new dependency `qrcode`** (+ `@types/qrcode`) for server-side QR-SVG
rendering (Complexity Tracking). CSV parsing is **dependency-free** (a tested parser in
`lib/members/csv.ts`).

**Storage**: Supabase Cloud (Postgres + Auth) — reused. Schema delta: migration
`0006_add_members.sql` — evolve `public.students` (`user_id` FK `auth.users`, `email`,
`whatsapp`, `status`, `lower(email)` unique index), seed two `tenants` rows (**Offline**,
**Online**), and widen the `admin_auth_events` reason CHECK with `member_created` /
`member_reinvited`. **No** Supabase Storage bucket is added (QR is rendered inline, not stored).
Member `auth.users` rows are created via the service-role Admin API.

**Testing**: Vitest + React Testing Library (jsdom) with a mocked Supabase client (cookie/RLS
**and** service-role Admin API) for pure helpers, the CSV parser/validators, Server Actions, and
components — same tiers as 002/003/004/005.

**Target Platform**: Web — latest two major Chrome/Edge/Firefox/Safari (desktop) + iOS Safari
and Chrome on Android (latest two); mobile-first from 320px.

**Project Type**: Web application (Next.js App Router) + Supabase backend (existing).

**Performance Goals**: Each admin action (list read, single create, bulk create, resend) and
each student action (sign-in, confirm, set-password) is a single Server Action / RSC round-trip;
meet the mobile CWV budget **LCP < 2.5s, CLS < 0.1, INP < 200ms** on a mid-tier Android over
Slow-4G. The members list and member-info page are server-rendered with explicit `loading.tsx`;
only the add-members modal, the student login/set-password forms, and the resend control ship
client JS. The QR is an **inline SVG** (no network round-trip, dimension-reserved → protects
CLS). The members read is bounded (`created_at desc`, capped/paginatable — R10). Bulk creation
loops per row server-side (tens of members; bounded).

**Constraints**: Server-side enforcement of the admin gate on **every** admin action and of the
student gate on every student route (never client-only); CSV validation runs **server-side** as
the trust boundary (FR-012); the service-role Admin API is reached **only after**
`assertAdminSession` passes; member email is matched case-insensitively + trimmed (FR-025); the
member-info page is **admin-only** (FR-024); WCAG 2.1 AA; English-only LTR; brand only via
tokens; all UI copy via `lib/strings.ts`; mobile inputs ≥16px.

**Scale/Scope**: Tens–hundreds of members (full list shown; bounded read, pagination deferred).
~7 Server Actions (`createMember`, `bulkCreateMembers`, `resendMemberInvite`; `signInStudent`,
`confirmStudentInvite`, `setStudentPassword`, `signOutStudent`); 2 admin pages (`members` list +
`members/[id]` info) + `loading.tsx`; 3 student pages (sign-in rework, `auth/confirm`,
`set-password`) + student dashboard QR; ~6 components; 5 `lib/members/*` + `lib/auth/studentGate`
modules; 1 migration; 1 static CSV template; a fourth `navItems` entry; proxy refactor (admin +
student matchers); ~40 new strings; one dependency (`qrcode`).

## Constitution Check

*GATE: evaluated against constitution v2.1.0. Must pass before Phase 0 and re-checked after
Phase 1.*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, build+lint clean, App Router + `@/*`, shared logic in `lib/`, no manual memo, tolerate long/AI text | **PASS** — pure validators in `lib/members/validation.ts`, the CSV parser in `lib/members/csv.ts`, QR helper in `lib/members/qr.ts`, the shared creation helper in `lib/members/create.ts`, student gate in `lib/auth/studentGate.ts`, copy in `lib/strings.ts`; Supabase via existing `lib/supabase/*`; no hand memoization; name/email/whatsapp cells truncate and tolerate any length. |
| II — Testing (NON-NEGOTIABLE) | Guaranteed behavior covered by deterministic isolated tests; **cross-wave denial tested for every wave-scoped path** | **PASS** — pure field + password + CSV-row validators; the CSV parser (quoted fields, blank/whitespace rejection); the create/bulk/resend Server Actions (admin-gate denial, dup-email reject, invite/insert, per-row failure); student sign-in/confirm/set-password (student gate, not-admin on member-info); components. The **cross-wave denial** case is tested at the RLS/session boundary: a member session scoped to wave A cannot read wave B's `students`, and a member is denied the admin-only member-info page (C-tests). |
| III — UX Consistency | Brand tokens, consistent loading/empty/**error** states, context-aware logo, English/LTR | **PASS** — reuses 004 modal/table/token patterns and `role="alert"`; defines list **loading** (`loading.tsx`) / empty / error, add-form idle/submitting/field-error/invite-not-sent/success states, bulk upload/validation-error/wave-confirm states, and student login/set-password states; the student-panel logo stays student-context (never crosses to admin); all copy centralized. |
| IV — Mobile-First / Responsive / A11y | Usable 320→desktop, touch targets, visible focus, WCAG AA, inputs ≥16px mobile, data-heavy view has a documented mobile strategy | **PASS** — the members list adopts a **card transform `< sm`** (R6-ui), the add-members modal **scrolls internally** and traps focus, the bulk wave-confirm is a labelled step; the QR SVG is dimension-reserved; inputs ≥16px; validated 320/390/430/768/desktop in the walkthrough. |
| V — Performance | RSC-first, bounded reads, lazy media, CWV budget stated | **PASS** — server-rendered list + member-info + `loading.tsx`, small client islands, single round-trips; the QR is an inline SVG (no extra request, no CLS); bounded `created_at desc` read; bulk loop is server-side and bounded; budget stated above. |
| VI — Wave Isolation & Tenant Boundaries (NON-NEGOTIABLE) | Tenant-scoped reads server-side; admin capabilities role-gated server-side; cross-wave denial tested | **PASS** — a wave **is** a `tenants` row; every member carries `app_metadata.tenant_id`, so the **existing** `students` RLS (`is_admin() OR tenant_id = jwt_tenant_id()`) bounds a member to their own wave with **no new policy**. Admin capabilities (list, create, bulk, resend, member-info) call `assertAdminSession` and/or rely on `is_admin()` RLS before any read/write; the service-role Admin API runs only after the gate. The member-info page is admin-only (proxy `/admin/members/:path*`). The required **denial case** is tested: (a) a member session cannot read another wave's students, and (b) a member is redirected away from `/admin/members/<id>`. |
| VII — Artifact Structure (NON-NEGOTIABLE) | plan = Phase → Story → Acceptance Criteria → Test Scenarios; walkthrough per phase | **PASS** — see Implementation Phases; each phase ships a `walkthrough.md` section. |

**Data-security bootstrapping (Principle VI scope clause)**: this is the first feature handling
student PII (email, WhatsApp) and the first to issue student sessions, so the plan states the
controls now: **PII** (full name, email, WhatsApp) is stored in `students` under RLS, never
exposed to anon, and the member-info page is admin-only; **in transit** everything is HTTPS
(Supabase + the app); **at rest** Supabase-managed encryption; **auth/session** uses Supabase
Auth (httpOnly cookies, JWT claims), passwords never stored by the app, single-use time-limited
invite tokens owned by Supabase Auth; **retention** — member rows persist for the cohort
lifetime (member removal is out of scope this feature); **audit** — member provisioning is
recorded in `admin_auth_events` (`member_created` / `member_reinvited`). See research R12.

**Tech-constraint check**: no state library or component framework added. **Three** additions
are recorded in Complexity Tracking: (1) service-role Admin API for member provisioning, (2) the
`qrcode` dependency, (3) student auth sessions + student-route protection. Each is justified with
the rejected simpler alternative.

**Result**: PASS (three justified additions, tracked). No NEEDS CLARIFICATION remain after
Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/006-add-members/
├── plan.md                                  # This file
├── research.md                              # Phase 0 — decisions R1–R12
├── data-model.md                            # Phase 1 — migration 0006: students evolution + waves seed + audit
├── quickstart.md                            # Phase 1 — apply migration, seed waves, email template, run, verify
├── contracts/
│   └── add-members-contracts.md             # Phase 1 — actions, helpers, pages/components, proxy, config, copy, tests
├── checklists/
│   └── requirements.md                      # spec quality checklist (from /speckit-specify)
├── spec.md
├── tasks.md                                 # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md                           # per implemented phase (/speckit-implement, Principle VII)
```

### Source Code (repository root)

```text
app/
├── admin/
│   └── members/
│       ├── page.tsx                 # NEW: Members list page (RSC, in DashboardShell)
│       ├── loading.tsx              # NEW: list loading state
│       ├── actions.ts               # NEW: createMember + bulkCreateMembers + resendMemberInvite (gated)
│       └── [id]/
│           └── page.tsx             # NEW: admin-only member-information page (QR scan target)
└── student/
    ├── page.tsx                     # MODIFY: real email+password sign-in (replaces placeholder join)
    ├── actions.ts                   # NEW: signInStudent + confirmStudentInvite + setStudentPassword + signOutStudent
    ├── dashboard/page.tsx           # MODIFY: render the member's QR + sign-out footer
    ├── auth/
    │   └── confirm/page.tsx         # NEW: invite/recovery interstitial (mirrors /admin/auth/confirm)
    └── set-password/page.tsx        # NEW: set-password page (mirrors /admin/reset-password)

components/
├── MemberTable.tsx                  # NEW: list table / mobile card-transform (full name, whatsapp, email, wave, status)
├── AddMembersModal.tsx              # NEW: client island — chooser (form | bulk) + single form + bulk upload + wave-confirm
├── MemberQrCode.tsx                 # NEW: renders the inline QR SVG for a member-info URL
├── DownloadTemplateButton.tsx       # NEW: links to the static CSV template
├── StudentLoginForm.tsx             # NEW: client island — email+password (mirrors AdminLoginForm)
└── StudentSetPasswordForm.tsx       # NEW: client island — set password (mirrors ResetPasswordForm)

lib/
├── members/
│   ├── validation.ts                # NEW: validateMemberFields + email/whatsapp/wave checks (pure)
│   ├── csv.ts                        # NEW: parseAndValidateMembersCsv (pure, dependency-free, tested)
│   ├── qr.ts                         # NEW: memberInfoUrl(id) + renderQrSvg(url) (uses qrcode)
│   └── create.ts                     # NEW: provisionMember(...) shared server helper (invite + claims + insert)
├── auth/
│   └── studentGate.ts                # NEW: assertStudentSession + validateStudentLoginFields (pure)
├── adminNav.tsx                      # MODIFY: append the Members nav item
├── supabase/{server,admin}.ts        # REUSE: cookie/RLS client (reads + row writes) + service-role (auth user create)
└── strings.ts                        # MODIFY: add Members + student-auth copy

public/
└── members-template.csv             # NEW: downloadable bulk template (full name, whatsapp number, email)

supabase/migrations/
└── 0006_add_members.sql             # NEW: students columns + lower(email) unique; seed Offline/Online tenants; widen audit CHECK

proxy.ts                             # MODIFY: branch admin vs student; add "/admin/members/:path*" + "/student/dashboard/:path*"
package.json                         # MODIFY: add qrcode + @types/qrcode

tests/
├── lib/members/validation.test.ts            # NEW: required/blank/email/wave validators (pure)
├── lib/members/csv.test.ts                    # NEW: quoted fields, blank/whitespace rejection, dup detection (pure)
├── lib/members/qr.test.ts                     # NEW: memberInfoUrl shape + SVG render
├── lib/auth/studentGate.test.ts               # NEW: student session accepted, admin/anon handled
├── app/admin/members/createMember.test.ts     # NEW: gate + dup-email + invite + claims + insert (mocked)
├── app/admin/members/bulkCreateMembers.test.ts# NEW: gate + whole-file reject on blank + per-row create (mocked)
├── app/admin/members/resendMemberInvite.test.ts# NEW: gate + pending-only + fresh link (mocked)
├── app/admin/members/membersPage.test.tsx     # NEW: rows render fields/wave/status; empty state
├── app/admin/members/memberInfoPage.test.tsx  # NEW: admin sees member; non-admin denied (cross-wave/role denial)
├── app/student/signInStudent.test.ts          # NEW: student accepted; admin/bad-creds denied
├── app/student/setStudentPassword.test.ts      # NEW: valid session sets pw + status active; invalid rejected
└── components/AddMembersModal.test.tsx         # NEW: chooser; required fields; bulk blank-cell rejected; cancel discards
```

**Structure Decision**: Next.js App Router + existing Supabase backend. Admin surfaces live
under `/admin/members` (list) and `/admin/members/[id]` (info), inheriting proxy protection (one
new matcher) and the dashboard shell. Member-facing surfaces live under `/student`
(`page.tsx` sign-in, `auth/confirm`, `set-password`, `dashboard`), protected by a **new student
branch** in the proxy. Reads use the cookie-bound RLS client; member-provisioning mutations live
in gated Server Actions that call `assertAdminSession` then use the **service-role Admin API**
to create the auth user + dispatch the invite (the only privileged path, after the gate), then
insert the `students` row via the same admin client. Pure validators, CSV parsing, and QR
rendering live in `lib/members/` for deterministic testing. A "wave" is a `tenants` row, so wave
isolation reuses the existing `students`/`jwt_tenant_id()` RLS with no new policy.

## Implementation Phases

### Phase 1 — Members page: navigation, list, template & schema foundation

Delivers the surface and the read, and lands the schema the later phases need. Adds the
**Members** sidebar entry and `/admin/members`, which lists every member (full name, WhatsApp,
email, wave, status) with defined **loading** (`loading.tsx`) / empty / error states and a **card
transform below `sm`**, plus a **Download CSV template** affordance. Lands migration `0006`
(evolve `students`; seed the **Offline**/**Online** waves; widen the audit CHECK), the static
template, the proxy matcher `/admin/members/:path*`, and the `Members` nav item. Implements spec
**User Story 1 (P1)**. Independently testable: seed a member row and assert the list renders it
(and that an unauthenticated caller is redirected).

#### User Story 1.1: As an administrator, I want a Members page that lists every member with an Add Members action and a downloadable template, so that I can see and manage the roster.

- Description: Add migration `0006_add_members.sql` (alter `students`: `user_id`, `email`,
  `whatsapp`, `status default 'pending'`, `lower(email)` unique index; seed two `tenants`
  **Offline**/**Online**; widen `admin_auth_events` reason CHECK). Add `public/members-template.csv`.
  Add `app/admin/members/page.tsx` reading `students` joined to its wave name via the cookie/RLS
  client ordered by `created_at desc`, rendering `components/MemberTable.tsx` (card transform
  `< sm`) with the **Add Members** action top-right and `components/DownloadTemplateButton.tsx`,
  plus `app/admin/members/loading.tsx`. Append the Members `NavItem` in `lib/adminNav.tsx`. Add
  the proxy matcher `/admin/members/:path*`. Add the C-list strings.

#### Acceptance Criteria (for the phase)

- [ ] The admin sidebar shows a **Members** entry that routes to `/admin/members` (FR-001).
- [ ] The page lists every member with full name, WhatsApp mobile, email, assigned wave, and status (FR-002).
- [ ] An **Add Members** action is present at the top-right and a **Download CSV template** affordance downloads a CSV whose columns are exactly full name, WhatsApp number, email (FR-003, FR-004, SC-010).
- [ ] The list is read through the cookie/RLS client gated by `is_admin()`; visiting `/admin/members` without an admin session redirects to `/admin` (FR-028).
- [ ] The list renders with no page-level horizontal scroll at 320/390/430/768/desktop — card transform below `sm` — with defined `loading.tsx` and empty states (FR-030, SC-009).
- [ ] Migration `0006` applies cleanly; the **Offline** and **Online** waves exist; `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** several seeded members across both waves, **When** the Members page renders, **Then** each appears with full name, WhatsApp, email, wave name, and status (golden path).
2. **Given** no members, **When** the page renders, **Then** the empty state is shown and the Add Members + template affordances remain available (FR-030).
3. **Given** no admin session, **When** `/admin/members` is requested directly, **Then** the request redirects to `/admin` (route protection, FR-028).
4. **Given** the template affordance, **When** it is used, **Then** a CSV downloads with exactly the columns full name, WhatsApp number, email (SC-010).
5. **Given** the page at 320px, **When** rendered, **Then** the list adopts the card layout with no horizontal page scroll or clipped controls. *(manual, walkthrough)*

---

### Phase 2 — Add a single member: form, QR identity & onboarding email

Delivers single creation: **Add Members → Add by form**, the `AddMembersModal` (chooser + single
form with the wave dropdown reading the seeded waves), the pure validators
(`lib/members/validation.ts`), the QR/member-info URL helper (`lib/members/qr.ts`), the shared
`provisionMember` helper (`lib/members/create.ts`), and the gated `createMember` +
`resendMemberInvite` Server Actions (validate → reject dup email → `inviteUserByEmail` via
service-role with `redirectTo=/student/auth/confirm` → set `{role:'student', tenant_id}` claims →
insert `pending` `students` row → audit `member_created`). Implements spec **User Story 2 (P1)**.
Independently testable with a mocked Supabase + Admin client.

#### User Story 2.1: As an administrator, I want to add a member through a form (name, WhatsApp, email, wave), so that they are created, assigned to a wave, and emailed an onboarding link.

- Description: Add `components/AddMembersModal.tsx` (the **Add Members** trigger; a chooser
  between **Add by form** and **Bulk upload**; the single form: full name, WhatsApp mobile, email,
  and a **wave** `<select>` populated from the seeded waves; submitting/field-error/invite-not-sent/
  success states; Cancel/close discards — FR-006/FR-008). Add `lib/members/validation.ts`
  (`validateMemberFields` — all four required, trimmed, non-blank, valid email) and
  `lib/members/qr.ts` (`memberInfoUrl(id)`). Add `lib/members/create.ts` (`provisionMember`):
  `inviteUserByEmail` (service-role) with `redirectTo` + `data:{full_name, whatsapp}` →
  `updateUserById` claims `{role:'student', tenant_id:waveId}` → insert `students`
  (`user_id`, `email`, `whatsapp`, `full_name`, `tenant_id`, `student_code:=email`,
  `status:'pending'`). Add `app/admin/members/actions.ts` `createMember`: `assertAdminSession` →
  `validateMemberFields` → reject existing email (cookie/RLS `students` lookup, FR-009) →
  `provisionMember` → audit `member_created` → `revalidatePath('/admin/members')`; and
  `resendMemberInvite` (pending-only `resetPasswordForEmail`, FR-026). Add the C-form strings.

#### Acceptance Criteria (for the phase)

- [ ] **Add Members** opens a chooser; **Add by form** opens a form with full name, WhatsApp mobile, email, and a wave dropdown offering **Offline** and **Online** (FR-005, FR-006, FR-007).
- [ ] Submitting with any empty/whitespace-only field or a malformed email is blocked with a clear message; no member is created (FR-008, SC-003).
- [ ] Submitting an email that already belongs to a member is rejected as in-use; no duplicate is created (FR-009, SC-003).
- [ ] A valid submission, after `assertAdminSession`, creates the auth user, sets `{role:'student', tenant_id:<wave>}`, inserts a `pending` `students` row in the selected wave, and the member appears in the list (FR-010).
- [ ] On a successful create, an onboarding email with a single-use set-password link is dispatched; if dispatch fails the member stays `pending` and the admin is told to re-send (FR-017, FR-027).
- [ ] A still-pending member can be re-invited (fresh single-use link, prior link invalidated); the control is offered only for pending members (FR-026).
- [ ] An unauthenticated/non-admin caller of `createMember`/`resendMemberInvite` is denied before any Admin-API call; the service-role key never reaches client/request-rendered output (FR-028).
- [ ] Cancelling/closing the form creates nothing; `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** the chooser, **When** **Add by form** is picked and a valid name/WhatsApp/email/wave submitted, **Then** the auth user is invited, claims are set, a `pending` row is inserted in that wave, and the member appears (golden path).
2. **Given** the form, **When** any field is blank or the email is malformed, **Then** submission is blocked and nothing is created (SC-003).
3. **Given** an email already used by a member, **When** submitted, **Then** it is rejected as in-use with no duplicate (SC-003).
4. **Given** a successful create whose invite email fails to dispatch, **When** it completes, **Then** the member is `pending` and the invite-not-sent warning + resend affordance are shown (FR-027).
5. **Given** a pending member, **When** resend is triggered, **Then** a fresh single-use link is issued and audited `member_reinvited`; an active member is not offered resend (FR-026).
6. **Given** `createMember` invoked without an admin session, **When** it runs, **Then** it returns the denial state before any Admin-API call (FR-028).

---

### Phase 3 — Member onboarding & student login (email + password)

Delivers the auth loop: the student sign-in page becomes a real **email + password** form; the
onboarding link lands on `/student/auth/confirm` → `/student/set-password`; and student routes
are protected. Implements spec **User Story 3 (P1)**. Independently testable with a mocked client.

#### User Story 3.1: As a member, I want to set a password via my onboarding link and sign in to the student panel with my email, so that I can access my account.

- Description: Rework `app/student/page.tsx` to render `components/StudentLoginForm.tsx`
  (email + password, ≥16px inputs). Add `app/student/actions.ts`: `signInStudent`
  (`signInWithPassword` → assert the session is a **student** (role≠'admin') → redirect
  `/student/dashboard`); `confirmStudentInvite` (mirrors `confirmPasswordReset`: `verifyOtp`
  invite/recovery on explicit click → assert **not** admin → redirect `/student/set-password`);
  `setStudentPassword` (valid student/recovery session → `validateNewPassword` →
  `updateUser({password})` → set `students.status='active'` → sign in/redirect); `signOutStudent`.
  Add `app/student/auth/confirm/page.tsx` (interstitial) and `app/student/set-password/page.tsx`
  (`components/StudentSetPasswordForm.tsx`). Add `lib/auth/studentGate.ts`
  (`assertStudentSession`, `validateStudentLoginFields`). Refactor `proxy.ts` to branch: admin
  matchers require `role==='admin'` (→ `/admin`), student matchers (`/student/dashboard/:path*`)
  require an authenticated student (→ `/student`). Add the C-student-auth strings; document the
  Supabase **Invite** email-template customization (state login ID = email, FR-017) in quickstart.

#### Acceptance Criteria (for the phase)

- [ ] The student sign-in page collects **email + password** and signs the member in with `signInWithPassword`; valid member credentials reach `/student/dashboard` (FR-021, SC-006).
- [ ] A member who has not set a password cannot sign in until they do (FR-020).
- [ ] Following a valid onboarding link lands on the set-password page; submitting a policy-compliant password sets it, marks the member `active`, and enables sign-in (FR-018, SC-006).
- [ ] An expired/used link cannot set a password and shows a clear message with a path to a new invitation (FR-019).
- [ ] The onboarding email states the member's login ID is their email (FR-017) *(email-template config, verified in walkthrough)*.
- [ ] `/student/dashboard` requires an authenticated student session; an admin token is not treated as a student and the member-info page stays admin-only (FR-024, FR-028).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** a member who set a password, **When** they sign in with email + password, **Then** they reach `/student/dashboard` (golden path).
2. **Given** a pending member (no password), **When** they attempt sign-in, **Then** it is denied (FR-020).
3. **Given** a valid invite link, **When** the member confirms and submits a valid password, **Then** the password is set, `status` becomes `active`, and subsequent sign-in succeeds (SC-006).
4. **Given** an expired/used link, **When** opened, **Then** set-password is refused with the invalid-link state (FR-019).
5. **Given** an unauthenticated visitor, **When** `/student/dashboard` is requested, **Then** they are redirected to `/student` (route protection).
6. **Given** a member session scoped to wave A, **When** it reads `students`, **Then** only wave-A rows are visible and wave-B rows are denied by RLS (**cross-wave denial**, Principle VI).

---

### Phase 4 — QR on the student home + admin member-information page

Delivers the QR payoff: the member sees their QR on the student home, and scanning it opens the
admin-only member-information page. Implements spec **User Story 5 (P2)** and **User Story 6
(P3)**. Independently testable with a mocked client.

#### User Story 4.1: As a member, I want my QR code on my home; and as an administrator, I want scanning it to open that member's information.

- Description: Add `renderQrSvg(url)` to `lib/members/qr.ts` (using `qrcode`) and
  `components/MemberQrCode.tsx`. In `app/student/dashboard/page.tsx`, read the signed-in member's
  own `students` row (`eq('user_id', auth.uid())`) and render their QR (encoding
  `memberInfoUrl(student.id)`), with a placeholder when unavailable (FR-022). Add
  `app/admin/members/[id]/page.tsx` (RSC) reading the member via the cookie/RLS client (admin
  sees all) and rendering full name, WhatsApp, email, wave, status, with a not-found state; it is
  admin-only via the existing `/admin/members/:path*` proxy matcher (FR-023, FR-024). Add the
  C-info strings.

#### Acceptance Criteria (for the phase)

- [ ] A signed-in member sees their own QR code (inline SVG) on the student home; if none, a placeholder is shown (FR-022, SC-008).
- [ ] The QR encodes `${SITE_URL}/admin/members/<their id>` and resolves to **their own** info page, never another member's (FR-022, SC-008).
- [ ] A signed-in admin opening a member's QR link sees that member's full name, WhatsApp, email, wave, and status (FR-023).
- [ ] A viewer without an admin session opening the member-info URL is redirected to authenticate and sees no member PII (FR-024, SC-007).
- [ ] A QR link for a non-existent member shows a not-found state, never another member's data (edge case).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** a signed-in member, **When** the home renders, **Then** their QR SVG is shown encoding their own member-info URL (golden path).
2. **Given** a member with no QR-resolvable row, **When** the home renders, **Then** a placeholder (not a broken image) is shown (FR-022).
3. **Given** an admin, **When** they open a member's QR link, **Then** that member's details render (FR-023).
4. **Given** a member (non-admin) session, **When** it opens `/admin/members/<id>`, **Then** it is redirected to `/admin` and sees no PII (**role denial**, FR-024, SC-007).
5. **Given** an admin, **When** they open `/admin/members/<unknown-id>`, **Then** a not-found state is shown (edge case).

---

### Phase 5 — Bulk upload members via CSV

Delivers bulk import: **Add Members → Bulk upload** (download template → upload → server-side
validate → confirm wave → submit). Reuses `provisionMember` per row. Implements spec **User Story
4 (P2)**. Independently testable with a mocked client.

#### User Story 5.1: As an administrator, I want to bulk-upload members from the template and assign them to a wave, so that I can onboard a cohort at once.

- Description: Add `lib/members/csv.ts` (`parseAndValidateMembersCsv`: parse the fixed 3-column
  template incl. quoted fields; reject the whole file if any required cell is empty/whitespace-only
  or any email malformed; report existing-member + in-file duplicate emails — FR-011/FR-012/FR-015).
  Extend `AddMembersModal` with the **Bulk upload** path: file input, client pre-parse for fast
  feedback, the **wave** confirmation step, and submit. Add `bulkCreateMembers` to
  `app/admin/members/actions.ts`: `assertAdminSession` → re-parse+validate **server-side** (trust
  boundary) → on any hard failure return errors and create nothing → else loop `provisionMember`
  per row into the confirmed wave, collecting per-row invite outcomes → audit → `revalidatePath`.

#### Acceptance Criteria (for the phase)

- [ ] **Bulk upload** accepts a CSV in the template shape (columns: full name, WhatsApp number, email) (FR-011).
- [ ] A file with any empty/whitespace-only required cell or malformed email is rejected **server-side** with a clear message identifying the failing row(s)/field(s); no members are created (FR-012, SC-004).
- [ ] After validation, the admin is shown and confirms the wave (Offline/Online) before creation (FR-013).
- [ ] On submit, every valid uploaded member is created in the confirmed wave, each invited and QR-resolvable (FR-014, FR-016, FR-017, SC-005).
- [ ] Emails duplicating an existing member or another in-file row are reported and not created; the admin is told which rows (FR-015).
- [ ] An unauthenticated/non-admin caller of `bulkCreateMembers` is denied before any Admin-API call (FR-028).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** a valid filled template, **When** uploaded, validated, the wave confirmed, and submitted, **Then** every row becomes a `pending` member in that wave, each invited (golden path, SC-005).
2. **Given** a file with a blank/whitespace-only cell, **When** validated server-side, **Then** the whole upload is rejected with the offending row identified and nothing is created (SC-004).
3. **Given** a file with a malformed email, **When** validated, **Then** it is rejected with no members created (SC-004).
4. **Given** a file containing an in-file duplicate email or an email already used by a member, **When** validated, **Then** those rows are reported and not created (FR-015).
5. **Given** a non-template file (wrong/missing columns), **When** uploaded, **Then** it is rejected with a clear message (edge case).
6. **Given** `bulkCreateMembers` invoked without an admin session, **When** it runs, **Then** it returns the denial state before any creation (FR-028).

## Complexity Tracking

> Three additions beyond the 002/004/005 baseline. The constitution requires backend/dependency
> additions to be justified with the rejected simpler alternative recorded.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Service-role Admin API** for member provisioning (`inviteUserByEmail`, `updateUserById` claims), reached only **after** `assertAdminSession` | Members must be real `auth.users` to sign in with email + password (clarified). Creating an auth user and dispatching the managed single-use invite **requires** the Admin API (the anon/RLS client cannot create users). This is the **same justified pattern 004 established** for admins, now applied to the student population; the privileged client never runs for a non-admin caller. | Self-service student sign-up (rejected: provisioning is admin-driven by the spec; no public sign-up surface). A bespoke credential/token table + custom emails on the anon client (rejected: re-implements single-use, time-limited tokens Supabase Auth already owns securely; 003/004 set the precedent). |
| **One new dependency `qrcode`** (+ `@types/qrcode`) for server-side QR-SVG rendering | The feature requires a real QR per member encoding the member-info URL; encoding QR matrices correctly needs a vetted library. Rendered as an **inline SVG** server-side → no extra network request, no CLS, no third-party exposure. | `api.qrserver.com` image URLs (the user's formula reference) — rejected: an external runtime dependency on every render, sends the member-info URL to a third-party host, adds a remote image host + network round-trip (worse reliability, privacy, CWV). Persisting a base64 data-URL on the row — rejected: bloats the row and list payload (fights the bounded-read/CWV budget). A hand-rolled QR encoder — rejected: error-prone matrix/EC math for a security-adjacent artifact. |
| **First student auth sessions + student-route protection** (proxy refactor to branch admin vs student; `assertStudentSession`; activating the `jwt_tenant_id()` claim) | This is the first feature that issues **student** sessions, so the proxy — previously "any non-admin → /admin" — must distinguish an authenticated **member** (allowed into `/student/dashboard`) from an admin and from anon. The `tenant_id` JWT claim that 0002 built "for the future student-auth feature" is wired up now. | A single role for everyone (rejected: cannot keep the member-info page admin-only). Client-only student route guarding (rejected: must be server-enforced, Principle VI). A separate `waves` table + `jwt_wave_id()` claim + new RLS (rejected: duplicates the tested `tenants`/`jwt_tenant_id()` isolation primitive that already exists for exactly this purpose — see research R2). |
