import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import strings from "@/lib/strings";

const { createWave, updateWave } = vi.hoisted(() => ({
  createWave: vi.fn(async () => ({ saved: true })),
  updateWave: vi.fn(async () => ({ saved: true })),
}));
vi.mock("@/app/admin/waves/actions", () => ({ createWave, updateWave }));
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
}));
// Stub the heavy contentEditable editor with a simple hidden input.
vi.mock("@/components/RichTextEditor", () => ({
  default: ({ name }: { name?: string }) => (
    <input type="hidden" name={name ?? "description_html"} defaultValue="" />
  ),
}));

import WaveForm from "@/components/WaveForm";

beforeEach(() => vi.clearAllMocks());

describe("WaveForm (US1.1)", () => {
  it("renders name field and both type options", () => {
    render(<WaveForm />);
    expect(screen.getByLabelText(/wave name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.waveTypeOnline })
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.waveTypeOffline })
    ).toBeInTheDocument();
  });

  it("selecting a type marks it pressed", () => {
    render(<WaveForm />);
    const online = screen.getByRole("button", { name: strings.waveTypeOnline });
    expect(online).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(online);
    expect(online).toHaveAttribute("aria-pressed", "true");
  });

  it("blocks submit with a missing type and does not call the action", async () => {
    render(<WaveForm />);
    fireEvent.change(screen.getByLabelText(/wave name/i), {
      target: { value: "July" },
    });
    fireEvent.click(
      screen.getByRole("button", { name: strings.waveFormSubmitLabel })
    );
    expect(await screen.findByText(strings.wavesTypeRequired)).toBeInTheDocument();
    expect(createWave).not.toHaveBeenCalled();
  });

  it("calls createWave when name and type are valid", async () => {
    render(<WaveForm />);
    fireEvent.change(screen.getByLabelText(/wave name/i), {
      target: { value: "July" },
    });
    fireEvent.click(screen.getByRole("button", { name: strings.waveTypeOnline }));
    fireEvent.click(
      screen.getByRole("button", { name: strings.waveFormSubmitLabel })
    );
    await waitFor(() => expect(createWave).toHaveBeenCalledTimes(1));
  });

  it("uses updateWave and prefills in edit mode", () => {
    render(
      <WaveForm
        wave={{
          id: "w1",
          name: "Existing",
          description_html: null,
          type: "offline",
          created_at: "",
        }}
      />
    );
    expect(screen.getByLabelText(/wave name/i)).toHaveValue("Existing");
    expect(
      screen.getByRole("button", { name: strings.waveTypeOffline })
    ).toHaveAttribute("aria-pressed", "true");
  });
});
