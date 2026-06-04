# Implementation Plan: Instructors Management

**Branch**: `005-instructors-management` | **Date**: 2026-06-04 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `specs/005-instructors-management/spec.md`

## Summary

Add an **Instructors** tab to the admin panel that lets administrators list, add, edit, and
remove instructors — building on the 002/004 stack (cookie-bound RLS reads, `assertAdminSession`
+ `revalidatePath` Server Actions, `DashboardShell` nav, shared tokens + `lib/strings.ts`). A
new sidebar entry, **Instructors**, opens `/admin/instructors`, which lists every instructor
(photo thumbnail, name, a clamped formatted-description preview, added date) read through the
cookie/RLS client (`instructors_select` = `is_admin()`), with **loading**, **empty**, and
**error** states and a **card transform** below `sm`. An **Add Instructor** button opens a shared
`InstructorFormModal` collecting a name, an uploaded image (previewed), and a rich-text
description authored in a small `contentEditable` editor (bold/italic/underline/lists/font-size,
**no editor framework**). On save, a gated `createInstructor` Server Action validates the name,
validates the image (MIME + size) **server-side**, uploads it to the **`instructor-images`**
Storage bucket via the cookie/RLS client, **sanitizes** the description HTML, and inserts the
row. The same modal, pre-populated, drives `updateInstructor`; a per-row confirm dialog drives
`removeInstructor` (delete row + best-effort storage cleanup).

This feature introduces **two** capabilities new to the codebase, both carried in Complexity
Tracking: (1) **Supabase Storage** (one public-read bucket + an `is_admin()` write policy) for
instructor photos, and (2) **one server-runnable HTML sanitizer dependency** as the FR-009
trust boundary for the rich-text description. Notably it adds **no** new service-role usage —
every write runs on the cookie/RLS client under `is_admin()` policies (research R5). The only
schema change is migration `0005_instructors.sql` (new `instructors` table + RLS + bucket +
storage policy). Full Phase 0/1 detail lives in [research.md](./research.md),
[data-model.md](./data-model.md),
[contracts/instructors-management-contracts.md](./contracts/instructors-management-contracts.md),
and [quickstart.md](./quickstart.md).

## Technical Context

**Language/Version**: TypeScript 5 (strict), React 19.2.4 (React Compiler enabled),
Next.js 16.2.6 (App Router).

**Primary Dependencies**: Next.js, React, Tailwind v4, `@supabase/supabase-js`, `@supabase/ssr`
(all already installed) **plus one new server-side HTML sanitizer** (e.g. `sanitize-html`) for
the rich-text description (Complexity Tracking).

**Storage**: Supabase Cloud (Postgres + **Storage**) — reused, with the **operator-created**
public bucket `instructor-images` (admin-only write via a `storage.objects` RLS policy).
Schema delta: migration `0005_instructors.sql` (new `instructors` table + `is_admin()` RLS
policies; the `is_admin()` storage **write** policy — the bucket itself is created out of band by
the operator, clarified 2026-06-04). No `auth.users` change; **no service-role usage**.

**Testing**: Vitest + React Testing Library (jsdom) with a mocked Supabase client (cookie/RLS,
incl. `storage.from(...)`) for pure helpers, the sanitizer, Server Actions, and components —
same tiers as 002/003/004.

**Target Platform**: Web — latest two major Chrome/Edge/Firefox/Safari (desktop) + iOS Safari
and Chrome on Android (latest two); mobile-first from 320px.

**Project Type**: Web application (Next.js App Router) + Supabase backend (existing).

**Performance Goals**: Each action (list read, create, update, remove) is a single Server
Action / RSC round-trip; meet the mobile CWV budget **LCP < 2.5s, CLS < 0.1, INP < 200ms** on a
mid-tier Android over Slow-4G. The list is server-rendered with an explicit `loading.tsx`; only
the form modal, rich-text editor, and remove-confirm ship client JS. Images are served from
Storage and rendered with `next/image` (lazy, dimension-reserved → protects CLS). The instructor
read is bounded (ordered by `created_at desc`, capped/paginatable — R10); the proxy matcher gains
one entry (`/admin/instructors/:path*`).

**Constraints**: Server-side enforcement of the admin gate on every action (never client-only);
the description HTML is **sanitized server-side before persistence** (FR-009) and re-sanitized on
read (defense-in-depth); image type/size validated **both** client- and server-side
(Principle V); uploads/deletes run on the cookie/RLS client under `is_admin()` storage policies
(no service-role); WCAG 2.1 AA; English-only LTR; brand only via tokens; all UI copy via
`lib/strings.ts`.

**Scale/Scope**: Tens of instructors (full list shown; bounded read, pagination deferred).
3 new Server Actions (create, update, remove); 1 list page + `loading.tsx`; 4 components
(`InstructorTable`, `InstructorFormModal`, `RichTextEditor`, `RemoveInstructorDialog`); 2 pure/
server helper modules (`lib/instructors/validation.ts`, `lib/instructors/sanitize.ts`);
1 migration; a third `navItems` entry; ~30 new strings; one `next.config.ts` image-host entry;
one proxy matcher entry; one new dependency (sanitizer).

## Constitution Check

*GATE: evaluated against constitution v2.1.0. Must pass before Phase 0 and re-checked after
Phase 1.*

| Principle | Gate | Status |
|-----------|------|--------|
| I — Code Quality | TS strict, build+lint clean, App Router + `@/*`, shared logic in `lib/`, no manual memo, tolerate long/AI text | **PASS** — validators in `lib/instructors/validation.ts`, sanitizer wrapper in `lib/instructors/sanitize.ts`, copy in `lib/strings.ts`, Supabase via existing `lib/supabase/*`; no hand memoization; name/description cells truncate/clamp and tolerate any length and any AI-generated description. |
| II — Testing (NON-NEGOTIABLE) | Guaranteed behavior covered by deterministic isolated tests | **PASS** — pure name/image validators, the **sanitizer** (injection inputs), the create/update/remove Server Actions (admin-gate denial, image-reject, sanitize-on-write, upload/insert/update/delete), the list/form/editor components — all mockable and unit-tested (contracts C6). |
| III — UX Consistency | Brand tokens, consistent loading/empty/**error** states, context-aware logo, English/LTR | **PASS** — reuses the 004 card/modal/token patterns and `role="alert"`; defines list **loading** (`loading.tsx`) / empty / error, and form idle/submitting/field-error/image-error/success states; logo stays admin-context; all copy centralized (C9). |
| IV — Mobile-First / Responsive / A11y | Usable 320→desktop, touch targets, visible focus, WCAG AA, inputs ≥16px mobile, data-heavy view has a documented mobile strategy | **PASS** — the list adopts a **card transform** `< sm` (documented strategy, R6); the form **modal scrolls internally** and traps focus; the rich-text toolbar buttons are real labelled `<button>`s with visible focus; inputs ≥16px; validated 320/390/430/768/desktop in the walkthrough. |
| V — Performance | RSC-first, bounded reads, lazy media, CWV budget stated | **PASS** — server-rendered list + `loading.tsx`, small client islands, single round-trips; images via `next/image` (lazy + dimension-reserved); bounded `created_at desc` read; uploads enforce format/size both sides; budget stated above. |
| VI — Wave Isolation & Tenant Boundaries (NON-NEGOTIABLE) | Tenant-scoped reads server-side; admin capabilities role-gated server-side | **PASS** — **no** student/wave-scoped data is introduced, so no new cross-wave path exists. Every instructor read/write is admin-gated server-side: the list relies on `instructors` RLS (`is_admin()`); create/update/remove call `assertAdminSession` **before** any write; the route is protected by the proxy matcher `/admin/instructors/:path*`; storage writes are gated by an `is_admin()` `storage.objects` policy. The required denial case is the **per-action admin-gate test** (C6). |
| VII — Artifact Structure (NON-NEGOTIABLE) | plan = Phase → Story → Acceptance Criteria → Test Scenarios; walkthrough per phase | **PASS** — see Implementation Phases; each phase ships a `walkthrough.md`. |

**Tech-constraint check**: No state library and **no rich-text/component framework** is added
(the editor is a dependency-free `contentEditable` island, R1). **Two** additions are recorded in
Complexity Tracking: (1) a Supabase **Storage** bucket + storage RLS policy for instructor
images, and (2) **one** server-runnable HTML **sanitizer** dependency as the FR-009 security
boundary. Both are justified with the rejected simpler alternative.

**Result**: PASS (two justified additions, tracked). No NEEDS CLARIFICATION remain after Phase 0.

## Project Structure

### Documentation (this feature)

```text
specs/005-instructors-management/
├── plan.md                                      # This file
├── research.md                                  # Phase 0 — decisions R1–R11
├── data-model.md                                # Phase 1 — migration 0005 + instructors table + bucket/RLS
├── quickstart.md                                # Phase 1 — configure, run, verify
├── contracts/
│   └── instructors-management-contracts.md      # Phase 1 — actions, helpers, page/components, config, copy, tests
├── checklists/
│   └── requirements.md                          # spec quality checklist (from /speckit-specify)
├── spec.md
├── tasks.md                                     # Phase 2 output (/speckit-tasks — NOT created here)
└── walkthrough.md                               # per implemented phase (/speckit-implement, Principle VII)
```

### Source Code (repository root)

```text
app/
└── admin/
    └── instructors/
        ├── page.tsx                     # NEW: Instructors list page (RSC, in DashboardShell)
        ├── loading.tsx                  # NEW: list loading state
        └── actions.ts                   # NEW: createInstructor + updateInstructor + removeInstructor (gated)

components/
├── InstructorTable.tsx                  # NEW: list table / mobile card-transform + per-row edit & remove
├── InstructorFormModal.tsx             # NEW: client island — shared add/edit dialog (image upload + editor)
├── RichTextEditor.tsx                   # NEW: client island — contentEditable + toolbar (no framework)
└── RemoveInstructorDialog.tsx          # NEW: client island — confirm + submit removeInstructor

lib/
├── instructors/
│   ├── validation.ts                    # NEW: validateInstructorFields + validateImageFile (pure)
│   └── sanitize.ts                      # NEW: sanitizeDescription wrapper over the sanitizer dep (server)
├── adminNav.tsx                         # MODIFY: append the Instructors nav item
├── supabase/server.ts                   # REUSE: cookie/RLS client (reads + storage writes + row writes)
└── strings.ts                           # MODIFY: add Instructors copy (group C9)

supabase/
└── migrations/
    └── 0005_instructors.sql             # NEW: instructors table + RLS; is_admin() storage WRITE policy (bucket is operator-created)

proxy.ts                                 # MODIFY: add matcher entry "/admin/instructors/:path*"
next.config.ts                           # MODIFY: add images.remotePatterns for the Supabase storage host
package.json                             # MODIFY: add the HTML sanitizer dependency

tests/
├── lib/instructors/validation.test.ts              # NEW: name + image (MIME/size) validators (pure)
├── lib/instructors/sanitize.test.ts                # NEW: strips script/handlers/disallowed; preserves allowlist (FR-009)
├── app/admin/instructors/createInstructor.test.ts  # NEW: gate + image-reject + upload + sanitized insert (mocked)
├── app/admin/instructors/updateInstructor.test.ts  # NEW: gate + re-validate + image replace + re-sanitize (mocked)
├── app/admin/instructors/removeInstructor.test.ts  # NEW: gate + delete row + best-effort storage delete (mocked)
├── app/admin/instructors/instructorsPage.test.tsx  # NEW: rows render image/name/preview/added; empty state
├── components/InstructorFormModal.test.tsx         # NEW: required name + bad image blocked; cancel discards
└── components/RichTextEditor.test.tsx              # NEW: toolbar formats + writes hidden HTML; labels/focus
```

**Structure Decision**: Next.js App Router + existing Supabase backend. The Instructors page
lives at `/admin/instructors` (top-level under `/admin`, like `/admin/admins`) so it inherits the
proxy protection (one new matcher entry) and the dashboard sidebar shell, with an explicit
`loading.tsx`. Reads use the cookie-bound server client (RLS-bounded by `is_admin()`); mutations
live in Server Actions that call `assertAdminSession` and then write **through the same cookie/RLS
client** — including Storage uploads/deletes, which are bounded by an `is_admin()`
`storage.objects` policy, so **no service-role client is introduced**. The rich-text description
is sanitized server-side in the action before persistence (FR-009). Pure validators live in
`lib/instructors/` for deterministic testing; the sanitizer wrapper isolates the one new
dependency behind a tested module.

## Implementation Phases

### Phase 1 — Instructors page: navigation, list & infrastructure

Delivers the surface and the read: the **Instructors** sidebar entry and the page that lists all
instructors (photo, name, clamped description preview, added date) with defined **loading**
(`loading.tsx`) / empty / error states and a **card transform** below `sm`. Lands the
foundational infrastructure the later phases need: migration `0005` (the `instructors` table +
RLS), the `instructor-images` bucket + storage write policy, the `next.config.ts` image host,
and the proxy matcher entry. Implements spec **User Story 1 (P1)**. Independently testable without
add/edit/remove: seed an instructor row and assert the list renders it (and that an unauthenticated
caller is redirected).

#### User Story 1.1: As an administrator, I want an Instructors page that lists every instructor, so that I can see them at a glance.

- Description: Add migration `0005_instructors.sql` (create `instructors` with `name`,
  `description_html`, `image_path`, timestamps; `is_admin()` RLS select/write policies; create the
  public `instructor-images` bucket + the `is_admin()` `storage.objects` write policy). Add
  `app/admin/instructors/page.tsx` reading `instructors` via the cookie/RLS client ordered by
  `created_at desc`, rendering `components/InstructorTable.tsx` (image thumbnail via `next/image`,
  name, clamped sanitized preview, added date, edit/remove action slots) plus
  `app/admin/instructors/loading.tsx`. Append the Instructors `NavItem` in `lib/adminNav.tsx`. Add
  the proxy matcher entry `/admin/instructors/:path*` and the `next.config.ts`
  `images.remotePatterns` host. Add the C9 list strings.

#### Acceptance Criteria (for the phase)

- [ ] The admin sidebar shows an **Instructors** entry that routes to `/admin/instructors` (FR-001).
- [ ] The page lists every `instructors` row with photo, name, a clamped formatted-description preview, and added date (FR-002, FR-016).
- [ ] The list is read through the cookie/RLS client gated by `is_admin()`; no read occurs for a non-admin (FR-015).
- [ ] Visiting `/admin/instructors` without a valid admin session redirects to `/admin` (proxy matcher, FR-015).
- [ ] The list renders with no horizontal page scroll at 320/390/430/768/desktop — **card transform** below `sm` — with a defined `loading.tsx` and empty state (FR-003-states, FR-017, SC-008).
- [ ] Thumbnails are served from the `instructor-images` host via `next/image` (lazy; no CLS regression) (FR-017, SC-001).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** several seeded instructors, **When** the Instructors page renders, **Then** each appears with its photo, name, a clamped description preview, and added date (golden path).
2. **Given** an instructor with a long formatted description, **When** the row renders, **Then** the preview is clamped without breaking the layout (FR-016).
3. **Given** no instructors, **When** the page renders, **Then** the empty state ("No instructors yet…") is shown (FR-003-states).
4. **Given** no admin session, **When** `/admin/instructors` is requested directly, **Then** the request redirects to `/admin` (route protection, FR-015).
5. **Given** the page at 320px, **When** rendered, **Then** the list adopts the card layout with no horizontal page scroll or clipped photo/controls. *(manual, walkthrough)*

---

### Phase 2 — Add instructor: image upload + rich-text description

Delivers creation: the **Add Instructor** button → shared `InstructorFormModal`, the
`RichTextEditor` island (bold/italic/underline/lists/font-size), the server `sanitizeDescription`
wrapper (+ the new sanitizer dependency), the pure `validation.ts` helpers, and the gated
`createInstructor` Server Action (validate name → validate image → upload to Storage → sanitize
description → insert). Implements spec **User Story 2 (P1)**. Independently testable with a mocked
Supabase/storage client.

#### User Story 2.1: As an administrator, I want to add an instructor through a polished form with an image and a formatted description, so that I can publish instructors without back-office work.

- Description: Add `components/RichTextEditor.tsx` (contentEditable + labelled toolbar, emits HTML
  into a hidden field, R1/R3) and `components/InstructorFormModal.tsx` (name; image file input
  with preview + client-side type/size pre-check; the editor; submitting/field-error/image-error/
  success states; Cancel/close discard the picked image — FR-012). Add `lib/instructors/validation.ts`
  (`validateInstructorFields`, `validateImageFile`, `ALLOWED_IMAGE_TYPES`, `MAX_IMAGE_BYTES`) and
  `lib/instructors/sanitize.ts` (`sanitizeDescription`, `FONT_SIZE_CLASSES`) wrapping the new
  sanitizer dependency. Add `createInstructor` to `app/admin/instructors/actions.ts`:
  `assertAdminSession` → `validateInstructorFields` → (if image) `validateImageFile` + upload via
  the cookie/RLS storage client → `sanitizeDescription` → insert `instructors` →
  `revalidatePath('/admin/instructors')`. Wire the **Add Instructor** trigger on the page. Add the
  C9 form + editor strings.

#### Acceptance Criteria (for the phase)

- [ ] Clicking **Add Instructor** opens a form with a name field, an image upload showing a **preview**, and a rich-text **description editor** exposing bold/italic/underline/lists/font-size (FR-004, FR-005, FR-006, FR-008).
- [ ] Applied formatting is preserved on save and reflected when the instructor is re-opened (FR-008, SC-003).
- [ ] Submitting with an empty name is blocked with a clear message; no instructor is created (FR-010, SC-004).
- [ ] Selecting an unsupported type or oversized image is rejected client- **and** server-side with a clear message; no instructor is created from it (FR-007, SC-004).
- [ ] A valid submission, after `assertAdminSession`, uploads the image to `instructor-images`, stores the **sanitized** description, inserts the row, and the instructor appears in the list (FR-009, FR-011).
- [ ] A description containing `<script>`/event handlers/`javascript:` is stored **stripped** and renders inertly (FR-009, SC-007).
- [ ] Cancelling or closing the form creates nothing and discards the picked image (FR-012).
- [ ] An unauthenticated/non-admin caller of `createInstructor` is denied before any upload/insert; the service-role key never appears in client/request-rendered output (FR-015).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** the page, **When** **Add Instructor** is clicked, **Then** the form opens with name, image upload (preview), and the rich-text editor with its toolbar (golden path).
2. **Given** the form with a valid name, an allowed image, and a formatted description, **When** saved, **Then** `validateImageFile` passes, the image uploads, `sanitizeDescription` runs, a row is inserted, and the instructor appears in the list.
3. **Given** the editor with bold + a larger font size applied, **When** saved and re-opened, **Then** that formatting is present (SC-003).
4. **Given** a description with `<script>onerror</script>` and a `javascript:` link, **When** saved, **Then** the stored `description_html` contains none of them but keeps the allowed tags (FR-009, SC-007).
5. **Given** an empty name, **When** save is attempted, **Then** it is blocked and no insert/upload occurs (SC-004).
6. **Given** a `.gif` or a >5 MB file, **When** chosen/submitted, **Then** it is rejected both client- and server-side and no instructor is created (SC-004).
7. **Given** `createInstructor` invoked without a valid admin session, **When** it runs, **Then** it returns the denial state before any upload/insert (FR-015).
8. **Given** the open form, **When** Cancel/close is used, **Then** nothing is created and the picked image is discarded (FR-012).

---

### Phase 3 — Edit instructor

Delivers editing: the per-row **Edit** action opens the shared `InstructorFormModal`
pre-populated, and the gated `updateInstructor` Server Action persists changes (name, replaced
image with old-object cleanup, re-sanitized description). Implements spec **User Story 3 (P2)**.
Independently testable with a mocked client.

#### User Story 3.1: As an administrator, I want to edit an instructor, so that their photo, name, and description stay accurate.

- Description: Add a per-row **Edit** control in `InstructorTable` that opens
  `InstructorFormModal` with the instructor pre-loaded (name, current image preview, current
  description in the editor). Add `updateInstructor` to `app/admin/instructors/actions.ts`:
  `assertAdminSession` → require `id` → `validateInstructorFields` → if a new image is provided,
  `validateImageFile` + upload + repoint `image_path` (best-effort delete the old object, R11),
  else keep the existing path → `sanitizeDescription` → `update … set …, updated_at=now()` →
  `revalidatePath`. Add the C9 edit strings (`instructorFormEditTitle`, reuse the rest).

#### Acceptance Criteria (for the phase)

- [ ] Each row exposes an **Edit** control that opens the form pre-populated with the instructor's current name, image, and formatted description (FR-013).
- [ ] Changing name, replacing the image, and/or re-formatting the description and saving updates the row to reflect every change (FR-013, SC-005).
- [ ] Cancelling the edit persists nothing; the instructor is unchanged (FR-012).
- [ ] Clearing the name and saving is blocked with a clear message; prior values are preserved (FR-010).
- [ ] The updated description is re-sanitized on save (FR-009).
- [ ] An unauthenticated/non-admin caller of `updateInstructor` is denied before any write (FR-015).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** an instructor, **When** Edit is opened, **Then** the form is pre-populated with its name, image preview, and formatted description (golden path).
2. **Given** the edit form, **When** the name and description are changed and a new image is uploaded and saved, **Then** `updateInstructor` updates the row, repoints `image_path`, and attempts to delete the old object; the list reflects the changes (SC-005).
3. **Given** the edit form, **When** Cancel is used, **Then** `updateInstructor` is not called and nothing changes.
4. **Given** the edit form with the name cleared, **When** save is attempted, **Then** it is blocked with no update (FR-010).
5. **Given** `updateInstructor` invoked without a valid admin session, **When** it runs, **Then** it returns the denial state before any write (FR-015).

---

### Phase 4 — Remove instructor

Delivers lifecycle removal: a per-row **Remove** control with explicit in-page confirmation and
the gated `removeInstructor` Server Action (delete row + best-effort storage-object cleanup).
Implements spec **User Story 4 (P2)**. Independently testable with a mocked client.

#### User Story 4.1: As an administrator, I want to remove an instructor with a confirmation step, so that I can take one down safely.

- Description: Add a per-row **Remove** control in `InstructorTable` and
  `components/RemoveInstructorDialog.tsx` (in-page accessible confirm showing the instructor's
  name; submitting/error states; Cancel does nothing). Add `removeInstructor` to
  `app/admin/instructors/actions.ts`: `assertAdminSession` → require `id` → read `image_path` →
  `delete from instructors where id` (cookie/RLS) → best-effort delete the storage object (R11) →
  `revalidatePath`. Add the C9 remove strings.

#### Acceptance Criteria (for the phase)

- [ ] Each row exposes a **Remove** control that requires explicit confirmation before acting (FR-014).
- [ ] Confirming removal deletes the row; the instructor disappears from the list and does not reappear (FR-014, SC-006).
- [ ] Cancelling the confirmation removes nothing (FR-014, SC-006).
- [ ] The instructor's storage object is deleted best-effort; a storage-delete failure still completes the removal (R11).
- [ ] An unauthenticated/non-admin caller of `removeInstructor` is denied before any delete (FR-015).
- [ ] `npm run build`, `npm run lint`, and `npm test` pass.

#### Test Scenarios (for the phase)

1. **Given** an instructor, **When** an admin confirms removal, **Then** the row is deleted, its storage object delete is attempted, and it leaves the list (golden path).
2. **Given** the confirm dialog, **When** the admin cancels, **Then** `removeInstructor` is not called and the instructor stays (SC-006).
3. **Given** a removal where the storage-object delete fails, **When** it runs, **Then** the row is still deleted and `{ removed: true }` is returned (R11).
4. **Given** `removeInstructor` invoked without a valid admin session, **When** it runs, **Then** it returns the denial state before any delete (FR-015).

## Complexity Tracking

> Two additions beyond the 002/004 baseline. The constitution requires backend/dependency
> additions to be justified with the rejected simpler alternative recorded.

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Supabase Storage** — the **operator-created** public-read bucket `instructor-images` + an `is_admin()` `storage.objects` write policy (migration), written via the cookie/RLS client | Instructor photos are binary assets that need durable object storage and lazy CDN-style delivery for the list; an image is core to FR-005/FR-006. Writes stay on the **RLS path** (no service-role), gated by `is_admin()` server-side; the bucket is provisioned by the operator (clarified 2026-06-04) so the migration owns only the write-authorization boundary. | Base64-encoding image bytes into a Postgres `text` column — rejected: bloats every row and the list payload, fighting the bounded-read/CWV budget (Principle V), and still needs the same admin gate. A private bucket + per-render signed URLs — rejected as needless complexity for non-sensitive display photos. Using the **service-role** client for uploads — rejected: an `is_admin()` storage policy already enforces the boundary, so widening the privileged surface is unjustified (R5). |
| **One HTML sanitizer dependency** (e.g. `sanitize-html`) used server-side in the create/update actions | The rich-text description (FR-008) is user-authored HTML; FR-009 requires that only allow-listed formatting is ever stored/rendered and that unsafe markup cannot affect the page. Sanitization is the **trust boundary** and must run server-side before persistence. | A hand-rolled allowlist parser — **rejected**: security-critical HTML parsing must use a vetted, maintained library, never bespoke code. `isomorphic-dompurify` (DOMPurify + jsdom) — rejected as a heavier server runtime (full DOM) than the pure string sanitizer for the same guarantee. Storing Markdown to avoid HTML entirely — rejected: cannot express font size (FR-008). The editor itself adds **no** dependency (dependency-free `contentEditable`, R1), so it is not tracked here. |
