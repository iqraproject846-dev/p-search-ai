// config/firebase.js — Firebase Admin SDK initialization
const admin = require("firebase-admin");

let firebaseApp;

function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  const serviceAccount = require("../firebase-service-account.json");

  try {
    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log("✅ Firebase Admin initialized");
  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
    throw err;
  }

  return firebaseApp;
}

module.exports = { getFirebaseAdmin, admin };
