const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  // xrpl.js uses Node crypto — needs this for server-side
  experimental: {
    serverComponentsExternalPackages: ['xrpl'],
  },
};

module.exports = withPWA(nextConfig);
