# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — start the Next.js dev server (Turbopack, with experimental filesystem cache enabled).
- `npm run build` — production build.
- `npm start` — run the production build.
- `npm run lint` — run ESLint (flat config in `eslint.config.mjs`, extends `next/core-web-vitals` and `next/typescript`).
- `npm test` — run the full Vitest suite (jsdom, non-watch).
- `npm run test:watch` — run Vitest in watch mode.
- `npx vitest run <file>` — run a single test file, e.g. `npx vitest run tests/components/Logo.test.tsx`.
- `npm run seed:admin` — idempotently provision the bootstrap administrator (`scripts/seed-admin.ts`, run via `tsx`). Loads `.env.local`, requires migrations applied, and needs `SEED_ADMIN_PASSWORD` + `SUPABASE_SERVICE_ROLE_KEY`.

### Environment

Required env vars (see `lib/siteUrl.ts`, `lib/supabase/*`, `scripts/seed-admin.ts`):

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — request/client Supabase access (RLS-bounded).
- `SUPABASE_SERVICE_ROLE_KEY` — **server-only**, no `NEXT_PUBLIC_` prefix; used by the seed script and the Admin-API provisioning path. Never import the admin client into request/client code.
- `NEXT_PUBLIC_SITE_URL` — public origin for absolute URLs (member QR target, auth-email redirects). Falls back to `NEXT_PUBLIC_VERCEL_URL`, then `http://localhost:3000`.
- `SEED_ADMIN_PASSWORD` — only consumed by the seed script.
- `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` — **server-only** (no `NEXT_PUBLIC_` prefix); back the Redis read-cache (feature 007). **Absent ⇒ the cache helper (`lib/cache/redis.ts`) is a no-op pass-through**, so the app runs exactly as without it.

Supabase migrations live in `supabase/migrations/` (apply in order). There is also a Supabase MCP server available for inspecting/managing the project.


## Architecture

- Next.js 16 App Router project (`app/` directory). Root layout is `app/layout.tsx`; global styles in `app/globals.css` (Tailwind v4 via `@tailwindcss/postcss`, plus `tw-animate-css`).
- React 19 with the **React Compiler enabled** (`reactCompiler: true` in `next.config.ts`, `babel-plugin-react-compiler` installed). Avoid hand-written `useMemo`/`useCallback` micro-optimizations the compiler will handle; do not write code that relies on referential stability the compiler may change.
- TypeScript strict mode is on. Path alias `@/*` maps to the repo root.
- `devIndicators: false` — the Next.js dev overlay indicator is disabled.

### Two-panel structure

The app has two distinct surfaces — Student and Admin — each with two routes:

```
app/page.tsx                       ← redirect("/student")
app/student/page.tsx               ← join-session card (sign-in), centered
app/student/set-password/          ← member onboarding (set password after magic link)
app/student/auth/confirm/          ← magic-link / invite confirmation handler
app/student/dashboard/page.tsx     ← student Home (greeting, wave name, instructors, member QR — no materials/assignments here)
app/student/dashboard/weeks/[weekId]/page.tsx ← per-week view (Resources + Assignments disclosures), self-gated to the caller's wave
app/admin/page.tsx                 ← admin portal card (sign-in), centered
app/admin/forgot-password/         ← request password-reset email
app/admin/reset-password/          ← set a new password from the reset link
app/admin/auth/confirm/            ← invite / reset confirmation handler
app/admin/dashboard/page.tsx       ← admin dashboard (sidebar layout)
app/admin/admins/page.tsx          ← admin management (invite / resend / remove admins)
app/admin/instructors/page.tsx     ← instructor management (CRUD + photo + rich bio)
app/admin/members/page.tsx         ← member roster (single add, bulk CSV, QR scan)
app/admin/members/[id]/page.tsx    ← member-info page (admin-only; the QR scan target)
```

Each panel root directory also contains `loading.tsx`, `error.tsx` (`'use client'`), and `not-found.tsx`. Server Actions live in colocated `actions.ts` files (`app/admin/actions.ts`, `app/admin/instructors/actions.ts`, `app/admin/members/actions.ts`, `app/student/actions.ts`).

### Shell components (`components/`)

- `DashboardShell` — **Client Component** (`'use client'`; owns the mobile drawer open/closed `useState`). Takes `panelName`, `navItems`, `activeHref`, `footer`, and `children`. On `md`+ it renders the fixed left sidebar (panel name in brand blue) alongside a scrollable `<main>`, as before. Below `md` the sidebar is an off-canvas drawer (`fixed … -translate-x-full`, slides in over a `bg-ink/40` backdrop) opened by a hamburger top bar; it closes on backdrop tap, the in-drawer chevron, any nav-link click, or `Escape`. The toggle wires `aria-label`/`aria-expanded`/`aria-controls`. Server-rendered `footer`/`children` (e.g. `AdminSidebarFooter`, `StudentSidebarFooter`, page content) are passed in as props and cross the boundary unchanged. Used by both dashboard pages and the admins page. A `NavItem` may carry `children?: NavItem[]` (+ `childrenEmptyLabel`) to render a **collapsible disclosure group** (the student "Weeks" entry — auto-expands when a child is the active route, `aria-expanded`/`aria-controls`, drawer-aware) and an optional `sublabel` (a secondary line under the label, e.g. a week's name under "Week N"); flat items (admin nav) render unchanged.
- `AdminTable` — Server Component; renders a semantic `<table>` inside `overflow-x-auto` with `min-w-[760px]` and `whitespace-nowrap` cells, so on mobile it scrolls horizontally rather than reflowing to cards. Each `<tr>` carries `data-admin-row` (a test hook).
- `Logo` — Server Component; `next/image` wrapped in `next/link`; `aria-label` and `alt` from `lib/strings.ts`. Takes `homeHref` prop. Used on the student sign-in page.
- `PanelShell` — exists in `components/` but is currently unused (dead code from early implementation). The sign-in pages inline their own centering wrapper.

Components are Server Components by default; the interactive ones are `'use client'` (`DashboardShell`, `AddAdminModal`, `ResendInviteButton`, `RemoveAdminDialog`, and every `error.tsx`).

### Backend, auth & data (Supabase)

The app is backed by **Supabase** (Postgres + Auth + Storage). There are no Next.js API route handlers — all mutations go through **Server Actions** in `actions.ts` files, and all reads are RSC-first.

**Three Supabase clients, by privilege (`lib/supabase/`):**

- `server.ts` `createClient()` — cookie-bound anon client for Server Components / Server Actions / route handlers. Access is bounded by RLS and the user's session. **Default — use this.**
- `client.ts` — browser anon client for Client Components.
- `admin.ts` `createAdminClient()` — **service-role** client that **bypasses RLS**. Server-only (guarded; throws if the key is missing). Only used to provision/delete `auth.users` (member/admin onboarding) and by the seed script. Never import it into request/client code, and only ever call it *after* asserting the caller's admin session.

**Auth model — two separate populations, one `auth.users` table, role carried in `app_metadata`:**

- Identity is the immutable JWT claim `app_metadata.role` (`'admin'` | `'student'`) plus `app_metadata.tenant_id` (the wave) for students. These are set at user creation and are tamper-proof (Postgres RLS reads them via `auth.jwt()`).
- **Admins** are invited (Supabase *Invite* email template) and have a `public.admin_profiles` row (1:1 with `auth.users`).
- **Members (students)** are provisioned by an admin via the service-role Admin API and onboarded with the Supabase *Magic Link* template (not Invite) → `/student/auth/confirm` → set password. See `lib/members/create.ts` (`provisionMember`, `sendMemberMagicLink`).
- Pure, Supabase-free gate helpers live in `lib/auth/` (`adminGate.ts` `assertAdminSession`, `studentGate.ts` `assertStudentSession`) so the authorization guarantees are deterministically unit-tested. Every gated Server Action calls `getUser()` then asserts the gate before touching data; denials return a single generic message (never leak the reason).

**Route protection — `proxy.ts` (Next 16 `proxy`, replaces deprecated `middleware`):** runs `supabase.auth.getUser()` to validate + refresh the session and redirects `/admin/**` to `/admin` unless `role==='admin'` and `/student/dashboard/**` to `/student` unless `role==='student'`. **Exception:** `/admin/members/<id>` (the QR scan target) is matched (so its session refreshes) but **exempt from redirect** — it self-gates and renders an explicit "Unauthorized" screen, so a phone-camera scan by a non-admin sees a clear denial instead of a sign-in bounce. Its matcher is in `config.matcher`; add new protected route groups there.

**RLS is the non-bypassable boundary (`supabase/migrations/`):** policies key off `is_admin()` and `jwt_tenant_id()` SQL helpers reading the JWT claims. Admins see all tenants; a tenant-scoped (student) caller sees only rows where `tenant_id = jwt_tenant_id()` — zero cross-tenant leakage (constitution's wave-isolation principle). Audit writes go through the `SECURITY DEFINER` RPC `log_admin_auth_event` (so request code never needs the service-role key). `tests/integration/rls.test.ts` covers the cross-tenant denial case.

**Data model:** core tables are `public.tenants` (a **tenant row == a wave/cohort** — there is no separate "waves" table; scope member data by `tenant_id`), `public.admin_profiles`, `public.students` (the member roster; `status` `pending`→active, `tenant_id`, `user_id` FK to `auth.users`), `public.instructors`, the wave-content tables (`wave_weeks`, `wave_materials`, `wave_assignments`, `wave_submissions` — all `tenant_id`-scoped, feature 008), `error_logs` (feature 009), and the `admin_auth_events` audit log. Migrations are numbered `0001…0015` (apply in order); later ones add password reset, admin management, instructors, members, waves/weeks/materials/assignments, error logging, member-removed/reassigned audit reasons, own-row student select, and (0015) widening instructor SELECT so authenticated students can read the instructor directory shown on their Home — instructor **writes stay admin-only** (the table has no `tenant_id`; it is global display data, not wave-scoped, so this is not a wave-isolation concern).

**Domain logic (`lib/`):** member features in `lib/members/` (`create`, `csv` bulk-import parse/validate, `qr` QR-SVG generation, `scan` decoded-text→in-app-path validation, `validation`); instructor features in `lib/instructors/` (`image` Storage URL/upload, `sanitize` rich-text bio via `sanitize-html`, `validation`). `lib/siteUrl.ts` is the single source of truth for the public origin used in QR codes and email redirects.

**Member QR flow:** a member's dashboard shows a QR (`MemberQrCode`, rendered as inline SVG by `lib/members/qr.ts`) encoding the absolute `/admin/members/<id>` URL. An admin scans it (`ScanMemberButton`, `html5-qrcode`); `lib/members/scan.ts#targetPathFromScan` validates the decoded text and strips the origin so navigation can only ever target our own member route, never an arbitrary URL.

**File uploads (CRITICAL — browser → Storage, never through the server):** user file bytes MUST upload **directly from the browser to Supabase Storage** (anon client, RLS-bounded); the Server Action receives only the uploaded object's **path** and MUST validate it against the caller's wave/role scope before recording it (`isMaterialObjectPath` in `lib/waves/validation.ts`; exact own-slot match in `submitAssignment`). Never put a `File` in a Server Action's `FormData`: Vercel hard-caps function request bodies at ~4.5 MB (no config can raise it), so server-side uploads work on localhost and **fail in production** — and raising `serverActions.bodySizeLimit` / `proxyClientMaxBodySize` in `next.config.ts` only fixes localhost. Size/MIME are enforced server-side at the bucket (`file_size_limit` + `allowed_mime_types`, migration `0011`); client `validateMaterialFile`/`validateSubmissionFile` checks are UX only. Full incident write-up: `specs/008-wave-management/learning.md`.

### Config & copy (`lib/`)

- `lib/panels.ts` — `Panel` type and `PANELS` constant. `panel.home` is **always derived** as `` `/${panel.id}` `` — never hand-written. This is the single source of truth that makes cross-panel link leakage structurally impossible.
- `lib/strings.ts` — flat English UI copy constants. All user-facing strings must come from here; no inline string literals in components.
- `lib/adminNav.tsx` — the admin sidebar `navItems` (single source of truth shared by every admin route's `DashboardShell`).
- `lib/students/nav.tsx` — `buildStudentNav(tenantId)` builds the student sidebar: a **Home** entry plus a collapsible **Weeks** group whose children are the caller's wave's weeks (`wave_weeks` ordered by `position`, numbered "Week N" with the week's name as a `sublabel`). RLS-bounded — never lists another wave's weeks. Called by both the Home page and the per-week page.

### Brand tokens (`app/globals.css`)

Four tokens under `@theme`; consumers must use tokens, never hex literals:

| Token | Value | Use |
|-------|-------|-----|
| `--color-brand` | `#1B5BFF` | accent, links, focus ring |
| `--color-page` | `#EEF3F8` | page background |
| `--color-surface` | `#FFFFFF` | content surfaces |
| `--color-ink` | `#0A1B2E` | primary text |

### Test tooling (`tests/`)

Vitest + React Testing Library (jsdom). Config: `vitest.config.ts` (globals enabled, `@` alias, jsdom env). Setup: `vitest.setup.ts` imports `@testing-library/jest-dom`. Test files live under `tests/` mirroring source paths (`tests/lib/`, `tests/components/`, `tests/app/`, plus `tests/integration/` for RLS / seed and `tests/middleware.test.ts` for the `proxy`). Next.js modules (`next/image`, `next/link`) and Supabase clients are mocked in tests; Server Actions are tested by mocking `@/lib/supabase/*` and the auth gates. Pure domain logic (`lib/auth/`, `lib/members/`, `lib/instructors/`) is kept Supabase-free precisely so it can be unit-tested deterministically.

## Notes

- No state-management library or component library, and **no API route handlers** — all mutations are Server Actions and all reads are RSC-first. The backend is Supabase (see "Backend, auth & data" above). Follow App Router conventions and the `@/` alias for all new structure.
- The `public/MeskaLogo.png` currently present is a placeholder; the official canonical asset must replace it at the same dimensions (160 × 28 CSS px) before the feature is signed off.

## Project principles

All work MUST comply with the project constitution at `.specify/memory/constitution.md` (currently **v2.2.0**; this file MUST stay consistent with it). In particular:

- **Mobile-first, responsive & accessible** — every screen/component works from 320px through desktop; validate at 320, 390, 430, 768px and desktop. Interactive elements must be touch-friendly, keyboard accessible, and show visible focus; mobile inputs use ≥16px font. Target **WCAG 2.1 AA** (≥4.5:1 contrast). The interface is **English only, left-to-right (LTR)**; internationalization, multi-language support, and RTL are out of scope until a future amendment reintroduces them.
- **Brand & UX consistency** — neon blue on white, `#EEF3F8` page background, tight palette via shared tokens; define loading/empty/error states. The Meska logo (canonical asset `MeskaLogo.png`) sits in the persistent header on every screen and links to the user's panel home — Student home for students, Admin home for admins (context-aware, never crossing panels).
- **Wave isolation (NON-NEGOTIABLE)** — students see only data for waves they are enrolled in; every wave-scoped query filters by the current user's enrollments, enforced server-side, with the cross-wave denial case covered by tests.
- **Testing (NON-NEGOTIABLE)** — see the testing note above.
- **Performance** — RSC-first, bounded/paginated wave-scoped reads, lazy media, no Core Web Vitals (LCP/CLS/interaction) regressions on mobile. File uploads go browser → Supabase Storage directly, never through a Server Action body (see "File uploads" above).
- **Artifact structure & walkthroughs (NON-NEGOTIABLE)** — Spec Kit artifacts MUST follow Principle VII: `plan.md` nests acceptance criteria and test scenarios at the **phase** level; `tasks.md` is `## Phase N` → `### User Story N.x` → atomic `- [ ]` items; each implemented phase ships a `walkthrough.md` in `specs/<feature>/`. Reviewers reject deviations.

## Working guidelines

Behavioral guidelines to reduce common coding mistakes. These bias toward caution over speed; for trivial tasks, use judgment.

**1. Think before coding** — Don't assume; don't hide confusion; surface tradeoffs. State assumptions explicitly and ask when uncertain. If multiple interpretations exist, present them rather than picking silently. If a simpler approach exists, say so and push back when warranted. If something is unclear, stop, name what's confusing, and ask.

**2. Simplicity first** — Minimum code that solves the problem, nothing speculative. No features beyond what was asked, no abstractions for single-use code, no unrequested "flexibility"/configurability, no error handling for impossible scenarios. If 200 lines could be 50, rewrite it. Ask: "Would a senior engineer call this overcomplicated?" If yes, simplify.

**3. Surgical changes** — Touch only what you must; clean up only your own mess. Don't "improve" adjacent code, comments, or formatting; don't refactor what isn't broken; match existing style even if you'd do it differently. Remove imports/variables/functions that *your* changes made unused, but leave pre-existing dead code (mention it, don't delete it, unless asked). The test: every changed line should trace directly to the request.

**4. Goal-driven execution** — Define success criteria, then loop until verified. Turn tasks into verifiable goals ("add validation" → "write tests for invalid inputs, then make them pass"; "fix the bug" → "write a test that reproduces it, then make it pass"). For multi-step tasks, state a brief plan with a verify check per step. Strong success criteria enable independent looping; weak ones ("make it work") force constant clarification.

These are working if: fewer unnecessary changes in diffs, fewer rewrites from overcomplication, and clarifying questions come *before* implementation rather than after mistakes.

<!-- SPECKIT START -->
For additional context about technologies, project structure, shell commands,
and other important information, read the current plan at
`specs/012-attendance-points-student-reset/plan.md` (and its `research.md`,
`data-model.md`, `contracts/ui-contracts.md`, `quickstart.md`).

Each feature directory under `specs/` holds its own `plan.md`, `research.md`,
`data-model.md`, `contracts/`, `quickstart.md`, and per-phase `walkthrough.md`.
Features 001–006 are implemented and merged to `main`; 007 (Redis caching &
persistent sessions) and 008 (wave management) are merged; 009 (error logging —
central `error_logs` table capturing every unexpected error, admin-only viewing)
is merged; 010 (student Home & Weeks navigation) is merged; 011 (week video
resources — Google-Drive-hosted videos per week, `wave_videos`) is merged. Active
feature branch: `012-attendance-points-student-reset` — three features: (1) student
self-service password reset (mirrors admin 003 on the student surface, new
`is_student_email()` gate); (2) an admin **Attendance** tab — Scan QR moves from
Members, offline waves are marked present by scanning a student then picking an
offline wave + week (one record per student per calendar day, `wave_attendance`),
online waves via an email-only CSV; (3) an admin **Points** tab with an editable
`point_rules` table (attendance 10 / assignment 20 / feedback 30), student totals
derived as counts × current values, plus persisted `wave_feedback` with a
points-awarded thank-you popup.
<!-- SPECKIT END -->
