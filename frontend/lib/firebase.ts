/**
 * lib/firebase.ts
 *
 * Firebase client SDK — configured from your .env.local values.
 * All NEXT_PUBLIC_ vars are safe in the browser bundle.
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
    apiKey: "AIzaSyB58m0qujzRKLmoLUupV31urPbc0rMCHX8",
    authDomain: "sgm-project-fc254.firebaseapp.com",
  projectId: "sgm-project-fc254",
  storageBucket: "sgm-project-fc254.firebasestorage.app",
  messagingSenderId: "589768864478",
  appId: "1:589768864478:web:b8293c62152d91d89f084f",
  measurementId: "G-5YWNJWRTKD"// optional
};
console.log("API KEY:", firebaseConfig.apiKey);
// Prevent duplicate initialisation during Next.js hot-reload
const app: FirebaseApp =
    getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth: Auth = getAuth(app);

// Google provider — request email and profile scopes
export const googleProvider = new GoogleAuthProvider();
googleProvider.addScope("email");
googleProvider.addScope("profile");

// ─── Auth helpers ─────────────────────────────────────────────────────────────

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

/**
 * Get a fresh Firebase ID token.
 * This is what you POST to /auth/firebase to get your backend JWT.
 * forceRefresh=true ensures it's never stale (tokens expire after 1 hour).
 */
export async function getFirebaseIdToken(
    user: User,
    forceRefresh = true
): Promise<string> {
    return user.getIdToken(forceRefresh);
}

export { onAuthStateChanged };
export type { User };