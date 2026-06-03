# Walkthrough: Admin Management (004)

Covers all three phases (list & nav → add/resend/onboarding → remove). Builds on
`002-admin-auth` + `003-admin-forgot-password`; no new dependency or env var.

## How to run

```bash
# 1. Apply the migration (T003 — manual, against your Supabase project)
#    supabase/migrations/0004_admin_management.sql
#    via the Supabase SQL editor or CLI, after 0003.

# 2. Configure the "Invite user" email template (T003 — Supabase dashboard):
#    Auth → Email Templates → Invite user → action link:
#      {{ .SiteURL }}/admin/auth/confirm   (carries token_hash + type=invite)
#    Auth → URL Configuration → ensure ${NEXT_PUBLIC_SITE_URL}/admin/auth/confirm
#    is allow-listed (reused from 003).

# 3. Seed + run
npm run seed:admin        # bootstrap admin, now status='active'
npm run dev               # http://localhost:3000

# Quality gates
npm run build             # ✓ passes (TypeScript strict)
npm run lint              # ✓ clean
npm test                  # ✓ 117 passed, 3 skipped
```

Sign in at `/admin` as the bootstrap admin (`ahmedatif@meska.ai`).

## Implemented features (route / component path)

| Feature | Path |
|---------|------|
| Admin Management nav entry | `lib/adminNav.tsx` → `components/DashboardShell.tsx` (navItems) |
| Admin Management list page | `app/admin/admins/page.tsx` |
| List loading state | `app/admin/admins/loading.tsx` |
| List table / mobile cards + actions | `components/AdminTable.tsx` |
| Add Admin modal | `components/AddAdminModal.tsx` |
| Resend invite (pending only) | `components/ResendInviteButton.tsx` |
| Remove confirm dialog | `components/RemoveAdminDialog.tsx` |
| Create / resend / remove actions | `app/admin/actions.ts` (`createAdmin`, `resendInvite`, `removeAdmin`) |
| Invite onboarding (set password) | `app/admin/auth/confirm/page.tsx` (+ `type=invite`), `app/admin/reset-password/page.tsx` (reused) |
| Field validators / name display | `lib/auth/adminManagement.ts` |
| Schema delta | `supabase/migrations/0004_admin_management.sql` |
| UI copy | `lib/strings.ts` (group C8) |

## Golden-path verification (desktop)

1. From the admin dashboard, click **Admin Management** in the sidebar → lands on
   `/admin/admins`. The bootstrap admin appears: role **Admin**, status **Active**,
   own row tagged **You**, no remove control on the own row.
2. Click **Add Admin** → the **Create New Admin** modal opens (First/Last name, Email, Role =
   Admin only). Submit a valid unused email → modal closes; the new admin appears as **Pending**
   with a **Resend invite** control.
3. Open the invited mailbox → follow the magic link → **Continue** on the confirm interstitial
   → set a password (≥ 8) → returned to `/admin`. The new admin's status is now **Active**;
   sign in with the new credentials works.
4. As the bootstrap admin, click the trash icon on the new admin's row → confirm in the dialog
   → the row disappears; that admin can no longer sign in.
5. Guards: **Add Admin** with an existing email → "already exists"; empty name / bad email →
   blocked; **Resend invite** only shows on Pending rows; removing your own row is impossible
   (no control + server self-guard); with one active admin left, removal is blocked.

## Golden-path verification (mobile — 320 / 390 / 430 / 768px)

- The table collapses to **stacked cards** (one `data-admin-row` per admin) — no horizontal
  scroll or clipped controls at 320px.
- The Add-Admin modal and Remove dialog scroll internally, trap focus, and close on Cancel/×;
  inputs render at ≥16px.
- Status chips (green Active / amber Pending) and the brand role chip meet WCAG AA contrast;
  every control has a visible focus ring; errors/warnings announce via `role="alert"`.

> **T030 (manual responsive sweep)** and **T032 (live end-to-end against a configured Supabase
> project)** remain to be run by a reviewer; everything they validate is wired and unit-tested.

## Security notes

- Every mutation (`createAdmin`, `resendInvite`, `removeAdmin`) calls `assertAdminSession`
  **before** any service-role Admin-API call; tests assert a non-admin caller is denied first.
- The service-role key (`lib/supabase/admin.ts`) is server-only (no `NEXT_PUBLIC_` prefix),
  used only inside these Server Actions, and never reaches client/request-rendered output.
- The list reads `admin_profiles` via the cookie/RLS client — students can never appear (SC-007).
- The last-**active**-admin guard counts `status='active'` rows, so the platform always keeps
  one administrator able to sign in (FR-016).

## Known gaps (intentional, out of scope)

- **Multiple roles** — the reference image shows "Company Admin"/"Manager"; this feature ships
  a single "Admin" role (FR-005). Multi-role + per-admin role editing are a future feature.
- **Editing an existing admin** (beyond removal) is out of scope.
- **T003** (apply migration + configure the invite email template) is a manual infra step.
- Invite **deliverability** beyond dispatch (bounce/spam handling) is outside scope; the create
  flow reports a dispatch failure and offers re-send (FR-021), which is the guaranteed behavior.
