import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /**
   * transpilePackages: force Next.js to process firebase packages
   * through the client-side bundler rather than treating them as
   * external Node.js modules. Without this, the server-side bundler
   * can try to evaluate firebase/auth which uses browser-only APIs
   * (IndexedDB, window, navigator) and crashes during SSR.
   */
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

  /**
   * serverExternalPackages: packages listed here are excluded from
   * the server bundle entirely. If any server component somehow
   * still tries to import firebase, this ensures it gets the empty
   * stub rather than crashing.
   *
   * Note: only use this if you are NOT doing server-side Firebase Admin
   * operations (which use the separate firebase-admin package, not the
   * client SDK). Since this project uses firebase-admin in the Python
   * backend only, not in Next.js server components, this is safe.
   */
  experimental: {
    serverComponentsExternalPackages: [
      "firebase",
      "@firebase/auth",
      "@firebase/app",
    ],
  },

  // Standard Next.js settings
  reactStrictMode: true,

  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**.googleusercontent.com", // for Firebase/Google profile pictures
      },
    ],
  },
};

export default nextConfig;