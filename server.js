// server.js — P-Search AI Backend Entry Point
require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const rateLimit  = require("express-rate-limit");
const { connectDB }        = require("./config/database");
const { getFirebaseAdmin } = require("./config/firebase");

// ── Initialize Firebase Admin ──────────────────────────────
getFirebaseAdmin();

// ── Connect MongoDB ────────────────────────────────────────
connectDB();

const app = express();

// ── Security Middleware ────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin:      process.env.FRONTEND_URL || "*",
  credentials: true,
  methods:     ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
}));

// ── Request Logging ────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ── Body Parsers ───────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));          // large base64 files
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ── Rate Limiting ──────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max:      200,
  message:  { error: "Too many requests, please try again later." },
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max:      20,             // 20 AI calls per minute
  message:  { error: "AI rate limit exceeded. Please wait." },
});

app.use("/api/", generalLimiter);
app.use("/api/ai/", aiLimiter);
app.use("/api/chats/*/message", aiLimiter);

// ── Routes ─────────────────────────────────────────────────
app.use("/api/chats",   require("./routes/chats"));
app.use("/api/library", require("./routes/library"));
app.use("/api/ai",      require("./routes/ai"));
app.use("/api/profile", require("./routes/profile"));

// ── Health Check ───────────────────────────────────────────
app.get("/health", (req, res) => {
  res.json({
    status:    "ok",
    timestamp: new Date().toISOString(),
    env:       process.env.NODE_ENV,
  });
});

// ── 404 Handler ────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.url}` });
});

// ── Global Error Handler ───────────────────────────────────
app.use((err, req, res, next) => {
  console.error("❌ Unhandled error:", err);
  res.status(err.status || 500).json({
    error:   err.message || "Internal server error",
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`\n🚀 P-Search AI Backend running on port ${PORT}`);
  console.log(`📡 Environment: ${process.env.NODE_ENV}`);
  console.log(`🔗 Health check: http://localhost:${PORT}/health\n`);
});
