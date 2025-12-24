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

  async rewrites() {
    return [
      {
        source: '/api/v1/:path*',
        destination: '/api/test',
      },
    ];
  },
};

export default nextConfig;
