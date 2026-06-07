import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import strings from "@/lib/strings";

// No real camera in jsdom — make start() reject so the live path shows its error
// state; scanFile() is the photo-fallback decode and is controlled per-test.
const stop = vi.fn(async () => {});
const clear = vi.fn();
const scanFile = vi.fn(async () => "https://x.test/admin/members/m-123");
vi.mock("html5-qrcode", () => ({
  Html5Qrcode: class {
    start() {
      return Promise.reject(new Error("init failed"));
    }
    stop = stop;
    clear = clear;
    scanFile = scanFile;
  },
}));

import ScanMemberButton from "@/components/ScanMemberButton";

// Stub the full-page navigation the component uses on a successful decode.
const assign = vi.fn();
beforeEach(() => {
  vi.clearAllMocks();
  scanFile.mockResolvedValue("https://x.test/admin/members/m-123");
  Object.defineProperty(window, "location", {
    configurable: true,
    value: { assign },
  });
});

function openDialog() {
  render(<ScanMemberButton />);
  fireEvent.click(screen.getByRole("button", { name: strings.membersScanLabel }));
}

async function pickPhoto() {
  const input = document.querySelector(
    'input[type="file"]'
  ) as HTMLInputElement;
  const file = new File(["x"], "qr.png", { type: "image/png" });
  // applyAccept:false so the hidden capture input still accepts the test file.
  await userEvent.upload(input, file, { applyAccept: false });
}

describe("ScanMemberButton", () => {
  it("renders the Scan QR trigger", () => {
    render(<ScanMemberButton />);
    expect(
      screen.getByRole("button", { name: strings.membersScanLabel })
    ).toBeInTheDocument();
  });

  it("opens the dialog, reports a camera error, and always offers the photo fallback", async () => {
    openDialog();
    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText(strings.scanTitle)).toBeInTheDocument();
    expect(await screen.findByText(strings.scanCameraError)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: strings.scanPhotoLabel })
    ).toBeInTheDocument();
  });

  it("decodes a photo of a member QR and navigates to that member", async () => {
    openDialog();
    await pickPhoto();
    await waitFor(() => expect(scanFile).toHaveBeenCalled());
    await waitFor(() =>
      expect(assign).toHaveBeenCalledWith("/admin/members/m-123")
    );
  });

  it("shows an error and does not navigate when the photo isn't a member QR", async () => {
    scanFile.mockResolvedValue("https://evil.example.com/phish");
    openDialog();
    await pickPhoto();
    expect(await screen.findByText(strings.scanInvalid)).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });

  it("shows an unreadable-photo error when no QR is found", async () => {
    scanFile.mockRejectedValue(new Error("No QR code found"));
    openDialog();
    await pickPhoto();
    expect(
      await screen.findByText(strings.scanPhotoUnreadable)
    ).toBeInTheDocument();
    expect(assign).not.toHaveBeenCalled();
  });
});
