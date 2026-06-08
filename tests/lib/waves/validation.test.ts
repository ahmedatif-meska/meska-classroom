import { describe, it, expect } from "vitest";
import {
  validateWaveFields,
  validateMaterialFile,
  validateSubmissionFile,
  extensionForType,
  MAX_FILE_BYTES,
} from "@/lib/waves/validation";
import strings from "@/lib/strings";

describe("validateWaveFields", () => {
  it("accepts a trimmed name with a valid type", () => {
    const r = validateWaveFields("  July Cohort  ", "online");
    expect(r).toEqual({ ok: true, name: "July Cohort", type: "online" });
  });

  it("accepts offline", () => {
    expect(validateWaveFields("X", "offline")).toEqual({
      ok: true,
      name: "X",
      type: "offline",
    });
  });

  it("rejects an empty/whitespace name", () => {
    expect(validateWaveFields("   ", "online")).toEqual({
      ok: false,
      error: strings.wavesNameRequired,
    });
    expect(validateWaveFields(null, "online").ok).toBe(false);
  });

  it("rejects a missing or invalid type", () => {
    expect(validateWaveFields("X", "")).toEqual({
      ok: false,
      error: strings.wavesTypeRequired,
    });
    expect(validateWaveFields("X", "hybrid").ok).toBe(false);
    expect(validateWaveFields("X", null).ok).toBe(false);
  });
});

describe("validateMaterialFile", () => {
  it("accepts PDF and PowerPoint within the size limit", () => {
    for (const type of [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    ]) {
      expect(validateMaterialFile({ type, size: 1024 })).toEqual({ ok: true });
    }
  });

  it("rejects a disallowed type (e.g. Word for materials)", () => {
    expect(
      validateMaterialFile({ type: "application/msword", size: 10 }).ok
    ).toBe(false);
    expect(validateMaterialFile({ type: "image/png", size: 10 }).ok).toBe(false);
  });

  it("rejects an empty or oversize file", () => {
    expect(validateMaterialFile({ type: "application/pdf", size: 0 }).ok).toBe(
      false
    );
    expect(
      validateMaterialFile({
        type: "application/pdf",
        size: MAX_FILE_BYTES + 1,
      }).ok
    ).toBe(false);
  });

  it("accepts exactly the max size", () => {
    expect(
      validateMaterialFile({ type: "application/pdf", size: MAX_FILE_BYTES }).ok
    ).toBe(true);
  });

  it("rejects a missing file", () => {
    expect(validateMaterialFile(null).ok).toBe(false);
  });
});

describe("validateSubmissionFile", () => {
  it("accepts the material set plus Word", () => {
    for (const type of [
      "application/pdf",
      "application/vnd.ms-powerpoint",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    ]) {
      expect(validateSubmissionFile({ type, size: 1024 })).toEqual({ ok: true });
    }
  });

  it("rejects an unsupported type", () => {
    expect(validateSubmissionFile({ type: "image/png", size: 10 }).ok).toBe(
      false
    );
  });
});

describe("extensionForType", () => {
  it("maps known MIME types to extensions", () => {
    expect(extensionForType("application/pdf")).toBe("pdf");
    expect(extensionForType("application/vnd.ms-powerpoint")).toBe("ppt");
    expect(
      extensionForType(
        "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      )
    ).toBe("pptx");
    expect(
      extensionForType(
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      )
    ).toBe("docx");
  });

  it("falls back to bin for unknown types", () => {
    expect(extensionForType("application/octet-stream")).toBe("bin");
  });
});
