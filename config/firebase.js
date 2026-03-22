// config/firebase.js — Firebase Admin SDK initialization
const admin = require("firebase-admin");
const path  = require("path");
const fs    = require("fs");

let firebaseApp;

function getFirebaseAdmin() {
  if (firebaseApp) return firebaseApp;

  try {
    let credential;

    // ── Option 1: Environment Variables (Render/Production) ──
    if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY) {
      credential = admin.credential.cert({
        projectId:   process.env.FIREBASE_PROJECT_ID,
        privateKey:  process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      });
      console.log("🔑 Firebase: using Environment Variables");

    // ── Option 2: serviceAccountKey.json file (Local development) ──
    } else {
      const jsonPath = path.join(__dirname, "../firebase-service-account.json");
      if (fs.existsSync(jsonPath)) {
        const serviceAccount = require(jsonPath);
        credential = admin.credential.cert(serviceAccount);
        console.log("🔑 Firebase: using serviceAccountKey.json");
      } else {
        throw new Error(
          "Firebase credentials missing! Set FIREBASE_PROJECT_ID, FIREBASE_PRIVATE_KEY, FIREBASE_CLIENT_EMAIL environment variables."
        );
      }
    }

    firebaseApp = admin.initializeApp({ credential });
    console.log("✅ Firebase Admin initialized successfully");

  } catch (err) {
    console.error("❌ Firebase Admin init failed:", err.message);
    throw err;
  }

  return firebaseApp;
}

module.exports = { getFirebaseAdmin, admin };