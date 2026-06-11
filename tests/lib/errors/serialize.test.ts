import { describe, it, expect } from "vitest";
import {
  BOUNDS,
  sanitizeContext,
  serializeError,
  truncate,
} from "@/lib/errors/serialize";

describe("truncate", () => {
  it("returns short strings unchanged", () => {
    expect(truncate("abc", 10)).toBe("abc");
  });

  it("cuts exactly at the bound", () => {
    expect(truncate("x".repeat(20), 10)).toHaveLength(10);
  });
});

describe("sanitizeContext (FR-005 / SC-004)", () => {
  it("drops secret-shaped keys and keeps safe ones", () => {
    const clean = sanitizeContext({
      password: "hunter2",
      accessToken: "ey.abc",
      api_key: "sk-123",
      apiKey: "sk-456",
      Authorization: "Bearer x",
      cookie: "session=abc",
      refresh_token_hint: "zzz",
      clientSecret: "shh",
      email: "a@b.c",
      waveId: "w-1",
      rows: 3,
      ok: false,
      missing: null,
    });
    expect(Object.keys(clean).sort()).toEqual([
      "email",
      "missing",
      "ok",
      "rows",
      "waveId",
    ]);
    expect(clean.email).toBe("a@b.c");
    expect(clean.rows).toBe(3);
    expect(clean.ok).toBe(false);
    expect(clean.missing).toBeNull();
  });

  it("truncates long string values", () => {
    const clean = sanitizeContext({ note: "y".repeat(9000) });
    expect((clean.note as string).length).toBeLessThanOrEqual(500);
  });

  it("returns a new object and leaves the input untouched", () => {
    const input = { password: "x", email: "a@b.c" };
    const clean = sanitizeContext(input);
    expect(clean).not.toBe(input);
    expect(input.password).toBe("x");
  });
});

describe("serializeError", () => {
  it("serializes an Error with message and stack", () => {
    const out = serializeError(new Error("boom"));
    expect(out.message).toBe("boom");
    expect(out.stack).toContain("boom");
  });

  it("appends the cause chain to the stack", () => {
    const inner = new Error("db down");
    const outer = new Error("save failed", { cause: inner });
    const out = serializeError(outer);
    expect(out.stack).toContain("Caused by:");
    expect(out.stack).toContain("db down");
  });

  it("serializes Supabase-style plain error objects", () => {
    const out = serializeError({
      message: "duplicate key value",
      code: "23505",
      details: "Key (email) already exists.",
    });
    expect(out.message).toBe("duplicate key value");
    expect(out.stack).toContain("23505");
  });

  it("handles non-Error values without throwing", () => {
    expect(serializeError("oops").message).toBe("oops");
    expect(serializeError(null).message).toBe("null");
    expect(serializeError(undefined).message).toBe("undefined");
    expect(serializeError(42).message).toBe("42");
    expect(serializeError({}).message).toBeTypeOf("string");
  });

  it("truncates message and stack to BOUNDS", () => {
    const err = new Error("m".repeat(5000));
    err.stack = "s".repeat(20000);
    const out = serializeError(err);
    expect(out.message).toHaveLength(BOUNDS.message);
    expect(out.stack).toHaveLength(BOUNDS.stack);
  });

  it("never throws on hostile inputs", () => {
    const hostile = {
      get message(): string {
        throw new Error("gotcha");
      },
    };
    expect(serializeError(hostile).message).toBe("Unserializable error");
  });
});
