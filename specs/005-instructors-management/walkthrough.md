# Walkthrough: Instructors Management

Covers Phases 1–4 (Principle VII). The feature adds an admin **Instructors** tab to list, add,
edit, and remove instructors with a photo and a sanitized rich-text description.

## How to run

```bash
npm run dev      # dev server at http://localhost:3000
npm run lint     # clean
npm run build    # clean (TypeScript + route /admin/instructors)
npm test         # full suite (incl. 8 new instructor tests)
```

**One-time setup (operator)** — see [quickstart.md](./quickstart.md):

1. In the Supabase dashboard → Storage, create a **public** bucket named exactly
   **`instructor-images`**.
2. Apply `supabase/migrations/0005_instructors.sql` (creates the `instructors` table + RLS and
   the `is_admin()` `storage.objects` write policy — it does **not** create the bucket).
3. `next.config.ts` already derives the Supabase image host from `NEXT_PUBLIC_SUPABASE_URL`.

Sign in at `/admin`, then open **Instructors** in the sidebar.

## What shipped (route / component paths)

| Area | Path |
|------|------|
| Route + list (RSC) | `app/admin/instructors/page.tsx` |
| Server Actions (gated) | `app/admin/instructors/actions.ts` — `createInstructor`, `updateInstructor`, `removeInstructor` |
| List rendering | `components/InstructorTable.tsx` (stacked card list) |
| Add/Edit form (island) | `components/InstructorFormModal.tsx` |
| Rich-text editor (island) | `components/RichTextEditor.tsx` |
| Remove confirm (island) | `components/RemoveInstructorDialog.tsx` |
| Pure validators | `lib/instructors/validation.ts` |
| HTML sanitizer (server) | `lib/instructors/sanitize.ts` (wraps `sanitize-html`) |
| Image URL helper | `lib/instructors/image.ts` |
| Nav entry | `lib/instructors/...` → `lib/adminNav.tsx` (third item) |
| Migration | `supabase/migrations/0005_instructors.sql` |
| Route protection | `proxy.ts` matcher `+ /admin/instructors/:path*` |
| Font-size classes | `app/globals.css` (`.rte-sm/.rte-base/.rte-lg/.rte-xl`) |
| Copy | `lib/strings.ts` (Instructors group) |

## Golden-path verification (desktop)

1. **List + empty state** — With no rows, `/admin/instructors` shows "No instructors yet — add
   your first one"; the sidebar shows the **Instructors** entry (active).
2. **Add** (Phase 2) — Click **Add Instructor** → form opens. Enter a name, pick a PNG/JPEG/WebP
   (≤5 MB; preview appears), format a description (bold/italic/underline, a list, a larger font
   size), **Save** → the instructor appears as a card with photo, name, and a clamped formatted
   preview.
3. **Validation** — Save with an empty name → blocked. Pick a `.gif` or >5 MB file → rejected
   with a message; no instructor created.
4. **Sanitization** — A description containing `<script>`/`onclick`/`javascript:` is stored
   stripped (verified by `lib/instructors/sanitize.test.ts`) and renders inertly.
5. **Edit** (Phase 3) — Click a card's edit (pencil) → form pre-filled. Change name, replace the
   image, re-format the description → **Save** → card reflects the changes. Cancel → unchanged.
6. **Remove** (Phase 4) — Click a card's remove (trash) → in-page confirm → **Remove** → the card
   disappears. Cancel → it stays.
7. **Authorization** — Sign out, visit `/admin/instructors` → redirected to `/admin`. Server
   Actions also deny a non-admin before any write (gate tests T012/T019/T022).

## Mobile verification (Principle IV — 320 / 390 / 430 / 768px and desktop)

- The list is a **single stacked-card layout** (photo + name + clamped formatted preview + added
  date + edit/remove) that reads well at every width with **no horizontal page scroll**.
- The add/edit **modal scrolls internally**; the name input is ≥16px; the rich-text toolbar
  buttons are touch-friendly, keyboard-focusable, and labelled; the font-size control is a
  labelled `<select>`.
- Photos load via `next/image` (lazy, dimension-reserved) — no layout shift.
- Esc closes the form/confirm dialogs; every control shows visible focus.

## Implementation notes & deviations

- **List layout — single stacked-card list (not a table/card dual render).** The plan/tasks
  described a table at `sm`+ with a card transform below `sm`. Implemented instead as one
  responsive **stacked-card list** at all widths: it matches the user's "table under each other in
  a beautiful view" intent, suits image-bearing rows, avoids the squished-table pitfall
  (`learning.md` Bug 3), and renders one DOM node per instructor (no duplicate-element test
  fragility). If a desktop columnar table is preferred, revisit `InstructorTable.tsx`.
- **No route-level `loading.tsx`** — per the 004 learning (a route loader blanks the whole
  `DashboardShell`). The RSC read is fast; empty + error states apply.
- **No service-role usage** — every write (row and Storage) runs on the cookie/RLS client under
  `is_admin()` policies; the service-role key is unused by this feature.
- **Rich text** — a dependency-free `contentEditable` editor (bold/italic/underline/lists via
  `execCommand`; font size via a closed CSS-class set). The **server sanitizer is the trust
  boundary** (FR-009), so editor quirks can never produce unsafe stored markup.

## Known gaps / out of scope

- **No student-facing/public instructors page** — instructors are admin-only this feature (spec
  assumption); image **bytes** are public-by-URL, records are admin-only.
- **One photo per instructor**; font size limited to the fixed `.rte-*` class set; description is
  optional.
- **Operator-applied infra (not automated here)**: creating the public `instructor-images` bucket
  and applying migration `0005` (tasks T005), full responsive sweep on real devices (T026), and
  the live end-to-end quickstart run against a configured Supabase project (T028).
- Pagination is deferred (bounded `created_at desc` read; full list shown at the expected scale).
