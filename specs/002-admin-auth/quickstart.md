# Quickstart: Admin Authentication & Account Separation

**Feature**: `002-admin-auth` | **Date**: 2026-06-03 | **Plan**: [plan.md](./plan.md)

How to configure, seed, run, and verify this feature. Assumes the repo deps from 001 are
installed (`npm install`).

## 0. ⚠️ Rotate the leaked secrets first

The Supabase service-role key, anon key, and the admin password shared in chat must be
treated as compromised. In the Supabase dashboard → **Settings → API**, rotate the keys;
choose a fresh admin password (set it via `SEED_ADMIN_PASSWORD`). Use the new values below.
Never commit them.

## 1. Install the new dependencies

```bash
npm install @supabase/supabase-js @supabase/ssr
```

## 2. Configure environment

Create `.env.local` (git-ignored) from `.env.example`:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://fghcfihgfgqoodylwcks.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<rotated anon key>
SUPABASE_SERVICE_ROLE_KEY=<rotated service-role key>   # server-only, seed script
SEED_ADMIN_PASSWORD=<chosen admin password>             # server-only, seed script
```

## 3. Apply the database migrations

Open the Supabase dashboard → **SQL Editor**, and run the migration files in
`supabase/migrations/` in order (or `supabase db push` if the CLI is installed). This
creates `tenants`, `admin_profiles`, `students`, `admin_auth_events` and enables their RLS
policies.

## 4. Seed the bootstrap administrator

```bash
npm run seed:admin
```

Expected: `Created admin ahmedatif@meska.ai` (first run) or `Admin already exists — skipping`
(subsequent runs — idempotent).

## 5. Run the app

```bash
npm run dev    # http://localhost:3000/admin
```

## 6. Verify the golden path & guarantees

Sign-in surface is `/admin`.

| # | Action | Expected |
|---|--------|----------|
| 1 | Submit correct admin email + password | Redirect to `/admin/dashboard`; admin session set (US1) |
| 2 | Visit `/admin/dashboard` directly while signed out | Redirected to `/admin` (US1 / FR-010) |
| 3 | Submit a **student** credential (seed a non-admin auth user) | Denied, generic message, no session (US2) |
| 4 | Submit correct email + **wrong** password | Denied, **same** generic message (US2 / SC-006) |
| 5 | Submit an unknown email | Denied, **same** generic message (US2 / SC-006) |
| 6 | Submit with empty email and/or empty password | Blocked before any network call; required-field message (US3) |
| 7 | Sign out | Session cleared; `/admin/dashboard` again redirects to `/admin` |

**Responsive/a11y (per Principle IV — manual, for the phase walkthrough)**: verify the admin
login and dashboard at **320 / 390 / 430 / 768px and desktop** — no horizontal scroll/clip/
overlap; inputs ≥16px on mobile; visible focus on both fields and the submit button; the
generic error is announced (`role="alert"`).

## 7. Run the tests

```bash
npm test
```

- **Unit/component (deterministic, mocked Supabase)**: admin-role gate (allow admin; deny
  student / wrong-password / unknown-email → identical generic message); mandatory-field
  validation; the login Server Action's success-redirect and denial paths; the form's
  `required` inputs.
- **RLS / isolation (integration tier, gated behind env creds, self-cleaning)**: a tenant-A
  claim returns zero tenant-B rows (SC-005); a `students` read returns no admin row and an
  `admin_profiles` read returns no student (SC-004); admin bypass returns rows. See the test
  file header for how to enable it (requires `.env.local`).

## Troubleshooting

- **"Invalid credentials or insufficient access" for a known admin** → confirm the seed ran
  and `app_metadata.role` is `'admin'` (Auth → Users → the user → metadata).
- **Dashboard never loads / redirect loop** → check middleware matcher and that cookies are
  `Secure` only over HTTPS (locally they are `SameSite=Lax`, non-Secure on `http://localhost`).
- **RLS test returns rows it shouldn't** → re-check the policy `USING` clauses against
  [data-model.md](./data-model.md).
