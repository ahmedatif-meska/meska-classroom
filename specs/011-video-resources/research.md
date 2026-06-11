# Research: Week Video Resources

**Feature**: 011-video-resources | **Date**: 2026-06-12

This feature attaches admin-provided **Google Drive videos** to a wave's week and
plays them inline for enrolled students. It reuses the wave-content model from
feature 008 (`wave_weeks` / `wave_materials` / `wave_assignments`). The questions
below resolve how videos differ from those existing content types.

---

## Decision 1 — Videos are a URL/file-id text field, NOT a Storage upload

**Decision**: Store each video as a row in a new `wave_videos` table whose payload
is a **Google Drive file id** (text), not uploaded file bytes. There is no Storage
bucket and no browser→Storage upload for this feature.

**Rationale**:

- The user's workflow is explicit: the admin uploads to Google Drive themselves and
  shares a link. The app never receives the media bytes.
- This sidesteps the Vercel ~4.5 MB body cap entirely (constitution Principle V) —
  there is no file in any request body, so the whole class of "works on localhost,
  fails in prod" upload bugs cannot occur here.
- A video file routed through our own Storage would be far larger than the 25 MB
  material ceiling and would re-create the upload problem feature 008 fought.

**Alternatives considered**:

- *Upload video bytes to a `wave-videos` Storage bucket* — rejected: huge files,
  bandwidth/storage cost, transcoding burden, and re-introduces the body-cap risk.
- *Embed an arbitrary admin-pasted URL (YouTube/Vimeo/Drive/any)* — rejected for
  v1: the existing placeholder (`VideoLinksSection`) hints YouTube/Vimeo, but the
  user asked specifically for Google Drive, and a single known host lets us build a
  **canonical embed URL** we control rather than trusting raw input (see Decision 3).

---

## Decision 2 — Parse and store the Drive **file id**, derive the embed URL at render

**Decision**: A pure helper `parseDriveFileId(input): string | null` extracts the
file id from the common Google Drive share-link shapes. We persist only the file id
(plus title + position). At render we build the embed URL ourselves:
`https://drive.google.com/file/d/<id>/preview`.

**Recognised input shapes** (all yield the same id):

- `https://drive.google.com/file/d/<ID>/view?usp=sharing`
- `https://drive.google.com/file/d/<ID>/preview`
- `https://drive.google.com/open?id=<ID>`
- `https://drive.google.com/uc?id=<ID>&export=download`
- a bare `<ID>` (32–44 chars of `[A-Za-z0-9_-]`)

Anything else → `null` → the admin gets a validation error (FR-002).

**Rationale**:

- Storing the id (not the raw URL) means a single value renders consistently and we
  never echo an attacker-influenced full URL into an `iframe src`.
- Mirrors the project's existing discipline of pure, Supabase-free validators
  (`lib/waves/validation.ts`, `lib/members/scan.ts`) that run identically client
  (pre-check UX) and server (authority) and are deterministically unit-tested.

**Alternatives considered**:

- *Store the raw pasted URL, sanitize at render* — rejected: weaker invariant; every
  render must re-validate, and the stored value is less predictable.

---

## Decision 3 — Inline playback via a click-to-load Google Drive `iframe` façade

**Decision**: The student week page renders, per video, a lightweight **poster +
play button** (server-rendered, brand-styled). Pressing play mounts a Google Drive
preview `iframe` (`src=.../preview`, `allow="autoplay; fullscreen"`,
`loading="lazy"`, `referrerPolicy="no-referrer"`, no `allow-popups`). Only the
play toggle is a tiny Client Component; the surrounding page stays RSC.

**Rationale**:

- **Performance (Principle V)**: a Drive `iframe` is heavy. Mounting it only on
  click keeps weeks with many videos from loading N third-party frames on open —
  protects LCP/INP on mobile and means the media never blocks the reading content.
- **UX semantics**: matches the spec's "student presses play" wording and the 2-tap
  success metric (SC-003): open week → press play.
- **RSC-first**: the façade markup is server-rendered; interactivity is the smallest
  possible client island (the play toggle), per Principle IV's "smallest scope".

**Constraint surfaced — "video unavailable" is best-effort (FR-011)**: a cross-origin
`iframe` does not reliably report load failure to the embedding page, so we cannot
deterministically detect a revoked/deleted Drive file from JS. What the app
guarantees is a **stable, non-broken frame** (fixed `aspect-video` container, never a
blank/0-height element) plus an always-present **"Open in Google Drive"** caption
link and admin guidance (FR-012) that the file must be shared "anyone with the link
can view." If sharing is wrong, Drive renders its own "request access" page inside
the frame — that is Drive's surface, not a broken app state. This is documented as a
known limitation rather than an over-promised feature.

**Alternatives considered**:

- *Eagerly render every `iframe` on page load* — rejected: N heavy third-party frames
  regress mobile CWV.
- *Custom HTML5 `<video>` with a direct Drive download URL* — rejected: Drive's
  `uc?export=download` is rate-limited, shows interstitials for large files, and is
  not a stable streaming endpoint; the official `/preview` embed is the supported path.

---

## Decision 4 — Reuse the 008 wave-content table + RLS pattern exactly

**Decision**: `wave_videos` denormalizes `tenant_id` and references `wave_weeks` with
`on delete cascade`, exactly like `wave_materials`. RLS: `select` allowed for
`is_admin() OR tenant_id = jwt_tenant_id()`; all writes `is_admin()` only. A
`position int` column carries admin ordering (FR-009).

**Rationale**: Wave isolation is non-negotiable (Principle VI); copying the proven
flat-`tenant_id` policy means the student read is the same join-free
`tenant_id = jwt_tenant_id()` predicate already covered by `tests/integration/rls.test.ts`,
and we extend that test with the cross-wave denial case for videos.

**Alternatives considered**:

- *Add video columns onto `wave_materials`* — rejected: materials are file-path rows;
  conflating a Drive-id row would muddy both the schema and the student render.

---

## Decision 5 — No Content-Security-Policy `frame-src` change required (verify)

**Decision**: Confirm during Phase 2 that no CSP `frame-src`/`child-src` directive
blocks `https://drive.google.com`. The project ships no custom CSP today (no
`headers()` in `next.config.ts`), so embedding works out of the box; if a CSP is
added later it MUST allow `https://drive.google.com`.

**Rationale**: An `iframe` to an external origin is the one place a missing/!strict CSP
silently breaks the feature; calling it out now prevents a late surprise.

---

## Summary of choices

| Concern | Choice |
|---|---|
| Storage | None — Google Drive file id in a text column |
| Validation | Pure `parseDriveFileId` (client pre-check + server authority) |
| Render | Click-to-load façade → Drive `/preview` `iframe`, lazy |
| Isolation | `wave_videos` with denormalized `tenant_id`, 008 RLS pattern |
| Ordering | `position int`, admin-controlled |
| New deps | **None** |
