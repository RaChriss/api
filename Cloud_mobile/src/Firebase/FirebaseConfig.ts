// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyAyyX8ZDCV6nBooeksTO54xvEFDboQzfQw",
  authDomain: "mapmobile-31594.firebaseapp.com",
  projectId: "mapmobile-31594",
  storageBucket: "mapmobile-31594.firebasestorage.app",
  messagingSenderId: "946065503210",
  appId: "1:946065503210:web:758b649a870b5d4d99b893",
  measurementId: "G-GQX72B4NVN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app)
const db = getFirestore(app)
export {app, analytics, auth, db};
