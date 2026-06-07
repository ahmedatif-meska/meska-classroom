# Learning Log — Add Members (006)

A running record of the bugs hit while building member management (add via
form/CSV, per-member QR, Magic-Link onboarding, student sign-in, QR scanning,
delete) and exactly how each was fixed, with root causes, so the same mistakes
are not repeated. The **Portable Instructions** at the bottom are written to drop
into any other Supabase + Next.js App Router project as guardrails.

Architecture note carried through this feature: **a wave is a `public.tenants`
row** (the isolation boundary), and **Supabase allows one email template per type
per project** — so members onboard via the **Magic Link** template while admins
keep **Invite**/**Reset Password** (004). Members log in with **email + password**
(the email *is* the login ID).

---

## Bugs & Fixes

### Bug 1 — `refresh_token_not_found` when opening the onboarding link

**Symptom.** Opening the member onboarding email link threw
`AuthApiError: Invalid Refresh Token: Refresh Token Not Found`.

**Root cause.** Members were initially routed through the same implicit
`{{ .ConfirmationURL }}` email flow as admins. That URL hits Supabase's
`/auth/v1/verify` endpoint **on open**, which consumes the single-use token and
redirects with the session in the URL *hash* — incompatible with our
click-to-verify (token-hash) confirm page, and fragile to inbox prefetch.

**Fix.** Give members their own template and a token-hash flow:
`lib/members/create.ts` provisions with `admin.auth.admin.createUser({ email_confirm:true, app_metadata:{ role:'student', tenant_id } })` and then sends the
**Magic Link** email via an isolated anon client
(`signInWithOtp({ email, options:{ shouldCreateUser:false, emailRedirectTo:'…/student/auth/confirm' } })`).
**Operator step (dashboard):** set the **Magic Link** template to the token-hash
form and allow the redirect URL:
```html
<p>Welcome to Meska Classroom. Your login ID is your email address.</p>
<p><a href="{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=email">Set your password</a></p>
```
plus **Auth → URL Configuration → Redirect URLs**: `${SITE}/student/auth/confirm`.

### Bug 2 — "This link is invalid or has expired" after clicking Continue

**Symptom.** Onboarding worked on the first verify, but the member landed on the
invalid-link screen. Tapping browser back / re-submitting reproduced it. Supabase
auth logs showed `/verify 200` (login) immediately followed by `/verify 403
otp_expired` ~3s later.

**Root cause.** The OTP is **single-use**. The Continue form was submitted twice
(double-tap / back-then-resubmit). The first verify created a valid session; the
second failed with `otp_expired`, and the old code did `if (error) return reject()`
on that second call — throwing away a perfectly good session.

**Fix.** (`app/student/actions.ts` `confirmStudentInvite`) Make confirmation
**idempotent**: still attempt `verifyOtp`, but decide on the *resulting session*,
not this call's error. If a valid student session exists (from the first verify),
proceed to set-password; only reject when there is no session, and sign out a
non-student token. Passive prefetch stays safe (the GET page never verifies).

### Bug 3 — Member status stuck on "Pending" after setting a password

**Symptom.** After a member set their password and reached the dashboard, the
admin Members table still showed **Pending** and kept offering "Resend invite".

**Root cause.** `setStudentPassword` flipped `status:'active'` using the
**student's cookie/RLS client**, which has no `UPDATE` privilege on `students`, so
the write silently affected **0 rows** (RLS doesn't error — it just filters).

**Fix.** (`app/student/actions.ts`) Do the status flip with the **service-role
admin client** (`createAdminClient`), scoped to the member's own `user_id`, after
the student session is asserted. The table already derives Active/hides Resend
from `status` — it just needed the write to land.

### Bug 4 — Per-member QR codes pointed at `localhost` in production

**Symptom.** Scanning a deployed member's QR opened `http://localhost:3000/...`.

**Root cause.** The QR origin came from `NEXT_PUBLIC_SITE_URL`, which was
`localhost` (or unset) in the deployed environment. Two traps: (1) `.env.local`
is **git-ignored and never uploaded to Vercel**; (2) `NEXT_PUBLIC_*` vars are
**inlined at build time**, so they must exist in the host's env at build, and a
change requires a redeploy.

**Fix.** Centralised origin resolution in `lib/siteUrl.ts`
(`NEXT_PUBLIC_SITE_URL` → `NEXT_PUBLIC_VERCEL_URL` → `localhost`, trailing slash
trimmed), used by `lib/members/qr.ts`. The **real** fix is operator-side: set
`NEXT_PUBLIC_SITE_URL` in **Vercel → Settings → Environment Variables** and
redeploy. (Same var also drives the onboarding-email redirect, so setting it fixes
both QR and email links.)

### Bug 5 — "Something went wrong" right after a successful scan (works on Try again)

**Symptom.** Scanning a member's QR via the in-panel scanner showed the error
boundary; tapping **Try again** then rendered the member page correctly. Supabase
auth logs were clean (`/user 200`, no token errors) — so it was **not** auth.

**Root cause.** A teardown race: on decode the code did a client-side
`router.push`, which unmounts the Members page **while `html5-qrcode` is still
tearing down its `<video>`**. That race throws into the error boundary; by the
time you retry, the scanner is gone, so the same URL renders fine.

**Fix.** (`components/ScanMemberButton.tsx`) After decode, stop the camera and do a
**full-page navigation** (`window.location.assign`) instead of `router.push`. The
browser drops the camera/page cleanly and loads the target via SSR — no React /
camera race. Also guarded `scanner.clear()` against mid-teardown throws.

### Bug 6 — Mobile Members header overflowed (page side-scroll, buttons over title)

**Symptom.** On a phone the three header actions (Scan QR / Download / Add Members)
ran off-screen, the page scrolled sideways, "Scan QR" overlapped the "Members"
title, and the subtitle wrapped word-by-word.

**Root cause.** The header was a single `flex items-start justify-between` row with
a **non-wrapping `shrink-0`** action group. One action fit (the original design);
three did not, so they overflowed the viewport.

**Fix.** (`app/admin/members/page.tsx`) Stack the header on mobile
(`flex-col` → `sm:flex-row sm:items-start sm:justify-between`) and let the actions
**wrap** (`flex-wrap`). The table's contained horizontal scroll was never the
cause.

### Bug 7 — "Camera access was blocked" on the admin's phone (Chrome on iOS)

**Symptom.** Tapping Scan QR on Chrome for iPhone instantly showed a camera error
with no permission prompt.

**Root cause.** **Chrome on iOS (and in-app browsers) cannot grant live-camera
`getUserMedia` to web pages** — Apple's WebKit restricts that to Safari. No
permission/gesture change can fix it there.

**Fix.** Two parts. (1) Replace the single generic message with **precise error
classification** (`cameraErrorMessage` maps `NotAllowedError`→permission,
`NotReadableError`→in-use, `NotFoundError`→no-camera) so the real reason shows.
(2) Guidance: use **Safari** on iPhone for the live scanner. *(A native-camera
photo fallback via `<input capture>` + `Html5Qrcode.scanFile()` was added and then
removed at the user's request — keep it in mind if Chrome-iOS support is needed
again.)*

### Bug 8 — ESLint `react-hooks/set-state-in-effect`

**Symptom.** `npm run lint` failed on the scanner: setting state synchronously in
an effect body (`setError(null)` at the top of `useEffect`).

**Root cause.** The React-Compiler rule forbids unconditional `setState` directly
in an effect (it forces an extra render).

**Fix.** Move the reset out of the effect into the event handler that opens the
dialog (`onClick → setError(null); setOpen(true)`). Async `setState` calls *after*
an `await` inside the effect are fine.

### Bug 9 — Member-info QR target: redirect-to-login vs Unauthorized, and a session bug

**Symptom / requirement.** Scanning the QR with a phone **camera app** (no admin
session) should show a clear **Unauthorized** page, not bounce to sign-in. An
early attempt to remove the detail route from the proxy then caused intermittent
render failures.

**Root cause.** The proxy both (a) gates routes by role and (b) **refreshes the
Supabase session, writing rotated cookies onto the response**. Server Components
can't write cookies (the `setAll` is swallowed), so **every protected route must
pass through the proxy** or its session refresh is lost. Removing the detail route
to allow self-gating also removed its refresh.

**Fix.** Keep `/admin/members/:path*` in the proxy matcher (session refresh), but
**exempt the member-detail route from the redirect** so it can self-gate:
`proxy.ts` → `if (/^\/admin\/members\/[^/]+$/.test(path)) return response;`. The
page (`app/admin/members/[id]/page.tsx`) checks `assertAdminSession` and renders an
`Unauthorized` screen for non-admins (before any DB read). RLS still protects the
data as defence-in-depth.

### Cross-cutting — testing the new client islands

- **Magic-link send** is mocked by mocking `@supabase/supabase-js`'s `createClient`
  to return `{ auth: { signInWithOtp } }` (the onboarding email goes through an
  isolated anon client, separate from the cookie/admin clients).
- **`redirect()`** is mocked to `throw new Error("REDIRECT:" + url)` so server
  actions' navigation is assertable.
- **File inputs in jsdom**: assigning `input.value = ""` can throw — guard it; and
  `fireEvent.change(input, { target:{ files:[file] } })` is unreliable. Use
  `@testing-library/user-event` `userEvent.upload(input, file, { applyAccept:false })`
  (the `applyAccept:false` lets a hidden `capture` input accept the test file).
- **Gates per change**: `npx vitest run`, `npm run lint`, `npm run build` — all
  three, every time.

---

## Portable Instructions (drop into any project)

Supabase-auth + Next.js App Router + camera guardrails distilled from the bugs above.

1. **One email template per type per Supabase project.** To give two audiences
   different onboarding mail, route them through **different built-in templates**
   (e.g. Invite/Reset for admins, **Magic Link** for members) — or a custom SMTP
   provider. Use the **token-hash** form (`{{ .TokenHash }}` + a click-to-verify
   page), never the implicit `{{ .ConfirmationURL }}`, which consumes the token on
   open and breaks on prefetch.

2. **Make single-use-token confirmation idempotent.** A verify link can be
   submitted twice (double-tap, back-then-resubmit). After `verifyOtp`, branch on
   the **resulting session**, not on that call's error — if a valid session now
   exists, proceed; only fail when there is none. Otherwise the second submit
   throws away a good session.

3. **RLS silently writes zero rows — privileged status flips need the service
   role.** A cookie/RLS client `UPDATE` that the user isn't allowed to make
   returns **no error and changes nothing**. For self-service state changes a user
   can't write under RLS (e.g. activating their own record), use the service-role
   client, scoped to their own id, after asserting their session.

4. **`NEXT_PUBLIC_*` is baked at build time and `.env.local` never deploys.** Any
   absolute URL the app emits (QR targets, email redirects) must read a public env
   var that is set **in the host's environment** and the app **redeployed** after a
   change. Centralise origin resolution in one helper
   (`SITE_URL` → platform URL → localhost) so nothing falls back to localhost.

5. **Don't `router.push` while a camera/`<video>` is tearing down.** A QR/camera
   component that client-navigates on success races React's unmount against the
   library's teardown and throws into the error boundary. Stop the camera, then do
   a **full-page navigation** (`window.location.assign`) so the browser releases
   the device and loads the destination via SSR.

6. **Live `getUserMedia` does not work in Chrome on iOS or in-app browsers.** It is
   a WebKit/platform restriction, not a bug. Surface the **specific** failure
   (`NotAllowedError` vs `NotReadableError`/in-use vs `NotFoundError`), tell iOS
   users to use Safari, and consider a native-camera **photo fallback**
   (`<input type="file" accept="image/*" capture="environment">` + a file QR
   decoder) when broad mobile support is required.

7. **A header with N actions must stack/wrap on mobile.** `justify-between` + a
   `shrink-0` action row works for one button; with several, switch to
   `flex-col` (→ `sm:flex-row`) and `flex-wrap` so actions never overflow the
   viewport or overlap the title.

8. **Middleware/proxy is where the auth session is refreshed — every protected
   route must pass through it.** Server Components can't persist rotated cookies.
   If a route needs different *access* behaviour (e.g. self-gating to an
   "Unauthorized" page instead of a redirect), keep it **matched** by the proxy
   (so the session refreshes) but **exempt it from the redirect** and let the page
   decide. Don't simply drop it from the matcher.

9. **React-Compiler lint: no synchronous `setState` in an effect body.** Move the
   reset into the triggering event handler; `setState` after an `await` inside the
   effect is allowed.

10. **Testing client islands.** Mock the specific Supabase client surface the code
    uses (`signInWithOtp`, `createUser`, `from().update().eq()` …); mock
    `redirect()` to throw a sentinel; for file inputs use `userEvent.upload(…,
    { applyAccept:false })` and guard `input.value = ""`.
