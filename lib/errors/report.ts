import { BOUNDS, truncate } from "@/lib/errors/serialize";

/**
 * Pure shaping for client-side crash reports (feature 009, US3.1). Runs in the
 * browser before the report crosses to the `reportClientError` Server Action,
 * so secrets are stripped and sizes bounded on the client too (the action and
 * the RPC re-enforce both server-side).
 */

export type ClientErrorReport = {
  /** Pathname only — query strings/fragments may carry tokens. */
  page: string;
  message: string;
  stack?: string;
};

export function buildClientErrorReport(
  error: unknown,
  pathname: string
): ClientErrorReport {
  let message = "Unknown client error";
  let stack: string | undefined;
  try {
    if (error instanceof Error) {
      message = error.message || message;
      stack = error.stack ?? undefined;
    } else if (typeof error === "string" && error) {
      message = error;
    } else if (error !== null && error !== undefined) {
      message = String(error);
    }
  } catch {
    /* hostile error object — keep the defaults */
  }

  const page =
    typeof pathname === "string" ? pathname.split("?")[0].split("#")[0] : "";

  return {
    page: truncate(page, BOUNDS.operation),
    message: truncate(message, BOUNDS.message),
    stack: stack ? truncate(stack, BOUNDS.stack) : undefined,
  };
}
