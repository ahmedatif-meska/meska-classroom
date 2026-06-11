# Meska Classroom Constitution

Meska Classroom is Meska's learning platform for teaching professionals to use AI. It
serves Students (enrolled in a wave/cohort: view materials, submit assignments, receive
feedback, track progress) and Admins (the Meska ops team: upload content, manage waves,
review submissions, give feedback, track performance). It is read-heavy, used in long
study sessions, and accessed primarily on mobile across phones, tablets, and desktops.

## Core Principles

### I. Code Quality & Maintainability

- TypeScript strict stays on (no `any`, no unexplained `@ts-ignore`); `npm run build` and
  `npm run lint` MUST pass clean before a change is done.
- Follow App Router conventions and the `@/*` alias; extract duplicated logic into
  `lib/`. Respect the React Compiler — no manual `useMemo`/`useCallback` and no reliance
  on referential stability it may change.
- Components MUST handle long, user-generated, and AI-generated content without breaking
  layout or types.

### II. Testing Standards (NON-NEGOTIABLE)

- Behavior the platform guarantees MUST be covered by deterministic, isolated tests that
  ship with the change; a bug fix MUST include a test that failed before it.
- Every wave-scoped path MUST test the cross-wave access-denial case (see VI).
- No test runner is configured yet; the first feature needing tests MUST establish the
  tooling and record that choice in its plan.

### III. User Experience Consistency

- One calm, branded system: neon blue on white, `#EEF3F8` page background, a tight
  palette via shared tokens — new accent colors need explicit justification.
- Interaction patterns and every view's loading / empty / error states MUST stay
  consistent across Student and Admin surfaces.
- The interface is **English only, left-to-right (LTR)**. Internationalization,
  multi-language support, and right-to-left (RTL) layout are out of scope until
  reintroduced by a future amendment; until then there is no requirement to externalize
  copy for translation or to set locale/direction server-side.
- The Meska logo MUST appear in the persistent header/nav on every screen and MUST be a
  clickable link that returns the user to **their panel's home** — the Student panel home
  for students and the Admin panel home for admins (context-aware; it MUST NOT cross panel
  boundaries). It MUST be keyboard-activatable with an accessible label.
- The logo asset MUST be the canonical Meska mark sourced from `MeskaLogo.png`; no
  ad-hoc, recolored, or substitute logos.

### IV. Mobile-First, Responsive & Accessible Design

- Design mobile-first; every screen, component, modal, form, table, and nav MUST work
  from 320px through desktop with no horizontal scroll, clipping, overlap, or
  inaccessible controls.
- Use Flexbox / Grid / fluid sizing (fixed dimensions need justification); interactive
  elements MUST be touch-friendly, keyboard accessible, and show visible focus.
- Accessibility target is **WCAG 2.1 AA**: text contrast ≥ 4.5:1 (≥ 3:1 for large text and
  UI components), semantic HTML, labelled controls, and meaningful alt text. The neon-blue
  brand token MUST be verified to meet contrast on both white and `#EEF3F8`.
- Data-heavy views MUST adopt a documented mobile strategy (responsive, card transform,
  or contained scroll). Concrete thresholds live in the Quality Gates checklist. When the
  strategy is contained scroll (e.g. a wide table), the horizontal scroll MUST be confined
  to that element — the page/body MUST NOT scroll sideways.
- Primary navigation that is a fixed sidebar on desktop MUST collapse to an off-canvas
  drawer on mobile: hidden by default below the breakpoint, opened by a labelled toggle,
  shown over the content with a dismissable backdrop, and restored to the static column at
  the breakpoint and up. A fixed-width sidebar MUST NOT share a flex row with content on
  small screens. The toggle MUST expose `aria-expanded`/`aria-controls`, and the drawer
  MUST close on backdrop tap, an explicit control, nav selection, and `Escape`.
- Layout MUST NOT let controls stretch unintentionally: an action paired with a heading
  keeps its natural size (the heading takes the slack and truncates), it is not widened to
  fill a stacked column. Promote a layout component to a Client Component only at the
  smallest scope that needs the interactivity; server-rendered slots pass through as props.

### V. Performance & Responsiveness

- RSC-first: ship client JS only where interactivity requires it, and code-split heavy or
  rarely-used client code.
- Wave-scoped reads MUST be paginated or bounded; media MUST lazy-load without blocking
  the reading content.
- Changes MUST NOT regress Core Web Vitals on mobile against the baseline **LCP < 2.5s,
  CLS < 0.1, INP < 200ms**, measured on a mid-tier Android device over a Slow-4G profile;
  per-feature performance budgets MUST be stated in the plan.
- For long mobile sessions: assignment drafts MUST autosave so a dropped connection loses no
  work, and uploads MUST declare allowed formats and a maximum size, enforced both client-
  and server-side.
- File bytes MUST upload **directly from the browser to Supabase Storage** (RLS-scoped,
  with bucket-level size/MIME limits as the server-side authority) — NEVER inside a Server
  Action or route-handler request body. Hosting platforms hard-cap function request bodies
  (~4.5 MB on Vercel, not configurable) far below the feature upload ceilings, so a file
  routed through the server works on localhost and fails in production. The server receives
  only the uploaded object's **path** and MUST validate that path against the caller's
  wave/role scope before recording it (Principle VI). See
  `specs/008-wave-management/learning.md` for the incident that ratified this.

### VI. Wave Isolation & Tenant Boundaries (NON-NEGOTIABLE)

- Students see only data for waves they are enrolled in; every wave-scoped query MUST
  filter by the current user's enrollments, enforced server-side — never client-only.
- The cross-wave denial case MUST be tested for every wave-scoped path.
- Admin-only capabilities MUST be gated by server-side role checks.

**Rationale**: Cohorts pay for and trust wave boundaries; a single cross-wave leak is a
breach that cannot be traded against convenience or speed.

**Scope & bootstrapping**: This principle governs tenant isolation and role gating today.
Broader data-security controls — PII handling, data retention, encryption in transit and at
rest, authentication/session management, and audit logging — are introduced with the first
backend feature and MUST be specified in that feature's plan; until then they are out of
scope here, not waived.

### VII. Artifact Structure & Walkthroughs (NON-NEGOTIABLE)

Spec Kit artifacts MUST use these structures; reviewers MUST reject deviations.

`plan.md` (`/speckit-plan`) — acceptance criteria and test scenarios live at the **phase**
level so a phase can be signed off as a unit:

```
# Plan: <feature name>
## Phase <N> — <phase name>
  ### User Story <N.x>: <as a … I want … so that …>
    - Description
  ### Acceptance Criteria (for the phase)   — declarative, testable, one fact per bullet
  ### Test Scenarios (for the phase)        — numbered Given / When / Then, golden + edge
```

`tasks.md` (`/speckit-tasks`) — atomic, PR-sized checklist items grouped by story, by
phase:

```
# Tasks: <feature name>
## Phase <N> — <phase name>
  ### User Story <N.x>: <story title>
    - [ ] Task description (atomic, verifiable)
```

`walkthrough.md` (after `/speckit-implement` finishes a phase, in `specs/<feature>/`) MUST
cover: (1) how to run the phase (exact commands, env, URL); (2) implemented features with
their route/component path; (3) numbered golden-path verification on desktop AND mobile
(per Principle IV); (4) known gaps with a pointer to the phase that delivers them. A phase
is not done until a reviewer has followed its walkthrough end-to-end.

**Rationale**: The product is multi-phase with overlapping UI; phase → story →
criteria/tests keeps planning testable, and the walkthrough makes hand-off and
regression-checking deterministic.

## Technology & Platform Constraints

The platform is a Next.js App Router application (React with the React Compiler enabled,
TypeScript strict, Tailwind CSS). **`CLAUDE.md` is the single source of truth for exact
versions, commands, path aliases, and config flags; this constitution deliberately does
not restate them so the two cannot drift.** What is binding here is what those choices
*constrain*:

- The React Compiler and TypeScript-strict disciplines (Principle I) are enforced
  consequences of the stack, not optional preferences.
- Brand colors and the `#EEF3F8` background MUST be shared design tokens, never
  per-component literals (Principle III).
- No backend, API routes, state library, or component library is wired up yet. Adding any
  of them is an architectural decision that MUST be justified in the feature plan, with the
  rejected simpler alternative recorded (see Complexity Tracking).
- Supported browsers/devices: the latest two major versions of Chrome, Edge, Firefox, and
  Safari on desktop, plus iOS Safari and Chrome on Android (latest two). Legacy IE is not
  supported.

## Development Workflow & Quality Gates

Before a change is "done", verify in order. Steps 3–5 hold the concrete thresholds the
principles reference:

1. **Type & lint** — `npm run build` passes; `npm run lint` is clean.
2. **Tests** — required tests pass, including the cross-wave denial case for any
   wave-scoped path.
3. **Responsive & accessible** — validated at **320 / 390 / 430 / 768px and desktop**;
   inputs use **≥16px font on mobile**; no horizontal scroll at the page/body level
   (only inside a deliberately scrollable element), clipping, or overlap; sidebar nav
   collapses to a dismissable drawer on mobile; actions keep their natural size beside a
   heading rather than stretching full-width; modals and overlays scroll internally; fixed
   bars respect device safe areas; portrait and landscape both work; meets **WCAG 2.1 AA**
   (≥4.5:1 contrast, visible focus, labelled controls).
4. **UX consistency** — shared palette/tokens; loading, empty, and error states defined.
5. **Performance & resilience** — no regression against **LCP < 2.5s / CLS < 0.1 / INP <
   200ms** on a mid-tier Android over Slow-4G; query and payload bounds respected; drafts
   autosave and uploads enforce format/size limits where applicable.

Every feature plan MUST include a Constitution Check confirming these gates and recording
each data-heavy view's mobile strategy and any performance budget. Deviations MUST be
recorded in the plan's Complexity Tracking with justification and the rejected simpler
alternative.

## Governance

This constitution supersedes other development practices; on conflict, it wins.

- **Amendments** are a change to this file stating rationale and template impact, ratified
  by the Meska ops lead (ahmedatif@meska.ai) via PR review; no amendment merges without that
  sign-off. Versioning is semantic: MAJOR removes/redefines a principle, MINOR adds or
  materially expands one, PATCH clarifies wording.
- **Compliance**: every PR verifies the Quality Gates. The NON-NEGOTIABLE principles
  (II Testing, VI Wave Isolation, VII Artifact Structure) are never waived; other
  deviations require recorded justification.
- `CLAUDE.md` provides runtime guidance and MUST stay consistent with this document; if
  they diverge, this document governs and `CLAUDE.md` MUST be corrected.

**Version**: 2.2.0 | **Ratified**: 2026-06-02 | **Last Amended**: 2026-06-11


