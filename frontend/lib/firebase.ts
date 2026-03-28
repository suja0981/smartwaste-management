/**
 * lib/firebase.ts — Firebase client SDK.
 *
 * FIX: Removed console.log(firebaseConfig.apiKey) which leaked credentials
 *      to the browser console in production.
 */

import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  User,
  UserCredential,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "process.env.NEXT_PUBLIC_FIREBASE_API_KEY",
  authDomain: "process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN",
  projectId: "process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID",
  storageBucket: "process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET",
  messagingSenderId: "process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID",
  appId: "process.env.NEXT_PUBLIC_FIREBASE_APP_ID",
  measurementId: "process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID",
};

// Prevent duplicate initialisation during Next.js hot-reload
const app: FirebaseApp =
  getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth = getAuth(app);

export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

export async function signInWithGoogle(): Promise<UserCredential> {
  return signInWithPopup(auth, googleProvider);
}

export async function signInWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return signInWithEmailAndPassword(auth, email, password);
}

export async function registerWithEmail(
  email: string,
  password: string
): Promise<UserCredential> {
  return createUserWithEmailAndPassword(auth, email, password);
}

export async function firebaseSignOut(): Promise<void> {
  return signOut(auth);
}

export async function getFirebaseIdToken(
  user: User,
  forceRefresh = true
): Promise<string> {
  return user.getIdToken(forceRefresh);
}

export { onAuthStateChanged };
export type { User };