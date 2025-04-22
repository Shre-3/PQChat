// src/firebase.js


// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "my firebase api key",
  authDomain: "pqchat-app.firebaseapp.com",
  projectId: "pqchat-app",
  storageBucket: "pqchat-app.firebasestorage.app",
  messagingSenderId: "970955153659",
  appId: "1:970955153659:web:df7af3a7e67357f067d05e"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export { db, auth };