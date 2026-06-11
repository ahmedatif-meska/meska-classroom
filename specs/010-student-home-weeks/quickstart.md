# Quickstart: Student Home & Weeks Navigation

How to run, apply the one migration, and verify the feature on desktop and mobile.

## Prerequisites

- `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and the usual server keys).
- Supabase migrations `0001`–`0014` applied. This feature adds `0015_instructors_student_read.sql`.
- Seed data to verify: at least one wave with **≥2 weeks**, each week with **≥1 material** and **≥1 assignment**; at least one **member** enrolled in that wave; at least **two instructors** created in the admin panel.

## Apply the migration

The only schema change is the instructors SELECT policy:

```bash
# via Supabase CLI (local) or apply 0015 through your migration workflow / MCP
supabase migration up   # or apply supabase/migrations/0015_instructors_student_read.sql
```

After applying, a student session can read `instructors`; student writes stay denied; admin behavior is unchanged.

## Run

```bash
npm run dev      # http://localhost:3000
```

## Verify — desktop

1. Sign in as a **member** (student). You land on `/student/dashboard`.
2. **Home**: the sidebar entry and page heading read **Home**; the page greets you **"Welcome to [your name] 👋"**; the wave section reads **"You are in wave [wave name]"** with the authored description.
3. Confirm **no materials and no assignments** appear on Home; the **QR** section is present.
4. Confirm an **About instructors** section lists the admin-created instructors (photo, name, formatted bio).
5. In the sidebar, click **Weeks** → it expands to exactly your wave's weeks (e.g. "Week 1", "Week 2").
6. Select a week → the **Resources** disclosure lists that week's materials (download one) and the **Assignments** disclosure lists assignments (download one, upload a submission → state shows "Submitted/Replace").

## Verify — mobile (≤375px / use 320, 390, 430, 768)

7. Open the hamburger drawer; expand **Weeks** inside the drawer; select a week (drawer closes); operate the Resources/Assignments disclosures.
8. Keyboard-only: Tab to the Weeks toggle and each disclosure, activate with Enter/Space, confirm visible focus and that `aria-expanded` flips.
9. No horizontal scroll at the page/body level at any width; touch targets are comfortable; ≥16px inputs.

## Verify — wave isolation (the non-negotiable check)

10. Note a `weekId` from **another** wave (as admin). As the student, visit `/student/dashboard/weeks/<that id>` → you get **Page not found**, never the other wave's content.
11. Automated: `npm test` — `tests/app/student-week.test.tsx` (cross-wave week 404, foreign material URL null), `tests/integration/rls.test.ts` (student reads instructors; student instructor-write denied; cross-wave week/material denied).

## Quality gates (before "done")

```bash
npm run build   # passes (TS strict)
npm run lint    # clean
npm test        # all green, including cross-wave denial + instructor RLS tests
```

- Responsive/accessible at 320/390/430/768/desktop; loading/empty/error states present on Home, Weeks group, week view, Resources/Assignments, instructors.
- No CWV regression (LCP < 2.5s / CLS < 0.1 / INP < 200ms) on mid-tier Android / Slow-4G; instructor photos lazy-loaded; RSC-first.

## Rollback

- Revert the feature branch UI/code changes.
- To restore admin-only instructor visibility, re-apply the 0005 policy:
  ```sql
  drop policy if exists instructors_select on public.instructors;
  create policy instructors_select on public.instructors
    for select using (public.is_admin());
  ```
