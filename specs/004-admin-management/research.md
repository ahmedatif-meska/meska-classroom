# Phase 0 Research: Admin Management

All decisions build on the existing `002-admin-auth` (identity, RLS, Supabase clients, audit
RPC) and `003-admin-forgot-password` (magic-link confirm + set-password flow). No NEEDS
CLARIFICATION remained after the spec's confirmed clarification (magic-link onboarding, not a
creator-set password).

---

## R1 — How a new administrator is created

**Decision**: From a gated `createAdmin` Server Action, call the Supabase Admin API
`auth.admin.inviteUserByEmail(email, { redirectTo, data })`, which creates the auth user
**without a password** and sends a single-use magic-link email. Set the immutable role claim
`app_metadata.role='admin'` on the created user (via a follow-up `auth.admin.updateUserById`,
mirroring the seed script). Then insert the application-side `admin_profiles` row with
`status='pending'`.

**Rationale**: `inviteUserByEmail` is the purpose-built primitive for "create account → email
a link to finish setup". It gives us the magic link for free and leaves the account
password-less (matching the confirmed spec flow). The role claim is set the same way the
proven 002 seed sets it.

**Ordering note (F2)**: supabase-js `inviteUserByEmail(email, { data, redirectTo })` accepts
`data` (→ `user_metadata`) and `redirectTo`, but **not** `app_metadata`, so the role claim is
set in an immediately-following `auth.admin.updateUserById(id, { app_metadata: { role:'admin' }})`
within the same Server Action. The window in which the user exists without the role claim is
sub-second and entirely before any email is delivered; even if the link were somehow followed
first, the set-password gate (`assertAdminSession`) would simply reject until the claim is set.
This ordering is therefore safe and intentional — documented here rather than worked around.

**Alternatives considered**: `createUser({ email_confirm:false }) + generateLink('invite')` +
sending the email ourselves — more moving parts and a transactional-email integration we don't
need. A SQL `SECURITY DEFINER` RPC — cannot create `auth.users` without bypassing GoTrue.

---

## R2 — Service-role usage in request code (the one expansion)

**Decision**: Reuse `lib/supabase/admin.ts` (`createAdminClient`, service-role) inside the
`createAdmin` and `removeAdmin` Server Actions, but **only after** `assertAdminSession`
succeeds on the caller's cookie session. Update the file's doc comment to record this new,
gated caller (no longer "seed only"). The list and duplicate check stay on the anon/RLS path.

**Rationale**: Creating/deleting auth users with a server-set role requires the Admin API;
there is no RLS-only path. Gating each privileged action behind the same server-side admin
check used everywhere else keeps the constitution's "admin capabilities role-gated
server-side" guarantee intact. The key stays server-only (no `NEXT_PUBLIC_` prefix; throws if
missing; never imported into client code) and Server Actions never ship to the browser.

**Alternatives considered**: Keep service-role seed-only (impossible for live admin
management). Soft-delete-only (weaker — see R3). Both rejected; recorded in plan Complexity
Tracking.

---

## R3 — How an administrator is removed

**Decision**: `removeAdmin` (gated) calls `auth.admin.deleteUser(targetId)`. The
`admin_profiles` PK is `references auth.users(id) on delete cascade`, so deleting the auth user
removes the profile automatically — the admin disappears from the list **and** can no longer
sign in (no credential, no role claim). Guards run before the delete: reject if `targetId`
equals the caller's id (self-removal), and reject if the administrator count is 1 (last-admin).

**Rationale**: Hard delete via the Admin API is the only path that simultaneously removes the
row and revokes sign-in in one authoritative step, with the FK cascade keeping the two stores
consistent. The spec's observable guarantee ("gone from list, cannot sign in") is met exactly.

**Alternatives considered**: Soft delete (set `admin_profiles.status='removed'`) — leaves a
signable auth user with `role='admin'` unless we also strip the claim via the Admin API, so it
is more work for a weaker guarantee, and would require extending the sign-in gate to re-check
the profile. Deferred unless an audit-retention requirement later mandates it (then re-evaluate).

---

## R4 — How the list is read (no service role)

**Decision**: The `/admin/admins` RSC reads `admin_profiles` through the cookie-bound
server client (`lib/supabase/server.ts`). RLS policy `admin_profiles_select` already restricts
this table to `is_admin()`, so the read is admin-only and structurally excludes students. Order
by `created_at desc`; mark the current row by comparing each row's `id` to
`supabase.auth.getUser().id`.

**Rationale**: Reuses the existing RLS guarantee — no new privileged path, and the
admin/student separation (SC-007) is enforced by the same policy 002 already tests. Keeps the
service-role key out of the read path entirely.

**Alternatives considered**: Service-role list (unnecessary — RLS already permits the admin
read and avoids the privileged client). `auth.admin.listUsers()` (returns auth fields, not the
profile/status we display, and needs service role).

---

## R5 — Status, names, and the schema delta (migration 0004)

**Decision**: Add three columns to `admin_profiles`: `first_name text`, `last_name text`, and
`status text not null default 'pending' check (status in ('pending','active'))`. Backfill
existing rows to `status='active'`. The seed script sets `status='active'` going forward. Widen
the `admin_auth_events` reason CHECK to add `admin_created`, `admin_removed`, and
`admin_reinvited` (R12). No new tables (invite tokens are GoTrue-owned).

- **status** lifecycle: `pending` at invite → `active` when the invited admin sets a password
  (flipped in `updateAdminPassword`). The seed/bootstrap admin is `active`.
- **Name** display: `first_name + last_name` when present, else fall back to `display_name`,
  else the email local-part — so existing rows and edge cases never render blank.
- **created date**: existing `created_at` column (no change).

**Rationale**: A persisted `status` makes "pending vs active" listable without querying the
Auth admin API; storing first/last names matches the modal inputs and the Name column. Widening
the existing audit CHECK reuses the proven `log_admin_auth_event` RPC.

**Alternatives considered**: Deriving status from `auth.users.last_sign_in_at` /
`email_confirmed_at` — fragile and needs the Admin API to read. A separate `admin_invites`
table — unnecessary since GoTrue owns the token; status on the profile is enough.

---

## R6 — Reusing the magic-link onboarding (invite vs recovery)

**Decision**: Generalize the 003 confirm flow to accept `type='invite'` alongside `'recovery'`.
The `inviteUserByEmail` link carries `type=invite`; the confirm page (`/admin/auth/confirm`)
treats either type as a present link, and the confirm Server Action calls
`verifyOtp({ type, token_hash })` with the link's type. On success it routes to the existing
`/admin/reset-password` set-password page (reused verbatim), and `updateAdminPassword`
additionally flips `admin_profiles.status='active'` for the current user.

**Rationale**: The "set your password" UI and the single-use-token integrity handling are
identical for invite and recovery; reusing them avoids a parallel page/flow and inherits 003's
scanner-safe interstitial (token consumed only on an explicit click, not a passive GET).

**Alternatives considered**: A separate `/admin/accept-invite` page + action — duplicates the
003 flow for no behavioral difference. Auto-verifying on GET — reintroduces the
scanner-burns-the-token problem 003 already solved.

---

## R7 — Navigation: adding the Admin Management entry

**Decision**: Generalize `DashboardShell` to accept a `navItems: { label, href, icon }[]` prop
plus an `activeHref` (default = the single "Dashboard" item, preserving the student dashboard
unchanged). The admin dashboard and the admins page pass `[Dashboard → /admin/dashboard,
Admin Management → /admin/admins]`. The page lives under `/admin/admins` so
it inherits the existing proxy matcher `/admin/dashboard/:path*`.

**Rationale**: The reference screenshot's "Users & Roles → Admin Management" rename refers to a
different app; **this** codebase's shell has only a placeholder "Dashboard" nav (`href="#"`).
The minimal, honest change is to make the shell nav configurable and add the real
Admin Management link, which also fixes the dead `href="#"` for the admin panel. Student stays
on the default single-item nav.

**Alternatives considered**: A separate admin-only shell component (duplicates the shell). A new
top-level `/admin/admins` route with its own layout (loses the existing proxy matcher coverage
and the shared sidebar).

---

## R8 — Mobile strategy & bounded read (Principles IV & V)

**Decision**: The admin table is the feature's only data-heavy view. **Mobile strategy:
card-transform** — at narrow widths (< `sm`) each admin renders as a stacked card (name + email,
role/status chips, created date, remove control) instead of a horizontally-scrolling table;
at `sm`+ it is a real `<table>`. The read is **ordered by `created_at desc` and bounded** (the
admin population is small — tens); pagination is deferred but the query is structured to add a
range later.

**Rationale**: Satisfies the constitution's "data-heavy views MUST adopt a documented mobile
strategy" and "wave-scoped reads MUST be bounded" (here, the admin read is bounded by being
small + ordered). No horizontal scroll at 320px.

**Alternatives considered**: Contained horizontal scroll of the table (worse touch ergonomics
for the primary actions). Immediate pagination (premature for tens of rows).

---

## R9 — New-admin field validation & duplicate-email rejection

**Decision**: A pure `validateNewAdminFields(firstName, lastName, email)` in
`lib/auth/adminManagement.ts` (mirrors `adminGate`/`passwordReset`): require non-empty trimmed
first and last name and a syntactically valid, trimmed, lowercased email. Duplicate rejection
reuses the existing `is_admin_email(email)` RPC — if it returns true, reject with the
"already in use" message **before** any Admin-API call. The DB `admin_profiles.email unique`
constraint is the backstop against a race.

**Rationale**: Keeps validation deterministically unit-testable and reuses the 003 gate for
duplicate detection (no new SQL). The unique constraint guarantees correctness even under
concurrent creates.

**Alternatives considered**: Catching the Admin-API "user already exists" error only — works but
leaks a round-trip and a less specific message; the pre-check gives a clean UX and the
constraint still backstops.

---

## R10 — Self-removal & last-ACTIVE-admin guards (revised per analysis F1)

**Decision**: Both guards are enforced **server-side** in `removeAdmin`, before any Admin-API
call: (a) compare the target id to the caller's `auth.getUser().id` → reject self-removal;
(b) **count administrators with `status='active'`** (cookie client, RLS-permitted) and reject
when the target is the only active admin — i.e. the target's status is `active` **and** the
active count is ≤ 1. The UI also hides/disables the remove control on the current user's own
row, but the server check is authoritative.

**Rationale (why active, not raw count)**: A still-`pending` admin cannot sign in, so counting
raw rows could let the last *active* admin be removed while only a pending (possibly
expired-invite) admin remained — effectively zero usable administrators. Counting **active**
admins guarantees at least one administrator who can actually sign in survives every removal
(SC-005 / FR-016). Removing a pending admin never reduces the active count, so it is always
allowed (subject to the self-guard).

**Alternatives considered**: Counting raw `admin_profiles` rows (the original draft — rejected
by analysis finding F1: can strand the platform on a non-signable pending admin). Client-only
guards (insufficient — violates Principle VI). A DB trigger preventing the last delete (harder
to message back to the user; the count check is clearer and testable).

---

## R11 — Email template & redirect configuration

**Decision**: Configure the Supabase **Invite user** email template to point its action link at
`{{ .SiteURL }}/admin/auth/confirm` (carrying `token_hash` + `type=invite`), and ensure
`/admin/auth/confirm` is in the Auth redirect allow-list (already added in 003 for recovery).
Reuse `NEXT_PUBLIC_SITE_URL` to build the absolute `redirectTo`. No new env var.

**Rationale**: Mirrors 003's recovery configuration; the same confirm route handles both link
types (R6). No new secrets or variables.

**Alternatives considered**: A dedicated invite redirect path — unnecessary given the unified
confirm route.

---

## R12 — Re-sending invites & invite-dispatch-failure feedback (added per analysis CG1 + U1)

**Decision**: Two related behaviors make `pending` accounts recoverable:

1. **Dispatch-failure feedback (FR-021)**: `createAdmin` inspects the result of
   `inviteUserByEmail`. The account is still created `pending` regardless (the profile insert is
   the source of truth), but if the **send** errored, the action returns
   `{ created: true, inviteFailed: true }` so the modal tells the creator the invite wasn't
   delivered and points them to **Resend invite**. The admin is never silently left unreachable.
2. **Resend invite (FR-020)**: a `resendInvite(target)` gated Server Action — `assertAdminSession`
   → verify the target is a `pending` admin → call `inviteUserByEmail(email, { redirectTo })`
   again. GoTrue issues a **fresh** single-use link and invalidates the prior one. Audited as
   `admin_reinvited`. The UI surfaces **Resend invite** only on `pending` rows; an `active`
   admin never shows it (there is nothing to accept).

**Rationale**: Email delivery is best-effort (the spec's edge case + FR-021); without feedback
and a resend path a transient SMTP failure or an expired link would strand a new admin with no
in-product recovery. Reusing `inviteUserByEmail` keeps the token single-use/expiring semantics
identical to the first invite — no custom token handling.

**Alternatives considered**: Surfacing only a generic success (rejected — analysis U1: hides a
real failure mode). A separate "regenerate link" primitive (`generateLink`) (unnecessary;
`inviteUserByEmail` already re-issues and emails). Gating resend on active admins too
(pointless — they have no pending link).

---

## Summary of decisions

| # | Decision |
|---|----------|
| R1 | Create via Admin API `inviteUserByEmail` + set `role='admin'`; insert `pending` profile |
| R2 | Service-role client used in request code, but only inside `assertAdminSession`-gated actions |
| R3 | Remove via Admin API `deleteUser` (FK-cascades profile); self + last-active-admin guards |
| R4 | List via cookie-bound client + existing `admin_profiles` RLS (no service role) |
| R5 | Migration 0004: `first_name`, `last_name`, `status` on `admin_profiles` + widened audit CHECK |
| R6 | Reuse 003 confirm + set-password flow for `type=invite`; flip status to `active` on set |
| R7 | `DashboardShell` gains `navItems`/`activeHref`; page at `/admin/admins` (+ `loading.tsx`, U2) |
| R8 | Card-transform mobile strategy; ordered + bounded admin read |
| R9 | Pure field validators + `is_admin_email` duplicate pre-check; unique constraint backstop |
| R10 | Server-side self-removal & **last-active-admin** guards (counts `status='active'`, F1) |
| R11 | Reuse invite email template + existing redirect allow-list + `NEXT_PUBLIC_SITE_URL` |
| R12 | Resend-invite action + invite-dispatch-failure feedback for pending admins (CG1 + U1) |
