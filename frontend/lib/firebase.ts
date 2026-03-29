/**
 * lib/firebase.ts — Firebase client SDK.
 *
 * ROOT CAUSE FIX: Firebase was initialized at module level:
 *
 *   const app = initializeApp(firebaseConfig)   // executed on server → crash
 *   export const auth = getAuth(app)            // executed on server → crash
 *
 * layout.tsx is a Server Component. Even though AuthProvider has 'use client',
 * Next.js statically resolves the full import chain at build time:
 *   layout.tsx → AuthProvider → auth-context.tsx → firebase.ts → firebase/auth
 *
 * firebase/auth uses browser-only APIs (IndexedDB, window, navigator).
 * When those module-level statements execute during SSR, Node.js throws
 * because those globals don't exist on the server.
 *
 * FIX: All Firebase initialization is moved into lazy getter functions.
 * Nothing executes at module level — only type imports and plain config.
 * The getters are only ever called from 'use client' code at runtime in
 * the browser, never during server-side rendering.
 */

import type { FirebaseApp } from "firebase/app";
import type { Auth, User, UserCredential } from "firebase/auth";

// Plain config object — no SDK calls, safe to evaluate anywhere
const firebaseConfig = {
  apiKey:"AIzaSyC9n8Xo2l3mLh0s1aZt7vVqjHkKJz5Xo",
  authDomain:"sgm-project-fc254.firebaseapp.com",
  projectId:"sgm-project-fc254",
  storageBucket:"sgm-project-fc254.firebasestorage.app",
  messagingSenderId:"589768864478",
  appId:"1:589768864478:web:b8293c62152d91d89f084f",
  measurementId:"G-5YWNJWRTKD",
};
// ─── Lazy singletons (browser-only, never called during SSR) ─────────────────

let _app: FirebaseApp | null = null;
let _auth: Auth | null = null;

function getApp(): FirebaseApp {
  if (_app) return _app;
  // require() keeps this out of the static import graph the server analyzes
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { initializeApp, getApps } = require("firebase/app");
  _app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
  return _app!;
}

export function getFirebaseAuth(): Auth {
  if (_auth) return _auth;
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { getAuth } = require("firebase/auth");
  _auth = getAuth(getApp());
  return _auth!;
}

// ─── Auth helpers (all use dynamic import — zero server-side execution) ───────

export async function signInWithGoogle(): Promise<UserCredential> {
  const { GoogleAuthProvider, signInWithPopup } = await import("firebase/auth");
  const provider = new GoogleAuthProvider();
  provider.addScope("email");
  provider.addScope("profile");
  return signInWithPopup(getFirebaseAuth(), provider);
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const { signInWithEmailAndPassword } = await import("firebase/auth");
  return signInWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  const { createUserWithEmailAndPassword } = await import("firebase/auth");
  return createUserWithEmailAndPassword(getFirebaseAuth(), email, password);
}

export async function firebaseSignOut(): Promise<void> {
  const { signOut } = await import("firebase/auth");
  return signOut(getFirebaseAuth());
}

export async function getFirebaseIdToken(
  user: User,
  forceRefresh = true
): Promise<string> {
  return user.getIdToken(forceRefresh);
}

/**
 * Subscribes to Firebase auth state changes.
 * Uses require() deliberately — this function is only called inside useEffect
 * in auth-context.tsx (browser only), but we keep require() here so the
 * static import analyzer never pulls firebase/auth into the server bundle.
 */
export function onAuthStateChanged(
  callback: (user: User | null) => void
): () => void {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { onAuthStateChanged: _listen } = require("firebase/auth");
  return _listen(getFirebaseAuth(), callback);
}

export type { User };