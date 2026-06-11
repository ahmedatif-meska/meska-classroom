import { describe, it, expect } from "vitest";
import { BOUNDS } from "@/lib/errors/serialize";
import { buildClientErrorReport } from "@/lib/errors/report";

describe("buildClientErrorReport (US3.1)", () => {
  it("captures message, stack, and the pathname", () => {
    const err = new Error("render crash");
    const report = buildClientErrorReport(err, "/student/dashboard");
    expect(report.page).toBe("/student/dashboard");
    expect(report.message).toBe("render crash");
    expect(report.stack).toContain("render crash");
  });

  it("strips query strings and fragments from the page (tokens never leave the browser)", () => {
    const report = buildClientErrorReport(
      new Error("x"),
      "/student/auth/confirm?token_hash=secret#frag"
    );
    expect(report.page).toBe("/student/auth/confirm");
    expect(JSON.stringify(report)).not.toContain("secret");
  });

  it("truncates message and stack to BOUNDS", () => {
    const err = new Error("m".repeat(5000));
    err.stack = "s".repeat(20000);
    const report = buildClientErrorReport(err, "/admin");
    expect(report.message).toHaveLength(BOUNDS.message);
    expect(report.stack).toHaveLength(BOUNDS.stack);
  });

  it("never throws on weird error values", () => {
    expect(buildClientErrorReport(null, "/x").message).toBeTypeOf("string");
    expect(buildClientErrorReport(undefined, "/x").message).toBeTypeOf("string");
    expect(buildClientErrorReport("plain string", "/x").message).toBe("plain string");
    expect(buildClientErrorReport(42, "/x").message).toBe("42");
    expect(
      buildClientErrorReport(
        {
          get message(): string {
            throw new Error("gotcha");
          },
        },
        "/x"
      ).message
    ).toBeTypeOf("string");
  });

  it("tolerates a non-string pathname", () => {
    const report = buildClientErrorReport(
      new Error("x"),
      undefined as unknown as string
    );
    expect(report.page).toBe("");
  });
});
