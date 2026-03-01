import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Your web app's Firebase configuration
// Since this is just a frontend connecting to the backend via webhook and reading DB,
// we just need the project ID for Firestore in a standard local setup.
// In a real deployed app, you'd use your actual Firebase config object here.
const firebaseConfig = {
  projectId: "imobiliaria-ai-joaopessoa",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
