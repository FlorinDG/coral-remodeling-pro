import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";
import path from 'path';

const withNextIntl = createNextIntlPlugin();

const nextConfig: any = {
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.VERCEL_GIT_COMMIT_SHA || 'dev',
  },
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  serverExternalPackages: ['canvas'],
  typescript: {
    ignoreBuildErrors: true,
  },
  distDir: process.env.VERCEL ? '.next' : '.next.nosync',
  webpack: (config: any) => {
    config.cache = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
