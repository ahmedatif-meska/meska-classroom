# Quickstart: Wave Management

**Feature**: 008-wave-management

## Prerequisites

- Local env per `CLAUDE.md` (`.env.local` with Supabase URL + anon key; service-role only
  for seeding/admin provisioning — **not** needed by this feature).
- Migrations `0001…0007` applied. This feature adds **`0008_waves.sql`**.

## One-time operator setup (Supabase dashboard)

Create **two PRIVATE Storage buckets** (like `instructor-images` was created manually, but
private — NOT public):

1. `wave-materials` — **Private**.
2. `assignment-submissions` — **Private**.

The migration adds the RLS policies for both; it does **not** create the buckets.

## Apply the migration

Apply `supabase/migrations/0008_waves.sql` (via the Supabase MCP `apply_migration` or your
normal migration flow). It:
- removes the two seed `Online`/`Offline` waves,
- adds `tenants.description_html` and `tenants.type`,
- creates `wave_weeks`, `wave_materials`, `wave_assignments`, `wave_submissions` with RLS,
- adds the Storage RLS policies for the two buckets.

## Run

```bash
npm run dev      # http://localhost:3000
npm run build    # must pass clean (Principle I)
npm run lint     # must be clean
npm test         # full Vitest suite incl. RLS cross-wave denial
```

## Verify the golden path (manual)

**Admin**
1. Sign in as admin → sidebar shows **Waves** → open `/admin/waves` (empty state + Create).
2. **Create wave**: name, author a rich-text description, pick **Online/Offline** → save →
   it appears as the first card (newest-first).
3. Open the wave → **add a week** (+ optional description) → **upload a material** (PDF/PPT)
   → **add an assignment** (title + instructions + optional due date).
4. Try to **delete** a wave that has a member or a week → blocked with a clear message.

**Student** (a member enrolled in that wave)
5. Sign in → dashboard shows the **wave description**, the weeks, and **download** links for
   materials.
6. **Upload a submission** for an assignment → admin can see/download it on the wave page.

**Inline create** (US6)
7. Admin → Members → Add → in the wave chooser pick **Create wave** → lands on the same
   create page → after creating, the new wave is selectable for the members.

## Verify wave isolation (the non-negotiable check)

- As a Wave-A student, confirm the dashboard shows only Wave A's description/weeks/materials.
- Confirm a Wave-A student cannot obtain a download URL for a Wave-B material, and cannot
  read another student's submission (covered by `tests/integration/rls.test.ts`).

## Responsive / a11y pass (Principle IV)

Check `/admin/waves`, the create page, the wave detail page, and the student dashboard at
**320 / 390 / 430 / 768px and desktop**: cards reflow to one column, forms have ≥16px inputs,
no page-level horizontal scroll, visible focus, labelled controls, sidebar drawer works.
