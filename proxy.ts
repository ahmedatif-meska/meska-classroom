import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { withPersistentMaxAge } from "@/lib/supabase/cookieOptions";

/**
 * Refreshes the Supabase session and protects panel routes server-side. The
 * sign-in pages themselves stay public (excluded by the matcher).
 *
 * Two role-gated path groups (006 added the student group):
 * - `/admin/**` (dashboard, admins, instructors, members list) require `role === 'admin'`
 *   — anything else is redirected to `/admin`.
 * - `/student/dashboard/**` requires an authenticated member (`role === 'student'`)
 *   — anything else is redirected to `/student`.
 *
 * The member-info page `/admin/members/<id>` (the QR scan target) IS matched here so
 * its session is refreshed, but it is exempt from the redirect: it self-gates and
 * renders an explicit "Unauthorized" screen for non-admins, so someone scanning the
 * QR with a phone camera sees a clear denial rather than being bounced to sign-in.
 *
 * Next 16 `proxy` convention (replaces the deprecated `middleware`).
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            // Persist refreshed auth cookies so reopening the app keeps the session (US1).
            response.cookies.set(name, value, withPersistentMaxAge(options));
          }
        },
      },
    }
  );

  // getUser() validates the JWT with the auth server (more secure than getSession)
  // AND refreshes the session, persisting rotated tokens onto `response`. Every
  // protected route must pass through here so the refresh is written — otherwise a
  // Server Component would try to refresh with read-only cookies and break.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;

  const path = request.nextUrl.pathname;
  const isStudentRoute = path.startsWith("/student");

  // The member-info page `/admin/members/<id>` (QR scan target) self-gates and
  // renders its own "Unauthorized" screen for non-admins. We still run through the
  // proxy to refresh the session, but we must NOT redirect — let the page decide.
  const isMemberDetail = /^\/admin\/members\/[^/]+$/.test(path);
  if (isMemberDetail) return response;

  const allowed = isStudentRoute ? role === "student" : role === "admin";

  if (!allowed) {
    const url = request.nextUrl.clone();
    url.pathname = isStudentRoute ? "/student" : "/admin";
    return NextResponse.redirect(url);
  }

  return response;
}

export const config = {
  matcher: [
    "/admin/dashboard/:path*",
    "/admin/admins/:path*",
    "/admin/instructors/:path*",
    "/admin/waves/:path*",
    "/admin/members/:path*",
    "/admin/errors/:path*",
    "/student/dashboard/:path*",
  ],
};
