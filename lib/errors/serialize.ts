/**
 * Pure error-serialization helpers (feature 009). Supabase-free so the
 * redaction and truncation guarantees are deterministically unit-tested.
 *
 * Field bounds mirror the server-side authority in the `log_error` RPC
 * (migration 0012) — the RPC re-truncates with `left()`, these keep payloads
 * small and the behavior observable in tests.
 */

export const BOUNDS = {
  operation: 200,
  message: 2000,
  stack: 8000,
  context: 4000,
} as const;

/**
 * Context only ever accepts caller-chosen scalars — the type itself forbids
 * FormData, File, nested objects, and arrays, so secrets can't be "dumped" in.
 */
export type SafeContext = Record<string, string | number | boolean | null>;

/** Keys that must never reach the log, even if a call site passes them. */
const SECRET_KEY_PATTERN = /password|token|secret|cookie|authorization|api[_-]?key/i;

const MAX_CONTEXT_VALUE_LENGTH = 500;

export function truncate(value: string, max: number): string {
  return value.length > max ? value.slice(0, max) : value;
}

/**
 * Drops secret-shaped keys and truncates string values. Returns a new object;
 * never throws.
 */
export function sanitizeContext(ctx: SafeContext): SafeContext {
  const clean: SafeContext = {};
  for (const [key, value] of Object.entries(ctx)) {
    if (SECRET_KEY_PATTERN.test(key)) continue;
    clean[key] =
      typeof value === "string"
        ? truncate(value, MAX_CONTEXT_VALUE_LENGTH)
        : value;
  }
  return clean;
}

/**
 * Anything thrown / returned as an error → { message, stack }, truncated.
 * Error causes are appended to the stack so the underlying failure chain is
 * preserved. Never throws, whatever the input.
 */
export function serializeError(err: unknown): {
  message: string;
  stack: string | null;
} {
  try {
    if (err instanceof Error) {
      let stack = err.stack ?? "";
      let cause: unknown = err.cause;
      let depth = 0;
      while (cause !== undefined && cause !== null && depth < 5) {
        const causeText =
          cause instanceof Error ? (cause.stack ?? cause.message) : String(cause);
        stack += `\nCaused by: ${causeText}`;
        cause = cause instanceof Error ? cause.cause : undefined;
        depth += 1;
      }
      return {
        message: truncate(err.message, BOUNDS.message),
        stack: stack ? truncate(stack, BOUNDS.stack) : null,
      };
    }
    // Supabase errors are plain objects with a `message` field, not Errors.
    if (typeof err === "object" && err !== null && "message" in err) {
      const { message, ...rest } = err as { message: unknown };
      let detail: string | null = null;
      try {
        const restText = JSON.stringify(rest);
        detail = restText && restText !== "{}" ? restText : null;
      } catch {
        detail = null;
      }
      return {
        message: truncate(String(message), BOUNDS.message),
        stack: detail ? truncate(detail, BOUNDS.stack) : null,
      };
    }
    return { message: truncate(String(err), BOUNDS.message), stack: null };
  } catch {
    return { message: "Unserializable error", stack: null };
  }
}
