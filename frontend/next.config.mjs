/**
 * next.config.js
 *
 * Phase 4: PWA support via next-pwa.
 *
 * Install:
 *   npm install next-pwa
 *
 * next-pwa generates a service worker at /public/sw.js automatically.
 * It caches the /driver/* pages and API responses so crew can
 * keep working with partial connectivity.
 *
 * In development, PWA is disabled to avoid cache confusion.
 */

import nextPwa from "next-pwa";

const withPWA = nextPwa({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  // Cache API responses for the driver view
  runtimeCaching: [
    {
      urlPattern: /^https?.*\/driver\/.*/,
      handler: "NetworkFirst",
      options: {
        cacheName: "driver-api",
        expiration: { maxEntries: 50, maxAgeSeconds: 300 }, // 5 min
        networkTimeoutSeconds: 5,
      },
    },
    {
      urlPattern: /^https?.*\/(bins|tasks|crews)\/.*/,
      handler: "StaleWhileRevalidate",
      options: {
        cacheName: "core-api",
        expiration: { maxEntries: 100, maxAgeSeconds: 60 },
      },
    },
  ],
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Allow the backend API domain for Next.js image optimisation if needed
  images: {
    domains: ["localhost"],
  },
  // Environment variables exposed to the browser
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000",
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "",
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "",
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "",
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "",
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "",
  },
};

export default withPWA(nextConfig);
