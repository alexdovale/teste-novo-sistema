// assets/js/firebase-init.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyCrLwXmkxgeVoB8TwRI7pplCVQETGK0zkE",
    authDomain: "pauta-ce162.firebaseapp.com",
    projectId: "pauta-ce162",
    storageBucket: "pauta-ce162.appspot.com",
    messagingSenderId: "87113750208",
    appId: "1:87113750208:web:4abba0024f4d4af699bf25"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, auth, db };
