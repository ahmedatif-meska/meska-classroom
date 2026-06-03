# Quickstart: Meska Classroom Foundation

**Feature**: `001-classroom-foundation` · **Date**: 2026-06-02

## Prerequisites

- Node + the repo dependencies installed (`npm install`).
- The canonical `public/MeskaLogo.png` asset present (a same-dimension placeholder is used until the official mark is supplied — see `research.md` R6).

## Run the app

```bash
npm run dev        # start the Next.js dev server (Turbopack)
```

Then open:

| URL | Screen |
|-----|--------|
| `http://localhost:3000/` | Pre-panel entry (links to panels) |
| `http://localhost:3000/student` | Student panel home |
| `http://localhost:3000/admin` | Admin panel home |
| `http://localhost:3000/student/anything` | Student not-found (path back to `/student`) |

## Run the checks (Quality Gates)

```bash
npm run build      # must pass (TypeScript strict, no errors)
npm run lint       # must be clean
npm test           # Vitest unit/component tests (added by this feature)
```

## What to verify manually (per phase walkthrough)

1. **Panel isolation**: from `/student`, the header logo returns to `/student`; no link leads to `/admin` (and vice-versa).
2. **Persistent header**: the Meska logo header is present on every panel screen; the logo is reachable and activatable by keyboard with a visible focus ring.
3. **Responsive**: no horizontal scroll/clipping/overlap at **320 / 390 / 430 / 768px and desktop**, portrait and landscape.
4. **States**: each panel home shows defined loading, empty, and error states; unknown routes show a branded not-found with a path home.
5. **Brand & a11y**: neon-blue-on-white with `#EEF3F8` page background via tokens; text contrast ≥ 4.5:1; English/LTR only.
6. **Performance**: panel homes meet LCP < 2.5s / CLS < 0.1 / INP < 200ms on a mid-tier Android over Slow-4G (logo dimensions reserved to protect CLS).

## Key paths

- Routes: `app/student/`, `app/admin/`, `app/page.tsx` (entry), `app/not-found.tsx`.
- Shared UI: `components/PanelShell.tsx`, `components/Header.tsx`, `components/Logo.tsx`.
- Config & copy: `lib/panels.ts`, `lib/strings.ts`.
- Tokens: `app/globals.css` (`@theme`).
