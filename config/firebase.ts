import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration loaded from environment variables
// Copy .env.example to .env.local and fill in your values
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
  measurementId: process.env.EXPO_PUBLIC_FIREBASE_MEASUREMENT_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Auth
// MANUAL: Make sure to enable an auth provider (e.g. Email/Password) in your Firebase console.
export const auth = getAuth(app);

// Initialize Firestore
// MANUAL: After implementing chat features, deploy Firestore security rules using:
//   firebase deploy --only firestore:rules
// See firestore.rules file in project root and .dev-docs/milestone1-testing.md for details
export const db = getFirestore(app);
