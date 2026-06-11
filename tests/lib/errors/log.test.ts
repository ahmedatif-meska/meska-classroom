import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const rpc = vi.fn(async () => ({ error: null as { message?: string } | null }));
const createClient = vi.fn(async () => ({ rpc }));

vi.mock("@/lib/supabase/server", () => ({
  createClient: (...args: unknown[]) => createClient(...(args as [])),
}));

import { logError } from "@/lib/errors/log";

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  vi.clearAllMocks();
  rpc.mockResolvedValue({ error: null });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("logError (US1.1)", () => {
  it("records via the log_error RPC with serialized error, sanitized context, and defaults", async () => {
    await logError({
      operation: "createMember",
      surface: "admin",
      error: new Error("boom"),
      context: { email: "a@b.c", password: "hunter2" },
    });

    expect(rpc).toHaveBeenCalledTimes(1);
    const [fn, params] = rpc.mock.calls[0] as [string, Record<string, string | null>];
    expect(fn).toBe("log_error");
    expect(params.p_surface).toBe("admin");
    expect(params.p_origin).toBe("server");
    expect(params.p_severity).toBe("error");
    expect(params.p_operation).toBe("createMember");
    expect(params.p_message).toBe("boom");
    expect(params.p_stack).toContain("boom");
    const context = JSON.parse(params.p_context as string);
    expect(context.email).toBe("a@b.c");
    expect(context).not.toHaveProperty("password");
    // VERCEL_ENV is unset under vitest; NODE_ENV is "test".
    expect(params.p_environment).toBe("test");
  });

  it("honors severity and origin overrides", async () => {
    await logError({
      operation: "onRequestError:/admin",
      surface: "system",
      error: "crash",
      severity: "fatal",
      origin: "client",
    });
    const [, params] = rpc.mock.calls[0] as [string, Record<string, string | null>];
    expect(params.p_severity).toBe("fatal");
    expect(params.p_origin).toBe("client");
    expect(params.p_context).toBeNull();
  });

  it("resolves (never throws) when the RPC returns an error, falling back to console.error", async () => {
    rpc.mockResolvedValue({ error: { message: "permission denied" } });
    await expect(
      logError({ operation: "x", surface: "admin", error: new Error("e") })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it("resolves (never throws) when the RPC rejects", async () => {
    rpc.mockRejectedValue(new Error("network down"));
    await expect(
      logError({ operation: "x", surface: "admin", error: new Error("e") })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it("resolves (never throws) when the client cannot be created", async () => {
    createClient.mockRejectedValueOnce(new Error("no request scope"));
    await expect(
      logError({ operation: "x", surface: "admin", error: new Error("e") })
    ).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalled();
  });

  it("uses an injected client instead of the cookie-bound one when provided", async () => {
    const injectedRpc = vi.fn(async () => ({ error: null }));
    await logError(
      { operation: "x", surface: "student", error: new Error("e") },
      { rpc: injectedRpc }
    );
    expect(injectedRpc).toHaveBeenCalledTimes(1);
    expect(createClient).not.toHaveBeenCalled();
  });
});
