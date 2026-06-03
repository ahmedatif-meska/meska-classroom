# Phase 1 Contracts: Admin Forgot Password & Reset

**Feature**: `003-admin-forgot-password` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

The interfaces this feature exposes: two **Server Actions**, one **Route Handler**, two pure
**validation helpers**, the reused **data-access (RLS/RPC)** contract, the **configuration**
surface, and the **UI copy** additions. These are what `/speckit-tasks` and the tests bind to.
Everything composes with the 002 contracts (`signInAdmin`, `proxy.ts`, the Supabase client
factories) — nothing in 002 changes behavior.

---

## C1 — `requestPasswordReset` Server Action (US1, US3)

**Identifier**: `requestPasswordReset(prevState, formData)` — `'use server'`, bound to the
forgot-password `<form>`.

**Input** (`FormData`):

| Field | Required | Notes |
|-------|----------|-------|
| `email` | yes | trimmed, lower-cased server-side |

**Behavior (decision table)**:

| Condition | Backend effect | User-visible result | Audit `outcome/reason` |
|-----------|----------------|---------------------|------------------------|
| `email` empty/whitespace | none | field-level: "Please enter your email." (no backend call) | — |
| `email` is an administrator's | `resetPasswordForEmail(email, { redirectTo })` | **neutral** confirmation (see C7 `resetLinkSent`) | `success/reset_requested` |
| `email` is non-admin / unknown | **no** link issued | **same** neutral confirmation | `denied/reset_requested` |

**Contract guarantees**:

- The admin and non-admin/unknown branches are **indistinguishable** to the caller — same
  message, no enumeration (FR-004, SC-002).
- Admin status is decided server-side via the `is_admin_email` RPC (C3); the service-role key
  never enters this path.
- Returns a serializable `{ error?: string; sent?: boolean }` state; never returns whether the
  email matched an admin.

## C2 — `updateAdminPassword` Server Action (US2)

**Identifier**: `updateAdminPassword(prevState, formData)` — `'use server'`, bound to the
change-password `<form>`. Requires a valid **admin recovery session** (established by C4).

**Input** (`FormData`):

| Field | Required | Notes |
|-------|----------|-------|
| `password` | yes | the new password; never logged/echoed |
| `confirm` | yes | must equal `password` |

**Behavior (decision table)**:

| Condition | Effect | User-visible result | Audit |
|-----------|--------|---------------------|-------|
| no valid admin recovery session | reject | invalid-link state (C7 `resetLinkInvalid`) | `denied/reset_invalid` |
| `password`/`confirm` empty, `< 8` chars, or mismatched | reject, **no** `updateUser` | field-level validation message | — |
| valid + rules pass | `updateUser({ password })` then `signOut({ scope: 'global' })` → `redirect('/admin')` | success state then sign-in | `success/reset_done` |
| `updateUser` errors (e.g., same-as-old per policy) | reject | clear message (C7 `resetUpdateFailed`) | `denied/reset_invalid` |

**Contract guarantees**:

- On success the new password authenticates and the old one does not (FR-008, SC-005); **all**
  other sessions for the account are revoked via global sign-out (FR-012, SC-007).
- Validation runs before any backend mutation (FR-007, SC-006).
- Flow stays in the admin panel; ends at `/admin` sign-in (FR-013).

## C3 — Pure validation helpers (deterministically unit-testable)

Added to `lib/auth/` alongside 002's `adminGate.ts`, same `{ ok } | { ok:false; error }` shape:

```
validateEmailField(email): { ok: true } | { ok: false; error: string }
//   ok only when email is a non-empty trimmed string (FR-002)

validateNewPassword(password, confirm): { ok: true } | { ok: false; error: string }
//   checks, in order: both present → length >= 8 → password === confirm (FR-007)
```

Reused from 002: `assertAdminSession(session)` — applied to the recovery session on the
confirm side (C4) so a non-admin recovery session cannot reach the change-password form.

## C4 — `/admin/auth/confirm` Route Handler (US4)

**Surface**: `GET /admin/auth/confirm?token_hash=<…>&type=recovery`. The recovery email's link
targets this route (R2).

| Request state | Action | Outcome |
|---------------|--------|---------|
| valid, unexpired, unused `token_hash` for an admin | `verifyOtp({ type:'recovery', token_hash })` → `assertAdminSession` true | recovery session set (httpOnly cookies) → `redirect('/admin/reset-password')` |
| valid token but recovery session is **non-admin** | sign out | `redirect('/admin/reset-password?error=link')`; audit `denied/reset_invalid` |
| missing/malformed/expired/already-used token | `verifyOtp` errors | `redirect('/admin/reset-password?error=link')`; audit `denied/reset_invalid` |

**Guarantee**: a password change is reachable only after a valid, unexpired, single-use
recovery link for an administrator (FR-005, FR-009, FR-010). A Route Handler (not an RSC page)
is required because `verifyOtp` writes session cookies.

## C5 — Data-access contract (RLS / RPC) — reused, one addition

| Caller (JWT role) | `is_admin_email(email)` | `admin_auth_events` | `admin_profiles` |
|-------------------|-------------------------|---------------------|------------------|
| `anon` (forgot-password request) | execute → boolean only | insert via `log_admin_auth_event` RPC | **no** direct read |
| `admin` recovery session | execute | insert via RPC; read all | read all |
| `service_role` | (unused at runtime) | — | — |

**Guarantees**: `is_admin_email` returns only a boolean (no admin row leaks, SC-002/SC-004
preserved); the RLS posture from 002 is otherwise unchanged; the service-role key stays out of
request code (002 R9).

## C6 — Configuration contract (additions to 002's env + Supabase Auth settings)

| Item | Where | Purpose |
|------|-------|---------|
| `NEXT_PUBLIC_SITE_URL` | `.env.local` / `.env.example` (client+server) | build the absolute `redirectTo` confirm URL |
| Allow-listed redirect URL | Supabase **Auth → URL Configuration** | `${SITE_URL}/admin/auth/confirm` + `http://localhost:3000/admin/auth/confirm` |
| Recovery email template | Supabase **Auth → Email Templates → Reset Password** | link to the confirm route carrying `token_hash` & `type=recovery` (R2) |
| Password policy (min length 8) | Supabase **Auth → Policies** | keep platform rule consistent with `validateNewPassword` |
| Recovery rate limits | Supabase **Auth → Rate Limits** | abuse resistance (FR-014, R7) |

Applied via the **Supabase dashboard or the Supabase MCP** (interchangeable, R10). No new
server-only secret is introduced; the service-role key/seed password from 002 are untouched.

## C7 — UI copy contract (additions to `lib/strings.ts`)

Centralized strings (no inline literals, constitution III / CLAUDE.md). `forgotPasswordLabel`,
`emailLabel`, `emailPlaceholder`, `passwordLabel` already exist and are reused.

| Key | Value (English, LTR) |
|-----|----------------------|
| `forgotTitle` | "Reset your password" |
| `forgotSubtitle` | "Enter your admin email and we'll send you a reset link." |
| `forgotEmailRequired` | "Please enter your email." |
| `forgotSubmitLabel` | "Send reset link" |
| `forgotSendingLabel` | "Sending…" |
| `resetLinkSent` | "If an admin account exists for that email, a reset link is on its way." |
| `backToSignInLabel` | "Back to sign in" |
| `resetTitle` | "Set a new password" |
| `newPasswordLabel` | "New password" |
| `confirmPasswordLabel` | "Confirm new password" |
| `resetPasswordTooShort` | "Password must be at least 8 characters." |
| `resetPasswordMismatch` | "Passwords do not match." |
| `resetSubmitLabel` | "Update password" |
| `resetUpdatingLabel` | "Updating…" |
| `resetUpdateFailed` | "We couldn't update your password. Please request a new link." |
| `resetSuccess` | "Your password has been changed. Sign in with your new password." |
| `resetLinkInvalid` | "This reset link is invalid or has expired." |
| `requestNewLinkLabel` | "Request a new link" |
