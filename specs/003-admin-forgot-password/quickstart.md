# Quickstart: Admin Forgot Password & Reset

**Feature**: `003-admin-forgot-password` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

How to configure, run, and verify admin password recovery. Assumes `002-admin-auth` is
already set up (Supabase project, `.env.local`, migrations `0001`/`0002`, seeded admin) and
deps are installed (`npm install`). No new dependencies are required.

## 1. Configure the site URL

Add to `.env.local` (and it is documented in `.env.example`):

```bash
NEXT_PUBLIC_SITE_URL=http://localhost:3000     # production: https://<your-domain>
```

This builds the absolute `redirectTo` for the recovery email.

## 2. Apply migration `0003`

Run `supabase/migrations/0003_password_reset.sql` — via the **Supabase dashboard → SQL
Editor**, the **Supabase MCP** (`apply_migration`), or `supabase db push`. It adds
`is_admin_email(text)` and widens the `admin_auth_events` reason/outcome CHECK to admit the
recovery categories.

## 3. Configure Supabase Auth (dashboard or MCP)

In the Supabase project settings (these are interchangeable with the MCP):

1. **Auth → URL Configuration → Redirect URLs**: add
   `http://localhost:3000/admin/auth/confirm` (and `${NEXT_PUBLIC_SITE_URL}/admin/auth/confirm`
   for production). Un-listed redirects are silently dropped.
2. **Auth → Email Templates → Reset Password**: point the link at our confirm route carrying
   the recovery `token_hash`, e.g.

   ```html
   <a href="{{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery">
     Reset your password
   </a>
   ```

3. **Auth → Policies**: set the minimum password length to **8** to match
   `validateNewPassword`.
4. **Auth → Rate Limits**: confirm sensible per-email / per-IP limits for password recovery
   (built-in; FR-014).

## 4. Run the app

```bash
npm run dev    # http://localhost:3000/admin
```

## 5. Verify the golden path & guarantees

| # | Action | Expected |
|---|--------|----------|
| 1 | On `/admin`, click **Forgot password?** | Navigates to `/admin/forgot-password` (US1) |
| 2 | Submit the seeded admin email | Neutral confirmation shown; a reset email arrives (US1) |
| 3 | Submit a **non-admin / unknown** email | **Same** neutral confirmation; **no** email arrives (US3 / SC-002) |
| 4 | Submit with an empty email | Blocked before any backend call; required message (FR-002) |
| 5 | Open the link from the email | Lands on `/admin/reset-password` with the new-password form (US2) |
| 6 | Submit a valid matching new password (≥ 8) | Success state → redirected to `/admin`; sign in with the **new** password works; the **old** password is rejected (US2 / SC-005) |
| 7 | Submit a password `< 8` chars or non-matching confirmation | Blocked before any change; validation message (SC-006) |
| 8 | Open the **same** link a second time, or after it expires | Invalid/expired-link state with **Request a new link** (US4 / SC-003) |
| 9 | After a successful reset, check a previously open admin session | It is signed out / its next protected action redirects to `/admin` (FR-012 / SC-007) |

**Responsive/a11y (Principle IV — manual, for the walkthrough)**: verify
`/admin/forgot-password` and `/admin/reset-password` at **320 / 390 / 430 / 768px and
desktop** — no horizontal scroll/clip/overlap; inputs ≥16px on mobile; visible focus on every
field and button; confirmation, validation, and invalid-link messages announced (`role="alert"`).

## 6. Run the tests

```bash
npm test
```

- **Unit (pure, no backend)**: `validateEmailField` (empty/whitespace → fail; valid → ok);
  `validateNewPassword` (missing / `< 8` / mismatch → fail with the right message; valid → ok).
- **Server Actions (mocked Supabase)**: `requestPasswordReset` returns the **identical**
  neutral state for admin, non-admin, and unknown emails, and only calls
  `resetPasswordForEmail` when `is_admin_email` is true; `updateAdminPassword` blocks invalid
  input before `updateUser`, and on success calls `updateUser` then `signOut({ scope:'global' })`.
- **Confirm route (mocked `verifyOtp`)**: valid admin token → redirect to
  `/admin/reset-password`; non-admin or failed verify → redirect with `error=link`.
- **Component**: forgot-password and reset-password forms mark inputs `required` and render
  their states.

## Troubleshooting

- **No email arrives for a real admin** → confirm migration `0003` ran (`is_admin_email`
  exists and returns true for that email), the redirect URL is allow-listed, and the project's
  email sending is configured.
- **Link opens to the invalid-link state** → the token was already used or expired, or the
  redirect URL isn't allow-listed, or the email template isn't pointing at
  `/admin/auth/confirm` with `token_hash` & `type=recovery`.
- **"Password must be at least 8 characters" from Supabase but not the form (or vice-versa)**
  → align the dashboard password policy with `validateNewPassword` (both = 8).
