# Quickstart: Admin Management

How to configure, run, and verify the Admin Management feature. Builds on the 002/003 setup —
no new dependency or env var.

## Prerequisites

- `002-admin-auth` and `003-admin-forgot-password` applied (Supabase project wired,
  `.env.local` filled, bootstrap admin seeded, recovery configured).
- `.env.local` already contains `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`,
  `NEXT_PUBLIC_SITE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SEED_ADMIN_PASSWORD`.

## 1. Apply the migration

Apply `supabase/migrations/0004_admin_management.sql` (adds `first_name`, `last_name`, `status`
to `admin_profiles`; widens the `admin_auth_events` reason CHECK; backfills existing admins to
`status='active'`). Apply via your normal migration path (Supabase SQL editor or CLI), in order
after `0003`.

## 2. Configure the invite email + redirect (Supabase dashboard)

- **Auth → URL Configuration → Redirect URLs**: ensure `${NEXT_PUBLIC_SITE_URL}/admin/auth/confirm`
  is allow-listed (already added in 003 for recovery — reused for invites).
- **Auth → Email Templates → Invite user**: set the action link to
  `{{ .SiteURL }}/admin/auth/confirm` so the invite link carries `token_hash` + `type=invite`
  to the shared confirm route.
- **Auth → Providers → Email**: confirm the password policy (min 8) matches the set-password
  validation.

## 3. (Re-)seed and run

```bash
npm run seed:admin     # idempotent; now also ensures the bootstrap admin is status='active'
npm run dev            # http://localhost:3000
```

## 4. Verify (golden path)

1. Sign in at `/admin` as the bootstrap admin → `/admin/dashboard`.
2. In the sidebar, click **Admin Management** → lands on `/admin/admins`; the list
   shows the bootstrap admin with your row marked **You**, role **Admin**, status **Active**.
3. Click **Add Admin** → the **Create New Admin** modal opens. Submit First/Last name + a fresh
   email. The modal closes; the new admin appears with status **Pending**.
4. Check the invited mailbox → follow the magic link → **Continue** on the confirm interstitial
   → set a password (≥ 8) → you are returned to `/admin`. The new admin's status is now
   **Active**; sign in with the new email + password works.
5. Back on Admin Management as the bootstrap admin, click **Remove** on the new admin →
   confirm → the row disappears; that admin can no longer sign in.

## 5. Verify (guards & edge cases)

- **Duplicate email**: Add Admin with an existing admin's email → "already exists"; no row added.
- **Validation**: empty name or malformed email → blocked before any backend call.
- **Resend invite**: on a **Pending** admin's row, click **Resend invite** → a fresh link is
  emailed (the old one stops working); the control does **not** appear on **Active** admins.
- **Invite-not-sent**: if the invite email fails to dispatch, the admin is still created
  **Pending** and the modal tells you to use **Resend invite** (FR-021).
- **Self-removal**: the remove control is absent on your own row; a forced `removeAdmin` with
  your own id is rejected server-side.
- **Last active admin**: with only one **active** admin remaining, removal is blocked (a
  still-**pending** admin does not satisfy the minimum).
- **Expired/used invite link**: re-opening a consumed link shows the invalid-link state with
  "Request a new link".
- **Route protection**: open `/admin/admins` while signed out → redirected to `/admin`.

## 6. Quality gates (constitution v2.0.0)

```bash
npm run build      # TS strict, must pass
npm run lint       # must be clean
npm test           # full Vitest suite, must pass
```

- **Responsive**: validate the list + modal at 320 / 390 / 430 / 768px and desktop — the table
  becomes stacked cards on narrow widths, the modal scrolls internally and traps focus, inputs
  are ≥16px. No horizontal scroll or clipped controls.
- **A11y**: keyboard-only add + remove; visible focus; `role="dialog"` modal labelled; status
  chips meet contrast; error/success announced (`role="alert"`).
- **Performance**: list is server-rendered and bounded; only the modal + remove dialog ship
  client JS; no CWV regression vs. the 002/003 baseline.

## Notes

- The service-role key is used **only** inside the `createAdmin` / `removeAdmin` Server Actions,
  after `assertAdminSession`. It has no `NEXT_PUBLIC_` prefix and is never imported into client
  code — confirm it is absent from the browser bundle and from any request-rendered HTML.
- No new student/wave-scoped read is introduced, so the existing 002 RLS isolation tests remain
  the authority for tenant boundaries.
