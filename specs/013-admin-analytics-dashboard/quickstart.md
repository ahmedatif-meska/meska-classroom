# Quickstart: Admin Analytics Dashboard

How to run and manually verify the feature. No migration or new env var is required — the dashboard reads existing tables.

## Prerequisites

- The repo's standard env (`.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`) and migrations `0001`–`0021` already applied (the tables this feature reads).
- An admin account to sign in with (see `npm run seed:admin`).
- Representative seed data for a meaningful view: at least 2–3 waves of differing `type` (online/offline) and `status`, members assigned to them, and some attendance, submissions, and feedback rows. (An empty platform is a valid state too — verify it shows zeros, see below.)

## Run

```bash
npm install          # no new deps; confirms lockfile unchanged
npm run dev          # http://localhost:3000
```

Sign in as an admin, then open `http://localhost:3000/admin/dashboard`.

## Tests

```bash
npm test                                   # full suite
npx vitest run tests/lib/dashboard         # aggregation + rate formulas (pure)
npx vitest run tests/components/dashboard  # chart/card components
npm run build && npm run lint              # must pass clean (Quality Gates 1)
```

## Manual verification per phase

Validate the responsive checks at **320 / 390 / 430 / 768px and desktop** (Quality Gate 3). Use the browser device toolbar.

### Phase 1 — Overview KPIs

1. Open `/admin/dashboard`. Confirm a row of KPI cards: total waves (with an online/offline sub-split), members, instructors, overall attendance rate, total points.
2. Cross-check each number against the data (e.g. compare the wave count and online/offline split to the Waves list; compare total points logic to a student's own total).
3. Shrink to 320px: cards stack vertically, nothing clips, no horizontal page scroll.
4. **Empty-platform check**: against a wave-less/member-less project (or mentally), every card reads `0` / "—" with no `NaN` and no error.

### Phase 2 — Per-wave breakdown

1. Confirm one row per wave: name, type badge, status tag (same colors as the Waves list), member count, attendance rate, submission rate, average rating.
2. Pick a wave where you know how many members have attended at least once — confirm the attendance rate matches `present ÷ members`.
3. Find/seed a wave with zero members or no activity — its rates show "—" and the row still renders.
4. Seed a very long wave name — confirm it truncates and the table scrolls inside its container (no page-level horizontal scroll on mobile).

### Phase 3 — Charts

1. Confirm the online/offline donut, waves-by-status chart, members-per-wave bars, and the top-members points leaderboard all render in brand colors.
2. Verify proportions: a 3-online / 2-offline project shows a 60/40 donut; the largest wave has the longest member bar.
3. Inspect a chart's accessible text equivalent (screen reader, or read the `aria-label`/adjacent summary in the DOM) — it states the same figures.
4. With no data for a metric, the chart shows its "No data yet" empty state, not a blank/broken graphic.

### Phase 4 — Engagement & content insights

1. Confirm panels for: total submissions + overall submission rate; average session rating, average instructor rating (1–5) + response count; content totals (weeks, materials, videos, assignments).
2. Cross-check a rating average and a content total against the underlying rows.
3. With no submissions/feedback, panels read `0` / "No responses yet" (no misleading average, no error).
4. Full-page pass: at 320/390/430/768/desktop the whole dashboard (all four sections) has no clipping, overlap, or page-level horizontal scroll; tab order and visible focus work; the sidebar collapses to the drawer on mobile.

## Done criteria

- `npm run build` + `npm run lint` clean; `npm test` green (new `lib/dashboard` and `components/dashboard` tests included).
- All numbers match seeded fixtures; no `NaN`/`Infinity`/blank anywhere.
- Responsive + a11y verified at the five breakpoints; charts have text equivalents.
- A `walkthrough.md` section exists for each implemented phase (Principle VII).
