"use client"
/**
 * lib/firebase.ts
 *
 * Firebase client-side helpers.
 *
 * BUG-18 fix: replaced require() calls with static ES module imports.
 *   require() is a CommonJS pattern that bypassed bundler tree-shaking and
 *   mixed module systems. Static imports are the correct Next.js pattern.
 *   The "use client" directive ensures this module is only bundled for the
 *   browser (it was always only used from "use client" components).
 *
 * BUG-12 fix: exported PUSH_TOKEN_STORAGE_KEY so auth-store.ts can import
 *   the constant instead of duplicating a magic string.
 */

import { getApps, initializeApp, type FirebaseApp } from "firebase/app"
import {
  getAuth,
  onAuthStateChanged as _onAuthStateChanged,
  type Auth,
  type User,
  type UserCredential,
} from "firebase/auth"

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
}

/** Exported so auth-store.ts can reference the same key without duplication. */
export const PUSH_TOKEN_STORAGE_KEY = "swm_push_token"

let appSingleton: FirebaseApp | null = null
let authSingleton: Auth | null = null

function getFirebaseApp(): FirebaseApp {
  if (appSingleton) return appSingleton
  appSingleton = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0]
  return appSingleton as FirebaseApp
}

export function getFirebaseAuth(): Auth {
  if (authSingleton) return authSingleton
  authSingleton = getAuth(getFirebaseApp())
  return authSingleton as Auth
}

export async function signInWithGoogle(): Promise<UserCredential> {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth")
  const provider = new GoogleAuthProvider()
  provider.addScope("email")
  provider.addScope("profile")
  return signInWithPopup(getFirebaseAuth(), provider)
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const { signInWithEmailAndPassword } = await import("firebase/auth")
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const { createUserWithEmailAndPassword } = await import("firebase/auth")
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password)
}

export async function firebaseSignOut(): Promise<void> {
  const { signOut } = await import("firebase/auth")
  return signOut(getFirebaseAuth())
}

export async function getFirebaseIdToken(user: User, forceRefresh = true): Promise<string> {
  return user.getIdToken(forceRefresh)
}

export async function updateFirebaseProfile(user: User, displayName: string): Promise<void> {
  const { updateProfile } = await import("firebase/auth")
  return updateProfile(user, { displayName })
}

export function onAuthStateChanged(callback: (user: User | null) => void): () => void {
  return _onAuthStateChanged(getFirebaseAuth(), callback)
}

export async function isPushMessagingSupported(): Promise<boolean> {
  if (
    typeof window === "undefined" ||
    !("Notification" in window) ||
    !("serviceWorker" in navigator)
  ) {
    return false
  }

  const { isSupported } = await import("firebase/messaging")
  return isSupported()
}

export function getStoredPushToken(): string | null {
  if (typeof window === "undefined") return null
  return localStorage.getItem(PUSH_TOKEN_STORAGE_KEY)
}

export function clearStoredPushToken(): void {
  if (typeof window === "undefined") return
  localStorage.removeItem(PUSH_TOKEN_STORAGE_KEY)
}

async function getMessagingRegistration() {
  return navigator.serviceWorker.register("/firebase-messaging-sw.js")
}

export async function requestPushPermission(): Promise<NotificationPermission> {
  if (!(await isPushMessagingSupported())) {
    throw new Error("This browser does not support push notifications.")
  }

  if (Notification.permission === "granted") return "granted"
  return Notification.requestPermission()
}

export async function registerBrowserPushNotifications(): Promise<string> {
  if (!(await isPushMessagingSupported())) {
    throw new Error("This browser does not support push notifications.")
  }

  const permission = await requestPushPermission()
  if (permission !== "granted") {
    throw new Error("Notification permission was denied.")
  }

  const vapidKey = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY
  if (!vapidKey) {
    throw new Error("NEXT_PUBLIC_FIREBASE_VAPID_KEY is not configured.")
  }

  const { getMessaging, getToken } = await import("firebase/messaging")
  const messaging = getMessaging(getFirebaseApp())
  const serviceWorkerRegistration = await getMessagingRegistration()
  const token = await getToken(messaging, {
    vapidKey,
    serviceWorkerRegistration,
  })

  if (!token) {
    throw new Error("Firebase did not return a push token.")
  }

  if (typeof window !== "undefined") {
    localStorage.setItem(PUSH_TOKEN_STORAGE_KEY, token)
  }

  return token
}

export async function clearBrowserPushNotifications(): Promise<string | null> {
  const existingToken = getStoredPushToken()
  if (!(await isPushMessagingSupported())) {
    clearStoredPushToken()
    return existingToken
  }

  try {
    const { deleteToken, getMessaging } = await import("firebase/messaging")
    const messaging = getMessaging(getFirebaseApp())
    await deleteToken(messaging)
  } catch {
    // Best effort: server-side unregistration still clears the backend mapping.
  }

  clearStoredPushToken()
  return existingToken
}

export type { User }
