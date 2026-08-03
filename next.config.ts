import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Opportunity assets upload directly to Supabase via signed URLs, so this
  // limit mainly covers other Server Action payloads. Keep some headroom.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
