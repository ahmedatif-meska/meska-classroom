# Phase 0 Research: Meska Classroom Foundation

**Feature**: `001-classroom-foundation` · **Date**: 2026-06-02

This document resolves every "NEEDS CLARIFICATION" from the plan's Technical Context. Each entry records the decision, the rationale, and the alternatives rejected.

---

## R1 — Two-panel routing structure

**Decision**: Use App Router **path segments** `app/student/` and `app/admin/`, each with its own nested `layout.tsx` (renders the shared panel shell + header) and `page.tsx` (the panel home). A shared `components/PanelShell.tsx` + `components/Header.tsx` are parameterized by a `panel` value so each layout supplies its own panel identity; the header's logo link target comes from a single source of truth in `lib/panels.ts`.

**Rationale**: Distinct URL segments are the simplest way to express two separate surfaces with no auth yet, and per-segment layouts give each panel a persistent header automatically on every nested screen (FR-003) while keeping the logo's home target inside the panel (FR-004, FR-005). Centralizing the per-panel home href in `lib/panels.ts` makes cross-panel leakage impossible by construction and testable.

**Alternatives rejected**:
- **Route groups `(student)`/`(admin)`** with no URL prefix — hides the panel in the URL, making deep links and the "stay within panel" guarantee ambiguous; rejected.
- **A single dynamic `[panel]` segment** — would centralize rendering but invites accidental cross-panel rendering and a runtime-validated allowlist; more complexity than two static segments for exactly two known panels.

---

## R2 — App root (`/`) behavior

**Decision**: The root `/` is a **minimal, branded pre-panel entry screen** that links to the Student panel and the Admin panel. It is not part of either panel; its header logo links to `/` (itself). Phase 1 ships the entry with the Student link; Phase 2 adds the Admin link.

**Rationale**: With no authentication, there is no role to route on, so a tiny chooser is the most honest landing and avoids hidden redirect logic. It keeps the panel shells clean (the panel-home logo behavior only applies *inside* a panel, matching the constitution's "their panel's home" wording). The spec explicitly deferred this UX detail to planning.

**Alternatives rejected**:
- **Redirect `/` → `/student`** — privileges one panel arbitrarily and hides the Admin panel; would also be rewritten in Phase 2.
- **Make `/` the Student home** — conflates the entry with a panel and breaks the "logo returns to panel home" invariant at the root.

---

## R3 — Brand design tokens (neon blue, contrast-verified)

**Decision**: Define shared tokens in `app/globals.css` under Tailwind v4 `@theme`:
- `--color-brand: #1B5BFF` (neon/electric blue — primary accent, links, focus ring, and fills with white text)
- `--color-surface: #FFFFFF` (content surface)
- `--color-page: #EEF3F8` (page background, per constitution)
- `--color-ink: #0A1B2E` (primary text on light surfaces)
Remove the boilerplate `--background`/`--foreground` pair and the `prefers-color-scheme: dark` block (no dark mode — see R5).

**Rationale**: `#1B5BFF` is a vivid "neon" blue that satisfies WCAG 2.1 AA in the ways the foundation uses it (verified by calculation):
- Brand-as-text **on white**: ≈ **5.27:1** (≥ 4.5:1 ✓)
- Brand-as-text **on `#EEF3F8`**: ≈ **4.91:1** (≥ 4.5:1 ✓)
- **White text on a brand fill** over white/`#EEF3F8` backgrounds: same ≈ 5.27 / 4.91:1 (≥ 4.5:1 ✓)
- As a UI-component/focus color it clears the 3:1 bar with margin.
`--color-ink #0A1B2E` on `#FFFFFF` ≈ 17:1 and on `#EEF3F8` ≈ 15:1 (≥ 4.5:1 ✓).

**Open confirmation (non-blocking)**: `#1B5BFF` is a working, accessible stand-in for "Meska neon blue." If brand guidelines specify an exact hex, swap the token value and re-verify the four ratios above; nothing else changes because all usage goes through the token.

**Alternatives rejected**:
- **`#2563EB` (Tailwind blue-600)** — accessible but reads as a calmer royal blue, less "neon."
- **Brighter cyans (e.g., `#1E90FF`)** — fail 4.5:1 for normal-size brand text on white; would force a separate darker text token and more rules.

---

## R4 — Test tooling (establishing the runner — Principle II)

**Decision**: Establish **Vitest + React Testing Library** (with `@testing-library/jest-dom` and `jsdom`) as the unit/component test runner. Add a `test` script to `package.json`. This is the "first feature needing tests establishes the tooling" moment the constitution anticipates.

**Rationale**: The foundation guarantees behavior that must be covered by deterministic tests (Principle II): the header logo resolves to the correct panel home, and the shell never emits a cross-panel link. These are pure component/render assertions — Vitest + RTL runs them fast and in isolation without a browser. Vitest aligns with the Vite/Turbopack-era toolchain, supports TS strict and the React Compiler output, and needs no Next.js server. Responsive/accessibility validation across breakpoints stays **manual via the phase `walkthrough.md`** (Principle VII), not automated here.

**Alternatives rejected**:
- **Playwright / full e2e now** — heavier setup and slower; the panel-boundary guarantee is verifiable at the component level, so e2e is deferred to a later feature that has real navigation/data.
- **Jest** — works, but Vitest has lighter config for an ESM/TS/Vite-aligned stack and faster watch.

**Note**: No wave-scoped queries exist in this feature, so the constitution's cross-wave denial test (Principle VI) is **N/A here** and is explicitly not waived — it attaches to the first wave-scoped path.

---

## R5 — Dark mode

**Decision**: **No dark mode.** Remove the `prefers-color-scheme: dark` block from `globals.css`; ship the single calm light brand theme (neon blue on white, `#EEF3F8` page).

**Rationale**: The constitution specifies one calm branded system (neon blue on white, `#EEF3F8`) and never introduces a dark palette; the boilerplate dark block contradicts the fixed page background and would double the contrast-verification surface for no requirement.

**Alternatives rejected**:
- **Keep boilerplate dark mode** — unrequested, conflicts with the mandated `#EEF3F8` background, and adds untested states.

---

## R6 — Canonical logo asset (`MeskaLogo.png`)

**Decision**: The canonical `public/MeskaLogo.png` is a **required input dependency** for this feature and does not yet exist in the repo. Implementation renders it via `next/image` in `components/Logo.tsx` with explicit `width`/`height` (to reserve space and protect CLS) and a meaningful `alt` ("Meska Classroom — go to home"). Until the real asset is supplied, a clearly-labelled placeholder PNG of the same intended dimensions is used so layout/tests are unblocked; **the placeholder MUST be replaced with the official `MeskaLogo.png` before the phase walkthrough is signed off.**

**Rationale**: The constitution mandates the canonical mark from `MeskaLogo.png` and forbids substitutes; we cannot invent a logo. Treating it as a tracked dependency with a same-dimension placeholder keeps the shell buildable and the layout/CLS stable while making the hand-off explicit.

**Alternatives rejected**:
- **Recolor/synthesize a mark** — forbidden by Principle III.
- **Ship without a logo** — violates FR-003/FR-014 and the persistent-header requirement.

---

## R7 — UI copy centralization (English-only)

**Decision**: Centralize all user-facing strings in `lib/strings.ts` as plain English constants consumed by components. No i18n library, no locale negotiation, `lang="en"` and default LTR direction on `<html>`.

**Rationale**: The clarified scope is hard English-only with no i18n machinery (no externalized-for-translation requirement). A single constants module still keeps copy out of JSX literals for consistency and easy editing, at zero i18n cost, and leaves a clean seam if localization is reintroduced later by amendment.

**Alternatives rejected**:
- **Inline string literals in components** — scatters copy and makes wording changes error-prone.
- **A full i18n framework (next-intl, etc.)** — explicitly out of scope per the clarification.

---

## Resolved Technical Context summary

| Item | Resolution |
|------|-----------|
| Routing | `app/student/*`, `app/admin/*` path segments with nested layouts (R1) |
| Root `/` | Minimal branded pre-panel entry linking panels (R2) |
| Brand tokens | `--color-brand #1B5BFF` + surface/page/ink, contrast-verified (R3) |
| Testing | Vitest + React Testing Library + jsdom; `test` script added (R4) |
| Dark mode | Removed; single light brand theme (R5) |
| Logo asset | Required `public/MeskaLogo.png` dependency; placeholder until supplied (R6) |
| Copy | Centralized English constants in `lib/strings.ts`; no i18n (R7) |
