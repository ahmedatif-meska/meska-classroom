# Phase 1 Data Model: Meska Classroom Foundation

**Feature**: `001-classroom-foundation` · **Date**: 2026-06-02

This foundation has **no persistence, no backend, and no runtime data store**. The "entities" are compile-time configuration and component shapes that encode the structural guarantees (panel identity, header behavior). They are defined in TypeScript under `lib/` and `components/`.

---

## Entity: Panel

A top-level surface of the product. Exactly two static instances exist. Source of truth: `lib/panels.ts`.

| Field | Type | Rules |
|-------|------|-------|
| `id` | `'student' \| 'admin'` | Closed union; the only two panels. Used as the URL segment. |
| `home` | `` `/${id}` `` (string) | Absolute in-app path to the panel home; the header logo's link target within this panel. |
| `nameKey` | keyof copy in `lib/strings.ts` | Key for the panel's display name (English). No raw display string here. |

**Validation / invariants**:
- `home` MUST point inside the same panel (`/student` → `/student`, never `/admin`) — enforced by deriving `home` from `id` (`` `/${id}` ``), not by free-form assignment.
- The set of panels is closed; adding a panel is a deliberate code change, not runtime data.
- No panel field may reference another panel (no cross-panel links in config) — the structural backing for FR-005.

**Relationships**: `Panel 1 ── 1 PanelHome` (each panel has exactly one home screen). Panels are siblings with **no** edges between them.

---

## Entity: PanelHome

The landing screen of a panel; the destination the logo returns to. Realized as `app/<id>/page.tsx`.

| Aspect | Value |
|--------|-------|
| Route | `/student` or `/admin` |
| Content | Branded welcome + scaffold framing future sections (placeholder; no real materials/wave data) |
| States | Defined **loading** (`loading.tsx`), **error** (`error.tsx`), and an in-page **empty** state (FR-009) |

**State transitions** (per Next.js App Router rendering): `Loading` (segment pending) → `Ready` (content shown) | `Empty` (no content to show) | `Error` (render/runtime failure → `error.tsx` boundary). `NotFound` is reached for unknown sub-routes via `not-found.tsx`.

---

## Entity: PanelShell (composition contract)

Shared wrapper rendered by each panel `layout.tsx`. Server Component. Source: `components/PanelShell.tsx`.

| Prop | Type | Rules |
|------|------|-------|
| `panel` | `Panel` | The panel this shell represents; drives the header's logo target. |
| `children` | `ReactNode` | The nested page content. Must tolerate long / AI-generated text without breaking layout (Principle I). |

Renders: `<Header panel={panel} />` + a semantic `<main>` region styled with brand tokens, page background `--color-page`, mobile-first from 320px.

---

## Entity: Header / Logo (composition contract)

Persistent top region on every panel screen. Source: `components/Header.tsx`, `components/Logo.tsx`.

| Prop | Type | Rules |
|------|------|-------|
| `panel` | `Panel` | Header is rendered inside a panel; logo links to `panel.home`. |
| `homeHref` (Logo) | string | The link target; `panel.home` inside a panel, `/` at the pre-panel entry. |

**Invariants**:
- Logo is a single focusable link (`<a>`/`<Link>`), keyboard-activatable, with a visible focus ring (brand token) and an accessible label (FR-004, FR-007, FR-012).
- Logo image is the canonical `MeskaLogo.png` with explicit dimensions and meaningful `alt` (FR-014; CLS protection).
- Header structure is identical across panels; only `panel.home` differs (FR-002 consistency, FR-005 isolation).

---

## Entity: UI Copy

Centralized English strings. Source: `lib/strings.ts`.

| Aspect | Value |
|--------|-------|
| Shape | A flat object of English string constants keyed by stable identifiers (e.g., `studentPanelName`, `adminPanelName`, `entryTitle`, `notFoundTitle`, `loadingLabel`, `emptyHomeBody`). |
| Rules | No display text inline in components; English only; LTR. Not externalized for translation (out of scope per clarification). |

---

## Out of model (this feature)

User/account, Role, Wave/Cohort, Enrollment, Assignment, Submission, Material, Feedback, Progress — all deferred to later features. No identity, uniqueness, retention, or scale rules apply yet because nothing is persisted.
