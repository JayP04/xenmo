/** @type {import('next').NextConfig} */
const nextConfig = {
  // xrpl.js uses Node crypto — needs this for server-side
  experimental: {
    serverComponentsExternalPackages: ['xrpl'],
  },
};

module.exports = nextConfig;
