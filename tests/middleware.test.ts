import { describe, it, expect, vi, beforeEach } from "vitest";

// Vary the authenticated user per test.
let currentUser: { app_metadata?: { role?: string } } | null = null;

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
    },
  })),
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

beforeEach(() => {
  currentUser = null;
  process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "anon";
});

describe("middleware admin-route protection (FR-010)", () => {
  it("redirects to /admin when there is no admin session", async () => {
    currentUser = null;
    const res = await proxy(
      new NextRequest("http://localhost/admin/dashboard")
    );
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost/admin");
  });

  it("redirects a non-admin user to /admin", async () => {
    currentUser = { app_metadata: { role: "student" } };
    const res = await proxy(
      new NextRequest("http://localhost/admin/dashboard")
    );
    expect(res.headers.get("location")).toBe("http://localhost/admin");
  });

  it("allows an admin through to the dashboard", async () => {
    currentUser = { app_metadata: { role: "admin" } };
    const res = await proxy(
      new NextRequest("http://localhost/admin/dashboard")
    );
    // NextResponse.next() — no redirect location header
    expect(res.headers.get("location")).toBeNull();
  });
});
