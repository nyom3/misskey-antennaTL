/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.nekonet.cyou',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '*.misskey.tarohouse.net',
        port: '',
        pathname: '/**',
      },
    ],
  },
};

export default nextConfig;
