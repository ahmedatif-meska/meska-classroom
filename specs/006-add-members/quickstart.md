# Quickstart — Add Members

How to configure, run, and verify this feature locally. Assumes the 002–005 setup is already in
place (Supabase project, `.env.local`, bootstrap admin seeded).

## Prerequisites

- `.env.local` with (all already used by 002–005):
  - `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY` (server-only — backs the Admin API for member creation)
  - `NEXT_PUBLIC_SITE_URL` (e.g. `http://localhost:3000`) — base for QR + invite redirects
- Supabase **Auth → URL Configuration**: ensure `${NEXT_PUBLIC_SITE_URL}/student/auth/confirm` is
  an allowed redirect URL (alongside the existing `/admin/auth/confirm`).

## 1) Add the dependency

```bash
npm install qrcode
npm install -D @types/qrcode
```

## 2) Apply migration `0006`

Migrations are applied as raw SQL against the Supabase project (the `migrations` table is empty in
this project). Apply `supabase/migrations/0006_add_members.sql` via the Supabase SQL editor or
MCP `apply_migration`. It is additive + idempotent (`if not exists`, guarded seeds). Verify after:

- `public.students` has `user_id`, `email`, `whatsapp`, `status` and the `students_email_lower_key`
  unique index.
- `public.tenants` contains **Offline** and **Online**.
- `admin_auth_events` reason CHECK includes `member_created`, `member_reinvited`.

## 3) Configure the Supabase email templates (FR-017)

Members and admins use **different** built-in templates (Supabase allows one template per type,
so this is how they stay separate):

- **Admins** (004) keep the **Invite user** and **Reset Password** templates.
- **Members** onboard via the **Magic Link** template (admins never use magic links). Member
  provisioning calls `createUser` + `signInWithOtp` (`lib/members/create.ts`), which sends the
  **Magic Link** email.

In **Supabase → Auth → Email Templates → Magic Link**, set the link to the **token-hash** form so
opening it is inert (the member confirms on click) and it lands on the student confirm page, and
state that the login ID is the email:

```html
<p>Welcome to Meska Classroom. Your login ID is your email address.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Set your password</a></p>
```

`{{ .RedirectTo }}` resolves to the `emailRedirectTo` we pass (`/student/auth/confirm`). In
**Auth → URL Configuration → Redirect URLs**, allow `${NEXT_PUBLIC_SITE_URL}/student/auth/confirm`
(alongside the existing `/admin/auth/confirm`). For consistency, the admin **Invite**/**Reset
Password** templates should use the same token-hash form pointing at their own
`{{ .RedirectTo }}`.

## 4) Run

```bash
npm run dev      # http://localhost:3000
```

## 5) Verify the golden paths

**Admin — add a single member**
1. Sign in at `/admin`, open **Members** in the sidebar (`/admin/members`).
2. **Add Members → Add by form**; enter full name, WhatsApp, a fresh email; pick **Offline** or
   **Online**; submit → the member appears in the list as **pending**.
3. Confirm the onboarding email arrives (Supabase logs / inbox) with the set-password link.

**Member — onboard & sign in**
4. Open the invite link → `/student/auth/confirm` → **Continue** → `/student/set-password`; set a
   policy-compliant password → redirected into the student panel.
5. Sign out, return to `/student`, sign in with the **email + password** → `/student/dashboard`.
6. On the dashboard, confirm the **QR code** renders.

**Scan → member info (admin-only)**
7. Open the QR target `${SITE_URL}/admin/members/<id>` while signed in as admin → the member's
   details render. Open it signed out (or as the member) → redirected to `/admin` (no PII).

**Bulk upload**
8. **Members → Download CSV template**; fill several valid rows. **Add Members → Bulk upload**,
   upload, confirm the wave, submit → all rows become pending members, each invited.
9. Upload a file with a **blank cell** → the whole upload is rejected with the offending row noted;
   nothing is created.

## 6) Quality gates (constitution)

```bash
npm run build      # TS strict + production build clean
npm run lint       # ESLint clean
npm test           # Vitest — incl. cross-wave/role denial coverage
```

Then validate responsiveness/a11y at **320 / 390 / 430 / 768 / desktop**: the members list uses a
card transform `< sm`, the add-members modal scrolls internally, inputs are ≥16px, focus is
visible, and there is no page-level horizontal scroll. Confirm CWV (LCP/CLS/INP) shows no
regression on a mid-tier Android over Slow-4G (the QR is an inline SVG → no layout shift).

## Notes

- The **service-role key** is used only server-side, only inside the member-creation actions,
  and only after `assertAdminSession` — it never reaches client/request-rendered output.
- **No Storage bucket** is needed (QR is rendered inline). There is no `next.config.ts` change.
- Member **removal** is supported (admin-only, trash action per row → confirm →
  deletes the auth user, cascading the students row). Member **editing** remains
  out of scope for this feature.
