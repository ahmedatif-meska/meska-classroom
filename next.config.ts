import type { NextConfig } from "next";

// Derive the Supabase Storage host from the project URL so next/image may load
// public instructor photos (feature 005). Falls back gracefully if unset.
const supabaseHost = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").hostname;
  } catch {
    return undefined;
  }
})();

const nextConfig: NextConfig = {
  reactCompiler: true,
  // Material/assignment files are uploaded through Server Actions and the form
  // validates up to 25 MB (see validateMaterialFile). The Server Action body
  // limit defaults to 1 MB, which silently rejected any real PDF — raise it past
  // 25 MB so a valid file's multipart body fits.
  experimental: {
    turbopackFileSystemCacheForDev: true,
    serverActions: { bodySizeLimit: "30mb" },
    // proxy.ts matches /admin/**, and Next clones the body of every proxied
    // request with a 10 MB default cap (proxyClientMaxBodySize) — larger upload
    // bodies were silently truncated, so busboy failed with "Unexpected end of
    // form". Must match bodySizeLimit or uploads between 10 and 30 MB fail.
    proxyClientMaxBodySize: "30mb",
  },
  devIndicators: false,
  // Compatibility shim for the shared Supabase "Reset Password" email template.
  // That single template (Auth → Email Templates) was authored for the admin
  // flow (feature 003) and hardcodes `/admin/auth/confirm`; student recovery
  // (feature 012) reuses the same template, so the link concatenates the
  // student `redirectTo` with the template's admin path —
  // `/student/auth/confirm/admin/auth/confirm?token_hash=…&type=recovery` — a
  // 404. Strip any segments appended AFTER a confirm route back to the route
  // itself (the query string, incl. token_hash/type, is preserved by Next), so
  // both panels' recovery links resolve regardless of the template's suffix.
  // Root-cause fix is to make the template panel-agnostic
  // (`{{ .RedirectTo }}?token_hash={{ .TokenHash }}&type=recovery`); this shim
  // then becomes inert and may be removed.
  async redirects() {
    return [
      {
        source: "/student/auth/confirm/:extra+",
        destination: "/student/auth/confirm",
        permanent: false,
      },
      {
        source: "/admin/auth/confirm/:extra+",
        destination: "/admin/auth/confirm",
        permanent: false,
      },
    ];
  },
  images: {
    remotePatterns: supabaseHost
      ? [
          {
            protocol: "https",
            hostname: supabaseHost,
            pathname: "/storage/v1/object/public/**",
          },
        ]
      : [],
  },
};

export default nextConfig;
