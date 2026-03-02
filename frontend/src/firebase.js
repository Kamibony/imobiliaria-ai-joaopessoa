import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';

// Your web app's Firebase configuration
// Since this is just a frontend connecting to the backend via webhook and reading DB,
// we just need the project ID for Firestore in a standard local setup.
// In a real deployed app, you'd use your actual Firebase config object here.
// Note: For Authentication to fully work, apiKey and other config params are required.
const firebaseConfig = {
  projectId: "imobiliaria-ai-joaopessoa",
  apiKey: "dummy-api-key-for-auth", // Usually required for Firebase Auth initialization
  authDomain: "imobiliaria-ai-joaopessoa.firebaseapp.com"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };
