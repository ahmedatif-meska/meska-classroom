# Walkthrough — Add Members

One section per implemented phase (Principle VII). Covers how to run it, what shipped (with
route/component paths), numbered golden-path verification on desktop **and** mobile, and known
gaps. Automated gates at time of writing: `npm test` (47 files, 208 passed / 3 skipped),
`npm run lint` (clean), `npm run build` (clean).

## How to run

1. `npm install` (adds `qrcode`).
2. Apply `supabase/migrations/0006_add_members.sql` (done on project `fghcfihgfgqoodylwcks`;
   `tenants` now holds **Offline** + **Online**; `students` has `user_id/email/whatsapp/status`).
3. Supabase Auth → URL Configuration: allow `${NEXT_PUBLIC_SITE_URL}/student/auth/confirm`;
   customize the **Invite user** email template to state the login ID is the recipient's email.
4. `npm run dev` → http://localhost:3000. Sign in at `/admin` as the seeded admin.

---

## Phase 1 — Members page: navigation, list, template & schema

**Shipped**: migration `0006` (`supabase/migrations/0006_add_members.sql`); the **Members** nav
item (`lib/adminNav.tsx`); `/admin/members` list (`app/admin/members/page.tsx`) →
`components/MemberTable.tsx` (contained-horizontal-scroll table) + `components/DownloadTemplateButton.tsx`
+ `components/AddMembersModal.tsx`; static template `public/members-template.csv`; proxy matcher
`/admin/members/:path*` (`proxy.ts`).

**Verify (desktop)**:
1. Sidebar shows **Members** → click → `/admin/members`.
2. With no members, the empty state shows; **Add Members** (top-right) and **Download CSV template** are present.
3. Click **Download CSV template** → a CSV with header `Full Name,WhatsApp Number,Email` downloads.
4. Sign out; visit `/admin/members` directly → redirected to `/admin`.

**Verify (mobile, 320–430px)**: the sidebar collapses to the drawer; the members table scrolls
**inside its wrapper** (swipe) with no page/body sideways scroll; the header keeps **Add Members**
its natural size beside the truncating title.

---

## Phase 2 — Add a single member: form, QR identity & onboarding email

**Shipped**: `lib/members/validation.ts`, `lib/members/qr.ts` (`memberInfoUrl`),
`lib/members/create.ts` (`provisionMember`), `app/admin/members/actions.ts`
(`createMember`, `resendMemberInvite`), the single-form path + chooser in
`components/AddMembersModal.tsx`, `components/ResendMemberButton.tsx`.

**Verify (desktop)**:
1. **Add Members → Add by form**: enter full name, WhatsApp, a fresh email, pick **Offline**/**Online**, submit → member appears as **Pending**.
2. Confirm the onboarding email is dispatched (Supabase Auth logs / inbox).
3. Re-submit the same email → "already exists" error, no duplicate.
4. Submit with a blank field or bad email → blocked, nothing created.
5. On a pending row, **Resend invite** issues a fresh link; an active member shows no resend.

**Verify (mobile)**: the modal scrolls internally and traps focus; inputs are ≥16px (no iOS zoom).

---

## Phase 3 — Member onboarding & student login (email + password)

**Shipped**: `lib/auth/studentGate.ts`; `app/student/actions.ts` (`signInStudent`,
`confirmStudentInvite`, `setStudentPassword`, `signOutStudent`); `components/StudentLoginForm.tsx`,
`components/StudentSetPasswordForm.tsx`; reworked `app/student/page.tsx`;
`app/student/auth/confirm/page.tsx`, `app/student/set-password/page.tsx`; proxy student branch
(`proxy.ts`).

**Verify**:
1. Open the invite link → `/student/auth/confirm` → **Continue** → `/student/set-password`.
2. Set a password (≥8, matching) → land in the student panel.
3. Sign out; at `/student` sign in with **email + password** → `/student/dashboard`.
4. A pending member (no password) cannot sign in; an expired/used link shows the invalid-link state.
5. Visit `/student/dashboard` signed out → redirected to `/student`.

---

## Phase 4 — QR on the student home + admin member-information page

**Shipped**: `renderQrSvg` (`lib/members/qr.ts`), `components/MemberQrCode.tsx`, the QR section in
`app/student/dashboard/page.tsx`, `app/admin/members/[id]/page.tsx`.

**Verify**:
1. As a signed-in member, the home shows the QR (inline SVG, dimension-reserved).
2. Scan/open the QR target `/admin/members/<id>` as an admin → that member's details render.
3. Open it signed out / as a member → redirected to `/admin` (no PII). Unknown id → not-found.

---

## Phase 5 — Bulk upload members via CSV

**Shipped**: `lib/members/csv.ts` (`parseAndValidateMembersCsv`), `bulkCreateMembers`
(`app/admin/members/actions.ts`), the bulk path (upload → server-validated → wave-confirm → submit)
in `components/AddMembersModal.tsx`.

**Verify**:
1. **Add Members → Bulk upload**, upload a filled template, **Continue** → wave-confirm step → **Create members** → all rows become pending members in the chosen wave, each invited.
2. Upload a file with a **blank cell** → rejected wholesale with the offending row noted; nothing created.
3. Upload duplicates (in-file or existing) → reported as skipped; non-duplicates still created.

---

## Known gaps / reviewer steps

- **Manual responsive/a11y pass (Quality Gate 3)** at 320/390/430/768/desktop, and the **mobile
  CWV** check (Slow-4G), are reviewer steps — the code follows the documented patterns
  (`learning.md`): contained-scroll table, internally-scrolling modal, ≥16px inputs, inline-SVG QR
  (no CLS).
- **Email template copy** (login-ID-is-email) is an operator config step (quickstart §3); verify in the inbox.
- **Member removal/editing** is intentionally out of scope for this feature.
- **Within-wave read**: students read only their own row in the UI; tightening `students_select`
  to self-only for non-admins is an optional follow-up (research R12) — cross-wave denial holds.
