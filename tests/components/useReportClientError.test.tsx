import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import strings from "@/lib/strings";

const reportClientError = vi.fn(async () => {});
vi.mock("@/app/actions", () => ({
  reportClientError: (...args: unknown[]) => reportClientError(...(args as [])),
}));

vi.mock("next/navigation", () => ({
  usePathname: () => "/admin/waves",
}));

import { useReportClientError } from "@/lib/errors/useReportClientError";
import AdminError from "@/app/admin/error";

function Probe({ error }: { error: Error }) {
  useReportClientError(error);
  return <div data-testid="probe" />;
}

beforeEach(() => {
  vi.clearAllMocks();
  reportClientError.mockResolvedValue(undefined);
});

describe("useReportClientError (US3.1)", () => {
  it("reports once with the page path and error message", async () => {
    const error = new Error("client crash");
    await act(async () => {
      render(<Probe error={error} />);
    });
    expect(reportClientError).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledWith(
      expect.objectContaining({ page: "/admin/waves", message: "client crash" })
    );
  });

  it("does not fire again on a re-render with the same error instance", async () => {
    const error = new Error("client crash");
    let rerender: (ui: React.ReactElement) => void;
    await act(async () => {
      ({ rerender } = render(<Probe error={error} />));
    });
    await act(async () => {
      rerender!(<Probe error={error} />);
    });
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });

  it("produces no unhandled rejection when the report fails", async () => {
    reportClientError.mockRejectedValue(new Error("offline"));
    await act(async () => {
      render(<Probe error={new Error("x")} />);
    });
    expect(reportClientError).toHaveBeenCalledTimes(1);
    // Reaching this assertion without vitest flagging an unhandled rejection
    // is the behavior under test.
  });
});

describe("panel error screen with reporting wired (US3.1)", () => {
  it("renders the standard error UI and a working retry even when reporting fails", async () => {
    reportClientError.mockRejectedValue(new Error("offline"));
    const reset = vi.fn();
    await act(async () => {
      render(<AdminError error={new Error("boom")} reset={reset} />);
    });

    expect(screen.getByText(strings.errorTitle)).toBeInTheDocument();
    const retry = screen.getByRole("button", { name: strings.errorRetryLabel });
    fireEvent.click(retry);
    expect(reset).toHaveBeenCalledTimes(1);
    expect(reportClientError).toHaveBeenCalledTimes(1);
  });
});
