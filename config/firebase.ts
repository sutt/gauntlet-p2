import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

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

// Connect to Firebase Emulators in development mode
// Set EXPO_PUBLIC_USE_EMULATOR=true in .env.local to enable
if (__DEV__ && process.env.EXPO_PUBLIC_USE_EMULATOR === 'true') {
  const authHost = process.env.EXPO_PUBLIC_AUTH_EMULATOR_HOST || 'localhost';
  const authPort = process.env.EXPO_PUBLIC_AUTH_EMULATOR_PORT || '9099';
  const firestoreHost = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_HOST || 'localhost';
  const firestorePort = process.env.EXPO_PUBLIC_FIRESTORE_EMULATOR_PORT || '8080';

  // Note: Use 10.0.2.2 instead of localhost when running on Android emulator
  connectAuthEmulator(auth, `http://${authHost}:${authPort}`, { disableWarnings: true });
  connectFirestoreEmulator(db, firestoreHost, parseInt(firestorePort));

  console.log('🔧 Connected to Firebase Emulators:');
  console.log(`  - Auth: ${authHost}:${authPort}`);
  console.log(`  - Firestore: ${firestoreHost}:${firestorePort}`);
  console.log('  - UI: http://localhost:4000');
}
