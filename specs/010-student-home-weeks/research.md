# Research: Student Home & Weeks Navigation

Phase 0 decisions. Each resolves an unknown or records a best-practice choice for the design.

## R1 — Course content already exists; this is a presentation restructure

**Decision**: Reuse the feature-008 data model (`wave_weeks`, `wave_materials`, `wave_assignments`, `wave_submissions`) and the wave-scoped private Storage (`wave-materials`, `assignment-submissions`) unchanged. Do **not** introduce any new content table or storage bucket.

**Rationale**: The student dashboard already fetches and renders all of these inline (`components/StudentWaveContent.tsx`). The user's request is to *relocate* them (out of Home, into per-week Resources/Assignments reached via a Weeks nav) and *rename* the materials group to "Resources" — a UI/IA change, not a data change. The existing `signedUrl()` + wave-folder Storage policy already enforces file-level isolation.

**Alternatives considered**: A new `weeks`/`resources` schema — rejected as duplicative and risky (would re-implement isolation already proven in 008).

## R2 — Week navigation: dedicated route vs in-page state

**Decision**: Each week is a real RSC route, `app/student/dashboard/weeks/[weekId]/page.tsx`. The Weeks sidebar group links to these routes; the selected week renders server-side.

**Rationale**: RSC-first (Principle V) — week content (DB reads + signed URLs) belongs on the server, matching every other page in the app. The route falls under the existing `proxy.ts` matcher `/student/dashboard/:path*`, so session refresh and student-role gating already apply with no proxy change. Deep links and refresh land on a coherent page. Active-link highlighting reuses the shell's existing `activeHref` mechanism.

**Alternatives considered**: (a) Query-param/in-page disclosure on Home — keeps everything client-side or forces Home to fetch all weeks' content, re-coupling what we are trying to separate; rejected. (b) A `layout.tsx` wrapping Home + week routes — a layout can't easily read the active `weekId` to set `activeHref`, and the per-page shell pattern is the established convention; rejected for consistency.

## R3 — Instructor visibility: instructors are global, not wave-scoped

**Decision**: Make `instructors` rows readable by any authenticated user (admins + students) via a revised `instructors_select` RLS policy; keep `instructors_write` admin-only and instructor images publicly readable (unchanged). All students see the same instructor list on Home.

**Rationale**: The `instructors` table (migration 0005) has **no `tenant_id`** — it is global reference/display data (name, photo, bio), explicitly admin-managed. Exposing display-only instructor data to all authenticated students is therefore **not** a wave-scoped leak under Principle VI, which governs *wave-scoped member data*. The user's wording ("if I add in admin panel it will be visible for students") implies a single shared list. Management stays admin-gated, preserving the role boundary (Principle VI second clause). This is the **only** data-access change in the feature and is enforced at the RLS boundary, not in app code.

**Policy shape**:
```sql
drop policy if exists instructors_select on public.instructors;
create policy instructors_select on public.instructors
  for select using (auth.uid() is not null);   -- any signed-in user (admin or student)
-- instructors_write (admin-only) and instructor_images_admin_write are UNCHANGED.
```

**Alternatives considered**: (a) Per-wave instructor assignment (add `tenant_id` + join table) — larger scope, not requested; deferred to a future spec (recorded as an assumption). (b) Public (anon) read — unnecessary; the student panel is authenticated, so authenticated-only read is the tighter choice. (c) Reading instructors through a service-role/admin path — rejected; never use the service-role client in request code, and RLS is the correct boundary.

## R4 — Collapsible nav group in the shared DashboardShell

**Decision**: Extend `NavItem` with an optional `children?: NavItem[]`. When present, `DashboardShell` renders a disclosure: a `<button>` (label + chevron) with `aria-expanded`/`aria-controls` toggling a `useState`-driven list of indented child `<Link>`s. The group auto-expands when any child's `href === resolvedActive`. Items without `children` render exactly as today.

**Rationale**: `DashboardShell` is already a Client Component owning the drawer state, so adding local disclosure state is natural and the React Compiler handles memoization. The change is backward-compatible (admin `adminNavItems` have no `children` → unchanged rendering). Keeps one shell for both panels (Principle III consistency) and satisfies the drawer/keyboard/focus requirements (Principle IV).

**Alternatives considered**: A bespoke student-only sidebar component — rejected; it would duplicate the drawer, backdrop, Escape handling, and footer slot already in `DashboardShell`.

## R5 — Resources/Assignments disclosures in the week view

**Decision**: Render the per-week **Resources** and **Assignments** groups as native `<details>/<summary>` disclosures, styled with brand tokens, inside the RSC `StudentWeekContent`. Download links and the existing `SubmitAssignment` client component sit inside.

**Rationale**: Native `<details>` is keyboard-accessible and needs zero client JS, keeping the week view RSC-first (Principle V) — only `SubmitAssignment` remains an island. It naturally exposes expand/collapse semantics to assistive tech. Matches the reference image's "labelled control that opens a list" pattern.

**Alternatives considered**: A client `Disclosure` component with manual `aria-expanded` — more JS for no functional gain; rejected. (If a future animated/controlled variant is needed, it can replace `<details>` without changing the data layer.)

## R6 — Greeting + wave-label copy

**Decision**: Add flat string constants to `lib/strings.ts` and compose the name/wave-name in the component (e.g. `{strings.studentHomeGreetingPrefix}{name}{strings.studentHomeGreetingSuffix}` where the suffix carries the 👋). Keep the wave label as a prefix string + interpolated wave name.

**Rationale**: `lib/strings.ts` is a flat constants object (no function values); interpolation of dynamic names is done at the call site, consistent with existing usage. The 👋 ("waving hand") is the intended "hi" emoji and is plain text (no asset). Satisfies Principle III "no inline literals."

**Alternatives considered**: Template-function strings — would introduce a new pattern into `strings.ts`; rejected for consistency.

## R7 — Name and wave-name sources, unassigned state

**Decision**: Greeting name = `students.full_name` (already fetched on Home), falling back to `user.email`. Wave name = `tenants.name` (already fetched). When the student is unassigned or the wave row doesn't resolve, Home still renders greeting + QR, shows a "not in a wave yet" state for the wave line, and the Weeks group is empty/disabled.

**Rationale**: Reuses data the Home RSC already loads (no extra queries). The existing dashboard already tolerates a missing wave (`student && tenantId && wave` guard); we preserve that resilience.

## R8 — Testing strategy

**Decision**:
- Update `tests/app/student-dashboard.test.tsx`: assert "Home" labels, greeting (name + fallback), wave label, **absence** of materials/assignments, instructors section presence.
- Add `tests/app/student-week.test.tsx`: week view renders Resources/Assignments; **cross-wave** week id → not-found; wave-B material path → null URL.
- Add `tests/components/DashboardShell.test.tsx`: collapsible group toggles, `aria-expanded`/`aria-controls`, auto-expand on active child, keyboard operation, admin flat nav unchanged.
- Update `tests/integration/rls.test.ts`: a student session can `select` instructors; a student `insert/update/delete` on instructors is denied; cross-wave week/material select denied (extends existing 008 coverage).
- Optional unit test for `buildStudentNav` week labelling/ordering.

**Rationale**: Principle II (NON-NEGOTIABLE) requires shipped, deterministic tests and a cross-wave denial test for every wave-scoped path; the new week route and the instructor read/write change are exactly such paths. Mocks follow the established pattern (mock `@/lib/supabase/*` and `next/*`).

## R9 — Performance budget

**Decision**: Week view fetches only the selected week's materials/assignments/submissions (bounded). Instructor list is a single small bounded select with lazy `next/image` thumbnails (`loading="lazy"`, as in `InstructorTable`). No upload routed through a Server Action body (submission flow unchanged). Target: no regression vs LCP < 2.5s / CLS < 0.1 / INP < 200ms on mid-tier Android / Slow-4G.

**Rationale**: Moving content out of Home into per-week pages reduces Home's payload; per-week reads are smaller than the prior "all weeks" fetch. Lazy images and RSC keep client JS minimal (Principle V).
