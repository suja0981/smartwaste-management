/** @type {import('next').NextConfig} */
const nextConfig = {
transpilePackages: [
  "firebase",
  "@firebase/app",
  "@firebase/auth",
  "@firebase/firestore",
  "@firebase/storage",
  "@firebase/analytics",
  "@firebase/messaging",
  "@firebase/functions",
  "@firebase/util",
  "@firebase/component",
  "@firebase/logger",
],

  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com",
      },
    ],
  },
};

module.exports = nextConfig;