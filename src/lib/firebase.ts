import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Firebase extraída de firebase-applet-config.json
const firebaseConfig = {
  projectId: "gen-lang-client-0446465115",
  appId: "1:229641689908:web:0daf69d374870c35c72361",
  apiKey: "AIzaSyDPukOwlIZ038_pnOeWFycFBkKpFgY7ytA",
  authDomain: "gen-lang-client-0446465115.firebaseapp.com",
  storageBucket: "gen-lang-client-0446465115.firebasestorage.app",
  messagingSenderId: "229641689908",
  measurementId: ""
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app, "ai-studio-instaboostsocial-3865dd3c-f509-4380-ba3b-5c4b07dc2ffc");
