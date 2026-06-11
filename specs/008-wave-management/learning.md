# Learning: File uploads must go browser → Supabase Storage, never through the server

**Date**: 2026-06-11 · **Feature**: 008-wave-management · **Severity**: production outage
(uploads > 4.5 MB failed on Vercel while working on localhost)

## Symptom

Saving a wave with an 11 MB assignment PDF failed with:

> The wave couldn't be saved. Please try again. (An unexpected response was received
> from the server.)

Small files (~630 KB) saved fine. The same large file later **worked on localhost but
failed on the production link** — the most misleading possible combination, because every
local test passes and the bug only exists deployed.

## Root cause — three stacked body-size limits

File bytes travelled inside the Server Action's `FormData`, which made the upload an HTTP
POST to our own Next.js server. That request body hits **three independent caps**, each
discovered the hard way:

| Layer | Limit | Configurable? |
|---|---|---|
| `experimental.serverActions.bodySizeLimit` | 1 MB default | yes (we set 30 MB) |
| `experimental.proxyClientMaxBodySize` — Next clones the body of every request matched by `proxy.ts` so it can replay it to the route; the clone is **silently truncated** at the cap, producing busboy's "Unexpected end of form" | 10 MB default | yes (we set 30 MB) |
| **Vercel serverless function request body** | **~4.5 MB** | **NO — platform hard cap** |

The first two could be raised in `next.config.ts`. The third cannot be raised by any
config, which makes routing file bytes through a Server Action (or any route handler) a
**dead end in production** for anything above 4.5 MB.

## The rule (now constitution Principle V)

> File uploads MUST go directly from the browser to Supabase Storage. A Server Action
> never receives file bytes — it receives the uploaded object's **path** and MUST
> validate that path against the caller's scope before recording it.

## How it is implemented here

1. **Client uploads the bytes** with the anon browser client (`lib/supabase/client.ts`);
   Storage RLS already confines who may write where (admin → `wave-materials`; student →
   only `‹wave›/‹assignment›/‹own-student-id›/` in `assignment-submissions`).
   See `components/WaveBuilder.tsx` and `components/SubmitAssignment.tsx`.
2. **Client sends only the path** in the action's `FormData` (`file_path`), plus the
   display title.
3. **Server validates the path before trusting it** — this is the security-critical step,
   because the path is now client input:
   - materials/assignments: `isMaterialObjectPath()` (`lib/waves/validation.ts`) requires
     exactly `‹waveId›/‹weekId›/(assignment-)‹uuid›.‹allowed-ext›` — wave id first
     (Principle VI isolation invariant), no traversal, no extra segments;
   - submissions: the action recomputes `submissionPath(tenant, assignment, student, ext)`
     for each allowed extension and requires an **exact match** with the caller's own slot.
4. **Size/MIME enforcement moved to the bucket** (migration
   `0011_storage_upload_limits.sql`: `file_size_limit` 25 MB + `allowed_mime_types`),
   because the server never sees the bytes anymore — client-side `validateMaterialFile`
   is UX, the bucket is the authority.

## How to not regress

- Any new feature that accepts a user file (photos, CSVs above trivial size, exports)
  follows the same shape: browser → Storage, path → action, action validates the path.
  Known residual: instructor photos still ride through a Server Action (≤ 5 MB limit vs
  the 4.5 MB cap — fails for 4.5–5 MB photos in production).
- Never "fix" an upload size problem by raising `bodySizeLimit` /
  `proxyClientMaxBodySize` alone — that only moves the failure from localhost to
  production, where the 4.5 MB Vercel cap still wins.
- **Test uploads against the deployed environment, not just `npm run dev`** — this entire
  class of bug is invisible locally.
