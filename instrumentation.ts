import { logError } from "@/lib/errors/log";

/**
 * onRequestError (Next.js instrumentation) — the safety net for genuinely
 * UNCAUGHT server exceptions (Server Components, Server Actions, route
 * handling). Handled-but-unexpected failures are logged at their swallow
 * points via `logError` (feature 009, research R1); this hook only catches
 * what slipped through, as severity `fatal`.
 *
 * Runs outside a request's React context, so the cookie-bound client is
 * unavailable — a bare anon client is used and the entry records as anonymous.
 * Wrapped in its own try/catch: a crash in crash-logging must be invisible.
 */

type RequestErrorContext = {
  routerKind: string;
  routePath: string;
  routeType: string;
};

export async function onRequestError(
  err: unknown,
  request: { path: string; method: string; headers: unknown },
  context: RequestErrorContext
): Promise<void> {
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const anon = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // Query strings may carry tokens (e.g. auth confirm links) — never log them.
    const pathname = (request.path ?? "").split("?")[0];
    const surface = pathname.startsWith("/admin")
      ? "admin"
      : pathname.startsWith("/student")
        ? "student"
        : "system";

    await logError(
      {
        operation: `onRequestError:${pathname}`,
        surface,
        origin: "server",
        severity: "fatal",
        error: err,
        context: {
          path: pathname,
          method: request.method,
          routerKind: context.routerKind,
          routeType: context.routeType,
        },
      },
      anon
    );
  } catch (cause) {
    try {
      console.error("[error-log] onRequestError failed:", cause);
    } catch {
      /* never propagate */
    }
  }
}
