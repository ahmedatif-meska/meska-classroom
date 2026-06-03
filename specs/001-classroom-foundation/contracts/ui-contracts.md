# UI Contracts: Meska Classroom Foundation

**Feature**: `001-classroom-foundation` · **Date**: 2026-06-02

This is a UI application with **no external/network API**. The "contracts" are the route surface and the component prop contracts that downstream features and tests depend on.

---

## Route contract

| Route | Renders | Header logo → | States provided |
|-------|---------|---------------|-----------------|
| `/` | Pre-panel entry (branded chooser linking to panels) | `/` (self) | n/a (static) |
| `/student` | Student panel home | `/student` | loading, empty, error |
| `/admin` | Admin panel home | `/admin` | loading, empty, error |
| `/student/<unknown>` | Student-scoped not-found | `/student` | not-found → path back to `/student` |
| `/admin/<unknown>` | Admin-scoped not-found | `/admin` | not-found → path back to `/admin` |
| any other unknown | Global not-found | `/` | not-found → path back to `/` (entry) |

**Guarantees (testable)**:
1. From any screen under `/student`, the header logo target is `/student` and **no** rendered link points to an `/admin` route — and vice-versa (FR-005).
2. Every panel route renders within the shared `PanelShell` (persistent header present) (FR-003).
3. Unknown routes render a branded not-found with a working path home (FR-010).
4. All routes render in English, `lang="en"`, LTR (FR-008).

---

## Component contracts

### `<PanelShell panel={Panel}>` (Server Component)
- **Input**: `panel: Panel` (from `lib/panels.ts`), `children: ReactNode`.
- **Output**: Renders `<Header panel={panel} />` then a semantic `<main>` with brand tokens and page background `--color-page`; mobile-first usable from 320px with no horizontal scroll.
- **Must**: pass `panel` straight to `Header`; never import or link the other panel.

### `<Header panel={Panel}>` (Server Component)
- **Input**: `panel: Panel`.
- **Output**: A `<header>` landmark containing `<Logo homeHref={panel.home} />` and the panel context label.
- **Must**: be identical in structure across panels; only `panel.home` varies.

### `<Logo homeHref={string}>` (Server Component)
- **Input**: `homeHref: string`.
- **Output**: A single focusable link wrapping `next/image` of `MeskaLogo.png` (explicit `width`/`height`, meaningful `alt`).
- **Must**: be keyboard-activatable, show a visible brand focus ring, and expose an accessible label; image is the canonical asset only.

### `lib/panels.ts`
- **Exports**: `PANELS: Record<'student'|'admin', Panel>` and a `Panel` type with `id`, `home` (derived as `` `/${id}` ``), `nameKey`.
- **Contract**: `home` is derived from `id`, never hand-written, so it can never point cross-panel.

### `lib/strings.ts`
- **Exports**: a flat object of English UI string constants. No component renders a hardcoded display string outside this module.

---

## Design-token contract (`app/globals.css`)

Consumers MUST use tokens, never literals (FR-012):

| Token | Value | Use |
|-------|-------|-----|
| `--color-brand` | `#1B5BFF` | accent, links, focus ring, fills (white text on it) |
| `--color-page` | `#EEF3F8` | page background |
| `--color-surface` | `#FFFFFF` | content surfaces |
| `--color-ink` | `#0A1B2E` | primary text |

Contrast guarantees verified in `research.md` R3 (all foundation usages ≥ 4.5:1; UI/focus ≥ 3:1).
