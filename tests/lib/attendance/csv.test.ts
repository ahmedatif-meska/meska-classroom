import { describe, it, expect } from "vitest";
import strings from "@/lib/strings";
import { parseAttendanceCsv } from "@/lib/attendance/csv";

describe("parseAttendanceCsv (US3 — email-only template)", () => {
  it("parses a simple email column", () => {
    const result = parseAttendanceCsv("email\na@example.com\nb@example.com\n");
    expect(result).toEqual({ emails: ["a@example.com", "b@example.com"] });
  });

  it("accepts the header case-insensitively, with whitespace and a BOM", () => {
    const result = parseAttendanceCsv("﻿  Email \na@example.com\n");
    expect(result).toEqual({ emails: ["a@example.com"] });
  });

  it("trims and lowercases rows and drops blank lines", () => {
    const result = parseAttendanceCsv(
      "email\n  A@Example.COM  \n\n   \nb@example.com\n"
    );
    expect(result).toEqual({ emails: ["a@example.com", "b@example.com"] });
  });

  it("dedupes in-file duplicates (case-insensitively)", () => {
    const result = parseAttendanceCsv(
      "email\na@example.com\nA@EXAMPLE.com\nb@example.com\na@example.com\n"
    );
    expect(result).toEqual({ emails: ["a@example.com", "b@example.com"] });
  });

  it("errors on a missing email header", () => {
    expect(parseAttendanceCsv("name\nsomeone\n")).toEqual({
      error: strings.attendanceCsvMissingHeader,
    });
  });

  it("errors on an empty file", () => {
    expect(parseAttendanceCsv("")).toEqual({
      error: strings.attendanceCsvMissingHeader,
    });
    expect(parseAttendanceCsv("   \n  \n")).toEqual({
      error: strings.attendanceCsvMissingHeader,
    });
  });

  it("errors on a header with extra columns (template is single-column)", () => {
    expect(parseAttendanceCsv("email,name\na@example.com,Someone\n")).toEqual({
      error: strings.attendanceCsvMissingHeader,
    });
  });

  it("errors on a data row with extra columns", () => {
    expect(parseAttendanceCsv("email\na@example.com,Someone\n")).toEqual({
      error: strings.attendanceCsvMissingHeader,
    });
  });

  it("errors when the file has a header but no email rows", () => {
    expect(parseAttendanceCsv("email\n\n")).toEqual({
      error: strings.attendanceCsvEmpty,
    });
  });
});
