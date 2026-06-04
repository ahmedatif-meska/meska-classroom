# Learning Log — Instructors Management (005)

A running record of bugs found and fixed while building the instructors
directory and its rich-text editor, with the root cause and the fix, so the same
mistakes are not repeated. The **Portable Instructions** at the bottom are
written to be dropped into any other project as guardrails.

---

## Bugs & Fixes

### Bug 1 — Supabase flagged the migration as "destructive"

**Symptom.** Running `0005_instructors.sql` in the Supabase SQL editor raised a
"Potential issue detected — this query includes destructive operations" warning,
making it unclear whether it was safe to run.

**Root cause.** A generic linter heuristic: any `drop`/`alter` statement trips
the warning. The migration only uses the idempotent **drop-then-recreate**
idiom (`drop policy if exists … ; create policy …`) so the script can be re-run
safely. There is no `drop table`/`drop column`/`delete`/`truncate` — no
data-loss path.

**Fix.** Nothing to change in the SQL — the warning is a false positive for the
re-runnable policy pattern. The only real prerequisite is that `public.is_admin()`
(from `0002`) already exists; otherwise the migration fails harmlessly with
"function does not exist". Proceeded with **Run query**.

### Bug 2 — Font-size dropdown did nothing

**Symptom.** In the rich-text editor, selecting a value from the Font-size
`<select>` had no effect, while Bold/Italic/Underline worked.

**Root cause.** Opening a native `<select>` moves focus out of the
`contentEditable` surface, which **collapses the text selection**. By the time
`onChange` fired, `window.getSelection().isCollapsed` was `true`, so the
"wrap the selection in a span" code had nothing to wrap. B/I/U worked only
because their toolbar buttons call `onMouseDown` → `preventDefault()`, which
stops the button from stealing focus and preserves the selection.

**Fix.** (`components/RichTextEditor.tsx`) Remember the selection `Range` while it
still lives inside the editor (`rememberSelection` on the editor's `mouseup`/
`keyup` and on each control's `mousedown`/`focus`) and **restore it** before
applying (`wrapSelectionInClass` prefers a live non-collapsed selection, else
re-adds the saved `Range`). Colour swatches are plain buttons, so they keep the
selection naturally via `onMouseDown preventDefault`.

### Bug 3 — Uploaded instructor image shows a broken-image icon

**Symptom.** After adding an instructor with a photo, the list/preview showed the
torn-image glyph instead of the photo. Crucially, instructors **without** an
image correctly showed the letter-avatar fallback — so `image_path` was being
stored.

**Root cause.** Not a code bug. Because the row saved *with* a non-null
`image_path`, the upload succeeded and the path was stored; the broken icon means
the **public URL returned a non-image**. The `instructor-images` Storage bucket
had not been toggled **Public**, so `/storage/v1/object/public/…` returns an
access error rather than the file. (Public-bucket reads bypass RLS, so the
admin-only storage policy is not the cause.)

**Fix.** Operator action in the Supabase dashboard: **Storage → `instructor-images`
→ Settings → Public bucket: ON.** The migration comment already states the bucket
must be operator-created as **public**; it had been created private. No code or
re-upload needed — existing images load once the toggle flips.

### Bug 4 — Previous image preview leaks into the next "Add" form

**Symptom.** After adding one instructor (with a photo), opening "Add Instructor"
again still showed the *previous* instructor's image in the preview, even though
the name/description fields were empty.

**Root cause.** `previewUrl` is React state on the **always-mounted** Add button.
The native form fields reset because the `<form>` is conditionally rendered and
remounts on each open — but `previewUrl` state is not inside that conditional, so
it survives. The `close()` handler reset it, but the **successful-save path only
called `setOpen(false)`** and never reset the preview.

**Fix.** (`components/InstructorFormModal.tsx`) Added a `reset()` that clears
`imageError`/`pendingFile`/`croppedFile` and resets `previewUrl` to the
instructor's current image (Edit) or nothing (Add), and call it from an `open_()`
handler wired to both trigger buttons. Opening the form is now always clean,
regardless of how it was previously closed.

### Bug 5 — Instructor list looked bad as stacked cards

**Symptom.** The instructor list rendered as large stacked cards showing the
(sometimes long, HTML) description — visually noisy and inconsistent with the
admins screen.

**Root cause.** An early design choice (card-per-instructor) that surfaced the
description inline. The requirement was a compact, scannable table.

**Fix.** (`components/InstructorTable.tsx`) Replaced the card list with a semantic
`<table>` — **Photo / Name / Added / Actions** — mirroring `AdminTable`
(`overflow-x-auto`, `min-w-[560px]`, `whitespace-nowrap`). The **description is
intentionally not shown** in the table (it can be long). Kept the
`data-instructor-row` hook tests depend on.

### Bug 6 — Photo crop cut off the top of the face

**Symptom.** Square thumbnails (`object-cover`, centred) cropped the top of
portrait photos — faces got cut.

**Root cause.** `object-cover` keeps the image centre; portraits put the face in
the upper third, so the centre crop removes it. There was no way to choose the
framing.

**Fix.** Added `components/ImageCropper.tsx` — a dependency-free square cropper:
drag to reposition (pointer + touch), a zoom slider, offset clamped so the frame
is always covered. On every commit it renders the visible square to a 512×512
canvas and emits a JPEG `File` via `onChange`. The modal swaps the raw pick for
this framed file at submit time (`formData.set("image", croppedFile)`), so the
**stored image is already correctly framed** (server still re-validates type/size).

### Bug 7 — Size/Font dropdowns didn't reflect the chosen value

**Symptom.** After picking a size or font, the dropdown snapped back to its
placeholder ("Font size") instead of showing the selection.

**Root cause.** The selects were uncontrolled and reset their value to `""` after
each change.

**Fix.** Made them **controlled** (`value={sizeValue}` / `value={familyValue}`),
updating state on change so the box keeps showing the last-applied value.

### Bug 8 — Long unbroken text overflowed the editor frame

**Symptom.** Typing a long string with no spaces (`hhhh…hhhh`) blew past the grey
editor frame horizontally, cutting the text and widening the modal.

**Root cause.** Default wrapping breaks at spaces only; a single long "word" has
no break opportunity, so it overflows. The editor box also grew with content.

**Fix.** Added `overflow-wrap: anywhere; word-break: break-word; white-space:
pre-wrap;` to `.instructor-rte`, plus `break-words` on the editable div, and made
the editable a **fixed-height, vertically-scrolling frame** (`h-40
overflow-y-auto`) with `overflow-hidden` on the bordered container.

### Bug 9 — Authored links were not clickable

**Symptom.** A link inserted via the toolbar appeared as styled text but clicking
it did nothing.

**Root cause.** Two parts. (1) Inside a `contentEditable`, clicking an anchor only
moves the caret — the browser never navigates. (2) The description (which holds
the links) is currently rendered **only inside the editor** — it is hidden from
the instructor table — so there was no read-only surface where the anchor was
naturally clickable.

**Fix.** (`components/RichTextEditor.tsx`) Added an editor `onClick` that detects
the clicked anchor and opens its `href` in a new tab
(`window.open(href, "_blank", "noopener,noreferrer")`). The sanitizer allows
`<a>` with safe schemes (`http`/`https`/`mailto`) and forces
`target="_blank" rel="noopener noreferrer"`, so anywhere the description is later
rendered the links are real, safe, clickable anchors. **Open item:** the
description/links are not yet shown on the instructor card — a viewer-facing
display is still needed for the links to be reachable outside the editor.

### Cross-cutting — every new formatting feature needs a sanitizer allowlist entry

**Theme.** The server sanitizer (`lib/instructors/sanitize.ts`) is the FR-009
trust boundary: it runs before persistence (and again on render). It uses a
**closed allowlist** and discards everything else. So each formatting affordance
had to be explicitly permitted, or it silently vanished on save:

- **Size / colour / font** → class-based: a `<span>` carrying one class from a
  closed set (`rte-fs-*`, `rte-c-*`, `rte-ff-*`), matched by `allowedClasses` and
  defined in `globals.css` (plain CSS, because Tailwind's JIT never scans
  DB-stored HTML rendered via `dangerouslySetInnerHTML`).
- **Alignment / indent** → constrained inline style: `allowedStyles` permits only
  `text-align` (regex-limited) and indent margins; arbitrary inline styles are
  still stripped.
- **Links** → `<a>` with `allowedSchemes: http/https/mailto` and a
  `transformTags` rule adding `target`/`rel`.

Symptom when this is forgotten: a feature "works" in the editor but disappears
after Save (the sanitizer dropped it). Always extend the allowlist **and** the
CSS together, and keep `sanitize.ts` ↔ `globals.css` in sync.

---

## Portable Instructions (drop into any project)

Rich-text editor + image-upload guardrails distilled from the bugs above.

1. **A `<select>`/colour-input in a rich-text toolbar collapses the editor's
   selection when it takes focus.** Save the selection `Range` while the editor is
   focused (on `mouseup`/`keyup` and the control's `mousedown`/`focus`) and
   restore it before applying. Prefer toolbar **buttons** with
   `onMouseDown → preventDefault()` (which preserve the selection outright) for
   anything that can be a button.

2. **The server sanitizer is the trust boundary — every formatting feature needs
   an explicit allowlist entry, or it silently disappears on save.** Prefer a
   **closed class set** (validated by `allowedClasses`, styled in plain CSS) over
   open-ended inline styles. When inline styles are unavoidable (alignment,
   indent), whitelist only specific properties with strict value regexes. Test
   each: author → save → reopen, and confirm it survives.

3. **Plain CSS classes — not Tailwind utilities — for HTML rendered via
   `dangerouslySetInnerHTML`.** Tailwind's JIT only scans source files, never
   DB-stored markup, so utility classes on sanitized HTML won't be generated.
   Define such classes as real CSS.

4. **A public storage URL that returns a broken image usually means the bucket is
   not Public, not a code bug.** If the row stored a non-null path, the upload
   succeeded; the read is failing. Verify by opening the
   `/object/public/<bucket>/<path>` URL directly. Public-bucket reads bypass RLS,
   so an admin-only write policy does not block them.

5. **Reset component-level form state on open, not just on cancel.** Preview/blob
   state lives on an always-mounted trigger; a successful-submit path that only
   closes the modal will leak stale previews into the next open. Centralise a
   `reset()` and call it whenever the form opens.

6. **Crop on the client and upload the framed result.** For avatar/portrait
   thumbnails, `object-cover` centre-crops and cuts faces. Give the user a square
   drag-and-zoom cropper, render the chosen region to a fixed-size canvas, and
   upload that `File` (swap it into `FormData` at submit) so the stored image is
   already framed. No dependency required; clamp the pan so the frame stays
   covered.

7. **Controlled `<select>` if the chosen value must stay visible.** An
   uncontrolled select that resets to `""` after `onChange` looks broken; bind
   `value` to state.

8. **Make the editable a fixed-height, scrolling frame and force word-wrap.** Use
   `overflow-wrap: anywhere` (+ `word-break: break-word`) so unbroken strings wrap
   instead of overflowing, and a fixed height with `overflow-y-auto` so the frame
   doesn't grow and reflow the surrounding layout.

9. **Links inside a `contentEditable` are not clickable by default** — the click
   only moves the caret. If the editor is the only place the content is shown, add
   an `onClick` that opens the clicked anchor in a new tab. Independently, ensure a
   read-only render surface exists wherever those links are meant to be used.
