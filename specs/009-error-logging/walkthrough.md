# Walkthrough: Error Logging (009)

One section per implemented phase (constitution Principle VII).

---

## Phase 1 — Capture foundation (server-side errors land in the table)

### How to run

```bash
npm install          # if fresh checkout
npm run dev          # http://localhost:3000
```

Env: `.env.local` with `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
(plus `SUPABASE_SERVICE_ROLE_KEY` for live integration tests). Migration
`supabase/migrations/0012_error_logs.sql` is applied to the project
(`fghcfihgfgqoodylwcks`). A seeded admin exists (`npm run seed:admin`).

### Implemented in this phase

| Piece | Path |
|-------|------|
| `error_logs` table + RLS + `log_error` RPC + pg_cron purge | `supabase/migrations/0012_error_logs.sql` |
| Pure serializer / redactor (`BOUNDS`, `sanitizeContext`, `serializeError`) | `lib/errors/serialize.ts` |
| `logError()` — never-throws RPC writer | `lib/errors/log.ts` |
| Uncaught-crash safety net (`onRequestError`, severity `fatal`) | `instrumentation.ts` |
| Wired swallow points (admin surface) | `app/admin/actions.ts` (updateAdminPassword, createAdmin ×3, resendInvite, removeAdmin), `app/admin/instructors/actions.ts` (upload + 3 CRUD), `app/admin/waves/actions.ts` (11 mutation failure branches), `app/admin/members/actions.ts` (removeMember ×2), `lib/members/create.ts` (provisionMember ×2, sendMemberMagicLink as `warning`) |
| Wired swallow points (student surface) | `app/student/actions.ts` (setStudentPassword), `app/student/dashboard/actions.ts` (submitAssignment) |
| Route protection for the upcoming viewer | `proxy.ts` (`/admin/errors/:path*` matcher) |
| Strings + admin nav entry | `lib/strings.ts`, `lib/adminNav.tsx` |

Deliberately **not** wired: validation rejections, gate denials, and the auth-confirm
invalid-link branches — these are by-design outcomes, not unexpected errors
(spec edge case "Expected vs. unexpected failures"). Uncaught crashes on those
routes are still covered by `onRequestError`.

### Golden-path verification (desktop AND mobile)

Run each step on a desktop browser and once in a mobile viewport (390px) — the
behavior under test is server-side, the UI must simply remain unchanged.

1. **Same friendly message, plus a row.** Temporarily force a failure: in the
   Supabase SQL editor run
   `alter table public.instructors rename column name to name_x;` then as an
   admin add an instructor at `/admin/instructors`. You see the existing
   "The instructor couldn't be saved. Please try again." message — nothing new.
   Now check (SQL editor, as service role):
   `select * from error_logs order by occurred_at desc limit 1;`
   → one row: `operation = createInstructor`, `surface = admin`,
   `severity = error`, your admin `user_id`/`user_role`, the real Postgres
   message ("column \"name\" ... does not exist") and detail in `stack`.
   **Restore:** `alter table public.instructors rename column name_x to name;`
2. **Anonymous attribution.** Sign out. Hit a student flow failure (e.g. submit
   the set-password form with an expired session is by-design — instead verify
   via the RPC path: the live test in `tests/integration/rls.test.ts` records an
   anonymous entry and asserts `user_id is null`). Or run
   `npx vitest run tests/integration/rls.test.ts` with creds loaded → 4 passed.
3. **Uncaught crash → fatal.** Add `throw new Error("demo crash")` at the top of
   `app/admin/dashboard/page.tsx`, visit `/admin/dashboard` (dev): the standard
   error screen renders; `error_logs` gains a `severity = fatal` row with
   `operation = onRequestError:/admin/dashboard`. Remove the line after.
   (Note: in `next dev`, the dev overlay may also show; the row is the test.)
4. **Logging never cascades.** `npx vitest run tests/lib/errors/log.test.ts` —
   the RPC-rejection and client-creation-failure cases resolve cleanly with a
   `console.error` fallback (6 passed).
5. **Admin-only reads (Principle VI).** `npx vitest run tests/integration/rls.test.ts`
   (with `.env.local` creds in the environment) → anon SELECT returns zero rows,
   direct INSERT is rejected, RPC write succeeds, message truncated at 2,000.

### Test evidence

- `tests/lib/errors/serialize.test.ts` — 11 passed (redaction, truncation, hostile inputs)
- `tests/lib/errors/log.test.ts` — 6 passed (RPC payload, defaults, never-throws, injected client)
- `tests/instrumentation.test.ts` — 5 passed (fatal/surface mapping, token-stripping, safe context, self-swallow)
- `tests/app/admin/members/createMember.test.ts` — 11 passed (6 pre-existing unchanged + 5 capture: generic states byte-identical, warning severity, never-logs-by-design)
- `tests/integration/rls.test.ts` — 4 passed live (incl. the new error_logs denial case)
- Full suite: 369 passed / 5 live-skipped-when-no-creds, `npm run lint` clean, `npm run build` clean

### Known gaps (delivered by later phases — both now shipped below)

- ~~No in-app viewing~~ → Phase 2 (`/admin/errors` + detail).
- ~~Client crashes not reported~~ → Phase 3 (`reportClientError` + `error.tsx` wiring).

---

## Phase 2 — Admin error log view

### How to run

Same as Phase 1 (`npm run dev`), signed in as an admin.

### Implemented in this phase

| Piece | Path |
|-------|------|
| Error list — newest-first, 50/page via `?page=N`, contained-scroll table, empty state | `app/admin/errors/page.tsx` |
| Entry detail — all fields; stack + context in contained-scroll `<pre>` | `app/admin/errors/[id]/page.tsx` |
| Loading state | `app/admin/errors/loading.tsx` |
| Error/not-found states | inherited from `app/admin/error.tsx` / `app/admin/not-found.tsx` (the convention every nested admin route follows — members, instructors, waves add none of their own) |
| Nav entry "Errors" (sidebar + mobile drawer) | `lib/adminNav.tsx` (Phase 1) |
| Route protection | `proxy.ts` matcher `/admin/errors/:path*` (Phase 1) + RLS admin-only SELECT |

Both pages are Server Components — **zero client JavaScript added**.

### Golden-path verification (desktop AND mobile)

1. **Seed one entry** (SQL editor):
   `select public.log_error('admin','server','error','walkthrough-demo','Demo message', E'Error: demo\n  at walkthrough', '{"step":"demo"}', 'development');`
2. **List.** As admin open `/admin/errors`: the entry is the top row showing
   time (UTC), severity chip, surface, origin, operation (linked), truncated
   message, and "Anonymous" (the SQL-editor call has no JWT). On a phone
   viewport (320–430px) the table scrolls **inside its container** — the page
   body never scrolls sideways; the drawer nav shows the highlighted "Errors"
   item.
3. **Detail.** Click the row (or View) → `/admin/errors/<id>`: every field,
   the stack in a dark contained-scroll block, the context JSON pretty-printed,
   and a "Back to errors" link. At 320px the long stack line scrolls within its
   `<pre>` only.
4. **Pagination.** With > 50 rows, "Older" appears and pages correctly;
   `?page=banana` falls back to page 1. (Covered by unit tests; seed in bulk
   with `insert into error_logs (operation) select 'bulk-'||g from generate_series(1,60) g;`
   as service role if you want to see it live.)
5. **Empty state.** Delete the demo rows → "No errors recorded".
6. **Denial.** Signed out (or as a student), `/admin/errors` redirects to
   `/admin` (proxy); even a direct REST read returns zero rows (RLS — live
   test in `tests/integration/rls.test.ts`).
7. **Cleanup:** `delete from error_logs where operation in ('walkthrough-demo') or operation like 'bulk-%';`

Responsive/accessibility checklist (Principle IV / Quality Gate 3) at
320 / 390 / 430 / 768 / desktop: contained scroll only inside the table and
`<pre>` blocks; no body-level horizontal scroll; nav collapses to the drawer;
row links and pagination buttons have visible focus rings (`focus-visible`
brand outline) and AA-contrast text.

### Test evidence

- `tests/app/admin/errors/page.test.tsx` — 5 passed (newest-first 50/page, older/newer links, invalid `?page=`, empty state, anonymous label, row links)
- `tests/app/admin/errors/detailPage.test.tsx` — 3 passed (all fields, null stack/context + anonymous, `notFound()` on unknown id)

### Known gaps

- The list has no filtering/search — out of scope by spec assumption ("viewing
  starts minimal"); layer on later if the log grows noisy.

---

## Phase 3 — Client-side crash reporting

### How to run

Same as Phase 1 (`npm run dev`).

### Implemented in this phase

| Piece | Path |
|-------|------|
| Pure report shaping (strip query/fragment, truncate, hostile-input-safe) | `lib/errors/report.ts` |
| `reportClientError` Server Action (ungated; re-validates + re-strips server-side; always resolves void) | `app/actions.ts` |
| Once-per-error reporting hook (failures swallowed) | `lib/errors/useReportClientError.ts` |
| Wired boundaries | `app/admin/error.tsx`, `app/student/error.tsx` (the only two `error.tsx` files in the app — nested admin routes inherit the panel boundary) |

### Golden-path verification (desktop AND mobile)

1. **Crash → row.** Add `throw new Error("client demo crash")` inside a Client
   Component (e.g. at the top of the `WaveForm` component body), open the page
   using it: the standard error screen renders (title + "Try again"). Then as
   admin open `/admin/errors`: a new entry with severity `error`, **origin
   `client`**, operation `clientError:/admin/waves/new`, your user attribution,
   and the browser stack. Remove the throw after.
2. **Retry unaffected by reporting failure.** Repeat step 1 with DevTools
   offline (Network → Offline): the error screen still renders and "Try again"
   still resets the boundary; no entry is created and no console crash occurs.
3. **Once per error.** With React strict-dev double-invocation and re-renders,
   the log gains one row per distinct crash instance (effect keyed on the
   error object) — verified by `tests/components/useReportClientError.test.tsx`.
4. **Mobile:** repeat step 1 in a 390px viewport — identical behavior.

### Test evidence

- `tests/lib/errors/report.test.ts` — 5 passed (query/fragment stripping, truncation, hostile inputs)
- `tests/app/reportClientError.test.ts` — 5 passed (client origin + surface mapping, server-side re-strip, malformed payloads dropped, resolves on failure)
- `tests/components/useReportClientError.test.tsx` — 4 passed (once per instance, no unhandled rejection, retry works when reporting fails)

### Known gaps

- No rate limiting on `reportClientError` — bounded by field truncation and
  small rows; can layer on the existing Upstash infra if abuse ever shows up
  (spec assumption).

---

## Final gates (all phases)

- `npm test` — **369 passed**, 5 live-skipped-without-creds (73 files); with
  `.env.local` creds loaded the live RLS suite passes 4/4 including the
  error_logs denial case.
- `npm run lint` — clean.
- `npm run build` — clean; `/admin/errors` and `/admin/errors/[id]` build as
  dynamic server-rendered routes; no new client bundles on any happy path.
- Migration `0012_error_logs` applied to project `fghcfihgfgqoodylwcks`; RPC
  smoke-tested live (truncation at 2,000, enum coercion, invalid-JSON wrap,
  anonymous attribution).
