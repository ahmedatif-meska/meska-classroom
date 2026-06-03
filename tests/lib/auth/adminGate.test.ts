import { describe, it, expect } from "vitest";
import {
  assertAdminSession,
  validateLoginFields,
} from "@/lib/auth/adminGate";
import strings from "@/lib/strings";

describe("validateLoginFields (mandatory fields — FR-002 / SC-003)", () => {
  it("rejects an empty email with the required message", () => {
    const r = validateLoginFields("", "secret");
    expect(r).toEqual({ ok: false, error: strings.adminEmailRequired });
  });

  it("rejects an empty password with the required message", () => {
    const r = validateLoginFields("admin@example.com", "");
    expect(r).toEqual({ ok: false, error: strings.adminEmailRequired });
  });

  it("rejects when both fields are empty", () => {
    expect(validateLoginFields("", "").ok).toBe(false);
    expect(validateLoginFields(null, undefined).ok).toBe(false);
  });

  it("rejects a whitespace-only email", () => {
    expect(validateLoginFields("   ", "secret").ok).toBe(false);
  });

  it("passes when both fields are present", () => {
    expect(validateLoginFields("admin@example.com", "secret")).toEqual({
      ok: true,
    });
  });
});

describe("assertAdminSession (admin-only gate — FR-003 / SC-006)", () => {
  it("allows a session whose role is admin", () => {
    const session = { user: { app_metadata: { role: "admin" } } };
    expect(assertAdminSession(session)).toEqual({ ok: true });
  });

  it("denies a session whose role is student", () => {
    const session = { user: { app_metadata: { role: "student" } } };
    expect(assertAdminSession(session)).toEqual({
      ok: false,
      reason: "not_admin",
    });
  });

  it("denies a session with no role claim", () => {
    expect(assertAdminSession({ user: { app_metadata: {} } }).ok).toBe(false);
    expect(assertAdminSession({ user: {} }).ok).toBe(false);
    expect(assertAdminSession(null).ok).toBe(false);
  });
});
