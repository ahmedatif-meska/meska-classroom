import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PerWaveTable from "@/components/dashboard/PerWaveTable";
import type { WaveStat } from "@/lib/dashboard/types";
import strings from "@/lib/strings";

const waves: WaveStat[] = [
  {
    id: "w1",
    name: "Wave A",
    type: "online",
    status: "in_progress",
    memberCount: 20,
    attendanceRate: 0.75,
    submissionRate: 0.5,
    avgRating: 4.2,
  },
  {
    id: "w2",
    name: "Empty Wave With A Very Long Name That Should Truncate",
    type: "offline",
    status: "not_started",
    memberCount: 0,
    attendanceRate: null,
    submissionRate: null,
    avgRating: null,
  },
];

describe("PerWaveTable (feature 013)", () => {
  it("renders one data row per wave with values and tags", () => {
    render(<PerWaveTable waves={waves} />);
    const rows = document.querySelectorAll("[data-admin-row]");
    expect(rows).toHaveLength(2);
    expect(screen.getByText("Wave A")).toBeInTheDocument();
    expect(screen.getByText("75%")).toBeInTheDocument(); // attendance
    expect(screen.getByText("50%")).toBeInTheDocument(); // submission
    expect(screen.getByText("4.2")).toBeInTheDocument(); // rating
    // Type/status tags reuse the shared copy.
    expect(screen.getByText(strings.waveTypeOnline)).toBeInTheDocument();
    expect(screen.getByText(strings.waveStatusInProgress)).toBeInTheDocument();
  });

  it("renders '—' for a wave with no members/activity", () => {
    render(<PerWaveTable waves={[waves[1]]} />);
    // attendance, submission, rating all show the sentinel.
    expect(screen.getAllByText(strings.rateNoData).length).toBeGreaterThanOrEqual(3);
  });

  it("shows the empty state when there are no waves", () => {
    render(<PerWaveTable waves={[]} />);
    expect(screen.getByText(strings.perWaveEmptyNote)).toBeInTheDocument();
  });
});
