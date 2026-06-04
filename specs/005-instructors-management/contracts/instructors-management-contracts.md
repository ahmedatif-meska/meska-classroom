# Phase 1 Contracts: Instructors Management

Interfaces this feature exposes. All mutation contracts run server-side and call
`assertAdminSession` **before** any write or storage call. Description HTML is **sanitized
server-side** before persistence (R2). Copy is referenced by key from `lib/strings.ts`
(group **C9**); no inline literals. Writes use the cookie-bound RLS client — **no service-role**
(R5).

---

## C1 — Server Actions (`app/admin/instructors/actions.ts`)

```ts
export type InstructorFormState = { error?: string; saved?: boolean };
export type RemoveInstructorState = { error?: string; removed?: boolean };
```

### `createInstructor(prevState, formData) → InstructorFormState`

Flow (any failure returns `{ error }` and performs **no** write past the point it fails):

1. `assertAdminSession` on the caller's cookie session → else `{ error: strings.instructorsForbidden }`.
2. `validateInstructorFields(name)` → else `{ error }` (e.g. `instructorsNameRequired`).
3. If an image file is present: `validateImageFile(file)` (MIME + size) → else `{ error: strings.instructorsImageInvalid }`. Upload to `instructor-images` via the cookie/RLS client (`storage.from('instructor-images').upload(path, file)`), `path = ` a generated uuid + extension → on storage error `{ error: strings.instructorsImageUploadFailed }`; capture `image_path`.
4. `description_html = sanitizeDescription(formData.get('description_html'))` (R2/R3 allowlist).
5. Insert `instructors` `{ name, description_html, image_path }` via the cookie/RLS client → on error `{ error: strings.instructorsSaveFailed }`.
6. `revalidatePath('/admin/instructors')`; return `{ saved: true }`.

Inputs (FormData): `name`, `description_html`, `image` (File, optional).

**Guarantees**: FR-004–FR-011, FR-015. Name trimmed; description sanitized before insert
(FR-009); image validated server-side (FR-007); admin gate before any storage/DB write (FR-015).

### `updateInstructor(prevState, formData) → InstructorFormState`

Flow:

1. `assertAdminSession` → else `{ error: strings.instructorsForbidden }`.
2. Read `id` (required); `validateInstructorFields(name)` → else `{ error }`.
3. If a **new** image file is present: `validateImageFile` → upload new object → set `image_path` to the new path; best-effort delete the prior object (R11). If no new file, keep the existing `image_path`.
4. `description_html = sanitizeDescription(...)`.
5. `update instructors set name, description_html, image_path, updated_at = now() where id = :id` (cookie/RLS client) → on error `{ error: strings.instructorsSaveFailed }`.
6. `revalidatePath('/admin/instructors')`; return `{ saved: true }`.

Inputs (FormData): `id`, `name`, `description_html`, `image` (File, optional — absent = unchanged).

**Guarantees**: FR-013, FR-008–FR-010, FR-015. Cancelling never calls this (client-side).

### `removeInstructor(prevState, formData) → RemoveInstructorState`

Flow:

1. `assertAdminSession` → else `{ error: strings.instructorsForbidden }`.
2. Read `id` (required) → else `{ error: strings.instructorsForbidden }`.
3. Read the row's `image_path` (cookie/RLS).
4. `delete from instructors where id = :id` (cookie/RLS) → on error `{ error: strings.instructorsRemoveFailed }`.
5. Best-effort delete the storage object at `image_path` (R11 — failure does not fail the action).
6. `revalidatePath('/admin/instructors')`; return `{ removed: true }`.

Inputs (FormData): `id`.

**Guarantees**: FR-014, FR-015. No write occurs before the admin gate (FR-015). Confirmation is
enforced in the client dialog (C3) before this action is invoked.

---

## C2 — Pure / server helpers (`lib/instructors/`)

```ts
// lib/instructors/validation.ts — pure, no Supabase/Next imports (deterministically testable)
export type FieldValidation = { ok: true } | { ok: false; error: string };

/** FR-010 — name required, non-empty after trim. */
export function validateInstructorFields(name: FormDataEntryValue | null): FieldValidation;

/** FR-007 — MIME ∈ {png,jpeg,webp} and size ≤ MAX_IMAGE_BYTES. Pure (takes {type,size}). */
export function validateImageFile(file: { type: string; size: number } | null): FieldValidation;

export const ALLOWED_IMAGE_TYPES: readonly string[]; // ['image/png','image/jpeg','image/webp']
export const MAX_IMAGE_BYTES: number;                // e.g. 5 * 1024 * 1024
```

```ts
// lib/instructors/sanitize.ts — server-side HTML sanitizer wrapper (R2/R3)
/** Allowlist: b,strong,i,em,u,p,br,ul,ol,li,span[class∈FONT_SIZE_CLASSES]. Strips all else. */
export function sanitizeDescription(input: FormDataEntryValue | null): string;
export const FONT_SIZE_CLASSES: readonly string[]; // the closed font-size class set (R3)
```

`validation.ts` is pure (mirrors `adminGate.ts`/`adminManagement.ts`). `sanitize.ts` wraps the
sanitizer dependency and is unit-tested against injection inputs.

---

## C3 — Pages & components

### `app/admin/instructors/page.tsx` (RSC) — Instructors list

- Reads `instructors` via the cookie-bound server client (RLS `is_admin()`), ordered by
  `created_at desc` (R10); renders `DashboardShell` (Instructors nav active) → header (title +
  subtitle + **Add Instructor** trigger) → `InstructorTable`.
- States: **loading** (`app/admin/instructors/loading.tsx`), **empty** (`instructorsEmptyNote`),
  **error** (inherited `app/admin/error.tsx`).

### `app/admin/instructors/loading.tsx` (NEW)

Lightweight skeleton/spinner for the list segment (explicit loading state, FR-003-state /
constitution UX), reusing the admin `loadingLabel` styling.

### `components/InstructorTable.tsx` (RSC)

Columns: **Image** (thumbnail via `next/image`, lazy), **Name**, **Description** (sanitized,
clamped preview, R8), **Added** (`created_at`), **Actions** (edit + remove per row). Below `sm`,
each row becomes a **stacked card** (R6) — no horizontal scroll at 320px. Empty → `instructorsEmptyNote`.
Each row carries `data-instructor-row` (test hook).

### `components/InstructorFormModal.tsx` (client island)

Shared **add/edit** dialog (R7) bound to `createInstructor` / `updateInstructor` via
`useActionState`. Props: optional `instructor` (present = edit, pre-populated; absent = create).
Fields: **Name** (required, ≥16px), **Image** (file input + preview; client-side type/size
pre-check mirroring the server allowlist), **Description** (the `RichTextEditor` island).
States: idle / submitting (disabled) / field-error / image-error / success (closes + list
revalidates). Cancel + close (×) dismiss without saving and discard the picked image (FR-012).
`role="dialog"`, labelled, focus-trapped, `Esc` closes, scrolls internally.

### `components/RichTextEditor.tsx` (client island)

`contentEditable` surface + toolbar: bold, italic, underline, ordered/unordered list, font-size
(closed class set, R3). Emits HTML into a hidden `description_html` field on change/submit.
Toolbar buttons are real `<button type="button">` with `aria-label`s and visible focus;
keyboard-operable. No editor framework (R1).

### `components/RemoveInstructorDialog.tsx` (client island)

Confirmation bound to `removeInstructor` via `useActionState`. Shows the instructor's name;
destructive confirm + Cancel; submitting/error states; Cancel removes nothing (FR-014). An
in-page accessible dialog — **not** a native `confirm()` (browser-modal constraint).

### `lib/adminNav.tsx` (MODIFY)

Append a third `NavItem` `{ label: strings.instructorsNavLabel, href: '/admin/instructors', icon: <…> }`.
`DashboardShell` is unchanged (already accepts `navItems`/`activeHref` from 004).

---

## C4 — Configuration

| Item | Value |
|------|-------|
| Storage bucket | `instructor-images` — **operator-created** (dashboard), **public-read**; migration adds only the `is_admin()` `storage.objects` **write** policy (data-model) |
| `next.config.ts` | Add `images.remotePatterns` for `<project>.supabase.co` `/storage/v1/object/public/**` (R4) |
| Proxy | Add matcher entry `/admin/instructors/:path*` (protect the new top-level route, R9) |
| Env | **No new variable** — `NEXT_PUBLIC_SUPABASE_URL`/`…ANON_KEY` already exist; service-role unused here |
| New dependency | one server-runnable HTML sanitizer (e.g. `sanitize-html`) — Complexity Tracking |

---

## C5 — Copy (`lib/strings.ts`, group C9)

| Key | English (indicative) |
|-----|----------------------|
| `instructorsNavLabel` / `instructorsTitle` | Instructors |
| `instructorsSubtitle` | Manage the instructors shown in the classroom |
| `instructorsAddLabel` | Add Instructor |
| `instructorsColImage` / `…Name` / `…Description` / `…Added` / `…Actions` | Image / Name / Description / Added / Actions |
| `instructorsEmptyNote` | No instructors yet — add your first one |
| `instructorFormAddTitle` / `instructorFormEditTitle` | Add Instructor / Edit Instructor |
| `instructorNameLabel` | Name |
| `instructorImageLabel` | Photo |
| `instructorImageHelp` | PNG, JPEG, or WebP, up to 5 MB |
| `instructorDescriptionLabel` | Description |
| `instructorFormSubmitLabel` / `instructorFormSubmittingLabel` | Save / Saving… |
| `cancelLabel` (reuse) / `closeLabel` (reuse) | Cancel / Close |
| `instructorsNameRequired` | Name is required. |
| `instructorsImageInvalid` | Choose a PNG, JPEG, or WebP image up to 5 MB. |
| `instructorsImageUploadFailed` | The image couldn't be uploaded. Please try again. |
| `instructorsSaveFailed` | The instructor couldn't be saved. Please try again. |
| `instructorsForbidden` (may reuse adminMgmtForbidden) | You don't have permission to do that. |
| `removeInstructorTitle` | Remove instructor |
| `removeInstructorConfirm` | Remove {name}? This can't be undone. |
| `removeInstructorSubmitLabel` / `removeInstructorSubmittingLabel` | Remove / Removing… |
| `instructorsRemoveFailed` | The instructor couldn't be removed. Please try again. |
| Editor: `rteBold` / `rteItalic` / `rteUnderline` / `rteBulletList` / `rteNumberList` / `rteFontSize` | Bold / Italic / Underline / Bulleted list / Numbered list / Font size |

(Final wording fixed during implementation; keys are the contract.)

---

## C6 — Test surface (Principle II, NON-NEGOTIABLE)

No wave/tenant-scoped path is introduced, so there is no cross-wave case; the equivalent
required denial test is the **admin-gate denial on every action** plus the RLS-backed list.

| Test | Asserts |
|------|---------|
| `lib/instructors/validation.test.ts` | name required/trim; image MIME + size allow/deny boundaries (FR-007/FR-010) |
| `lib/instructors/sanitize.test.ts` | `<script>`/`onerror`/`javascript:`/disallowed tags & attrs stripped; allowed tags + allowed font-size class preserved (FR-009, SC-007) |
| `app/admin/instructors/createInstructor.test.ts` | gate denial (no write); invalid image rejected (no upload); success → upload + sanitized insert + revalidate (mocked client) |
| `app/admin/instructors/updateInstructor.test.ts` | gate denial; name re-validated; new image replaces path (+ old object delete attempted); description re-sanitized on update |
| `app/admin/instructors/removeInstructor.test.ts` | gate denial; success deletes row + attempts storage-object delete; storage-delete failure still returns `{ removed: true }` |
| `app/admin/instructors/instructorsPage.test.tsx` | rows render image/name/clamped preview/added; empty state; (RLS-backed) no read without admin |
| `components/InstructorFormModal.test.tsx` | required name blocks submit; oversized/wrong-type image blocked; cancel/close discards and saves nothing (FR-012) |
| `components/RichTextEditor.test.tsx` | toolbar buttons toggle formatting and write HTML into the hidden field; keyboard/focus labels present |

All use a mocked Supabase client (cookie/RLS, incl. `storage.from(...)`). The service-role key is
asserted **absent** from any client/request-rendered output (it is unused by this feature).
