// server.js — P-Search AI Backend Entry Point
require("dotenv").config();

const express    = require("express");
const cors       = require("cors");
const helmet     = require("helmet");
const morgan     = require("morgan");
const rateLimit  = require("express-rate-limit");
const { connectDB }        = require("./config/database");
const { getFirebaseAdmin } = require("./config/firebase");

getFirebaseAdmin();
connectDB();

const app = express();

// ── Security Middleware ────────────────────────────────────
app.use(helmet());

// ── CORS ───────────────────────────────────────────────────
const corsOptions = {
  origin: [
    "http://127.0.0.1:5500",
    "http://localhost:5500",
    "https://p-search-assistant.netlify.app",
    "https://p-search-ai.firebaseapp.com",
    "https://p-search-ai.web.app",
    "https://p-search-assistant1v.netlify.app",
    "https://iqraproject846-dev.github.io/frontent-p-search-ai",
    "https://p-search-aii.netlify.app",
  ],
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.options("*", cors(corsOptions));  // Preflight ke liye

// ── Request Logging ────────────────────────────────────────
if (process.env.NODE_ENV !== "production") {
  app.use(morgan("dev"));
}

// ── Body Parsers ───────────────────────────────────────────
app.use(express.json({ limit: "20mb" }));
app.use(express.urlencoded({ extended: true, limit: "20mb" }));

// ── Rate Limiting ──────────────────────────────────────────
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max:      200,
  message:  { error: "Too many requests, please try again later." },
});

const aiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max:      20,
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