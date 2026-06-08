# Walkthrough: Wave Management (008)

Feature branch `008-wave-management`. A wave is a `public.tenants` row evolved with a
sanitized rich-text `description_html` and an Online/Offline `type`; child tables hold
weeks, materials, assignments, and submissions, all wave-isolated at the row AND file
level. Implemented by reusing the Instructors machinery (gated Server Actions on the
cookie/RLS client, `sanitizeDescription`, `RichTextEditor`, Storage upload + best-effort
cleanup) — no service-role, no new dependency.

## How to run

```bash
npm run dev      # http://localhost:3000
npm run build    # clean
npm run lint     # clean
npm test         # 64 files, 305 passed / 4 skipped (no-creds RLS variants)
```

Migration `supabase/migrations/0008_waves.sql` is already applied to project
`fghcfihgfgqoodylwcks` (verified: seeds removed, `tenants.description_html`/`type` added,
4 `wave_*` tables created, and the two PRIVATE buckets `wave-materials` /
`assignment-submissions` created with their RLS). The buckets are created BY the migration
(`insert into storage.buckets … public=false`), so no manual dashboard step is required.

## What shipped, by phase

### Phase 1 — Wave foundation (US1.1, US1.2)
- **Waves** nav item → `lib/adminNav.tsx`; route group gated in `proxy.ts`.
- `app/admin/waves/page.tsx` — list of waves as newest-first cards (`components/WaveCard.tsx`),
  empty state, **Create wave** link.
- `app/admin/waves/new/page.tsx` + `components/WaveForm.tsx` — create form (name,
  `RichTextEditor` description, Online/Offline type); `createWave` in
  `app/admin/waves/actions.ts`.
- `app/student/dashboard/page.tsx` — renders the caller's own wave description (RLS-scoped).

### Phase 2 — Weeks & materials (US2.1, US2.2)
- `components/WaveWeeks.tsx` on `app/admin/waves/[id]/page.tsx` — add weeks; upload materials
  (PDF/PPT, ≤25 MB) to `wave-materials/‹wave_id›/‹week_id›/…`; remove week/material with
  best-effort object cleanup. Actions: `addWeek/updateWeek/removeWeek`, `addMaterial/removeMaterial`.
- `components/StudentWaveContent.tsx` — student downloads own-wave materials via short-lived
  signed URLs (a Wave-B path yields no URL).

### Phase 3 — Assignments & submissions (US3.1, US3.2)
- Admin: `addAssignment/updateAssignment/removeAssignment`; the wave page lists each
  assignment's submissions with admin signed-URL downloads.
- Student: `app/student/dashboard/actions.ts#submitAssignment` + `components/SubmitAssignment.tsx`
  — upload one submission per assignment (latest-wins upsert) to
  `assignment-submissions/‹wave_id›/‹assignment_id›/‹student_id›/submission.‹ext›`.

### Phase 4 — Manage & inline create (US4.1, US4.2)
- `components/EditWaveModal.tsx` (reuses `WaveForm`) + `components/RemoveWaveDialog.tsx`
  (`deleteWave` blocks while the wave has members or weeks — FR-018).
- `components/AddMembersModal.tsx` — a **Create wave** link in the wave chooser →
  `/admin/waves/new` (the dropdown cache `adminListKey("waves")` is invalidated on create).

## Golden-path verification

**Admin (desktop + mobile)**
1. Sidebar → **Waves** → `/admin/waves` (empty state + Create wave).
2. Create a wave (name, formatted description, Online/Offline) → appears as the top card.
3. Open the wave → add a week → upload a PDF/PPT material → add an assignment (title +
   instructions + optional due date).
4. Try to delete a wave that has a week/member → blocked with a clear message; an empty wave deletes.

**Student**
5. Sign in (member of that wave) → dashboard shows the wave description, weeks, and material
   **download** links.
6. Upload an assignment submission → admin sees/downloads it on the wave page; re-upload replaces it.

**Inline create**
7. Members → Add → in the wave chooser, **+ Create wave** → `/admin/waves/new`; after creating,
   the wave is selectable.

## Wave isolation (the non-negotiable check)
- Row level: every `wave_*` table carries `tenant_id`; student RLS is `tenant_id = jwt_tenant_id()`.
- File level: the wave id is the first Storage path segment; policies use
  `(storage.foldername(name))[1] = jwt_tenant_id()::text` (+ student-id folder for submissions).
- Covered by `tests/integration/rls.test.ts` (live cross-wave/tenantless denial for all four
  new tables) and `tests/app/student/submitAssignment.test.ts` (cannot submit to another
  wave's assignment).

## Tests added
- `tests/lib/waves/validation.test.ts`, `tests/lib/waves/files.test.ts` (pure).
- `tests/app/admin/waves/createWave.test.ts`, `manageWave.test.ts`, `materials.test.ts`,
  `wavesPage.test.tsx`.
- `tests/app/student/submitAssignment.test.ts`, `tests/app/student/studentWaveDashboard.test.tsx`.
- `tests/components/WaveForm.test.tsx`; extended `tests/components/AddMembersModal.test.tsx`
  and `tests/integration/rls.test.ts`.

## Known gaps / follow-ups
- **Manual responsive/a11y sweep** (320/390/430/768/desktop) and **Core Web Vitals** check are
  not automated — verify in-browser before sign-off (tasks T041, T042, T045).
- Week description and assignment instructions use a plain textarea (sanitized server-side);
  only the wave description uses the full `RichTextEditor`. Promote to the RTE later if richer
  week/assignment formatting is wanted.
- Student wave content is not Redis-cached (avoids per-user invalidation); revisit if the
  dashboard read becomes hot (research R10).
