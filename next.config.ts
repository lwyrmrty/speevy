import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // Pitch decks and term sheets regularly exceed Next's default 1MB
  // Server Action body limit. Keep this aligned with realistic SPV docs.
  experimental: {
    serverActions: {
      bodySizeLimit: '25mb',
    },
  },
};

export default nextConfig;
