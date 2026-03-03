import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyBT4BOy2fdKSgvtpF2dN7ADCDr9hqJcgso",
  authDomain: "imobiliaria-ai-joaopessoa.firebaseapp.com",
  projectId: "imobiliaria-ai-joaopessoa",
  storageBucket: "imobiliaria-ai-joaopessoa.firebasestorage.app",
  messagingSenderId: "261768873267",
  appId: "1:261768873267:web:a3179484dad2ccd0282a46",
  measurementId: "G-9TDX9SYJ20"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
