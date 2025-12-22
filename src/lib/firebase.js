// src/lib/firebase.js
import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, initializeFirestore } from "firebase/firestore";

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

// Initialize Firebase App (only once)
let app;
if (!getApps().length) {
  app = initializeApp(firebaseConfig);

  // Initialize Firestore with long polling BEFORE any other Firestore operations
  // This is critical for Vercel/serverless environments
  initializeFirestore(app, {
    experimentalForceLongPolling: true,
  });

  console.log("Firestore initialized with long polling for Vercel");
} else {
  app = getApp();
}

// Initialize Auth
const auth = getAuth(app);

// Get Firestore instance (already configured with long polling above)
const db = getFirestore(app);

const googleProvider = new GoogleAuthProvider();

export { app, auth, db, googleProvider };
