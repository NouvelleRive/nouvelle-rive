import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    missingSuspenseWithCSRBailout: false,
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};
export default nextConfig;