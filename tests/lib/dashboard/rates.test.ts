import { describe, it, expect } from "vitest";
import { attendanceRate, submissionRate, average } from "@/lib/dashboard/rates";

describe("dashboard rate helpers (feature 013)", () => {
  it("attendanceRate returns the fraction present ÷ total", () => {
    expect(attendanceRate(15, 20)).toBe(0.75);
    expect(attendanceRate(0, 5)).toBe(0);
  });

  it("attendanceRate guards a zero/negative denominator → null (never NaN)", () => {
    expect(attendanceRate(0, 0)).toBeNull();
    expect(attendanceRate(3, -1)).toBeNull();
    expect(Number.isNaN(attendanceRate(0, 0) as number)).toBe(false);
  });

  it("submissionRate returns received ÷ expected, guarding zero expected", () => {
    expect(submissionRate(4, 8)).toBe(0.5);
    expect(submissionRate(0, 0)).toBeNull();
    expect(submissionRate(5, 0)).toBeNull();
  });

  it("average returns the mean and guards a zero count → null", () => {
    expect(average(8.4, 2)).toBe(4.2);
    expect(average(0, 0)).toBeNull();
    expect(Number.isFinite(average(0, 0) as number)).toBe(false); // it's null, not Infinity
  });
});
