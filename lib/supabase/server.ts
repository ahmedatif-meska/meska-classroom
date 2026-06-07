import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withPersistentMaxAge } from "@/lib/supabase/cookieOptions";

/**
 * Supabase client for Server Components, Server Actions, and Route Handlers.
 * Cookie-bound (httpOnly) and uses the anon key — access is bounded by RLS and
 * the authenticated user's session. Never use the service-role key here.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              // Persist auth cookies so the session survives an app close (US1).
              cookieStore.set(name, value, withPersistentMaxAge(options));
            }
          } catch {
            // setAll called from a Server Component (read-only cookies) —
            // safe to ignore when middleware refreshes the session.
          }
        },
      },
    }
  );
}
