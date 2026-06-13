import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import StatCard from "@/components/dashboard/StatCard";

describe("StatCard (feature 013)", () => {
  it("renders value, label, and optional sublabel", () => {
    render(<StatCard label="Waves" value={5} icon={<svg />} sublabel="3 online · 2 offline" />);
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Waves")).toBeInTheDocument();
    expect(screen.getByText("3 online · 2 offline")).toBeInTheDocument();
  });

  it("renders a zero value and omits the sublabel when not given", () => {
    render(<StatCard label="Members" value={0} icon={<svg />} />);
    expect(screen.getByText("0")).toBeInTheDocument();
    expect(screen.getByText("Members")).toBeInTheDocument();
  });
});
