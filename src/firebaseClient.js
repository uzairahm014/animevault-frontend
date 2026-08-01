// src/firebaseClient.js
// Frontend Firebase setup — this is what lets users sign up/log in from the browser.
// Get these values: Firebase Console → Project Settings → General → scroll to
// "Your apps" → Add app → Web (</>) → copy the config object it gives you.

import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(firebaseApp);

export async function signUp(email, password) {
  const cred = await createUserWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function logIn(email, password) {
  const cred = await signInWithEmailAndPassword(firebaseAuth, email, password);
  return cred.user;
}

export async function logOut() {
  await signOut(firebaseAuth);
}

// Returns the current user's ID token (or null if logged out).
// Every authenticated request to the backend needs this token.
export async function getIdToken() {
  const user = firebaseAuth.currentUser;
  if (!user) return null;
  return user.getIdToken();
}

// Fires a callback whenever login state changes (login, logout, page refresh)
export function onAuthChange(callback) {
  return onAuthStateChanged(firebaseAuth, callback);
}
