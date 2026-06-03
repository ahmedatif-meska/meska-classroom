# Feature Specification: Meska Classroom Foundation (Student & Admin Panels)

**Feature Branch**: `001-classroom-foundation`

**Created**: 2026-06-02

**Status**: Draft

**Input**: User description: "I want to build the foundation of meska classroom for now under app i want to pages admin panel and student panel"

## Overview

This feature establishes the navigable foundation of Meska Classroom: two distinct panel surfaces — a **Student panel** and an **Admin panel** — each reachable at its own location with its own home screen, wrapped in the shared, branded, mobile-first shell that every future screen will inherit. It delivers the persistent header (with the context-aware Meska logo) and the brand look-and-feel. The interface is **English-only (left-to-right)** for now. It deliberately does **not** include real feature content (assignments, materials, submissions, feedback, wave data) or authentication; those arrive with later features. The value is a correct, consistent skeleton that proves the two-panel structure and the non-negotiable presentation rules before any data is layered on.

## Clarifications

### Session 2026-06-02

- Q: Should the foundation support Arabic / right-to-left and bilingual localization? → A: No. The interface is English-only (LTR) for now, with no internationalization machinery: no externalized-copy requirement, no server-side locale/direction, and no RTL support. Arabic and multi-language support are out of scope and deferred. (The project constitution and `CLAUDE.md` were amended to match.)
- Q: How is mobile layout handled — do the foundation screens need an adaptive (breakpoint-specific) layout strategy? → A: The foundation screens use a single **fluid, mobile-first responsive** layout (320px → desktop, no horizontal scroll, portrait + landscape). **Adaptive transforms** (e.g., table→card, contained-scroll) are **N/A for this feature** because it has no data-heavy views; that requirement attaches to the first feature that introduces tables or long lists.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Student opens their panel home (Priority: P1)

A student opens Meska Classroom and lands on the Student panel home — a branded screen that welcomes them and frames where their learning materials and progress will live. The persistent header carries the Meska logo; clicking or activating the logo always returns them to the Student panel home.

**Why this priority**: The Student panel is the primary surface of the product (the platform is read-heavy and student-facing). A working, branded student home is the smallest slice that demonstrates the product exists and behaves to brand and accessibility standards.

**Independent Test**: Navigate to the Student panel home with no other panel implemented; confirm the home renders with the persistent branded header, the logo returns to the Student home from anywhere in the Student panel, and the screen meets the responsive/accessibility/brand rules. Delivers a demonstrable, on-brand student entry point.

**Acceptance Scenarios**:

1. **Given** a visitor navigates to the Student panel, **When** the home screen loads, **Then** they see the Meska-branded home with the persistent header containing the Meska logo and a clearly identified "Student" context.
2. **Given** a student is anywhere within the Student panel, **When** they activate the header logo (by click or keyboard), **Then** they are returned to the Student panel home and never sent to an Admin screen.
3. **Given** the Student home is open on a 320px-wide screen, **When** the student views or rotates the device, **Then** all content and controls are usable with no horizontal scroll, clipping, or overlap.
4. **Given** the Student home is open, **When** content for the home is still loading or is empty, **Then** a defined loading state and a defined empty state are shown (never a blank or broken screen).

---

### User Story 2 - Admin opens their panel home (Priority: P2)

A member of the Meska ops team opens the Admin panel and lands on the Admin panel home — a branded screen that frames where they will manage waves, content, and submissions. The same persistent header is present; the logo here always returns them to the Admin panel home, never to a Student screen.

**Why this priority**: Admins run the platform, but no admin work can happen until student-facing surfaces and the shared shell exist; the admin home is the second slice and proves the two panels are cleanly separated.

**Independent Test**: Navigate to the Admin panel home; confirm it is a distinct surface from the Student panel, renders the branded header with the logo returning to the Admin home, and that no navigation within the Admin panel crosses into the Student panel (or vice-versa).

**Acceptance Scenarios**:

1. **Given** a visitor navigates to the Admin panel, **When** the home screen loads, **Then** they see the Meska-branded home with the persistent header and a clearly identified "Admin" context, visually consistent with the Student shell but distinct in panel identity.
2. **Given** an admin is anywhere within the Admin panel, **When** they activate the header logo, **Then** they are returned to the Admin panel home and never sent to a Student screen.
3. **Given** the Admin and Student panels both exist, **When** a user is in one panel, **Then** the panel's navigation and the logo target stay within that panel (no cross-panel leakage in either direction).

---

### Edge Cases

- **Unknown or invalid route** within or outside a panel: the user is shown a defined, branded not-found state with a way back to their panel home — not a raw error.
- **Direct deep link** to a panel location: the persistent header and correct panel context still render (the shell is never partially applied).
- **Very long or AI-generated text** placed in home content: layout holds without overflow or truncation that hides meaning.
- **Reduced motion / keyboard-only / screen-reader** users: the logo and any interactive header elements are reachable, labelled, and show visible focus.
- **Narrow 320px and landscape orientations**: header and home remain usable with no horizontal scroll.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST provide two distinct, separately addressable panel surfaces — a Student panel and an Admin panel — each with its own home screen.
- **FR-002**: Each panel home MUST render within a shared, consistent, Meska-branded shell (neon blue on white, `#EEF3F8` page background, shared palette) so the two panels look like one system while remaining distinct in panel identity.
- **FR-003**: A persistent header carrying the canonical Meska logo MUST appear on every screen of both panels.
- **FR-004**: The header logo MUST be a clickable, keyboard-activatable link with an accessible label that returns the user to **their current panel's home** — Student logo → Student home, Admin logo → Admin home.
- **FR-005**: Navigation and the logo target MUST never cross panel boundaries: a user in the Student panel is never sent to an Admin screen by the shell, and vice-versa.
- **FR-006**: Every screen MUST be usable and visually correct from 320px width through desktop, with no horizontal scroll, clipping, or overlap, in both portrait and landscape.
- **FR-007**: Interactive elements (including the logo and any header controls) MUST be touch-friendly, keyboard accessible, and show a visible focus indicator.
- **FR-008**: The interface MUST be presented in English with a left-to-right layout; no other language or right-to-left support is in scope for this feature.
- **FR-009**: Each panel home MUST define and display loading, empty, and error states (no blank or broken screens).
- **FR-010**: The system MUST present a defined, branded not-found state for unknown routes, with a path back to the user's panel home.
- **FR-011**: The interface MUST meet WCAG 2.1 AA: text contrast ≥ 4.5:1 (≥ 3:1 for large text and UI components), semantic structure, labelled controls, and meaningful alternative text for the logo.
- **FR-012**: Brand colors and the page background MUST be applied via shared design tokens, not per-screen literals.
- **FR-013**: The Meska logo MUST be the canonical mark from the approved logo asset — no recolored, substitute, or ad-hoc logos.

### Out of Scope (this feature)

- Authentication, login, sessions, and real role determination (a visitor reaches a panel by its address; true role gating arrives with the first backend feature).
- Wave/cohort data, enrollment, and wave isolation behavior beyond the structural panel separation above.
- Real feature content: materials, assignments, submissions, feedback, progress tracking, content upload, wave management.
- Any backend, data persistence, or API.

### Key Entities

- **Panel**: A top-level surface of the product with its own identity and home. Two exist: **Student panel** and **Admin panel**. A panel bounds navigation and the logo's home target.
- **Panel Home**: The landing screen for a panel; the destination the logo returns to within that panel.
- **Persistent Header**: The always-present top region carrying the Meska logo and panel context, shared in structure across both panels.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A user can reach the Student panel home and the Admin panel home as two clearly distinct, branded surfaces, each with the persistent header present.
- **SC-002**: From any screen within a panel, activating the logo returns the user to that panel's home in 100% of cases, with zero cross-panel navigations observed in testing.
- **SC-003**: Both panel homes render with no horizontal scroll, clipping, or overlap at 320, 390, 430, and 768px and at desktop width.
- **SC-004**: Both panel homes pass WCAG 2.1 AA checks for contrast, visible focus, labelled controls, and logo alternative text; the logo is fully operable by keyboard alone.
- **SC-005**: Every panel home presents a defined loading state, empty state, and error state, and unknown routes present a branded not-found state with a path home — verified with zero blank/broken screens.
- **SC-006**: On a mid-tier mobile device over a constrained connection, each panel home meets the platform's mobile performance bar (LCP < 2.5s, CLS < 0.1, INP < 200ms).

## Assumptions

- **No authentication in this feature**: Per the project constitution, authentication/session management arrives with the first backend feature. Here, a visitor reaches a panel by its address; the panels are structurally separated but not yet access-gated by role. This is the highest-impact scope assumption.
- **Foundation content is placeholder**: Panel homes frame where future content will live (welcome/intro and section scaffolding) rather than showing real materials, assignments, or wave data.
- **English-only (LTR)**: the interface ships in English with a left-to-right layout and no internationalization machinery; Arabic, other languages, and RTL support are deferred (see Clarifications).
- **Fluid responsive, no adaptive transforms yet**: foundation screens use one mobile-first responsive layout (320px → desktop). Because there are no data-heavy views (tables/long lists) in this feature, breakpoint-specific adaptive transforms (card/contained-scroll) are not required here; that strategy is owned by the first feature that introduces such views (see Clarifications).
- **Two panels only** for now (Student, Admin); no additional roles or sub-panels.
- **Reuses the existing scaffold**: builds on the current App Router project, its brand tokens, and the canonical logo asset; no new backend, state library, or component library is assumed by the spec (any such choice is an implementation decision for the plan).
- **A single landing decision** at the app root (how a bare visit routes toward a panel) is a UX detail to be settled in planning; it does not change the two-panel scope above.
