import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: { turbopackFileSystemCacheForDev: true },
  devIndicators: false,
};

export default nextConfig;
