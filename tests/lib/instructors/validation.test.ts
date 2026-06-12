import { describe, it, expect } from "vitest";
import {
  validateInstructorFields,
  validateImageFile,
  extensionForType,
  MAX_IMAGE_BYTES,
} from "@/lib/instructors/validation";
import strings from "@/lib/strings";

describe("validateInstructorFields (US2.1)", () => {
  it("rejects an empty or whitespace name", () => {
    expect(validateInstructorFields("", "Lead")).toEqual({
      ok: false,
      error: strings.instructorsNameRequired,
    });
    expect(validateInstructorFields("   ", "Lead")).toEqual({
      ok: false,
      error: strings.instructorsNameRequired,
    });
    expect(validateInstructorFields(null, "Lead")).toEqual({
      ok: false,
      error: strings.instructorsNameRequired,
    });
  });

  it("rejects an empty or whitespace title", () => {
    expect(validateInstructorFields("Dr. Sarah Lee", "")).toEqual({
      ok: false,
      error: strings.instructorsTitleRequired,
    });
    expect(validateInstructorFields("Dr. Sarah Lee", "   ")).toEqual({
      ok: false,
      error: strings.instructorsTitleRequired,
    });
    expect(validateInstructorFields("Dr. Sarah Lee", null)).toEqual({
      ok: false,
      error: strings.instructorsTitleRequired,
    });
  });

  it("accepts and trims a valid name + title", () => {
    expect(
      validateInstructorFields("  Dr. Sarah Lee  ", "  Lead AI Instructor  ")
    ).toEqual({
      ok: true,
      name: "Dr. Sarah Lee",
      title: "Lead AI Instructor",
    });
  });
});

describe("validateImageFile (US2.1, FR-007)", () => {
  it("treats a missing image as allowed (image is optional)", () => {
    expect(validateImageFile(null)).toEqual({ ok: true });
  });

  it("rejects an unsupported MIME type", () => {
    expect(validateImageFile({ type: "image/gif", size: 1000 })).toEqual({
      ok: false,
      error: strings.instructorsImageInvalid,
    });
  });

  it("rejects an oversized file", () => {
    expect(
      validateImageFile({ type: "image/png", size: MAX_IMAGE_BYTES + 1 })
    ).toEqual({ ok: false, error: strings.instructorsImageInvalid });
  });

  it("rejects a zero-byte file", () => {
    expect(validateImageFile({ type: "image/png", size: 0 })).toEqual({
      ok: false,
      error: strings.instructorsImageInvalid,
    });
  });

  it("accepts png/jpeg/webp within the size limit", () => {
    for (const type of ["image/png", "image/jpeg", "image/webp"]) {
      expect(validateImageFile({ type, size: MAX_IMAGE_BYTES })).toEqual({
        ok: true,
      });
    }
  });
});

describe("extensionForType", () => {
  it("maps MIME types to extensions", () => {
    expect(extensionForType("image/png")).toBe("png");
    expect(extensionForType("image/webp")).toBe("webp");
    expect(extensionForType("image/jpeg")).toBe("jpg");
  });
});
