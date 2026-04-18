import createNextIntlPlugin from 'next-intl/plugin';
import type { NextConfig } from "next";
import path from 'path';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '20mb',
    },
  },
  distDir: process.env.VERCEL ? '.next' : '.next.nosync',
  webpack: (config) => {
    config.cache = false;
    // pdfjs-dist ESM uses Object.defineProperty on globals which Webpack intercepts.
    // Alias to the legacy CJS build to avoid the runtime error.
    config.resolve.alias = {
      ...config.resolve.alias,
      'pdfjs-dist': path.resolve('./node_modules/pdfjs-dist/legacy/build/pdf.mjs'),
    };
    return config;
  },
};

export default withNextIntl(nextConfig);
