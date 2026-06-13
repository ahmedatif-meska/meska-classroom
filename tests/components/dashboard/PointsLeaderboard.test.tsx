import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import PointsLeaderboard from "@/components/dashboard/PointsLeaderboard";

describe("PointsLeaderboard (feature 013)", () => {
  it("renders ranked entries in the given order", () => {
    render(
      <PointsLeaderboard
        title="Top members by points"
        entries={[
          { studentId: "a", name: "Alice", points: 60 },
          { studentId: "b", name: "Bob", points: 30 },
        ]}
        emptyLabel="No data yet"
      />
    );
    const items = screen.getAllByRole("listitem");
    expect(items).toHaveLength(2);
    expect(items[0]).toHaveTextContent("Alice");
    expect(items[0]).toHaveTextContent("60");
    expect(items[1]).toHaveTextContent("Bob");
  });

  it("shows the empty state when no member has points", () => {
    render(
      <PointsLeaderboard title="Top members by points" entries={[]} emptyLabel="No data yet" />
    );
    expect(screen.getByText("No data yet")).toBeInTheDocument();
  });
});
