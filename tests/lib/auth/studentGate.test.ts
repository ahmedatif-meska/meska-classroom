import { describe, it, expect } from "vitest";
import {
  assertStudentSession,
  validateStudentLoginFields,
} from "@/lib/auth/studentGate";
import strings from "@/lib/strings";

describe("studentGate (US3.1)", () => {
  it("requires both email and password", () => {
    expect(validateStudentLoginFields("", "pw")).toEqual({
      ok: false,
      error: strings.studentEmailRequired,
    });
    expect(validateStudentLoginFields("a@b.com", "")).toEqual({
      ok: false,
      error: strings.studentEmailRequired,
    });
    expect(validateStudentLoginFields("a@b.com", "pw")).toEqual({ ok: true });
  });

  it("accepts a student session", () => {
    expect(
      assertStudentSession({ user: { app_metadata: { role: "student" } } })
    ).toEqual({ ok: true });
  });

  it("rejects an admin session (role denial — Principle VI)", () => {
    expect(
      assertStudentSession({ user: { app_metadata: { role: "admin" } } })
    ).toEqual({ ok: false, reason: "not_student" });
  });

  it("rejects an anonymous (null) session", () => {
    expect(assertStudentSession(null)).toEqual({
      ok: false,
      reason: "not_student",
    });
  });
});
