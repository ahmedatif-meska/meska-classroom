import { describe, it, expect } from "vitest";
import {
  validateEmailField,
  validateNewPassword,
} from "@/lib/auth/passwordReset";
import strings from "@/lib/strings";

describe("validateEmailField (recovery request — FR-002)", () => {
  it("rejects an empty email with the required message", () => {
    expect(validateEmailField("")).toEqual({
      ok: false,
      error: strings.forgotEmailRequired,
    });
  });

  it("rejects a whitespace-only email", () => {
    expect(validateEmailField("   ").ok).toBe(false);
  });

  it("rejects null/undefined/non-string", () => {
    expect(validateEmailField(null).ok).toBe(false);
    expect(validateEmailField(undefined).ok).toBe(false);
  });

  it("passes a non-empty email", () => {
    expect(validateEmailField("admin@example.com")).toEqual({ ok: true });
  });
});

describe("validateNewPassword (new-password rules — FR-007 / SC-006)", () => {
  it("rejects a missing password or confirmation", () => {
    expect(validateNewPassword("", "").ok).toBe(false);
    expect(validateNewPassword("longenough", "").ok).toBe(false);
    expect(validateNewPassword(null, undefined).ok).toBe(false);
  });

  it("rejects a password shorter than 8 characters", () => {
    expect(validateNewPassword("short7!", "short7!")).toEqual({
      ok: false,
      error: strings.resetPasswordTooShort,
    });
  });

  it("rejects when password and confirmation do not match", () => {
    expect(validateNewPassword("longenough1", "longenough2")).toEqual({
      ok: false,
      error: strings.resetPasswordMismatch,
    });
  });

  it("passes a matching password of length >= 8", () => {
    expect(validateNewPassword("longenough1", "longenough1")).toEqual({
      ok: true,
    });
  });
});
