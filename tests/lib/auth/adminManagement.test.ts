import { describe, it, expect } from "vitest";
import strings from "@/lib/strings";
import {
  adminDisplayName,
  validateNewAdminFields,
} from "@/lib/auth/adminManagement";

describe("adminDisplayName (US1.1)", () => {
  it("returns 'First Last' when both names are present", () => {
    expect(
      adminDisplayName({ first_name: "John", last_name: "Doe", email: "j@x.com" })
    ).toBe("John Doe");
  });

  it("falls back to display_name when names are missing", () => {
    expect(
      adminDisplayName({
        first_name: null,
        last_name: null,
        display_name: "ahmedatif",
        email: "ahmedatif@meska.ai",
      })
    ).toBe("ahmedatif");
  });

  it("falls back to the email local-part when nothing else is present", () => {
    expect(adminDisplayName({ email: "Maha.Gamal@algoriza.com" })).toBe(
      "Maha.Gamal"
    );
  });

  it("never returns an empty string", () => {
    expect(adminDisplayName({ first_name: "  ", email: "x@y.com" }).length).toBeGreaterThan(0);
  });
});

describe("validateNewAdminFields (US2.1)", () => {
  it("rejects an empty or whitespace first name", () => {
    expect(validateNewAdminFields("  ", "Doe", "j@x.com")).toEqual({
      ok: false,
      error: strings.adminMgmtNameRequired,
    });
  });

  it("rejects an empty last name", () => {
    expect(validateNewAdminFields("John", "", "j@x.com")).toEqual({
      ok: false,
      error: strings.adminMgmtNameRequired,
    });
  });

  it("rejects a malformed or empty email", () => {
    expect(validateNewAdminFields("John", "Doe", "not-an-email")).toEqual({
      ok: false,
      error: strings.adminMgmtEmailInvalid,
    });
    expect(validateNewAdminFields("John", "Doe", "")).toEqual({
      ok: false,
      error: strings.adminMgmtEmailInvalid,
    });
  });

  it("accepts valid names + email and normalizes the email (trim + lowercase)", () => {
    expect(
      validateNewAdminFields("  John ", " Doe ", "  John.Doe@Example.COM ")
    ).toEqual({
      ok: true,
      firstName: "John",
      lastName: "Doe",
      email: "john.doe@example.com",
    });
  });
});
