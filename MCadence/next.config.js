/** @type {import('next').NextConfig} */
const nextConfig = {
  // PWA configuration
  async rewrites() {
    return [
      {
        source: '/manifest.json',
        destination: '/api/manifest',
      },
    ];
  },
};

module.exports = nextConfig;
