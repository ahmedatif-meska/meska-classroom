# Phase 0 Research: Admin Forgot Password & Reset

**Feature**: `003-admin-forgot-password` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

This feature extends `002-admin-auth`. The backend (Supabase Cloud), the admin/student
separation, the `app_metadata.role` claim, the three Supabase client factories, the
`proxy.ts` route protection, the audit RPC, and the pure-helper testing discipline already
exist and are **reused**. The decisions below resolve every NEEDS CLARIFICATION in the
Technical Context for the *recovery* path only.

---

## R1 — Reuse Supabase Auth recovery (don't build a token store)

- **Decision**: Implement recovery with Supabase Auth's built-in password-recovery
  primitives — `auth.resetPasswordForEmail()` to issue the link and `auth.updateUser({ password })`
  to apply the new password — rather than minting, storing, and expiring our own reset
  tokens.
- **Rationale**: GoTrue already issues unguessable, single-use, time-limited recovery
  tokens, hashes the stored password, and (by configuration) revokes sessions on change —
  exactly FR-005/FR-008/FR-011. Re-implementing a token table re-creates audited security
  primitives the platform mandated in 002 (R1 there). Spec assumption "email delivery uses
  the managed auth backend's recovery capability" is honored.
- **Alternatives considered**:
  - *Custom `password_reset_tokens` table + our own email* — rejected: re-implements
    security-critical token issuance/expiry and needs a separate mail provider; more
    surface, no benefit.
  - *Magic-link sign-in then "change password while signed in"* — rejected: that is a
    different (authenticated) flow than the spec's unauthenticated email-link recovery.

## R2 — Link delivery & verification: `token_hash` + `verifyOtp` (server-side)

- **Decision**: Use the **`token_hash` + `verifyOtp({ type: 'recovery', token_hash })`** server
  flow. The recovery email's link points at our own Route Handler
  `GET /admin/auth/confirm?token_hash=…&type=recovery`, which calls `verifyOtp` to establish a
  short-lived recovery session (httpOnly cookies via `@supabase/ssr`), then redirects to the
  change-password page.
- **Rationale**: `verifyOtp` with a `token_hash` does **not** depend on a PKCE
  `code_verifier` cookie, so the link works even when the email is opened in a different
  browser or on a different device (the common case for email) — more robust than the
  implicit-hash flow (`#access_token=…`, client-only, tokens in JS) or
  `exchangeCodeForSession(code)` (needs the originating browser's verifier cookie). This is
  Supabase's documented Server-Side Auth pattern for App Router and keeps verification
  server-side (Principle VI), consistent with how 002 runs auth in Server Actions / `proxy.ts`.
- **Config consequence**: the default email template's `{{ .ConfirmationURL }}` must be
  changed to a link carrying `token_hash` and `type` and pointing at our confirm route — a
  one-time Supabase dashboard (or MCP) step, documented in quickstart §Config.
- **Alternatives considered**:
  - *Implicit flow (hash fragment, client reads tokens)* — rejected: client-side token
    handling, `localStorage` exposure, contradicts the server-side discipline of 002.
  - *`exchangeCodeForSession(code)` (PKCE)* — rejected as primary: the code-verifier cookie
    is bound to the browser that requested the reset, so opening the link on another device
    fails; worse UX for an email link.

## R3 — Admin-only recovery + anti-enumeration (FR-003, FR-004, FR-010, US3)

- **Decision**: Gate the recovery flow to administrators on **both** ends, while always
  returning one neutral confirmation:
  1. **Request side** — before issuing a link, the `requestPasswordReset` Server Action calls
     a new SECURITY DEFINER RPC `public.is_admin_email(p_email)` (returns boolean by looking
     up `admin_profiles`). A link is sent **only** when it returns true; the action returns
     the **same** neutral confirmation regardless of the result (FR-004, SC-002).
  2. **Confirm side** — after `verifyOtp` establishes the session, reuse
     `assertAdminSession()` (from 002). A non-admin recovery session is signed out and routed
     to the invalid-link state, so the change-password page is never usable by a non-admin
     (FR-010).
- **Rationale**: Today only admins exist in `auth.users` (002 R2), so `resetPasswordForEmail`
  is already neutral and admin-only by construction. The explicit `is_admin_email` gate makes
  the guarantee **survive the future student-auth feature** (when `role='student'` users will
  exist in `auth.users`) and makes US3 deterministically testable now. The SECURITY DEFINER
  RPC mirrors the existing `log_admin_auth_event` pattern, so the service-role key still never
  enters request code (002 R9 preserved).
- **Alternatives considered**:
  - *Call `resetPasswordForEmail` unconditionally* — rejected: once students are auth users
    it would email recovery links to non-admins, violating FR-003/FR-010.
  - *Look up admin status with the service-role client in the action* — rejected: 002
    deliberately confines the service-role key to the seed script; a SECURITY DEFINER RPC
    achieves the lookup without it.

## R4 — Route topology

- **Decision**:
  - `GET/POST /admin/forgot-password` — Server-Component page with a small client form
    island; its Server Action is `requestPasswordReset`.
  - `GET /admin/auth/confirm` — Route Handler: `verifyOtp` → admin check → redirect to
    `/admin/reset-password` (success) or `/admin/reset-password?error=link` (failure).
  - `GET/POST /admin/reset-password` — Server-Component page that renders the
    change-password form (client island) when a valid admin recovery session is present, or
    the invalid/expired-link state otherwise; its Server Action is `updateAdminPassword`.
  - The existing **"Forgot password?"** control in `AdminLoginForm` (currently a dead
    `<button type="button">`) becomes a `<Link href="/admin/forgot-password">`.
- **`proxy.ts` matcher stays `"/admin/dashboard/:path*"`** — unchanged. `/admin/forgot-password`,
  `/admin/auth/confirm`, and `/admin/reset-password` must be reachable **without** a normal
  admin session (the recovery session is established mid-flow), so they are intentionally
  outside the protected matcher. Their own admin gating is the `is_admin_email` RPC (request)
  and `assertAdminSession` (confirm).
- **Rationale**: Mirrors 002's separation of concerns (Server Action owns the mutation,
  Route Handler owns the cookie-setting exchange, page owns rendering). Keeping the confirm
  step a Route Handler is required because `verifyOtp` must **write** session cookies, which
  an RSC render cannot do.

## R5 — Invalidating other sessions on change (FR-012)

- **Decision**: After a successful `updateUser({ password })`, call
  `supabase.auth.signOut({ scope: 'global' })` and `redirect('/admin')`.
- **Rationale**: `scope: 'global'` revokes **all** refresh tokens for that administrator,
  so any other/previously-compromised session is invalidated (FR-012, SC-007); redirecting
  to the sign-in completes FR-013 (the admin then authenticates with the new password).
- **Alternatives considered**: *Default (`scope: 'local'`) sign-out* — rejected: leaves
  other sessions alive, failing FR-012. *Relying on a Supabase "revoke other sessions on
  password change" toggle* — used as defense-in-depth and noted in config, but the explicit
  global sign-out makes the guarantee code-level and testable.

## R6 — New-password validation (FR-007, SC-006)

- **Decision**: A new pure helper `validateNewPassword(password, confirm)` enforces, in
  order: both present → minimum length **8** → password equals its confirmation. It returns
  the same `{ ok } | { ok:false, error }` shape as 002's `validateLoginFields`, so the
  Server Action rejects before calling Supabase and the client form marks fields `required`.
- **Rationale**: Pure + deterministic = unit-testable (Principle II), matching 002's
  `lib/auth/adminGate.ts` discipline. Minimum length 8 is a sensible default ≥ Supabase's
  built-in minimum; the Supabase dashboard password policy should be set to match so server
  and platform agree (documented in quickstart).
- **Alternatives considered**: *Rely only on Supabase to reject weak passwords* — rejected:
  it cannot check the confirmation field and yields a less controllable message than our
  centralized copy.

## R7 — Rate limiting & abuse resistance (FR-014)

- **Decision**: Rely on **Supabase Auth's built-in rate limits** for
  `resetPasswordForEmail` (per-email and per-IP) and OTP verification, configured in the
  dashboard; do not build a custom limiter. The action still returns the neutral confirmation
  on every request.
- **Rationale**: GoTrue already throttles recovery email and token verification; a custom
  limiter would duplicate it and add state. Simplicity (CLAUDE.md guideline 2). The neutral
  response keeps timing/counting from revealing account existence.
- **Alternatives considered**: *Custom per-IP/email throttle table* — rejected as
  speculative; revisit only if abuse is observed.

## R8 — Audit of recovery events (FR-015)

- **Decision**: Reuse `public.admin_auth_events` and the `log_admin_auth_event` RPC. Migration
  `0003` **widens the CHECK constraints** to add recovery categories:
  `reason ∈ {…, 'reset_requested', 'reset_done', 'reset_invalid'}` and
  `outcome ∈ {'success','denied'}` (reusing existing outcomes). The actions log
  request-issued / reset-succeeded / reset-rejected. The reason is **never** returned to the
  client (preserves the neutral response) and **never** stores a password.
- **Rationale**: One audit surface for all admin-auth activity; the SECURITY DEFINER RPC
  already lets request code insert safely without the service-role key (002 R10).
- **Alternatives considered**: *A separate `password_reset_events` table* — rejected:
  unnecessary second audit surface for the same admin-auth concern.

## R9 — Absolute redirect URL & allow-listing (config)

- **Decision**: Add `NEXT_PUBLIC_SITE_URL` to build the absolute confirm URL; the Supabase
  project's **Auth → URL Configuration** must allow-list `${SITE_URL}/admin/auth/confirm`
  (plus `http://localhost:3000/admin/auth/confirm` for dev). The recovery email template is
  pointed at that route with `token_hash`/`type` (R2).
- **Rationale**: Supabase only redirects to allow-listed URLs; an un-listed redirect
  silently fails. Documented as explicit config so the flow works end-to-end.

## R10 — Applying schema/config: Supabase MCP or dashboard

- **Decision**: Migration `0003` and the Auth configuration (allow-listed redirect URL,
  recovery email template, password policy, rate limits) may be applied with the **Supabase
  MCP** (when connected) or the **Supabase dashboard** — the two are interchangeable.
  Quickstart documents the dashboard steps so the feature is reproducible without the MCP.
- **Rationale**: The MCP was offered "if needed"; it is a convenience for applying SQL/config,
  not a dependency. Keeping a dashboard path documented avoids coupling the feature to a
  session-only tool (it was not connected during planning).

---

**All NEEDS CLARIFICATION resolved.** No open unknowns remain for Phase 1.
