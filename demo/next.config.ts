import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    unoptimized: true,
  },

  // General configuration
  eslint: {
    ignoreDuringBuilds: true,
    dirs: ['src'],
  },
  typescript: {
    ignoreBuildErrors: true,
    dirs: ['src'],
  },

  reactStrictMode: false,

  // No rewrites. Let Vercel handle /api routing.
};

export default nextConfig;
