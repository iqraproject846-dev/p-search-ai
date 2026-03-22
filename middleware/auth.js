// middleware/auth.js — Verify Firebase ID Token on every protected route
const { admin } = require("../config/firebase");

async function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization || "";
    if (!authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "No token provided" });
    }

    const idToken = authHeader.split("Bearer ")[1];
    const decoded = await admin.auth().verifyIdToken(idToken, true);

    req.user = {
      uid:   decoded.uid,
      email: decoded.email || "",
      name:  decoded.name  || "",
    };

    next();
  } catch (err) {
    console.error("Auth middleware error:", err.message);
    return res.status(401).json({ error: "Invalid or expired token" });
  }
}

module.exports = { verifyToken };
