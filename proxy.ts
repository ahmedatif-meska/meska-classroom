import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

/**
 * Refreshes the Supabase session and protects panel routes server-side. The
 * sign-in pages themselves stay public (excluded by the matcher).
 *
 * Two role-gated path groups (006 added the student group):
 * - `/admin/**` (dashboard, admins, instructors, members) require `role === 'admin'`
 *   — anything else is redirected to `/admin`.
 * - `/student/dashboard/**` requires an authenticated member (`role === 'student'`)
 *   — anything else is redirected to `/student`.
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
            response.cookies.set(name, value, options);
          }
        },
      },
    }
  );

  // getUser() validates the JWT with the auth server (more secure than getSession).
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const role = user?.app_metadata?.role;

  const isStudentRoute = request.nextUrl.pathname.startsWith("/student");
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
    "/admin/members/:path*",
    "/student/dashboard/:path*",
  ],
};
