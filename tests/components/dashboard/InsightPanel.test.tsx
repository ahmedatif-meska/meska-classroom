import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import InsightPanel from "@/components/dashboard/InsightPanel";

describe("InsightPanel (feature 013)", () => {
  it("renders the title and each labelled item value", () => {
    render(
      <InsightPanel
        title="Content built"
        items={[
          { label: "Weeks", value: "4" },
          { label: "Materials", value: "12" },
          { label: "Videos", value: "0" },
        ]}
      />
    );
    expect(screen.getByText("Content built")).toBeInTheDocument();
    expect(screen.getByText("Weeks")).toBeInTheDocument();
    expect(screen.getByText("4")).toBeInTheDocument();
    expect(screen.getByText("12")).toBeInTheDocument();
    expect(screen.getByText("0")).toBeInTheDocument();
  });
});
