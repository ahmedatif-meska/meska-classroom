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
  experimental: { turbopackFileSystemCacheForDev: true },
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
