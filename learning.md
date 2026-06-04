# Learning Log — Mobile Responsiveness

A running record of bugs found and fixed, with the root cause and the fix, so
the same mistakes are not repeated. The **Portable Instructions** at the bottom
are written to be dropped into any other project as guardrails.

---

## Bugs & Fixes

### Bug 1 — Persistent sidebar steals content width on mobile

**Symptom.** On a phone the admin dashboard rendered the left sidebar and the
page side-by-side. The sidebar ate ~60% of the viewport and squeezed the actual
content (e.g. "Dashboard" / "No data to display yet") into a thin strip on the
right.

**Root cause.** `DashboardShell` rendered the sidebar as a permanent flex child
(`<aside className="w-60 shrink-0 …">`) inside `flex h-screen`. That layout is
correct on desktop but never collapses, so on small screens the fixed-width
sidebar and `<main>` compete for the same row.

**Fix.** Turned the shell into a responsive off-canvas drawer
(`components/DashboardShell.tsx`):

- Below `md` (768px) the sidebar is **hidden off-canvas** (`fixed inset-y-0
  left-0 -translate-x-full`) and a **top bar with a hamburger button** appears.
- Tapping the hamburger slides the sidebar in (`translate-x-0`) over a dimmed
  backdrop (`bg-ink/40`); the page underneath stays put.
- At `md`+ the sidebar is `md:static md:translate-x-0` — i.e. the original
  always-visible column, unchanged.
- Closes on: backdrop tap, a chevron button in the drawer header, clicking any
  nav link, or pressing `Escape`.
- Accessibility: the toggle has `aria-label`, `aria-expanded`, and
  `aria-controls` pointing at the sidebar `id`.

This required adding `"use client"` to `DashboardShell` (it now owns `useState`
for the open/closed flag). The server-rendered `footer`/`children` are still
passed in as props and cross the server→client boundary fine.

### Bug 2 — Action button stretches full-width and is misaligned on mobile

**Symptom.** On the Admin Management page the "Add Admin" button rendered as a
full-width bar under the title instead of sitting compactly to the right of it.

**Root cause.** The header was `flex flex-col … sm:flex-row`. On mobile
`flex-col` stacks children, and the default `align-items: stretch` makes the
button fill the cross-axis — so an otherwise `inline-flex` button became full
width.

**Fix.** (`app/admin/admins/page.tsx`) Made the header `flex items-start
justify-between` at **all** sizes and wrapped the button in a `shrink-0`
container, so the title takes remaining space and the button stays its natural
size, pinned right. Title side got `min-w-0` so long titles truncate instead of
shoving the button off-screen.

### Bug 3 — Data table reflows into ugly stacked cards on mobile

**Symptom.** The admins table collapsed into a vertical list of stacked cards on
mobile (name, email, role… piled per row), which looked broken and lost the
"table" affordance.

**Root cause.** `AdminTable` faked a table with a CSS grid
(`sm:grid-cols-[…]`) that intentionally reflowed to a single column below `sm`.
The desired UX was a real table that **scrolls horizontally**, not a card
transform.

**Fix.** (`components/AdminTable.tsx`) Replaced the grid with a semantic
`<table>` wrapped in `overflow-x-auto`, with `min-w-[760px]` so the columns keep
their shape and the user swipes left/right to reach later columns. Cells use
`whitespace-nowrap`. Kept the `data-admin-row` hook (moved onto each `<tr>`) the
tests depend on.

### Bug 4 — Test broke because a label now appears twice

**Symptom.** After Bug 1's fix, `admin-dashboard` / `student-dashboard` tests
failed: `getByText("Admin")` / `getByText("Student")` threw "multiple elements".

**Root cause.** The panel name now legitimately appears **twice** — once in the
mobile top bar, once in the sidebar header. `getByText` asserts exactly one
match.

**Fix.** Updated those assertions to `getAllByText(…).length` `> 0`. The intent
("the panel label is shown") is preserved; the rigid single-match assumption is
dropped. Lesson: when a UI change duplicates an element by design, fix the test
to match the new truth — don't contort the UI to keep a brittle assertion.

---

## Portable Instructions (drop into any project)

Responsive/layout guardrails distilled from the bugs above. Validate every
screen at **320 / 390 / 430 / 768px and desktop** before calling a change done.

1. **Navigation that is a fixed sidebar on desktop MUST collapse to an
   off-canvas drawer on mobile.** Never let a fixed-width sidebar share a flex
   row with content on small screens. Pattern: `fixed … -translate-x-full`
   hidden by default below the breakpoint, a hamburger top bar to open it, slide
   in over a dimmed backdrop, and `md:static md:translate-x-0` to restore the
   desktop column. Close on backdrop tap, explicit close control, nav-link
   click, and `Escape`. Wire `aria-label` + `aria-expanded` + `aria-controls` on
   the toggle.

2. **Don't let buttons stretch to full width by accident.** A `flex-col`
   container stretches children via default `align-items: stretch`. For a
   title-plus-action header use `flex items-start justify-between` (at all
   breakpoints if the action should stay inline), give the action `shrink-0`,
   and give the text side `min-w-0` so it truncates instead of pushing the
   action off-screen.

3. **Pick a deliberate mobile strategy for data-heavy views: contained
   horizontal scroll *or* card transform — not an accidental squish.** For a
   real table, use a semantic `<table>` inside `overflow-x-auto` with a
   `min-w-[…]` and `whitespace-nowrap` cells so columns keep shape and the user
   swipes to see more. Only reflow to cards when that is the chosen design.

4. **A horizontally-scrolling region must be the *only* horizontal scroll.** The
   page/body must never scroll sideways — contain the overflow to the intended
   element (the table wrapper, the drawer), and verify no clipping or overlap.

5. **Keep server/client boundaries intentional when adding interactivity.**
   Promoting a layout component to `"use client"` to hold open/closed state is
   fine; server-rendered `children`/slots can still be passed through as props.
   Add `"use client"` at the smallest component that truly needs the hook, not
   the whole tree.

6. **When a UI change legitimately duplicates an element, update the test to the
   new reality** (`getAllByText`/scoped queries), rather than reshaping the UI to
   satisfy a `getByText` single-match assumption. Conversely, a real bug fix must
   ship a test that failed before the fix.

7. **Every interactive control stays touch-friendly, keyboard-accessible, and
   shows visible focus**, and mobile inputs use ≥16px font (prevents iOS zoom).
   Target WCAG 2.1 AA (≥4.5:1 contrast).
