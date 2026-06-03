# Phase 1 Contracts: Admin Management

Interfaces this feature exposes. All mutation contracts run server-side and are gated by
`assertAdminSession` before any privileged (service-role) call. Copy is referenced by key from
`lib/strings.ts` (group **C8**); no inline literals.

---

## C1 — Server Actions (`app/admin/actions.ts`)

### `createAdmin(prevState, formData) → CreateAdminState`

```ts
export type CreateAdminState = { error?: string; created?: boolean; inviteFailed?: boolean };
```

Flow (any failure returns `{ error }` and performs **no** privileged call past the point it
fails):

1. `assertAdminSession` on the caller's cookie session → else `{ error: strings.adminMgmtForbidden }`.
2. `validateNewAdminFields(firstName, lastName, email)` → else `{ error }` (first failing message).
3. `is_admin_email(email)` RPC (cookie client) → if `true`, `{ error: strings.adminMgmtEmailInUse }`.
4. `const { data, error: inviteErr } = await createAdminClient().auth.admin.inviteUserByEmail(email, { redirectTo: ${SITE_URL}/admin/auth/confirm, data: { first_name, last_name } })`. If `inviteErr` indicates "user already exists", map to `{ error: strings.adminMgmtEmailInUse }` (race backstop).
5. Set the role claim: `auth.admin.updateUserById(newUserId, { app_metadata: { role: 'admin' } })` (see research R1 ordering note — `app_metadata` is not an invite option, so this immediately follows).
6. Insert `admin_profiles` `{ id: newUserId, email, first_name, last_name, display_name: "First Last", role:'admin', status:'pending' }`.
7. `log_admin_auth_event(email, 'success', 'admin_created')`; `revalidatePath('/admin/admins')`; return `{ created: true, inviteFailed: <true iff the invite send reported a delivery error> }` (FR-021 — the account is still created `pending`; the modal surfaces the resend pointer when `inviteFailed`).

Inputs (FormData): `first_name`, `last_name`, `email`. (`role` is presentational only; the
action always sets `'admin'`.)

**Guarantees**: FR-006–FR-010, FR-017, FR-018, FR-021. Email normalized (trim + lowercase). On
the rare create race, the `email unique` constraint backstops step 6 → mapped to the in-use
error.

### `resendInvite(prevState, formData) → ResendInviteState`

```ts
export type ResendInviteState = { error?: string; sent?: boolean };
```

Flow:

1. `assertAdminSession` → else `{ error: strings.adminMgmtForbidden }`.
2. Read `target_id`; load the target `admin_profiles` row (cookie client, RLS) → reject if it is missing or **not** `status='pending'` (`{ error: strings.adminMgmtResendNotPending }`) — an active admin has no pending link.
3. `createAdminClient().auth.admin.inviteUserByEmail(targetEmail, { redirectTo: ${SITE_URL}/admin/auth/confirm })` — GoTrue issues a fresh single-use link and invalidates the prior one.
4. `log_admin_auth_event(targetEmail, 'success', 'admin_reinvited')`; `revalidatePath(...)`; return `{ sent: true }` (or `{ error: strings.adminMgmtInviteFailed }` if the send errors).

Inputs (FormData): `target_id` (+ `target_email` for the audit label).

**Guarantees**: FR-020, FR-021, FR-017. Only offered/accepted for `pending` admins.

### `removeAdmin(prevState, formData) → RemoveAdminState`

```ts
export type RemoveAdminState = { error?: string; removed?: boolean };
```

Flow:

1. `assertAdminSession` → else `{ error: strings.adminMgmtForbidden }`.
2. Resolve caller id via `getUser()`; read `target_id` + `target_status` from FormData (status also re-checked against the DB).
3. **Self-guard**: `target_id === callerId` → `{ error: strings.adminMgmtNoSelfRemove }` (FR-015).
4. **Last-active-admin guard**: `count(admin_profiles where status='active')`; if the target is `active` **and** that count `<= 1` → `{ error: strings.adminMgmtLastAdmin }` (FR-016). (Removing a `pending` admin never reduces the active count, so it is allowed.)
5. `createAdminClient().auth.admin.deleteUser(target_id)` (FK-cascades `admin_profiles`).
6. `log_admin_auth_event(targetEmail, 'success', 'admin_removed')`; `revalidatePath(...)`; `{ removed: true }`.

Inputs (FormData): `target_id` (and `target_email` for the audit label).

**Guarantees**: FR-013–FR-017, SC-005, SC-006. No Admin-API call occurs before guards 1–4 pass.
The active-count is read with the cookie client (RLS-permitted), so no service role is needed
to evaluate the guard.

### `confirmPasswordReset` / shared confirm — generalize for invite (MODIFY)

Accept `type ∈ { 'recovery', 'invite' }` from the link; verify with
`verifyOtp({ type, token_hash })`; on success route to `/admin/reset-password`. Failure → the
existing invalid-link state (`?error=link`) + `reset_invalid` audit. Scanner-safe (token
consumed only on explicit "Continue" click) — unchanged from 003.

### `updateAdminPassword` — flip status on set (MODIFY)

After a successful `updateUser({ password })` for the current admin recovery/invite session,
also `update admin_profiles set status='active' where id = userId` (idempotent for an
already-active admin). Everything else (validation, global sign-out, redirect) unchanged.

---

## C2 — Pure helpers (`lib/auth/adminManagement.ts`)

```ts
export type FieldValidation = { ok: true } | { ok: false; error: string };

/** FR-007/FR-018 — required names + valid, normalized email. */
export function validateNewAdminFields(
  firstName: FormDataEntryValue | null,
  lastName: FormDataEntryValue | null,
  email: FormDataEntryValue | null
): FieldValidation;

/** Display name from row parts: "First Last" → display_name → email local-part. Never blank. */
export function adminDisplayName(row: {
  first_name?: string | null; last_name?: string | null;
  display_name?: string | null; email: string;
}): string;
```

No Supabase/Next imports — deterministically unit-testable (mirrors `adminGate.ts`,
`passwordReset.ts`).

---

## C3 — Pages & components

### `app/admin/admins/page.tsx` (RSC) — Admin Management list

- Reads `admin_profiles` via the cookie-bound server client (RLS `is_admin()`), ordered by
  `created_at desc`; resolves the current user id to mark the own row.
- Renders `DashboardShell` (with the Admin Management nav active) → header (title + subtitle +
  **Add Admin** trigger) → `AdminTable`.
- States: **loading** (`app/admin/admins/loading.tsx` — explicit, U2/FR-019),
  **empty** (no admins — not normally reachable but defined via `adminMgmtEmptyNote`),
  **error** (inherited `app/admin/error.tsx`).

### `app/admin/admins/loading.tsx` (NEW, U2)

A lightweight skeleton/spinner for the list segment reusing the existing admin `loadingLabel`
styling, so FR-019's defined loading state is explicit rather than implicit.

### `components/DashboardShell.tsx` (MODIFY)

```ts
type NavItem = { label: string; href: string; icon?: React.ReactNode };
DashboardShell({ panelName, navItems?, activeHref?, footer?, children })
```

`navItems` defaults to a single Dashboard item (student dashboard unchanged). Active item by
`href === activeHref`; falls back to the existing `aria-current="page"` styling. Touch-friendly,
keyboard-focusable links.

### `components/AdminTable.tsx`

Columns: **Name** (`adminDisplayName`, current row gets a "You" marker), **Email**, **Role**
(chip "Admin"), **Status** (chip pending/active), **Created** (`created_at`), **Actions** —
a **Remove** control per non-self row, and a **Resend invite** control (`ResendInviteButton`)
shown **only** for `status='pending'` rows (R12). Mobile (`< sm`): each row becomes a stacked
card (R8). No horizontal scroll at 320px.

### `components/ResendInviteButton.tsx` (client island)

Bound to `resendInvite` via `useActionState`; passes the pending admin's `target_id`/`target_email`.
Sent/sending/error states (`role="alert"`); rendered only on pending rows. Reuses token styling.

### `components/AddAdminModal.tsx` (client island)

Dialog titled **Create New Admin** bound to `createAdmin` via `useActionState`. Fields:
First Name, Last Name, Email Address (type=email, ≥16px), Role (select, only "Admin"). States:
idle / submitting (disabled button) / field-error / duplicate-email / success (closes +
list revalidates) / **invite-not-sent** (`inviteFailed` → success-with-warning telling the
creator to use Resend invite, FR-021). Cancel + close (×) dismiss without creating. Focus
trapped; `Esc` closes; scrolls internally; `role="dialog"` + labelled.

### `components/RemoveAdminDialog.tsx` (client island)

Confirmation bound to `removeAdmin`. Shows the target's name/email, a destructive confirm and a
Cancel; submitting/error states; Cancel removes nothing. Does **not** use a native `confirm()`
dialog (browser-modal constraint) — an in-page accessible dialog.

---

## C4 — Configuration

| Item | Value |
|------|-------|
| Invite redirect | `${NEXT_PUBLIC_SITE_URL}/admin/auth/confirm` (allow-listed; shared with recovery) |
| Supabase email template | **Invite user** → action link to `{{ .SiteURL }}/admin/auth/confirm` carrying `token_hash` + `type=invite` |
| Env | No new variable — `NEXT_PUBLIC_SITE_URL` + `SUPABASE_SERVICE_ROLE_KEY` already exist |
| Proxy | Add matcher entry `/admin/admins/:path*` so the new top-level route is admin-protected |

---

## C5 — Copy (`lib/strings.ts`, group C8)

| Key | English |
|-----|---------|
| `adminMgmtNavLabel` | Admin Management |
| `adminMgmtTitle` | Admin Management |
| `adminMgmtSubtitle` | Manage administrators and their access |
| `adminMgmtAddLabel` | Add Admin |
| `adminMgmtColName` / `…Email` / `…Role` / `…Status` / `…Created` / `…Actions` | Name / Email / Role / Status / Created / Actions |
| `adminMgmtRoleAdmin` | Admin |
| `adminMgmtStatusPending` / `…Active` | Pending / Active |
| `adminMgmtYouBadge` | You |
| `adminMgmtEmptyNote` | No administrators yet |
| `createAdminTitle` | Create New Admin |
| `createAdminSubtitle` | Create a new administrator account and assign a role. |
| `firstNameLabel` / `lastNameLabel` | First Name / Last Name |
| `adminMgmtRoleHelp` | Full administrative access to manage the tenant |
| `createAdminSubmitLabel` / `createAdminSubmittingLabel` | Create Admin / Creating… |
| `cancelLabel` | Cancel |
| `adminMgmtNameRequired` | First and last name are required. |
| `adminMgmtEmailInvalid` | Enter a valid email address. |
| `adminMgmtEmailInUse` | An administrator with that email already exists. |
| `adminMgmtForbidden` | You don't have permission to do that. |
| `removeAdminTitle` | Remove administrator |
| `removeAdminConfirm` | Remove {name}? They will lose admin access immediately. |
| `removeAdminSubmitLabel` / `removeAdminSubmittingLabel` | Remove / Removing… |
| `adminMgmtNoSelfRemove` | You can't remove your own account. |
| `adminMgmtLastAdmin` | You can't remove the last active administrator. |
| `inviteSentNote` | An invite to set a password has been emailed to the new admin. |
| `adminMgmtInviteNotSent` | Admin created, but the invite email couldn't be sent. Use "Resend invite" to try again. |
| `resendInviteLabel` / `resendInviteSendingLabel` | Resend invite / Sending… |
| `resendInviteSentNote` | A new invite link has been emailed. |
| `adminMgmtResendNotPending` | This administrator has already set up their account. |
| `adminMgmtInviteFailed` | The invite couldn't be sent. Please try again. |

(Exact final wording is fixed during implementation; keys are the contract.)

---

## C6 — Test surface (per Principle II)

| Test | Asserts |
|------|---------|
| `lib/auth/adminManagement.test.ts` | name/email validation; `adminDisplayName` fallbacks |
| `app/admin/createAdmin.test.ts` | gate denial; duplicate-email reject (no invite); invite + role claim + pending insert + audit on success; **`inviteFailed` returned when the send errors** (FR-021) |
| `app/admin/resendInvite.test.ts` | gate denial; reject non-pending target; fresh `inviteUserByEmail` + `admin_reinvited` audit on a pending target (FR-020) |
| `app/admin/removeAdmin.test.ts` | gate denial; self-guard; **last-active-admin guard** (active count ≤1 blocks; a pending-only remainder still allows removing a pending row); `deleteUser` + audit on success |
| `app/admin/confirmInvite.test.ts` | `verifyOtp({type:'invite'})` success → reset-password; status→active on set; invalid link → error state |
| `app/admin/adminsPage.test.tsx` | rows render; current user marked; empty state; no non-admin rows; resend shown only on pending rows |
| `components/AddAdminModal.test.tsx` | required fields block submit; duplicate/error render; **invite-not-sent surfaced**; cancel creates nothing |

All use a mocked Supabase client (both cookie-bound and service-role). The service-role key is
asserted absent from any client/request-rendered output.
