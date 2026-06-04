# Research — Add Members (Phase 0)

Decisions that resolve the unknowns in the plan's Technical Context. Each is **Decision /
Rationale / Alternatives**. Grounded in the live 002/003/004/005 codebase (Supabase Cloud,
cookie/RLS + service-role patterns, `auth.users`-backed identities, JWT `app_metadata` claims).

---

## R1 — A member is an `auth.users` user + an evolved `public.students` row

**Decision**: Each member is provisioned as a real Supabase Auth user **and** a `public.students`
row linked by a new `user_id` FK. The `students` table is evolved (migration `0006`) with
`user_id uuid unique references auth.users(id) on delete cascade`, `email text`, `whatsapp text`,
`status text not null default 'pending' check (status in ('pending','active'))`, and a unique
index on `lower(email)`. The existing `full_name` and `tenant_id` columns are reused; the legacy
`student_code` (NOT NULL, unique within tenant) is satisfied by setting `student_code := email`
at insert (no destructive constraint change).

**Rationale**: Members must authenticate (email + password, clarified), so they need `auth.users`
rows — exactly the model `admin_profiles` uses (PK = `auth.users.id`). The 0001 migration created
`students` as the roster and noted "full student/wave domain lands in a later feature" — this is
that feature, so evolving `students` (rather than inventing a parallel table) keeps one roster.

**Alternatives**: A new `student_profiles` table 1:1 with `auth.users` (rejected: splits the
roster from the existing `students` table for no gain). Keeping members non-authenticated like
today (rejected: contradicts the email+password clarification).

---

## R2 — A "wave" is a `public.tenants` row (reuse the existing isolation boundary)

**Decision**: Model a wave as a `tenants` row. Seed two: **Offline** and **Online**. A member's
wave is `students.tenant_id`. Wave isolation is enforced by the **existing** `students` RLS
(`is_admin() OR tenant_id = jwt_tenant_id()`) and the `jwt_tenant_id()` function — both built in
0002 and explicitly annotated "wired up by the future student-auth feature." The member's JWT
carries `app_metadata.tenant_id = <waveId>` (set at creation), so `jwt_tenant_id()` resolves their
wave. The wave dropdown reads `tenants` (admins may select all via `tenants_select`). A future
"create wave" tab inserts `tenants` rows with **no** redesign here.

**Rationale**: The constitution's wave/cohort isolation maps one-to-one onto the tenant boundary
already implemented and (per 002) tested. Reusing it means **zero new RLS** and no second copy of
the NON-NEGOTIABLE isolation mechanism. 0002's own comments anticipated this exact wiring.

**Alternatives**: A separate `waves` table + `wave_id` column + a new `jwt_wave_id()` claim + new
RLS policies (rejected: duplicates the entire tested isolation primitive for no behavioral
difference, doubling the surface of a NON-NEGOTIABLE boundary). ⚠️ **Flagged to the user** in the
plan report: "wave == tenant row" is the load-bearing modeling choice; if Meska intends `tenant`
to mean a customer org distinct from a cohort, switch to the rejected alternative before tasks.

---

## R3 — Student role claim + dual-surface route protection

**Decision**: Members get `app_metadata = { role: 'student', tenant_id: <waveId> }`.
`assertAdminSession` (role === 'admin') continues to keep members out of every admin surface and
out of the admin-only member-info page. Add `assertStudentSession` (authenticated, role !==
'admin'). Refactor `proxy.ts` to branch by path group: admin matchers
(`/admin/dashboard`, `/admin/admins`, `/admin/instructors`, **`/admin/members`**) require
role === 'admin' (redirect → `/admin`); a new student matcher (`/student/dashboard/:path*`)
requires an authenticated student (redirect → `/student`).

**Rationale**: Keeps the admin gate unchanged and non-bypassable; members never gain admin
powers; route protection stays server-side (Principle VI). The proxy already validates the JWT
with `getUser()` — only the branching is new.

**Alternatives**: One role for all authenticated users (rejected: can't keep the member-info page
admin-only). Client-side student guarding (rejected: must be server-enforced).

---

## R4 — Onboarding + set-password flow under `/student` (reuse Supabase Auth invite)

**Decision**: Reuse `inviteUserByEmail` (service-role) with
`redirectTo = ${NEXT_PUBLIC_SITE_URL}/student/auth/confirm` and `data: { full_name, whatsapp }`.
Add `/student/auth/confirm` (interstitial — token consumed only on an explicit click, mirroring
`confirmPasswordReset` so inbox prefetch never burns the token) + `confirmStudentInvite`
(`verifyOtp` for `invite`/`recovery`, then assert the session is **not** an admin) →
`/student/set-password` + `setStudentPassword` (`validateNewPassword` → `updateUser({password})`
→ set `students.status = 'active'` → redirect to the student panel). Re-send uses
`resetPasswordForEmail` (same primitive as `resendInvite`).

**Rationale**: Identical, proven mechanics to 003/004; only the redirect target and the
post-confirm gate differ (student instead of admin). Supabase Auth owns the single-use,
time-limited tokens (FR-019).

**Alternatives**: A custom token table + bespoke emails (rejected: re-implements what Supabase
Auth already provides securely; 003/004 precedent).

---

## R5 — QR generation: local inline SVG via `qrcode`, encoding the member-info URL

**Decision**: The QR encodes `${NEXT_PUBLIC_SITE_URL}/admin/members/<studentId>`. Render it as an
inline **SVG** server-side with the `qrcode` library (`QRCode.toString(url, { type: 'svg' })`),
at render time on the student home (and a small QR may also appear on the member-info page). No QR
image is persisted — the URL is derivable from the member id.

**Rationale**: A QR matrix needs a vetted encoder. Inline SVG means no extra network request, no
layout shift (dimension-reserved), and **no member URL is sent to a third-party** image host. The
user's Google-Sheet/`api.qrserver.com` formula is the conceptual reference (build a QR from member
data) — not a runtime requirement.

**Alternatives**: `api.qrserver.com` image URLs (rejected: external runtime dependency on every
render; leaks the member-info URL to a third party; extra remote-image host + round-trip — worse
reliability/privacy/CWV). Base64 data-URL persisted on the row (rejected: row/payload bloat). A
hand-rolled encoder (rejected: error-prone EC/matrix math). → **Complexity Tracking** (one
dependency: `qrcode` + `@types/qrcode`).

---

## R6 — CSV parsing & validation: server-side, dependency-free

**Decision**: Parse and validate the uploaded CSV **server-side** in `bulkCreateMembers` (the
trust boundary) using a small, tested parser in `lib/members/csv.ts` for the fixed 3-column
template (full name, WhatsApp number, email), handling quoted fields and embedded commas. The
file is rejected **wholesale** if any required cell is empty/whitespace-only or any email is
malformed (FR-012); existing-member and in-file duplicate emails are reported and skipped
(FR-015). The client may pre-parse the same module for fast feedback, but the server re-validates.
The downloadable template is a **static** `public/members-template.csv` whose header matches the
validator exactly (SC-010).

**Rationale**: A fixed, controlled 3-column format does not justify a heavy CSV dependency; a
~40-line tested parser covers quoting. Server-side keeps validation non-bypassable (Principle VI).

**UI strategy (R6-ui)**: the members list is a data-heavy view → **card transform below `sm`**
(the 005 instructors pattern), table at `sm`+; the add-members modal scrolls internally.

**Alternatives**: `papaparse` (rejected: dependency overkill for a fixed template). Client-only
validation (rejected: must be server-enforced).

---

## R7 — Shared `provisionMember` helper for single + bulk

**Decision**: Factor creation into `lib/members/create.ts` `provisionMember({ fullName, email,
whatsapp, waveId })`: `inviteUserByEmail` → `updateUserById` claims → insert `students` row →
return `{ memberId, inviteFailed }`. `createMember` calls it once; `bulkCreateMembers` loops it
per validated row (tens of members; bounded), collecting per-row invite outcomes. A per-row invite
dispatch failure does not abort already-created rows; it is reported so those members can be
re-invited (FR-027).

**Rationale**: One creation path → one place to test the claims/insert/invite contract; bulk is
just the loop.

**Alternatives**: Duplicating the create logic in both actions (rejected: drift risk).

---

## R8 — Audit member provisioning in `admin_auth_events`

**Decision**: Widen the `admin_auth_events` reason CHECK to add `member_created` and
`member_reinvited`. Member provisioning is an admin action, audited via the existing
`log_admin_auth_event` RPC (best-effort, never blocks, never surfaced to the client) — same as
`admin_created`/`admin_reinvited`.

**Rationale**: Reuses the existing audit channel and trust pattern; no new table.

**Alternatives**: A separate `member_events` table (rejected: premature; one audit channel
suffices for now). Student **sign-in** auditing is out of scope this feature (kept minimal).

---

## R9 — Member email uniqueness (case-insensitive, trimmed)

**Decision**: Email is globally unique — enforced by `auth.users` (one user per email) **and** a
`lower(email)` unique index on `students`. The create action pre-checks an existing member by
`students` lookup on `lower(email)` (the admin caller's `is_admin()` RLS permits the read) and
rejects duplicates before inviting (FR-009); bulk additionally rejects in-file duplicates
(FR-015). All matching is trimmed + lower-cased, matching the admin convention (FR-025).

**Rationale**: Mirrors the 002/004 email handling; no new RPC needed (admins can already read
`students`).

**Alternatives**: An `is_member_email` SECURITY DEFINER RPC like `is_admin_email` (rejected:
unnecessary — the duplicate check runs as an authenticated admin who can read `students` directly;
the non-enumeration concern that motivated `is_admin_email` does not apply to an admin-only flow).

---

## R10 — Bounded reads

**Decision**: The members list reads `students` ordered by `created_at desc`, bounded
(capped/paginatable); pagination UI is deferred (tens–low-hundreds expected). The student home
reads a single own-row (`eq('user_id', auth.uid())`). The member-info page reads one row by id.

**Rationale**: Principle V (bounded wave-scoped reads); current scale is small.

---

## R11 — Pure validation helpers

**Decision**: `lib/members/validation.ts` exposes `validateMemberFields(fullName, whatsapp,
email, waveId)` (all required, trimmed, non-blank; email syntactically valid; waveId one of the
known waves) returning the 002-style `{ ok } | { ok:false, error }`. Password validation reuses
`validateNewPassword` from `lib/auth/passwordReset`. `lib/auth/studentGate.ts` exposes
`validateStudentLoginFields` (email + password mandatory) and `assertStudentSession`. All are
Supabase/Next-free so they are deterministically unit-testable.

**Rationale**: Matches the 002/004 "pure helpers in `lib/`" discipline; enables the
NON-NEGOTIABLE test coverage without integration plumbing.

---

## R12 — Data-security controls (first PII / first student-session feature)

**Decision** (satisfying the constitution VI bootstrapping clause, recorded here and in the plan):

- **PII**: full name, email, WhatsApp live in `students` behind RLS; never readable by anon; the
  member-info page is admin-only; the QR encodes only an opaque member-id URL (no PII in the QR).
- **In transit**: HTTPS everywhere (app + Supabase). **At rest**: Supabase-managed encryption.
- **Auth/session**: Supabase Auth; httpOnly cookies; immutable `app_metadata` claims (`role`,
  `tenant_id`); the app never stores passwords; invite/reset tokens are single-use + time-limited
  and owned by Supabase Auth.
- **Within-wave visibility**: the existing `students_select` policy lets a tenant-scoped caller
  read rows in their **own** wave (002's documented design). This feature only surfaces a member's
  **own** row on the home; it does not display wave-mates. If students must be barred from reading
  wave-mates at the API level, that is a recorded **optional follow-up** (tighten `students_select`
  to `... AND user_id = auth.uid()` for non-admins) — not required by this spec, which mandates
  **cross-wave** denial (satisfied).
- **Retention**: member rows persist for the cohort lifetime; member **removal** is out of scope
  this feature.
- **Audit**: `member_created` / `member_reinvited` in `admin_auth_events`.

**Rationale**: This is the first feature touching student PII and issuing student sessions, so the
controls are stated explicitly per Principle VI rather than deferred.
