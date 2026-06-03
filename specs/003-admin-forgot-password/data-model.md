# Phase 1 Data Model: Admin Forgot Password & Reset

**Feature**: `003-admin-forgot-password` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

This feature adds **no new tables**. Recovery tokens are owned by Supabase Auth (GoTrue) —
unguessable, single-use, time-limited (R1) — and never modeled in our schema. The only
schema delta is migration `0003`: one helper function plus a widening of the existing audit
constraints. Everything else is reused from `002-admin-auth`.

## Schema delta (migration `0003_password_reset.sql`)

### 1. `public.is_admin_email(p_email text) → boolean` (NEW, SECURITY DEFINER)

The admin-only gate for the request side (R3). Lets the `requestPasswordReset` Server Action
decide whether an email belongs to an administrator **without** the service-role key — the
same trust pattern as the existing `log_admin_auth_event`.

| Property | Value |
|----------|-------|
| Arguments | `p_email text` |
| Returns | `boolean` — true iff a row exists in `admin_profiles` with `lower(email) = lower(p_email)` and `role = 'admin'` |
| Security | `SECURITY DEFINER`, `set search_path = public` |
| Grants | `execute` to `anon, authenticated`; `revoke all` from `public` first |

> Returns only a boolean — it never exposes admin rows, so it cannot be used to enumerate
> admins beyond the yes/no the request flow already (neutrally) acts on.

### 2. `public.admin_auth_events` CHECK widening (ALTER, R8)

No column changes. The `reason` and `outcome` CHECK constraints are dropped and re-created to
admit recovery categories alongside the existing sign-in ones:

| Column | Before (`002`) | After (`003`) |
|--------|----------------|---------------|
| `outcome` | `in ('success','denied')` | `in ('success','denied')` *(unchanged)* |
| `reason` | `in ('ok','bad_credentials','not_admin')` | `in ('ok','bad_credentials','not_admin','reset_requested','reset_done','reset_invalid')` |

The existing `log_admin_auth_event(p_email, p_outcome, p_reason)` RPC is reused as-is to
insert these rows.

## Recovery events written (FR-015)

| Trigger | `outcome` | `reason` | Notes |
|---------|-----------|----------|-------|
| A reset request is accepted (link issued — admin email) | `success` | `reset_requested` | logged regardless of send; never reveals to client |
| A reset request for a non-admin / unknown email | `denied` | `reset_requested` | still neutral to caller; distinguishes server-side only |
| Password successfully changed | `success` | `reset_done` | after `updateUser` + global sign-out |
| Confirm/verify or change rejected (invalid/expired/used link, non-admin recovery session) | `denied` | `reset_invalid` | reason never returned to client |

> The `reason` is recorded for traceability only and is **never** surfaced to the user — the
> client always sees the neutral confirmation or the generic invalid-link message
> (FR-004, FR-009).

## Reused entities (no change)

| Entity | Source | Role in this feature |
|--------|--------|----------------------|
| `auth.users` (GoTrue) | 002 | Holds the admin credential; `resetPasswordForEmail` targets it, `updateUser` rewrites `encrypted_password`, recovery tokens live here. Admins are the only members today. |
| `public.admin_profiles` | 002 | Looked up by `is_admin_email` to gate the request side. |
| `app_metadata.role = 'admin'` | 002 | Checked by `assertAdminSession` on the recovery session (confirm side) to keep the change-password page admin-only. |
| `public.admin_auth_events` | 002 | Audit sink (widened above). |

## Recovery token (Supabase-managed — modeled here only for clarity, not created by us)

| Attribute | Guarantee (enforced by GoTrue) | Spec link |
|-----------|--------------------------------|-----------|
| Unguessable | cryptographically random `token_hash` | FR-005 |
| Single-use | consumed on first successful `verifyOtp` | FR-005, SC-003 |
| Time-limited | expires after the configured recovery window | FR-005, SC-003 |
| Bound to one account | issued for exactly one `auth.users` row | FR-005 |

## Validation & state

- **Request email** (FR-002): `validateEmailField` (new pure helper) rejects empty/whitespace
  before any backend call; the form marks the field `required`.
- **New password** (FR-007): `validateNewPassword(password, confirm)` (new pure helper) — both
  present → length ≥ 8 → equals confirmation — rejects before `updateUser`; the form marks both
  fields `required`.
- **Recovery session state transition**:
  `unauthenticated → (valid recovery link via verifyOtp) → recovery session (admin) → (updateUser + global signOut) → unauthenticated → (sign in with new password) → admin session`.
  A **non-admin** recovery session never reaches the change-password form: it is signed out
  at the confirm step (R3) and an `reset_invalid` event is recorded.
