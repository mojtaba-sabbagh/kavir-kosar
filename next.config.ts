import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Let production builds pass even if ESLint has errors (optional)
  eslint: {
    ignoreDuringBuilds: true, // set true if you want to unblock CI quickly
  },
  output: 'standalone', // for Docker production builds
  // Pin the correct workspace root for Turbopack (to silence the lockfile warning)
  // Set this to the directory that contains THIS app's package.json and next.config.ts
  turbopack: {
    root: '.',
  },
};

export default nextConfig;
