// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

console.log("Firebase Config Debug:", {
  apiKey: firebaseConfig.apiKey ? "Defined" : "Missing",
  authDomain: firebaseConfig.authDomain ? "Defined" : "Missing",
  projectId: firebaseConfig.projectId ? "Defined" : "Missing",
});

// Initialize Firebase App
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize Auth
const auth = getAuth(app);

// Initialize Firestore with settings optimized for Vercel/production
let db;
try {
  if (!getApps().length || !getApps()[0]._firestoreInstance) {
    // Use initializeFirestore with settings for better connection stability
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
      }),
      experimentalForceLongPolling: true, // Fix for Vercel/serverless environments
      experimentalAutoDetectLongPolling: true,
    });
  } else {
    db = getFirestore(app);
  }
} catch (error) {
  // Fallback if initializeFirestore fails (already initialized)
  console.warn("Firestore already initialized, using existing instance");
  db = getFirestore(app);
}

const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
