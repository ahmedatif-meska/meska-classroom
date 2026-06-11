"use server";

import { logError } from "@/lib/errors/log";
import { BOUNDS, truncate } from "@/lib/errors/serialize";
import type { ClientErrorReport } from "@/lib/errors/report";

/**
 * reportClientError — record a browser rendering crash in the central error
 * log (feature 009, US3.1). Deliberately ungated: anonymous crashes are
 * reportable, and identity is attached from the caller's JWT inside the
 * `log_error` RPC — a report can never impersonate another user.
 *
 * Always resolves void; reporting failure must never affect the error
 * screen's recovery UX (FR-012).
 */
export async function reportClientError(
  report: ClientErrorReport
): Promise<void> {
  try {
    if (!report || typeof report !== "object") return;
    const message = typeof report.message === "string" ? report.message : "";
    if (!message) return;

    // Re-validate and re-strip server-side — the client shaping is UX only.
    const rawPage = typeof report.page === "string" ? report.page : "";
    const page = rawPage.split("?")[0].split("#")[0];
    const stack = typeof report.stack === "string" ? report.stack : undefined;

    const surface = page.startsWith("/admin")
      ? "admin"
      : page.startsWith("/student")
        ? "student"
        : "system";

    const error = new Error(truncate(message, BOUNDS.message));
    error.stack = stack ? truncate(stack, BOUNDS.stack) : "";

    await logError({
      operation: `clientError:${truncate(page, 150)}`,
      surface,
      origin: "client",
      error,
      context: { page: truncate(page, BOUNDS.operation) },
    });
  } catch {
    /* never throw back to the browser */
  }
}
