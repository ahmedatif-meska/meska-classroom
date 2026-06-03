import { describe, it, expect, vi } from "vitest";

const redirect = vi.fn();
vi.mock("next/navigation", () => ({
  redirect: (path: string) => redirect(path),
}));

import Home from "@/app/page";

describe("Root entry (/)", () => {
  it("redirects to /student (student is the default panel)", () => {
    Home();
    expect(redirect).toHaveBeenCalledWith("/student");
  });
});
