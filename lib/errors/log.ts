import { createClient } from "@/lib/supabase/server";
import {
  BOUNDS,
  sanitizeContext,
  serializeError,
  truncate,
  type SafeContext,
} from "@/lib/errors/serialize";

/**
 * logError — record an unexpected failure in `error_logs` via the `log_error`
 * RPC (feature 009). Server-only.
 *
 * Guarantees (contracts §3):
 * - NEVER throws and never rejects — its own failure falls back to
 *   `console.error` so logging can't change a user-visible outcome (FR-006).
 * - Awaited by callers (a floating promise is dropped when the serverless
 *   instance freezes after the response — research R4); called on failure
 *   paths only, so success paths are untouched.
 * - Identity is attached inside the RPC from the caller's JWT; nothing here
 *   can attribute an entry to another user.
 *
 * Wiring rule: call this immediately before returning a generic user-facing
 * message for an UNEXPECTED underlying failure. By-design rejections
 * (validation, gate denials) must not be logged.
 */

export type LogErrorInput = {
  /** Function/action identifier, e.g. "createMember". */
  operation: string;
  surface: "admin" | "student" | "system";
  /** Anything thrown, or a Supabase error object. */
  error: unknown;
  severity?: "warning" | "error" | "fatal";
  origin?: "server" | "client";
  /** Caller-chosen safe scalars only; secret-shaped keys are dropped. */
  context?: SafeContext;
};

/** Minimal structural client so instrumentation can inject its bare anon client. */
export type LogErrorClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => PromiseLike<{ error: unknown }>;
};

export async function logError(
  input: LogErrorInput,
  client?: LogErrorClient
): Promise<void> {
  try {
    const { message, stack } = serializeError(input.error);
    const context = input.context ? sanitizeContext(input.context) : null;

    const supabase = client ?? (await createClient());
    const { error } = await supabase.rpc("log_error", {
      p_surface: input.surface,
      p_origin: input.origin ?? "server",
      p_severity: input.severity ?? "error",
      p_operation: truncate(input.operation, BOUNDS.operation),
      p_message: message,
      p_stack: stack,
      p_context: context
        ? truncate(JSON.stringify(context), BOUNDS.context)
        : null,
      p_environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
    });
    if (error) {
      console.error("[error-log] failed to record error:", error);
    }
  } catch (cause) {
    try {
      console.error("[error-log] failed to record error:", cause);
    } catch {
      /* even the fallback must never throw into the caller */
    }
  }
}
