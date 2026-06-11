import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// The bare anon client instrumentation builds for itself (no cookies available
// in onRequestError) — NOT the cookie-bound server client.
const rpc = vi.fn(async () => ({ error: null as { message?: string } | null }));
const bareCreateClient = vi.fn(() => ({ rpc }));
vi.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => bareCreateClient(...(args as [])),
}));

// logError's default client path is never used here (a client is injected),
// but the module imports next/headers transitively — keep it inert.
vi.mock("@/lib/supabase/server", () => ({
  createClient: vi.fn(async () => ({ rpc: vi.fn() })),
}));

import { onRequestError } from "@/instrumentation";

function request(path: string) {
  return { path, method: "POST", headers: {} };
}

const context = {
  routerKind: "App Router",
  routePath: "/whatever",
  routeType: "action",
} as Parameters<typeof onRequestError>[2];

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://example.supabase.co");
  vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
  consoleError.mockRestore();
});

describe("onRequestError (US1.1 safety net)", () => {
  it("logs an uncaught admin-route crash as fatal/server with the route-derived surface", async () => {
    await onRequestError(new Error("uncaught crash"), request("/admin/members"), context);

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0] as [string, Record<string, string | null>];
    expect(fn).toBe("log_error");
    expect(params.p_severity).toBe("fatal");
    expect(params.p_origin).toBe("server");
    expect(params.p_surface).toBe("admin");
    expect(params.p_operation).toBe("onRequestError:/admin/members");
    expect(params.p_message).toBe("uncaught crash");
  });

  it("maps /student/** to the student surface and anything else to system", async () => {
    await onRequestError(new Error("a"), request("/student/dashboard"), context);
    await onRequestError(new Error("b"), request("/somewhere"), context);
    const surfaces = rpc.mock.calls.map(
      (c) => (c as [string, Record<string, string | null>])[1].p_surface
    );
    expect(surfaces).toEqual(["student", "system"]);
  });

  it("strips the query string from the path (it may carry tokens)", async () => {
    await onRequestError(
      new Error("a"),
      request("/student/auth/confirm?token_hash=secret"),
      context
    );
    const [, params] = rpc.mock.calls[0] as [string, Record<string, string | null>];
    expect(params.p_operation).toBe("onRequestError:/student/auth/confirm");
    expect(JSON.stringify(params)).not.toContain("secret");
  });

  it("sends only safe context keys — no headers, cookies, or body", async () => {
    await onRequestError(new Error("a"), request("/admin/waves"), context);
    const [, params] = rpc.mock.calls[0] as [string, Record<string, string | null>];
    const ctx = JSON.parse(params.p_context as string);
    expect(Object.keys(ctx).sort()).toEqual(["method", "path", "routeType", "routerKind"]);
    expect(ctx.path).toBe("/admin/waves");
    expect(ctx.method).toBe("POST");
  });

  it("swallows its own failures — a crash in crash-logging is invisible", async () => {
    rpc.mockRejectedValue(new Error("db unreachable"));
    await expect(
      onRequestError(new Error("a"), request("/admin"), context)
    ).resolves.toBeUndefined();

    bareCreateClient.mockImplementationOnce(() => {
      throw new Error("bad config");
    });
    await expect(
      onRequestError(new Error("b"), request("/admin"), context)
    ).resolves.toBeUndefined();
  });
});
