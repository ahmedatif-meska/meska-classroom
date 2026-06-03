# Walkthrough: Meska Classroom Foundation (Student & Admin Panels)

**Feature**: `001-classroom-foundation` · **Date**: 2026-06-02  
**Branch**: `001-classroom-foundation`

---

## How to run

```bash
npm run dev        # starts Next.js dev server on localhost:3000
npm run build      # production build (must pass)
npm run lint       # ESLint (must be clean)
npm test           # Vitest unit/component tests (must be green)
```

---

## Phase 1 — Branded shell & Student panel

### What was implemented

| File | Purpose |
|------|---------|
| `app/globals.css` | Brand tokens (`--color-brand #1B5BFF`, `--color-page #EEF3F8`, `--color-surface #FFFFFF`, `--color-ink #0A1B2E`); dark mode removed |
| `app/layout.tsx` | Root layout: `lang="en"`, metadata "Meska Classroom" |
| `lib/strings.ts` | Centralized English UI copy constants |
| `lib/panels.ts` | `Panel` type + `PANELS` config; `home` derived from `id` |
| `components/Logo.tsx` | `next/image` logo link; `aria-label`, focus ring |
| `components/Header.tsx` | `<header>` landmark with `Logo` + panel context label |
| `components/PanelShell.tsx` | Shared shell: `Header` + semantic `<main>` |
| `app/not-found.tsx` | Global branded not-found → `/` |
| `app/student/layout.tsx` | Wraps children in `<PanelShell panel={PANELS.student}>` |
| `app/student/page.tsx` | Student home: welcome + empty state scaffold |
| `app/student/loading.tsx` | Loading state |
| `app/student/error.tsx` | Error boundary (`'use client'`) with retry |
| `app/student/not-found.tsx` | Student-scoped not-found → `/student` |
| `app/page.tsx` | Pre-panel entry; logo → `/`; Student + Admin links |
| `vitest.config.ts` + `vitest.setup.ts` | Vitest + RTL test tooling (established here) |
| `public/MeskaLogo.png` | Logo asset (placeholder — see Known Gaps) |

### Routes verified

| URL | Expected |
|-----|---------|
| `localhost:3000/` | Pre-panel entry with Student and Admin links; logo → `/` |
| `localhost:3000/student` | Student home inside the branded shell |
| `localhost:3000/student/anything` | Student-scoped not-found with link back to `/student` |

### Desktop golden-path verification

1. Open `localhost:3000/` — branded entry screen, Meska logo in header.
2. Click **Student** — lands at `/student`; persistent header with logo present.
3. Click the logo — returns to `/student` (not `/` or `/admin`).
4. Navigate to `localhost:3000/student/fake-path` — Student not-found page with "Go back home" → `/student`.
5. Tab to the logo; press Enter — focus ring visible; navigates to `/student`.

### Mobile golden-path verification (repeat at 320 / 390 / 430 / 768px, portrait + landscape)

1. Open DevTools → Responsive mode; set viewport to 320px.
2. Visit `/student` — no horizontal scroll; header and home content fully visible.
3. Activate logo by tap — returns to `/student`.
4. Rotate to landscape — no horizontal scroll or overlap.
5. Repeat at 390, 430, 768px.

---

## Phase 2 — Admin panel & panel isolation

### What was implemented

| File | Purpose |
|------|---------|
| `app/admin/layout.tsx` | Wraps children in `<PanelShell panel={PANELS.admin}>` |
| `app/admin/page.tsx` | Admin home: welcome + empty state scaffold |
| `app/admin/loading.tsx` | Loading state |
| `app/admin/error.tsx` | Error boundary (`'use client'`) with retry |
| `app/admin/not-found.tsx` | Admin-scoped not-found → `/admin` |
| `app/page.tsx` | Updated to include Admin link alongside Student link |

### Routes verified

| URL | Expected |
|-----|---------|
| `localhost:3000/admin` | Admin home inside the shared shell; logo → `/admin` |
| `localhost:3000/admin/anything` | Admin-scoped not-found with link back to `/admin` |
| `localhost:3000/` | Entry now shows both Student and Admin panel links |

### Desktop golden-path verification

1. Open `localhost:3000/` — two panel links: Student and Admin.
2. Click **Admin** — lands at `/admin`; persistent header with logo showing "Admin" context.
3. Click the logo — returns to `/admin` (not `/student`).
4. Navigate to `localhost:3000/admin/fake-path` — Admin not-found with "Go back home" → `/admin`.
5. **Panel isolation check**: While on `/admin`, confirm no link in the shell points to `/student`. While on `/student`, confirm no link points to `/admin`.

### Mobile golden-path verification

Same steps as Phase 1 repeated for `/admin` at 320 / 390 / 430 / 768px, portrait + landscape.

---

## Test suite

```
Test Files  5 passed (5)
     Tests  23 passed (23)
```

Covers:
- `lib/panels.ts`: home values and cross-panel derivation invariant
- `components/Logo.tsx`: link target, single link, aria-label, alt text, focusability
- `components/PanelShell.tsx` (Student): header landmark, logo target, no admin links
- `components/PanelShell.tsx` (Admin + both-direction isolation): header landmark, logo target, both cross-panel checks
- `app/page.tsx` (entry): links to both panels, logo → `/`

---

## Known gaps

- **`public/MeskaLogo.png` is a placeholder** — the root-level `MeskaLogo.png` was copied to `public/`. The official canonical Meska mark must replace it at the same path and same dimensions (currently 160 × 28 CSS px) before phase sign-off (T032). No other code changes are needed; only the image file.
- **No authentication** — panels are reachable by URL with no role check; auth is deferred to the first backend feature per the project constitution.
- **Responsive / a11y / CWV validation** — manual checks (T033–T035) and `quickstart.md` end-to-end (T036) are documented but not automated; complete these before closing Phase 3.
