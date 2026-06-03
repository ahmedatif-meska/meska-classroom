# Walkthrough: Admin Forgot Password & Reset

**Feature**: `003-admin-forgot-password` | **Branch**: `003-admin-forgot-password`

This walkthrough covers both implemented phases. It assumes `002-admin-auth` is configured
(Supabase project, `.env.local`, migrations `0001`/`0002`, a seeded admin) per its quickstart.

## How to run

```bash
# 1. Add the site origin used to build the reset redirect URL
#    (append to .env.local)
NEXT_PUBLIC_SITE_URL=http://localhost:3000

# 2. Apply migration 0003 (dashboard SQL editor, Supabase MCP, or `supabase db push`)
#    supabase/migrations/0003_password_reset.sql  →  is_admin_email() + widened audit CHECK

# 3. Configure Supabase Auth (dashboard or MCP) — see quickstart.md §3:
#    - allow-list http://localhost:3000/admin/auth/confirm (+ prod origin)
#    - point the Reset Password email template at
#      {{ .SiteURL }}/admin/auth/confirm?token_hash={{ .TokenHash }}&type=recovery
#    - set min password length to 8

# 4. Run
npm run dev        # http://localhost:3000/admin
```

Verification commands:

```bash
npm test           # full suite (incl. the recovery unit/component/route tests)
npm run lint       # ESLint — clean
npx tsc --noEmit   # type-check — clean
# npm run build    # NOTE: requires network access to Google Fonts (next/font in app/layout.tsx)
```

## Implemented features

### Phase 1 — Request a reset link

| Surface | Path |
|---------|------|
| "Forgot password?" link (entry) | `components/AdminLoginForm.tsx` → `/admin/forgot-password` |
| Forgot-password page | `app/admin/forgot-password/page.tsx` |
| Request form (client island) | `components/ForgotPasswordForm.tsx` |
| Request Server Action | `requestPasswordReset` in `app/admin/actions.ts` |
| Email validator (pure) | `validateEmailField` in `lib/auth/passwordReset.ts` |
| Admin-only gate + audit categories | `supabase/migrations/0003_password_reset.sql` (`is_admin_email`) |

### Phase 2 — Set the new password

| Surface | Path |
|---------|------|
| Link verification (token → session) | `app/admin/auth/confirm/route.ts` (`GET`, `verifyOtp`) |
| Change-password page + invalid-link state | `app/admin/reset-password/page.tsx` |
| Change form (client island) | `components/ResetPasswordForm.tsx` |
| Update Server Action | `updateAdminPassword` in `app/admin/actions.ts` |
| New-password validator (pure) | `validateNewPassword` in `lib/auth/passwordReset.ts` |

## Golden-path verification (desktop AND mobile — Principle IV)

Run each at desktop width and at **320 / 390 / 430 / 768px** (DevTools device toolbar);
confirm no horizontal scroll, clipping, or overlap, inputs are ≥16px, and every field/button
shows a visible focus ring.

1. On `/admin`, click **Forgot password?** → lands on `/admin/forgot-password`.
2. Submit the **seeded admin** email → the neutral confirmation
   ("If an admin account exists…") appears in a `role="alert"` region; a reset email arrives.
3. Submit a **non-admin / unknown** email → the **identical** confirmation appears; **no**
   email is sent (anti-enumeration, SC-002).
4. Submit with an **empty** email → blocked before any backend call with "Please enter your
   email." (FR-002).
5. Open the link in the email → lands on `/admin/reset-password` with the new-password form.
6. Enter a matching new password (≥ 8 chars) → success → redirected to `/admin`; sign in with
   the **new** password succeeds and the **old** password is rejected (SC-005).
7. Enter a `< 8`-char or non-matching password → blocked before any change with the right
   validation message (SC-006).
8. Re-open the **same** link (or wait for expiry) → the invalid-link state with **Request a
   new link** (single-use / expiry, SC-003).
9. After a successful reset, return to a previously open admin session → its next protected
   action redirects to `/admin` (all sessions revoked, FR-012 / SC-007).

## Test coverage (deterministic, Principle II)

- `tests/lib/auth/passwordReset.test.ts` — `validateEmailField`, `validateNewPassword`.
- `tests/app/admin/requestPasswordReset.test.ts` — neutral response, admin-only send, audit.
- `tests/app/admin/updateAdminPassword.test.ts` — session gate, validation, update + global
  sign-out + redirect.
- `tests/app/admin/confirmRoute.test.ts` — `verifyOtp` success/failure and non-admin → redirect.
- `tests/components/ForgotPasswordForm.test.tsx`, `tests/components/ResetPasswordForm.test.tsx`
  — required inputs + state rendering.

## Known gaps / not executable in this environment

- **T004 (Supabase config)**: applying migration `0003` and the Auth settings (redirect
  allow-list, recovery email template, password policy, rate limits) requires the live Supabase
  project — do this via the dashboard or the Supabase MCP before the golden path works
  end-to-end.
- **T025 / T027 (manual verification)**: the responsive/a11y sweep and the live quickstart
  run require a running app against the configured project.
- **`npm run build`**: blocked here only by `next/font/google` needing network access in
  `app/layout.tsx` (pre-existing, unrelated to this feature); `lint`, `tsc`, and `test` pass.
