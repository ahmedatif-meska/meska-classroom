import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";

const { createWave, updateWave } = vi.hoisted(() => ({
  createWave: vi.fn(async () => ({
    saved: true,
    wave: {
      id: "w1",
      name: "July",
      description_html: null,
      type: "online",
      created_at: "",
    },
  })),
  updateWave: vi.fn(async () => ({ saved: true })),
}));
vi.mock("@/app/admin/waves/actions", () => ({ createWave, updateWave }));

// Stub heavy/child components so the builder renders in isolation.
vi.mock("@/components/RichTextEditor", () => ({
  default: () => <div data-testid="rte" />,
}));
vi.mock("@/components/WaveContentManager", () => ({
  default: ({ waveId }: { waveId: string }) => (
    <div data-testid="content-manager">{waveId}</div>
  ),
}));

import WaveBuilder from "@/components/WaveBuilder";

beforeEach(() => vi.clearAllMocks());

const saveButton = () =>
  screen.getByRole("button", { name: strings.waveFormSubmitLabel });

describe("WaveBuilder (one-page, Save at end)", () => {
  it("shows a Save button and the weeks section locked initially", () => {
    render(<WaveBuilder />);
    expect(saveButton()).toBeInTheDocument();
    expect(screen.getByText(strings.waveBuilderWeeksLocked)).toBeInTheDocument();
    expect(screen.queryByTestId("content-manager")).not.toBeInTheDocument();
  });

  it("creates the wave on Save and unlocks the weeks builder", async () => {
    render(<WaveBuilder />);
    fireEvent.change(screen.getByLabelText(/wave name/i), {
      target: { value: "July" },
    });
    fireEvent.click(screen.getByRole("button", { name: strings.waveTypeOnline }));
    fireEvent.click(saveButton());

    await waitFor(() => expect(createWave).toHaveBeenCalledTimes(1));
    expect(await screen.findByTestId("content-manager")).toHaveTextContent("w1");
  });

  it("blocks Save with a missing type and does not call the action", async () => {
    render(<WaveBuilder />);
    fireEvent.change(screen.getByLabelText(/wave name/i), {
      target: { value: "July" },
    });
    fireEvent.click(saveButton());
    expect(await screen.findByText(strings.wavesTypeRequired)).toBeInTheDocument();
    expect(createWave).not.toHaveBeenCalled();
  });

  it("updates (not re-creates) on a second Save after creation", async () => {
    render(<WaveBuilder />);
    fireEvent.change(screen.getByLabelText(/wave name/i), {
      target: { value: "July" },
    });
    fireEvent.click(screen.getByRole("button", { name: strings.waveTypeOnline }));
    fireEvent.click(saveButton());
    await waitFor(() => expect(createWave).toHaveBeenCalledTimes(1));

    fireEvent.click(saveButton());
    await waitFor(() => expect(updateWave).toHaveBeenCalledTimes(1));
    expect(createWave).toHaveBeenCalledTimes(1);
  });
});
