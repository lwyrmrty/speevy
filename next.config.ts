import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Opportunity assets upload directly to Supabase via signed URLs, so this
  // limit mainly covers other Server Action payloads. Keep some headroom.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
  serverExternalPackages: ['@sparticuz/chromium-min', 'puppeteer-core', 'sharp'],
};

export default nextConfig;
