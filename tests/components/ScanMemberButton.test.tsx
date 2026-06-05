import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import strings from "@/lib/strings";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

// No real camera in jsdom — make start() reject so the component shows its
// camera-error state (the decode path is covered by the scan-helper test).
const stop = vi.fn(async () => {});
const clear = vi.fn();
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    start() {
      return Promise.reject(new Error("no camera"));
    }
    stop = stop;
    clear = clear;
  },
}));

import ScanMemberButton from "@/components/ScanMemberButton";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("ScanMemberButton", () => {
  it("renders the Scan QR trigger", () => {
    render(<ScanMemberButton />);
    expect(
      screen.getByRole("button", { name: strings.membersScanLabel })
    ).toBeInTheDocument();
  });

  it("opens the scanner dialog and reports a camera error when access fails", async () => {
    render(<ScanMemberButton />);
    fireEvent.click(
      screen.getByRole("button", { name: strings.membersScanLabel })
    );
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(strings.scanTitle)).toBeInTheDocument();
    expect(await screen.findByText(strings.scanCameraError)).toBeInTheDocument();
  });
});
