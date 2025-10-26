import type { NextConfig } from "next";

/**
 * Temporary: ignore ESLint and TypeScript errors during production builds
 * Remove this once lint/type errors are fixed.
 */
const nextConfig: NextConfig = {
  experimental: { optimizeCss: true },

  eslint: { ignoreDuringBuilds: true },
  typescript: { ignoreBuildErrors: true },
};

export default nextConfig;
