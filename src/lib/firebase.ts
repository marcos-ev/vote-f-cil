import { initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, setPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCUXnXh2lES2JCe61KQy_tt3tgDUMm47hA",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "pokerplanning-6a78d.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "pokerplanning-6a78d",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "pokerplanning-6a78d.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "123183344744",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:123183344744:web:8e4ce260ce6fd7c2915fdd",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-KLLHJGLPE9",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);
export const firebaseDb = getFirestore(firebaseApp);

void setPersistence(firebaseAuth, browserLocalPersistence).catch(() => {
  // Evita quebrar o app em navegadores com restrições de storage.
});
