import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // @ts-ignore
  turbopack: {
    // Specify the absolute path to fix workspace inference issues
    root: process.cwd(),
  },
  trailingSlash: true,
  images: {
    unoptimized: true,
    remotePatterns: [{ protocol: 'https', hostname: '**' }],
  },
};

export default nextConfig;
