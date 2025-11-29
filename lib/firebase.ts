// src/lib/firebase.ts

import { initializeApp } from "firebase/app";
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager
} from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyC6xRw4CTIpseEaW0eZ0pSCjdr0oj6yKjg",
  authDomain: "ledger-app-for-boxilla.firebaseapp.com",
  projectId: "ledger-app-for-boxilla",
  storageBucket: "ledger-app-for-boxilla.firebasestorage.app",
  messagingSenderId: "901367867330",
  appId: "1:901367867330:web:87e05d35c268cd6e01185b"
};

const app = initializeApp(firebaseConfig);

// ⭐ Offline Firestore using the NEW, SAFE API
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager() // <-- FIXED (no argument required)
  }),
});

// Auth
export const auth = getAuth(app);
