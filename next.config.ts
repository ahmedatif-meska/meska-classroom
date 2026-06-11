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
