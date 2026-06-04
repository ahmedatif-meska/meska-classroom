# Phase 0 Research: Instructors Management

Decisions that resolve the open choices in the spec and ground the plan in the existing
002/003/004 stack (Supabase + Next App Router, cookie-bound RLS client for reads, gated
Server Actions for writes). Two capabilities are **new to this codebase**: binary image
storage and a rich-text description. Both are settled below and the two that expand the
architecture are carried into the plan's Complexity Tracking.

---

## R1 — Rich-text editing approach ("font manipulation")

**Decision**: Implement the description editor as a small `contentEditable` **client island**
with a fixed toolbar offering bold, italic, underline, ordered/unordered lists, and a
constrained font-size control (FR-008's minimum). **No rich-text editor framework is added.**
The editor is uncontrolled: on submit it reads its sanitized-on-write HTML and posts it in the
form. Only this island ships client JS (RSC-first, Principle V).

**Rationale**: A toolbar over `contentEditable` covers the requested formatting with zero new
runtime dependency, honoring the tech constraint ("no component library … without justified
need"). The feature set is deliberately bounded so the markup the editor can emit is small and
fully allow-listable by the sanitizer (R2).

**Alternatives considered**: Tiptap / Lexical / Slate — robust but each is a substantial new
client dependency of component-library weight, against the constitution's tech constraint and
"simplicity first"; rejected for a baseline that only needs five formatting controls. A plain
`<textarea>` of Markdown — rejected because Markdown cannot express font size, which the user
explicitly asked for.

**Caveat recorded**: `document.execCommand` (used to apply bold/italic/underline/lists) is
deprecated but still functions in all supported target browsers; the editor does not depend on
its return value, and the **server-side sanitizer (R2) is the trust boundary**, so editor
quirks can never produce unsafe stored markup.

## R2 — Storage format & sanitization (FR-009, security boundary)

**Decision**: Store the description as **sanitized HTML** in a single `text` column. The
**trust boundary is server-side**: the create/update Server Actions pass the submitted HTML
through a vetted sanitizer with a strict allowlist **before any persistence** —
tags `b, strong, i, em, u, p, br, ul, ol, li, span`; attributes limited to `class` on `span`
(for font size, R3); **all** other tags/attributes/styles/URLs stripped. The stored value is
therefore safe to render. As defense-in-depth the same sanitizer also runs **on read** before
rendering, so even a hypothetically tainted row cannot bite.

**Rationale**: Sanitized-HTML is the only model that preserves bold/italic/underline/lists
**and** font size (FR-008). Doing the sanitization in the Server Action — never trusting the
client island — satisfies FR-009 and the project's "enforced server-side, never client-only"
discipline (Principle VI's spirit for privileged writes).

**Dependency**: one server-runnable HTML sanitizer (e.g. `sanitize-html`, a pure string
parser that needs no DOM). Carried into **Complexity Tracking**.

**Alternatives considered**: hand-rolled allowlist parser — **rejected**: security-critical
HTML parsing must use a vetted library, never bespoke code. `isomorphic-dompurify`
(DOMPurify + jsdom) — heavier server runtime (pulls a full DOM); rejected in favor of the
lighter string sanitizer. Storing raw HTML and sanitizing only on render — rejected: the write
path is the durable boundary; sanitizing on write means the database never holds unsafe markup.

## R3 — Font-size mechanism

**Decision**: The toolbar's font-size control applies one of a **small fixed set of CSS
classes** (e.g. a "small / normal / large / x-large" scale mapped to brand type tokens) wrapped
on a `<span class="…">`. The sanitizer allowlists **only** `class` on `span` and **only** those
known class names; anything else is dropped. No inline `style` attribute is permitted.

**Rationale**: A closed set of classes keeps the allowlist tiny and removes the inline-`style`
injection surface entirely, while still giving the user visible font-size control. It also keeps
the rendered description on-brand (sizes come from tokens, Principle III) rather than arbitrary
pixel values.

**Alternatives considered**: `execCommand('fontSize')`'s legacy `<font size>` markup — rejected
(non-semantic, awkward to allowlist). Arbitrary `style="font-size:…"` — rejected (opens an
inline-style surface the sanitizer would have to police value-by-value).

## R4 — Image storage & delivery

**Decision**: Store instructor photos in a **Supabase Storage** bucket `instructor-images`.
The instructor row keeps the object **path**; the displayed URL is derived from it. Render
list thumbnails and the form preview with `next/image` (lazy by default — Principle V's
lazy-media + CLS budget), adding the Supabase storage host to `next.config.ts`
`images.remotePatterns`.

**Rationale**: Durable binary storage belongs in object storage, not the row. `next/image`
gives lazy-loading and reserved dimensions (protects the CLS budget). Profile photos are
display assets, so a **public-read** bucket is acceptable and keeps delivery simple (no signed
URLs on every render).

**Alternatives considered**: base64 image bytes in a Postgres column — rejected (bloats every
row and the list payload, fights the bounded-read budget). Private bucket + per-render signed
URLs — rejected as unnecessary complexity for non-sensitive display images. A plain
`<img loading="lazy">` (no `next.config` change) — viable fallback, but `next/image`'s
dimension reservation better protects CLS, so it is preferred.

## R5 — Storage write authorization (no service-role expansion)

**Decision**: Image uploads/deletes go through the **cookie-bound anon client under Storage
RLS** — policies on `storage.objects` scope `bucket_id = 'instructor-images'` writes to
`is_admin()` — **not** the service-role Admin API. The Server Action still calls
`assertAdminSession` first (defense-in-depth), and reads/writes of the `instructors` row use
the same cookie/RLS client.

**Rationale**: Unlike 004 (which needed the Admin API only because creating/deleting
`auth.users` requires GoTrue), nothing here touches auth users — instructor rows and storage
objects are ordinary RLS-governed resources. Keeping writes on the RLS path means **this
feature adds no new service-role surface**: the privileged key stays seed/004-only.

**Alternatives considered**: service-role client for uploads — rejected (needlessly widens the
privileged surface when an `is_admin()` storage policy already enforces the boundary
server-side).

## R6 — List mobile strategy (Principle IV, documented)

**Decision**: The instructors table uses a **card transform below `sm`**: each row (thumbnail,
name, truncated description preview, added date, edit/remove actions) becomes a stacked card;
at `sm`+ it is a semantic `<table>`. No horizontal scroll at 320px.

**Rationale**: Rows carry an image + rich preview, which read better as a card than as a wide
scrolling row on a phone; this is the project's "card transform" documented strategy
(mirrors 004's R8 intent) and keeps the page body from scrolling sideways.

**Alternatives considered**: contained horizontal scroll (004's `AdminTable` approach) —
acceptable but worse for image-bearing rows on a phone; rejected here in favor of cards.

## R7 — Add/Edit surface

**Decision**: A **single shared form island** (`InstructorFormModal`) backs both add and edit —
a `role="dialog"` modal that **scrolls internally** (Principle IV), reused with empty state for
create and pre-populated for edit. Fields: name, image upload (with preview), rich-text
description (R1).

**Rationale**: Add and edit collect identical fields; one component avoids divergence and keeps
copy/validation in one place. A modal matches the established `AddAdminModal` pattern and the
constitution's "modals scroll internally" rule.

**Alternatives considered**: a dedicated `/admin/instructors/new` + `/[id]/edit` route pair —
more surfaces and nav for no added value at this scope; deferred.

## R8 — Description preview in the list

**Decision**: The list cell shows the **sanitized description rendered and visually clamped**
(line-clamp) to a couple of lines. Because the value was sanitized on write (R2), rendering it
is safe; clamping keeps rows/cards readable regardless of length (FR-016).

**Alternatives considered**: strip all tags to plain text for the preview — simpler but loses
the "beautiful" formatted glance the user asked for; the clamped sanitized render is preferred,
with tag-stripping available as a trivial fallback if clamp rendering misbehaves.

## R9 — Route, protection & states

**Decision**: The page lives at **`/admin/instructors`** (top-level under `/admin`, like
`/admin/admins`) so it inherits proxy protection via a new matcher entry
`/admin/instructors/:path*`, plus an explicit `app/admin/instructors/loading.tsx`. Empty state
via a copy string; error via the inherited `app/admin/error.tsx`.

**Rationale**: Mirrors the 004 placement so route protection, the dashboard shell, and the
loading/empty/error trio are consistent and "free."

## R10 — Ordering & bounding (Principle V)

**Decision**: List `instructors` ordered by `created_at desc`, read bounded/paginatable. At the
expected scale (tens) the full list renders; a cap/pagination is added if it grows, per the
performance principle.

## R11 — Image lifecycle on replace/remove

**Decision**: On **edit-with-new-image**, upload the new object, point the row at it, and
best-effort delete the old object. On **remove instructor**, delete the row and best-effort
delete its storage object. A failed object delete never blocks the row mutation (it is cleanup,
not correctness) and is logged best-effort.

**Rationale**: Keeps storage tidy without making row correctness depend on a second system's
delete succeeding.

---

## Resolved unknowns from the spec

| Spec assumption / open point | Resolution |
|------------------------------|------------|
| "font manipulation" scope | R1/R3 — toolbar (bold/italic/underline/lists/font-size), constrained, no editor framework |
| Description optionality | Treated **optional**; empty → neutral placeholder in the list (matches spec assumption) |
| Image type/size limits | Enforced **both** client- and server-side (Principle V); concrete allowlist (PNG/JPEG/WebP) + max size fixed in data-model/contracts |
| Where instructors appear | **Admin-only** this feature (spec assumption); no student/public surface |
| Removal semantics | Hard-delete the row + best-effort storage cleanup (R11); observable = gone from list |
| Mobile strategy | R6 — card transform `< sm` |

No NEEDS CLARIFICATION remain.
