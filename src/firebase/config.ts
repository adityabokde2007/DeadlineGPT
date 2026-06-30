import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getAnalytics, isSupported, Analytics } from "firebase/analytics";

// Fallback configuration if env variables are empty during initialization
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyC3rtImiJQcA6AWOCK9vx9t0uF4mWmgO2g",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "deadline-gpt.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "deadline-gpt",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "deadline-gpt.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "932927162254",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:932927162254:web:168c6b3d8d5defe8bc06df",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
const auth = getAuth(app);
const database = getFirestore(app);

let analytics: Analytics | null = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch((error) => {
  console.warn("Analytics not supported in this environment:", error);
});

export { app, auth, database, analytics };
