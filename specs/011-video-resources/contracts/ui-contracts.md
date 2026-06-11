# UI & Action Contracts: Week Video Resources

**Feature**: 011-video-resources | **Date**: 2026-06-12

This is a web-app feature with no public HTTP API. The contracts are (A) the Server
Actions that mutate week videos and (B) the UI surfaces that render them. All actions
are admin-gated and RLS-bounded; all reads are RSC-first.

---

## A. Server Actions (`app/admin/waves/actions.ts`)

All follow the existing wave-action shape: `(prevState, FormData) => Promise<State>`,
admin gate first (`adminClient()` → generic `wavesForbidden` on denial), `logError`
on unexpected failure, `revalidatePath(wavePath(waveId))` on success.

### `addVideo(prev, formData): VideoState`

| FormData field | Type | Required | Validation |
|---|---|---|---|
| `wave_id` | string (uuid) | yes | non-empty |
| `week_id` | string (uuid) | yes | non-empty |
| `title` | string | yes | trimmed non-empty, ≤ 200 chars |
| `drive_link` | string | yes | `parseDriveFileId` returns non-null id |

- **Effect**: inserts `{ tenant_id, week_id, title, drive_file_id, position }` with
  `position` = current max for the week + 1.
- **Returns**: `{ saved: true }` | `{ error }`.

### `updateVideo(prev, formData): VideoState`  *(Phase 3 / US3)*

Fields: `id`, `wave_id`, `title`, `drive_link` (same validation as `addVideo`).
Re-stores the re-parsed `drive_file_id`. Returns `{ saved: true }` | `{ error }`.

### `reorderVideo(prev, formData): VideoState`  *(Phase 3 / US3)*

Fields: `id`, `wave_id`, `direction` ∈ `{ "up", "down" }`. Swaps `position` with the
adjacent video in the same week. No-op at the ends. Returns `{ saved: true }` | `{ error }`.

### `removeVideo(prev, formData): VideoState`

Fields: `id`, `wave_id`. Deletes the row (no Storage cleanup — no owned object).
Returns `{ saved: true }` | `{ error }`.

**`VideoState`** = `{ error?: string; saved?: boolean }`.

**Denial contract (every action)**: a non-admin session returns `{ error: strings.wavesForbidden }`
and performs no write — never leaks the reason, never partially mutates.

---

## B. Domain contract (`lib/waves/video.ts`, pure)

```ts
/** Extract the Google Drive file id from a share link or bare id; null if not a Drive link. */
export function parseDriveFileId(input: string | null | undefined): string | null;

/** Canonical inline-player URL for a stored file id. */
export function driveEmbedUrl(fileId: string): string;   // …/file/d/<id>/preview

/** Canonical open-in-Drive URL (caption fallback). */
export function driveWatchUrl(fileId: string): string;    // …/file/d/<id>/view

export const MAX_VIDEO_TITLE_LEN = 200;
```

`parseDriveFileId` MUST: accept `/file/d/<id>/(view|preview)`, `open?id=<id>`,
`uc?id=<id>`, and a bare `[A-Za-z0-9_-]{20,}` id; return `null` for empty input,
non-Drive hosts, and ids with illegal characters.

---

## C. Admin UI contract (per-week Videos section in the wave builder)

Surface: a **Videos** section rendered per week alongside the existing Materials and
Assignments sections (`WaveBuilder` / `WaveWeeks`). Replaces the current non-persisted
`VideoLinksSection` placeholder.

- **Add form**: a text input for the title, a text input for the Drive link, an "Add
  video" button. Below the link input, helper copy: *"Paste the Google Drive share
  link. In Drive, set the file's sharing to 'Anyone with the link can view' so
  students can watch."* (FR-012).
- **List**: each existing video shows its title, a small "Open in Drive" link, a
  remove control, and (Phase 3) move-up/move-down controls. Empty state:
  *"No videos."*
- **Validation feedback**: inline `role="alert"` error on invalid link / missing title.
- **Accessibility**: labelled inputs, ≥16px font on mobile, touch-friendly controls,
  visible focus, brand tokens only.

---

## D. Student UI contract (week page video section)

Surface: `StudentWeekContent` — replace the static `VideoPlaceholder` with a
**Videos** section rendered above Resources.

- **Per video**: a `aspect-video`, brand-styled **poster with a centered play button**
  (server-rendered) and the video **title** as a caption. Pressing play mounts a
  Google Drive `/preview` `iframe` in the same frame (`loading="lazy"`,
  `allow="autoplay; fullscreen"`, `allowFullScreen`, `referrerPolicy="no-referrer"`,
  no `allow-popups`). A small "Open in Google Drive" link is always present as a
  fallback.
- **Order**: videos render by `position` ascending (admin-controlled, FR-009).
- **Empty state**: when the week has no videos, the section either shows
  *"No videos for this week yet."* or is omitted — and the Resources/Assignments
  sections render unchanged (FR-010).
- **Unavailable state**: the frame is always a stable `aspect-video` container; a
  removed/restricted Drive file shows Drive's own in-frame message plus the
  always-present "Open in Google Drive" fallback (FR-011, best-effort per research).
- **Isolation**: the query filters `tenant_id = tenantId AND week_id = week.id` and is
  RLS-bounded; a non-enrolled caller's page 404s before reaching this section (the
  week itself resolves to null), and RLS independently denies foreign rows (FR-007).
- **Accessibility**: the play button is a real `<button>` with an accessible label
  (e.g. `Play: <title>`), keyboard-activatable, visible focus; the `iframe` carries a
  `title`. WCAG 2.1 AA, validated 320 → desktop.

---

## E. Copy (`lib/strings.ts`)

New/repurposed keys (replacing the YouTube/Vimeo placeholder keys
`videoLinksLabel` / `videoLinkPlaceholder` / `videoAddLabel` / `videoRemoveLabel`):

| Key | English |
|---|---|
| `wavesVideosLabel` | "Videos" |
| `wavesVideoTitlePlaceholder` | "Video title" |
| `wavesVideoLinkPlaceholder` | "Paste Google Drive share link" |
| `wavesVideoLinkHelp` | "Paste the Google Drive share link. Set the file's sharing to 'Anyone with the link can view' so students can watch." |
| `wavesVideoAddLabel` | "Add video" |
| `wavesVideoRemoveLabel` | "Remove video" |
| `wavesVideoMoveUpLabel` | "Move up" |
| `wavesVideoMoveDownLabel` | "Move down" |
| `wavesVideosEmptyNote` | "No videos" |
| `wavesVideoTitleRequired` | "A video title is required." |
| `wavesVideoLinkInvalid` | "Enter a valid Google Drive share link." |
| `wavesVideoSaveFailed` | "The video couldn't be saved. Please try again." |
| `studentVideosLabel` | "Videos" |
| `studentWeekNoVideos` | "No videos for this week yet." |
| `studentVideoPlayLabel` | "Play" |
| `studentVideoOpenInDrive` | "Open in Google Drive" |
