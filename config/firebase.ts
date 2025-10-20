import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// MANUAL INTERVENTION: Replace these values with your Firebase project configuration
// You can find these in your Firebase Console:
// 1. Go to Project Settings > General
// 2. Scroll down to "Your apps" section
// 3. Click on the web app or create a new web app
// 4. Copy the firebaseConfig object
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
  projectId: "YOUR_PROJECT_ID",
  storageBucket: "YOUR_PROJECT_ID.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
