/** @type {import('next').NextConfig} */
module.exports = {
  output: 'standalone',
  images: {
    unoptimized: true,
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'img.freepik.com',
        port: '',
      },
    ],
  },
}