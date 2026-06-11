# Walkthrough: Student Home & Weeks Navigation

Covers Phases 1–3 (all implemented together). Follow end-to-end to sign off.

## How to run

```bash
# Env: .env.local with NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY (+ server keys)
# Migration 0015 is already applied to the "meska classroom" project (instructors readable by authenticated users).
npm run dev          # http://localhost:3000
npm run build        # passes (TS strict)
npm run lint         # clean
npm test             # 428 passed, 6 skipped (live RLS — needs creds)
```

Seed to exercise everything: a wave with ≥2 weeks (each with ≥1 material + ≥1 assignment), a member in that wave, ≥2 instructors in the admin panel.

## Implemented features (route / component paths)

| Feature | Path |
|---|---|
| Home (greeting, wave label, instructors, QR; no materials/assignments) | `app/student/dashboard/page.tsx` |
| Per-week view (Resources + Assignments disclosures) | `app/student/dashboard/weeks/[weekId]/page.tsx` |
| Collapsible nav group support | `components/DashboardShell.tsx` (`NavItem.children`) |
| Student nav builder (Home + Weeks) | `lib/students/nav.tsx` (`buildStudentNav`) |
| Per-week content (materials/assignments/submit) | `components/StudentWeekContent.tsx` |
| Home instructors section | `components/StudentInstructors.tsx` |
| Shared student sidebar footer | `components/StudentSidebarFooter.tsx` |
| Instructor SELECT widened to authenticated users | `supabase/migrations/0015_instructors_student_read.sql` |
| Copy | `lib/strings.ts` (student Home/Weeks/Resources/About-instructors keys) |

Removed: `components/StudentWaveContent.tsx` (replaced by the per-week view).

## Golden-path verification — desktop

1. Sign in as a member → lands on `/student/dashboard`.
2. Sidebar entry + page heading read **Home**; heading is **"Welcome to [name] 👋"**.
3. Wave section reads **"You are in wave [wave name]"** with the authored description (or empty note).
4. **No materials/assignments** on Home; an **About instructors** section lists admin instructors (photo, name, bio); the **QR** section is present.
5. Click **Weeks** in the sidebar → expands to exactly the wave's weeks ("Week 1", "Week 2", …).
6. Select a week → its view shows **Resources** (download a material) and **Assignments** (download + upload a submission → "Submitted/Replace").

## Golden-path verification — mobile (320 / 390 / 430 / 768)

1. Tap the hamburger → drawer opens; expand **Weeks** inside the drawer; select a week → drawer closes, week view loads.
2. Operate the Resources/Assignments `<details>` disclosures; download + submit work.
3. Keyboard-only: Tab to the Weeks toggle and each disclosure summary; Enter/Space toggles; visible focus; `aria-expanded` flips.
4. No page/body horizontal scroll at any width; instructor photos lazy-load.

## Wave-isolation check (non-negotiable)

- As admin, copy a `weekId` from **another** wave. As the student, visit `/student/dashboard/weeks/<that id>` → **Page not found** (never the other wave's content).
- Automated: `tests/app/student-week.test.tsx` (cross-wave week → `notFound`), `tests/components/StudentWeekContent.test.tsx` (foreign material path → null URL → plain text, no link), `tests/integration/rls.test.ts` (instructors: anon read denied, non-admin write denied, admin read ok; cross-wave wave_* denied).

## Known gaps

- The positive "authenticated **student** can read instructors" path is enforced by the RLS policy (`auth.uid() is not null`) and exercised via the app/component tests; the live integration test asserts the anon-denied + write-denied + admin-read cases (the harness has no live student session). 
- Instructors remain **global** (no per-wave assignment) — a deliberate, documented assumption (see `research.md` R3); per-wave instructors would be a separate feature.
