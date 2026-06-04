import { describe, it, expect } from "vitest";
import { validateMemberFields, isValidEmail } from "@/lib/members/validation";
import strings from "@/lib/strings";

describe("validateMemberFields (US2.1)", () => {
  it("requires a non-blank full name", () => {
    expect(validateMemberFields("   ", "+201", "a@b.com", "w1")).toEqual({
      ok: false,
      error: strings.memberMgmtNameRequired,
    });
  });

  it("requires a non-blank WhatsApp number", () => {
    expect(validateMemberFields("Mona", "  ", "a@b.com", "w1")).toEqual({
      ok: false,
      error: strings.memberMgmtWhatsappRequired,
    });
  });

  it("rejects a malformed email", () => {
    expect(validateMemberFields("Mona", "+201", "not-an-email", "w1")).toEqual({
      ok: false,
      error: strings.memberMgmtEmailInvalid,
    });
  });

  it("requires a wave selection", () => {
    expect(validateMemberFields("Mona", "+201", "a@b.com", "")).toEqual({
      ok: false,
      error: strings.memberMgmtWaveRequired,
    });
  });

  it("normalizes on success (trim fields, lowercase email)", () => {
    expect(
      validateMemberFields("  Mona Ali ", " +201 ", "  Mona@Example.COM ", " w1 ")
    ).toEqual({
      ok: true,
      fullName: "Mona Ali",
      whatsapp: "+201",
      email: "mona@example.com",
      waveId: "w1",
    });
  });

  it("isValidEmail accepts/rejects basic shapes", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a b@c.com")).toBe(false);
  });
});
