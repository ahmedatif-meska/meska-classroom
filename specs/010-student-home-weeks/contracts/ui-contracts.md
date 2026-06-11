# Contracts: Student Home & Weeks Navigation

This app exposes no public HTTP API (RSC + Server Actions). The relevant contracts are: routes, the `DashboardShell` nav contract, the student-nav builder, server component props, and the RLS authorization contract. Each item below is observable and testable.

## 1. Routes

| Route | Type | Guard | Renders |
|-------|------|-------|---------|
| `/student/dashboard` | RSC page (changed) | `proxy.ts` requires `role==='student'` | Home: greeting, wave label + description, **About instructors**, QR. **No materials/assignments.** |
| `/student/dashboard/weeks/[weekId]` | RSC page (new) | `proxy.ts` `/student/dashboard/:path*` (already matched) + in-page wave self-check | Week view: **Resources** disclosure (materials) + **Assignments** disclosure (downloads + submit). |

**Week route contract**:
- Input: `weekId` path segment.
- If the week resolves within the caller's wave → render `StudentWeekContent`.
- If the week does not exist **or belongs to another wave** → `notFound()` (404). Never renders foreign content.
- `proxy.ts` needs **no change** (matcher already covers the subpath).

## 2. `DashboardShell` nav contract (changed — backward compatible)

```ts
export type NavItem = {
  label: string;
  href: string;
  icon?: React.ReactNode;
  children?: NavItem[]; // NEW — when present, render a collapsible disclosure group
};
```

Behavior contract:
- `children == null/undefined` → renders a single `<Link>` exactly as today (admin nav unchanged).
- `children` present → renders a disclosure:
  - A `<button>` with the group label + a chevron, `aria-expanded={open}` and `aria-controls={groupId}`, keyboard-activatable with visible focus.
  - Toggling shows/hides the indented child `<Link>`s (each closes the mobile drawer on click, like existing items).
  - The group is **auto-expanded on render** when any child `href === resolvedActive`.
  - An empty `children: []` renders the group header with an in-group empty state (no crash).
- Works identically inside the mobile off-canvas drawer (Principle IV): backdrop tap / Escape / nav-click still close the drawer.

## 3. `buildStudentNav` contract (new — `lib/students/nav.tsx`)

```ts
buildStudentNav(supabase, tenantId: string | null): Promise<NavItem[]>
```
- Returns `[ Home, Weeks ]` where:
  - **Home** → `{ label: strings.studentHomeNavLabel, href: "/student/dashboard", icon }`.
  - **Weeks** → `{ label: strings.studentWeeksNavLabel, href: "#"|nav-only, icon, children }`.
- `children` = the caller's wave's weeks (`tenant_id = tenantId`), ordered by `position` asc, each:
  `{ label: title || "Week " + position, href: "/student/dashboard/weeks/" + id }`.
- `tenantId == null` or zero weeks → Weeks group with empty `children` (UI shows empty state).
- MUST only ever return the caller's own wave's weeks (RLS-bounded query). Never another wave's.

## 4. Server-component props

```ts
// components/StudentWeekContent.tsx (new)
StudentWeekContent(props: { tenantId: string; weekId: string; studentId: string }): JSX
//  → Resources disclosure (week's materials, signed-URL downloads, empty state)
//  → Assignments disclosure (week's assignments, downloads + <SubmitAssignment/>, empty state)

// components/StudentInstructors.tsx (new)
StudentInstructors(): JSX   // self-fetches the global instructor list (RLS-bounded)
//  → cards: lazy photo + name + sanitized description; empty state when none
```

## 5. Copy contract (`lib/strings.ts` additions/renames)

New/changed keys (exact wording is a copy decision; keys must exist and be referenced, no inline literals):
- `studentHomeNavLabel = "Home"`, and the Home page heading uses the greeting (below) — the "Dashboard" label/subtitle are no longer used on the student panel.
- `studentHomeGreetingPrefix = "Welcome to "`, `studentHomeGreetingSuffix = " 👋"` (composed with the name).
- `studentHomeWaveLabelPrefix = "You are in wave "` (composed with the wave name) — replaces `studentWaveSectionTitle` ("Your wave") on Home.
- `studentNoWaveNote` = unassigned/empty wave state.
- `studentWeeksNavLabel = "Weeks"`, `studentWeeksEmptyNote` (no weeks yet).
- `studentResourcesLabel = "Resources"` (student-facing label for materials), reuse `studentAssignmentsLabel`.
- `studentWeekNoMaterials`, `studentWeekNoAssignments` (per-group empty states).
- `studentInstructorsTitle = "About instructors"`, `studentInstructorsEmptyNote`.
- English-only/LTR; sourced from `strings.ts`.

## 6. RLS authorization contract (testable denials)

| Operation under a STUDENT session | Expected |
|-----------------------------------|----------|
| `select` from `instructors` | **allowed** (new) |
| `insert/update/delete` on `instructors` | **denied** |
| `select` a `wave_weeks`/`wave_materials`/`wave_assignments` row of **another** wave | **denied / empty** |
| `createSignedUrl` for another wave's material path | **null** (no link) |
| Navigate to `/student/dashboard/weeks/<foreign weekId>` | **404 (notFound)** |

| Operation under ANON session | Expected |
|------------------------------|----------|
| `select` from `instructors` | **denied** |

These rows are the acceptance hooks for `tests/integration/rls.test.ts` and `tests/app/student-week.test.tsx`.
