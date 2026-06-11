import { describe, it, expect, vi, beforeEach } from "vitest";

const logError = vi.fn(async () => {});
vi.mock("@/lib/errors/log", () => ({
  logError: (...args: unknown[]) => logError(...(args as [])),
}));

import { reportClientError } from "@/app/actions";
import type { ClientErrorReport } from "@/lib/errors/report";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("reportClientError (US3.1)", () => {
  it("records a valid report as a client-origin error with the surface from the page path", async () => {
    await reportClientError({
      page: "/admin/waves",
      message: "render crash",
      stack: "Error: render crash\n  at Component",
    });
    expect(logError).toHaveBeenCalledTimes(1);
    expect(logError).toHaveBeenCalledWith(
      expect.objectContaining({
        origin: "client",
        surface: "admin",
        operation: "clientError:/admin/waves",
      })
    );
  });

  it("maps student pages to the student surface and others to system", async () => {
    await reportClientError({ page: "/student/dashboard", message: "x" });
    await reportClientError({ page: "/somewhere", message: "x" });
    const surfaces = logError.mock.calls.map(
      (c) => (c as [Record<string, unknown>])[0].surface
    );
    expect(surfaces).toEqual(["student", "system"]);
  });

  it("re-strips a query string server-side (defense in depth)", async () => {
    await reportClientError({
      page: "/student/auth/confirm?token_hash=secret",
      message: "x",
    });
    const [input] = logError.mock.calls[0] as [Record<string, unknown>];
    expect(JSON.stringify(input)).not.toContain("secret");
  });

  it("drops malformed payloads without logging garbage", async () => {
    await reportClientError(null as unknown as ClientErrorReport);
    await reportClientError("nope" as unknown as ClientErrorReport);
    await reportClientError({ page: 123, message: {} } as unknown as ClientErrorReport);
    await reportClientError({ page: "/admin" } as unknown as ClientErrorReport);
    expect(logError).not.toHaveBeenCalled();
  });

  it("always resolves void, even when logging itself fails", async () => {
    logError.mockRejectedValueOnce(new Error("db down"));
    await expect(
      reportClientError({ page: "/admin", message: "x" })
    ).resolves.toBeUndefined();
  });
});
