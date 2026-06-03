# Walkthrough: Admin Authentication & Account Separation

**Feature**: `002-admin-auth` | **Branch**: `002-admin-auth`

Covers Phase 1 (identity foundation) and Phase 2 (admin login). A reviewer should be able to
follow this end-to-end. Offline verification (tests/build/lint) is fully automated; the live
Supabase steps require the dashboard and rotated keys (see "Live setup").

---

## How to run

### Offline (no backend) — verifies the logic, gate, validation, and protection

```bash
npm install
npm run lint     # clean
npm test         # 53 pass, 3 integration skipped (no creds)
npm run build    # clean (no deprecation warnings)
```

### Live setup (to actually sign in against Supabase) — requires the dashboard

1. **Rotate** the leaked service-role key, anon key, and admin password (Supabase → Settings → API). *(blocker, task T027)*
2. Create `.env.local` from `.env.example` with the rotated values.
3. Apply migrations: run `supabase/migrations/0001_init_identity.sql` then `0002_rls_policies.sql` in the Supabase **SQL Editor**.
4. Seed the admin: `npm run seed:admin` → `Created admin ahmedatif@meska.ai.` (re-run → `Admin already exists — skipping`).
5. `npm run dev` → open `http://localhost:3000/admin`.

---

## Implemented features (route / component paths)

| Capability | Path |
|------------|------|
| Admin sign-in form (required fields, error alert, pending state) | `components/AdminLoginForm.tsx` rendered by `app/admin/page.tsx` |
| Sign-in / sign-out Server Actions (verify, admin gate, audit, redirect) | `app/admin/actions.ts` |
| Admin-only authorization + mandatory-field logic (pure) | `lib/auth/adminGate.ts` |
| Route protection (refresh session, guard `/admin/dashboard`) | `proxy.ts` |
| Supabase clients (browser / server / service-role-seed) | `lib/supabase/{client,server,admin}.ts` |
| Schema + RLS (tenants, admin_profiles, students, admin_auth_events) | `supabase/migrations/0001_init_identity.sql`, `0002_rls_policies.sql` |
| Idempotent bootstrap-admin seeding | `scripts/seed-admin.ts` (`npm run seed:admin`) |
| Sign-out control | `app/admin/dashboard/page.tsx` |

---

## Golden-path verification (numbered)

Run on **desktop** and **mobile** (validate at 320 / 390 / 430 / 768px and desktop —
Principle IV). After live setup:

1. Open `/admin` → the branded sign-in card renders; both fields show, ≥16px on mobile, with visible focus on tab.
2. Submit **empty** → blocked before any network call; required-field message appears (US3). *(also offline: `validateLoginFields` + form tests)*
3. Submit the **admin** email + correct password → redirected to `/admin/dashboard`; the sign-out control is visible (US1).
4. Click **Sign out** → returned to `/admin`; revisiting `/admin/dashboard` directly redirects back to `/admin` (US1 / route protection).
5. Submit a **student** credential, a **wrong password**, and an **unknown email** → each denied with the **identical** generic message "Invalid credentials or insufficient access."; no session is created (US2 / no enumeration).
6. At 320px → no horizontal scroll, clipping, or overlap; the error region is announced (`role="alert"`).

**Data-layer checks (live):** with the integration env set, `npm test` exercises
`tests/integration/rls.test.ts` (tenant-A claim returns zero tenant-B rows; anon cannot read
`admin_profiles`) and `tests/integration/seedAdmin.test.ts` (one admin profile, role `admin`,
`full_control`).

---

## Known gaps (and where they land)

- **Live migration apply + seed + key rotation** (T026/T027) are manual/dashboard steps; they require credentials this environment does not hold. The code, migrations, and seed script are complete and verified offline.
- **Student authentication** (email/JWT for students, the `tenant_id` JWT claim wiring) is **out of scope** here. The `students` table and tenant RLS ship now so separation/isolation are real and testable; the live cross-tenant *student-session* denial attaches to the future **student-auth** feature (as 001 deferred wave tests).
- **Manual responsive/a11y sign-off** (T026) must be performed on devices/viewports before final sign-off.
- **Password reset** ("Forgot password?") is a non-functional placeholder carried over from the 001 UI.
