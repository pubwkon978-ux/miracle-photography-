// firebase-config.js - Firebase Initialization
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyBtQQlgLvDtgzqBe4SN2W-Dw5XiUeDBNTA",
  authDomain: "miracle-9c471.firebaseapp.com",
  projectId: "miracle-9c471",
  storageBucket: "miracle-9c471.firebasestorage.app",
  messagingSenderId: "161447950350",
  appId: "1:161447950350:web:5e2a4e24543ad93e86645f",
  measurementId: "G-X4WBSXD91W"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

export { db, auth, googleProvider };