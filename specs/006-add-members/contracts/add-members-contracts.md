# Contracts — Add Members (Phase 1)

Interface contracts for the feature: Server Actions, pure helpers, pages/components, proxy/config,
copy, and the test matrix. Mirrors the 002/004/005 conventions (cookie/RLS client for reads +
row writes; service-role Admin API only after `assertAdminSession`; `{ ok } | { ok:false, error }`
validators; `useActionState` client islands; all copy via `lib/strings.ts`).

---

## C1 — Server Actions (`app/admin/members/actions.ts`) — gated, admin-only

```ts
export type CreateMemberState   = { error?: string; created?: boolean; inviteFailed?: boolean };
export type ResendMemberState   = { error?: string; sent?: boolean };
export type BulkResultRow       = { row: number; email: string; created: boolean; reason?: string };
export type BulkCreateState     = {
  error?: string;                 // hard, whole-file failure (validation / gate) — nothing created
  results?: BulkResultRow[];      // per-row outcomes on a processed file
  createdCount?: number;
};

createMember(prev, formData): Promise<CreateMemberState>
bulkCreateMembers(prev, formData): Promise<BulkCreateState>
resendMemberInvite(prev, formData): Promise<ResendMemberState>
```

**`createMember`** (US2): `assertAdminSession` (else `strings.memberMgmtForbidden`) →
`validateMemberFields(full_name, whatsapp, email, wave_id)` → reject existing email via
`students` lookup on `lower(email)` (`strings.memberMgmtEmailInUse`, FR-009) →
`provisionMember(...)` (C3) → `logEvent(..., 'member_created')` →
`revalidatePath('/admin/members')` → `{ created: true, inviteFailed }`. The service-role Admin
API runs **only** inside `provisionMember`, after the gate.

**`bulkCreateMembers`** (US5): `assertAdminSession` → read the uploaded file + `wave_id` from
`formData` → `parseAndValidateMembersCsv(text)` (C4) **server-side**; on `ok:false` return
`{ error }` and create nothing (FR-012) → else loop `provisionMember` per row into `wave_id`,
collecting `BulkResultRow[]` (existing/in-file-duplicate emails → `created:false` with a reason,
FR-015) → audit → `revalidatePath` → `{ results, createdCount }`.

**`resendMemberInvite`** (US2/FR-026): `assertAdminSession` → load target `students` row by id →
require `status === 'pending'` (else `strings.memberMgmtResendNotPending`) →
`supabase.auth.resetPasswordForEmail(email, { redirectTo: ${SITE_URL}/student/auth/confirm })` →
`logEvent(..., 'member_reinvited')` → `{ sent: true }`.

**Denial contract (all three)**: a missing/non-admin session returns the forbidden state
**before** any Admin-API call or write (FR-028) — tested.

---

## C2 — Student Server Actions (`app/student/actions.ts`)

```ts
export type StudentSignInState   = { error?: string };
export type SetStudentPwState    = { error?: string };

signInStudent(prev, formData): Promise<StudentSignInState>      // signInWithPassword → assertStudentSession → redirect /student/dashboard
confirmStudentInvite(formData): Promise<void>                   // verifyOtp(invite|recovery) on click → assert NOT admin → redirect /student/set-password
setStudentPassword(prev, formData): Promise<SetStudentPwState>  // validateNewPassword → updateUser({password}) → students.status='active' → redirect
signOutStudent(): Promise<void>                                 // signOut → redirect /student
```

- **`signInStudent`** (FR-021): `validateStudentLoginFields` → `signInWithPassword` → if error or
  the session is an **admin** (`assertStudentSession` fails / role==='admin'), sign out + return
  `strings.studentAuthFailed` (a `pending` member with no password naturally fails here, FR-020) →
  `redirect('/student/dashboard')`.
- **`confirmStudentInvite`** (FR-018/FR-019): mirrors `confirmPasswordReset` — token consumed only
  on the explicit "Continue" click (no passive GET); `type` is `invite` or `recovery`; on any
  failure or an **admin** session, sign out and land on the invalid-link state; else redirect to
  `/student/set-password`.
- **`setStudentPassword`** (FR-018): require a valid non-admin recovery/invite session →
  `validateNewPassword(password, confirm)` → `updateUser({ password })` → set the member's
  `students.status = 'active'` (by `user_id = auth.uid()`) → redirect to `/student/dashboard`
  (signed in) or `/student`.

---

## C3 — Shared creation helper (`lib/members/create.ts`) — server

```ts
type ProvisionInput  = { fullName: string; email: string; whatsapp: string; waveId: string };
type ProvisionResult = { memberId: string; inviteFailed: boolean } | { error: string };

provisionMember(admin, supabase, input): Promise<ProvisionResult>
```

Steps (research R7): `admin.auth.admin.inviteUserByEmail(email, { redirectTo:
${SITE_URL}/student/auth/confirm, data: { full_name, whatsapp } })` → on no user, map
already-registered → `{ error: emailInUse }` else `{ error: inviteFailed }` →
`admin.auth.admin.updateUserById(id, { app_metadata: { role:'student', tenant_id: waveId } })` →
`admin.from('students').insert({ user_id:id, email, whatsapp, full_name, tenant_id: waveId,
student_code: email, status:'pending' })` → `{ memberId, inviteFailed: Boolean(inviteErr) }`.
Used once by `createMember`, per-row by `bulkCreateMembers`.

---

## C4 — Pure helpers (`lib/members/*`, `lib/auth/studentGate.ts`)

```ts
// lib/members/validation.ts
type FieldValidation = { ok: true } | { ok: false; error: string };
validateMemberFields(fullName, whatsapp, email, waveId): FieldValidation   // all required, trimmed, non-blank; email valid; waveId non-empty
isValidEmail(value: string): boolean

// lib/members/csv.ts  (dependency-free, server-side trust boundary)
type CsvRow = { fullName: string; whatsapp: string; email: string };
type CsvResult =
  | { ok: true; rows: CsvRow[] }
  | { ok: false; error: string; badRows?: number[] };   // any blank/whitespace cell or malformed email → ok:false (FR-012)
parseAndValidateMembersCsv(text: string): CsvResult       // parses the fixed 3-col template incl. quoted fields; flags in-file duplicate emails

// lib/members/qr.ts
memberInfoUrl(id: string): string                         // `${NEXT_PUBLIC_SITE_URL}/admin/members/${id}`
renderQrSvg(url: string): Promise<string>                 // QRCode.toString(url, { type:'svg' })

// lib/auth/studentGate.ts  (no Supabase/Next imports)
validateStudentLoginFields(email, password): FieldValidation
assertStudentSession(session): { ok: true } | { ok: false; reason: 'not_student' }   // authenticated AND role !== 'admin'
```

`validateNewPassword` is **reused** from `lib/auth/passwordReset.ts` (no new password validator).

---

## C5 — Pages & components

| Path | Kind | Responsibility |
|------|------|----------------|
| `app/admin/members/page.tsx` | RSC | List `students` (+ wave name) via cookie/RLS, `created_at desc`; `MemberTable`, `AddMembersModal`, `DownloadTemplateButton`; empty state. |
| `app/admin/members/loading.tsx` | RSC | List loading skeleton. |
| `app/admin/members/[id]/page.tsx` | RSC | Admin-only member-info (full name, WhatsApp, email, wave, status); not-found state. Proxy-gated. |
| `app/student/page.tsx` | RSC shell | Renders `StudentLoginForm` (replaces the placeholder join form). |
| `app/student/auth/confirm/page.tsx` | RSC | Invite/recovery interstitial → posts to `confirmStudentInvite`. |
| `app/student/set-password/page.tsx` | RSC shell | Renders `StudentSetPasswordForm`; invalid-link state via `?error=link`. |
| `app/student/dashboard/page.tsx` | RSC | Reads own `students` row; renders `MemberQrCode` (or placeholder) + sign-out. |
| `components/MemberTable.tsx` | Server | `<table>` at `sm`+, **card transform `< sm`**; `data-member-row` hook; per-row resend (pending) + a link to the info page. |
| `components/AddMembersModal.tsx` | Client | `useActionState`; chooser (form \| bulk); single form (name/whatsapp/email/wave); bulk (file → server-validate → wave-confirm → submit); states per Constitution III. |
| `components/MemberQrCode.tsx` | Server | Inline QR SVG from `renderQrSvg(memberInfoUrl(id))`; dimension-reserved; placeholder when no member. |
| `components/DownloadTemplateButton.tsx` | Server | Link to `/members-template.csv`. |
| `components/StudentLoginForm.tsx` | Client | Email+password; `useActionState(signInStudent)`; ≥16px inputs (mirrors `AdminLoginForm`). |
| `components/StudentSetPasswordForm.tsx` | Client | Password+confirm; `useActionState(setStudentPassword)` (mirrors `ResetPasswordForm`). |

---

## C6 — Proxy & config

- **`proxy.ts`**: refactor to branch by path. Admin matchers
  (`/admin/dashboard`, `/admin/admins`, `/admin/instructors`, **`/admin/members`**) require
  `role === 'admin'` → redirect `/admin`. New student matcher **`/student/dashboard/:path*`**
  requires an authenticated session that is **not** an admin → redirect `/student`. (Keep the
  `getUser()` JWT validation.)
- **`package.json`**: add `qrcode` + dev `@types/qrcode`.
- **No** `next.config.ts` change (inline SVG QR; no remote image host).
- **Env**: `NEXT_PUBLIC_SITE_URL` (existing) is the QR + redirect base; `SUPABASE_SERVICE_ROLE_KEY`
  (existing) backs the Admin API.

---

## C7 — Copy (`lib/strings.ts`, additive)

New groups (names indicative): **members list** (`membersNavLabel`, `membersTitle`,
`membersSubtitle`, `membersAddLabel`, `membersColName/Whatsapp/Email/Wave/Status`,
`membersEmpty`, `membersDownloadTemplate`), **add/bulk** (`addMembersChooserTitle`,
`addMemberFormOption`, `bulkUploadOption`, `memberFullNameLabel`, `memberWhatsappLabel`,
`memberWaveLabel`, `waveOfflineLabel`/`waveOnlineLabel` — or read from `tenants`,
`bulkChooseWave`, `bulkInvalidCsv`, `memberMgmtEmailInUse`, `memberMgmtForbidden`,
`memberMgmtResendNotPending`, `memberInviteNotSent`, submit/submitting labels), **student auth**
(`studentSignInTitle`, `studentEmailLabel`, `studentAuthFailed`, `studentSetPasswordTitle`,
`studentLoginIdIsEmailNote`, set-password + invalid-link strings), **member info**
(`memberInfoTitle`, field labels, `memberNotFound`). No inline literals in components.

---

## C8 — Test matrix (Vitest + RTL, mocked Supabase incl. Admin API)

| Test | Asserts |
|------|---------|
| `lib/members/validation.test.ts` | required/blank/whitespace rejection; email validity; waveId required (FR-008). |
| `lib/members/csv.test.ts` | parses quoted fields/commas; **rejects any blank/whitespace cell**; flags malformed email; detects in-file duplicate emails (FR-012/FR-015). |
| `lib/members/qr.test.ts` | `memberInfoUrl(id)` shape; `renderQrSvg` returns `<svg>` for a URL (FR-016/FR-022). |
| `lib/auth/studentGate.test.ts` | student session accepted; **admin/anon rejected** (FR-024). |
| `createMember.test.ts` | gate denial before Admin API; dup-email reject; invite + claims + insert; invite-failed surfaced (FR-009/FR-010/FR-027/FR-028). |
| `bulkCreateMembers.test.ts` | gate; **whole-file reject on a blank cell** (nothing created); per-row create + duplicate skip (FR-012/FR-015/SC-004/SC-005). |
| `resendMemberInvite.test.ts` | gate; pending-only; fresh link issued + `member_reinvited` (FR-026). |
| `membersPage.test.tsx` | rows render name/whatsapp/email/wave/status; empty state (FR-002/FR-030). |
| `memberInfoPage.test.tsx` | admin sees member; **non-admin/member denied** (FR-024/SC-007) — **role/cross-wave denial case**. |
| `signInStudent.test.ts` | student accepted → dashboard; admin & bad-creds denied; pending denied (FR-020/FR-021). |
| `setStudentPassword.test.ts` | valid session sets pw + `status='active'`; invalid/expired link rejected (FR-018/FR-019). |
| `AddMembersModal.test.tsx` | chooser switches; required fields block; bulk blank-cell rejected client-side; cancel discards (FR-006/FR-008/FR-012). |

The **NON-NEGOTIABLE cross-wave/role denial** coverage is `memberInfoPage.test.tsx` +
`studentGate.test.ts` + the `signInStudent` admin-rejection, plus an RLS-level assertion that a
member session scoped to wave A cannot read wave B's `students`.
