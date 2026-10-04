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
  serverExternalPackages: ['canvas', 'pdf-parse'],
  // WO-4b: the signed work order PDF loads its IBM Plex fonts from disk (path.join(process.cwd(), …)) —
  // ship them with every server function that may render it (signing, the review queue).
  outputFileTracingIncludes: {
    '/**': ['./src/lib/documents/fonts/**'],
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  distDir: process.env.VERCEL ? '.next' : '.next.nosync',
  webpack: (config: any) => {
    config.cache = false;
    return config;
  },
};

export default withNextIntl(nextConfig);
