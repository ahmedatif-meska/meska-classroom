# Contracts: Error Logging (009)

The feature exposes no HTTP API (architecture rule: no route handlers). Its contracts
are: the SQL surface, the `lib/errors/` module API, one Server Action, the
instrumentation hook, and the admin pages.

## 1. SQL surface (migration `0012_error_logs.sql`)

### `public.log_error` RPC — the only write path

```text
log_error(p_surface, p_origin, p_severity, p_operation, p_message, p_stack, p_context, p_environment) → void
```

**Guarantees**:
- Executable by `anon` and `authenticated`; `SECURITY DEFINER`; revoked from `public`.
- Identity columns (`user_id`, `user_role`, `tenant_id`) come from the caller's JWT
  inside the function. Parameters cannot set them.
- Truncation applied via `left()`: operation 200, message 2,000, stack 8,000,
  context 4,000 chars. Invalid context JSON is wrapped as `{"raw": <text>}` rather
  than rejected — a malformed payload must never make logging fail.
- Invalid `surface`/`origin`/`severity` values are coerced to `'system'`/`'server'`/`'error'`
  (logging must not throw on bad enum input).

### `public.error_logs` read contract

- `SELECT` allowed only when `is_admin()`; all other access yields zero rows.
- No write policies exist. Immutable from the application.

## 2. `lib/errors/serialize.ts` (pure, Supabase-free, unit-tested)

```ts
export const BOUNDS = { operation: 200, message: 2000, stack: 8000, context: 4000 } as const;

export type SafeContext = Record<string, string | number | boolean | null>;
// The type itself forbids FormData, File, objects, arrays — secrets can't be "dumped" in.

export function sanitizeContext(ctx: SafeContext): SafeContext;
// Drops keys matching /password|token|secret|cookie|authorization|api[_-]?key/i,
// truncates string values, returns a new object.

export function serializeError(err: unknown): { message: string; stack: string | null };
// Error → message + stack (with cause chain appended); non-Error → String(err);
// both truncated to BOUNDS. Never throws.

export function truncate(value: string, max: number): string;
```

## 3. `lib/errors/log.ts` — `logError()` (server-only)

```ts
export type LogErrorInput = {
  operation: string;                       // e.g. "createMember"
  surface: 'admin' | 'student' | 'system';
  error: unknown;                          // anything thrown / Supabase error object
  severity?: 'warning' | 'error' | 'fatal'; // default 'error'
  origin?: 'server' | 'client';            // default 'server'
  context?: SafeContext;                   // caller-chosen safe scalars only
};

export async function logError(input: LogErrorInput): Promise<void>;
```

**Guarantees**:
- **Never throws and never rejects.** Internal failure → `console.error` fallback (FR-006).
- Awaited by callers (serverless-safe; see research R4); called on failure paths only.
- Uses the cookie-bound server client when available so the RPC sees the caller's JWT;
  `instrumentation.ts` passes a bare anon client instead (anonymous attribution).
- Applies `serializeError` + `sanitizeContext` before the RPC; sends `environment`
  from `VERCEL_ENV ?? NODE_ENV`.

**Call-site contract (wiring rule)**: every place that converts an unexpected
underlying failure into a generic user-facing message MUST call
`await logError({...})` immediately before returning that message. By-design
rejections (validation failures, gate denials) MUST NOT call it (spec: unexpected only).

## 4. `instrumentation.ts` — `onRequestError`

```ts
export async function onRequestError(err, request, context): Promise<void>;
```

- Logs severity `fatal`, origin `server`, operation `onRequestError:<pathname>`.
- Surface from pathname: `/admin/**` → `admin`, `/student/**` → `student`, else `system`.
- Context: `{ path, method, routerKind, routeType }` from the hook's arguments — never
  headers, cookies, or bodies.
- Wrapped in its own try/catch (a crash in crash-logging must be invisible).

## 5. `reportClientError` Server Action (`app/actions.ts`)

```ts
export type ClientErrorReport = {
  page: string;          // pathname only — no query string (may carry tokens)
  message: string;
  stack?: string;
};

export async function reportClientError(report: ClientErrorReport): Promise<void>;
```

- Ungated (anonymous crashes are reportable); identity still derived from the JWT by
  the RPC — the report cannot impersonate.
- Validates the shape (non-string fields dropped), strips query strings from `page`,
  sanitizes/truncates exactly like server-side logging, records with origin `client`,
  surface from the page path.
- Always resolves `void`; failures are swallowed server-side. The client caller in
  `error.tsx` also `catch`es — the retry UX is never affected (FR-012).
- Fired once per error instance (effect keyed on the error object).

## 6. Admin pages

### `GET /admin/errors` (RSC)

- Admin-gated (proxy `/admin/**` matcher + self-gate + RLS).
- Query: newest-first, `range`-paginated **50/page**, `?page=N` (1-based; invalid → 1).
- Columns: occurred at, severity, surface, origin, operation, truncated message,
  user (email/id or anonymous label). Row links to detail.
- States: `loading.tsx` skeleton; empty state copy from `lib/strings.ts`; errors use
  the existing panel `error.tsx`.
- Mobile strategy: contained horizontal scroll (AdminTable pattern); page/body never
  scrolls sideways.

### `GET /admin/errors/[id]` (RSC)

- Admin-gated as above. Unknown id → `notFound()`.
- Shows every stored field; `stack` and `context` render in contained-scroll `<pre>`
  blocks (320px-safe).

### Navigation

- `lib/adminNav.tsx` gains an "Errors" item (label from `lib/strings.ts`), appearing in
  both the desktop sidebar and the mobile drawer via `DashboardShell`.
