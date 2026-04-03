import { NextResponse } from "next/server"

/**
 * Serves the Firebase background-messaging service worker at /firebase-messaging-sw.js
 * with Firebase config injected from server-side environment variables.
 *
 * Service workers are static files and cannot read process.env at runtime,
 * so this route handler injects the config at request time — keeping credentials
 * out of the git repository.
 */
export async function GET() {
  const config = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY ?? "",
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ?? "",
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ?? "",
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID ?? "",
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID ?? "",
    measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID ?? "",
  }

  const js = `
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-app-compat.js")
importScripts("https://www.gstatic.com/firebasejs/12.11.0/firebase-messaging-compat.js")

firebase.initializeApp(${JSON.stringify(config)})

const messaging = firebase.messaging()

messaging.onBackgroundMessage((payload) => {
  const notification = payload.notification || {}
  const title = notification.title || "Smart Waste Alert"
  const options = {
    body: notification.body || "You have a new update.",
    icon: "/placeholder-logo.png",
    data: payload.data || {},
  }
  self.registration.showNotification(title, options)
})

self.addEventListener("notificationclick", (event) => {
  event.notification.close()
  const targetUrl = event.notification.data?.url || "/"
  event.waitUntil(clients.openWindow(targetUrl))
})
`

  return new NextResponse(js, {
    headers: {
      "Content-Type": "application/javascript",
      "Service-Worker-Allowed": "/",
    },
  })
}
