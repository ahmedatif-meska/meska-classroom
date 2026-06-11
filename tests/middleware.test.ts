import { describe, it, expect, vi, beforeEach } from "vitest";

// Vary the authenticated user / stored session per test.
let currentUser: {
  app_metadata?: { role?: string; tenant_id?: string };
} | null = null;
let currentSession: { access_token: string } | null = null;
const refreshSession = vi.fn(async () => ({ data: {}, error: null }));

vi.mock("@supabase/ssr", () => ({
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: async () => ({ data: { user: currentUser } }),
      getSession: async () => ({ data: { session: currentSession } }),
      refreshSession,
    },
  })),
}));

import { NextRequest } from "next/server";
import { proxy } from "@/proxy";

/** A structurally valid JWT whose payload carries the given wave claim. */
function tokenWithTenant(tenantId?: string) {
  const payload = Buffer.from(
    JSON.stringify({ app_metadata: tenantId ? { tenant_id: tenantId } : {} })
  ).toString("base64url");
  return `header.${payload}.signature`;
}

beforeEach(() => {
  currentUser = null;
  currentSession = null;
  refreshSession.mockClear();
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

  it("does NOT redirect the member-info QR target — it self-gates (session still refreshed)", async () => {
    // A non-admin scanning the QR must reach the page (which renders Unauthorized),
    // not get bounced to sign-in; and the proxy must still run to refresh cookies.
    currentUser = null;
    const res = await proxy(
      new NextRequest("http://localhost/admin/members/abc-123")
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("still redirects a non-admin away from the members LIST", async () => {
    currentUser = { app_metadata: { role: "student" } };
    const res = await proxy(new NextRequest("http://localhost/admin/members"));
    expect(res.headers.get("location")).toBe("http://localhost/admin");
  });
});

describe("middleware student-route protection / session reopen (US1)", () => {
  it("lets an authenticated student through to their dashboard on reopen (no re-login)", async () => {
    currentUser = { app_metadata: { role: "student" } };
    const res = await proxy(
      new NextRequest("http://localhost/student/dashboard")
    );
    expect(res.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated visitor away from the student dashboard", async () => {
    currentUser = null;
    const res = await proxy(
      new NextRequest("http://localhost/student/dashboard")
    );
    expect(res.headers.get("location")).toBe("http://localhost/student");
  });
});

describe("middleware wave-claim sync (reassign reflects immediately)", () => {
  it("refreshes the session when the token's wave claim no longer matches the record", async () => {
    currentUser = { app_metadata: { role: "student", tenant_id: "wave-12" } };
    currentSession = { access_token: tokenWithTenant("old-wave") };
    const res = await proxy(
      new NextRequest("http://localhost/student/dashboard")
    );
    expect(refreshSession).toHaveBeenCalledTimes(1);
    expect(res.headers.get("location")).toBeNull();
  });

  it("does NOT refresh when the token claim already matches the record", async () => {
    currentUser = { app_metadata: { role: "student", tenant_id: "wave-12" } };
    currentSession = { access_token: tokenWithTenant("wave-12") };
    await proxy(new NextRequest("http://localhost/student/dashboard"));
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("does nothing without a stored session", async () => {
    currentUser = { app_metadata: { role: "student", tenant_id: "wave-12" } };
    currentSession = null;
    await proxy(new NextRequest("http://localhost/student/dashboard"));
    expect(refreshSession).not.toHaveBeenCalled();
  });

  it("never runs the claim sync for admins (their reads don't depend on a wave claim)", async () => {
    currentUser = { app_metadata: { role: "admin" } };
    currentSession = { access_token: tokenWithTenant("anything") };
    await proxy(new NextRequest("http://localhost/admin/dashboard"));
    expect(refreshSession).not.toHaveBeenCalled();
  });
});
