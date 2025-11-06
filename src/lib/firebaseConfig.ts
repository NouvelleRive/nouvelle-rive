// src/lib/firebaseConfig.ts
import { initializeApp, getApps } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCHAQITC3n40WDQXLN4OAflmlE5lNG42SM",
  authDomain: "nouvelle-rive.firebaseapp.com",
  projectId: "nouvelle-rive",
  storageBucket: "nouvelle-rive.appspot.com",
  messagingSenderId: "367296973767",
  appId: "1:367296973767:web:c2d7d052bf4e15db0e67e2"
};

// Vérifie que l'app n'est pas déjà initialisée
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

const db = getFirestore(app);
const auth = getAuth(app);

export { app, db, auth };
