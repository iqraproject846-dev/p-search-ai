// routes/library.js — File library endpoints
const express     = require("express");
const router      = express.Router();
const multer      = require("multer");
const LibraryFile = require("../models/LibraryFile");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

// Multer: store in memory (then save base64 to MongoDB for files <5MB)
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: parseInt(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = (process.env.ALLOWED_FILE_TYPES || "").split(",");
    if (!allowed.length || allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error(`File type not allowed: ${file.mimetype}`));
    }
  },
});

// ── GET /api/library ──────────────────────────────────────
// Get all library files for user (optionally filtered by model)
router.get("/", async (req, res) => {
  try {
    const filter = { userId: req.user.uid };
    if (req.query.model) filter.model = req.query.model;

    const files = await LibraryFile.find(filter, { data: 0 }) // exclude base64 for listing
      .sort({ uploadedAt: -1 });

    // Group by chatId (same as frontend structure)
    const grouped = {};
    files.forEach((f) => {
      if (!grouped[f.chatId]) {
        grouped[f.chatId] = { chatId: f.chatId, chatTitle: f.chatTitle, files: [] };
      }
      grouped[f.chatId].files.push({
        id:         f.fileId,
        name:       f.name,
        type:       f.type,
        size:       f.size,
        uploadedAt: f.uploadedAt,
        _id:        f._id,
      });
    });

    res.json({ success: true, library: grouped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/library/file/:fileId ─────────────────────────
// Get full file data (base64) for a specific file
router.get("/file/:fileId", async (req, res) => {
  try {
    const file = await LibraryFile.findOne({
      fileId: req.params.fileId,
      userId: req.user.uid,
    });

    if (!file) return res.status(404).json({ error: "File not found" });

    res.json({
      success: true,
      file: {
        id:         file.fileId,
        name:       file.name,
        type:       file.type,
        size:       file.size,
        data:       file.data,
        uploadedAt: file.uploadedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/library/upload ──────────────────────────────
// Upload a file to library (multipart form)
router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: "No file provided" });

    const { chatId, chatTitle = "Unknown Chat", model = "default" } = req.body;
    if (!chatId) return res.status(400).json({ error: "chatId is required" });

    // Convert buffer to base64 data URL
    const base64 = req.file.buffer.toString("base64");
    const dataUrl = `data:${req.file.mimetype};base64,${base64}`;

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const libraryFile = await LibraryFile.create({
      userId:     req.user.uid,
      chatId,
      chatTitle,
      model,
      fileId,
      name:       req.file.originalname,
      type:       req.file.mimetype,
      size:       req.file.size,
      data:       dataUrl,
      uploadedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      file: {
        id:         libraryFile.fileId,
        name:       libraryFile.name,
        type:       libraryFile.type,
        size:       libraryFile.size,
        uploadedAt: libraryFile.uploadedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/library/upload-base64 ──────────────────────
// Upload file as base64 string (from frontend FileReader)
router.post("/upload-base64", async (req, res) => {
  try {
    const { fileData, chatId, chatTitle = "Unknown Chat", model = "default" } = req.body;
    if (!fileData || !chatId)
      return res.status(400).json({ error: "fileData and chatId required" });

    const { name, type, size, data } = fileData;
    if (!name || !type || !data)
      return res.status(400).json({ error: "Invalid fileData: name, type, data required" });

    // Size check
    const maxBytes = parseInt(process.env.MAX_FILE_SIZE_MB || 10) * 1024 * 1024;
    if (size > maxBytes)
      return res.status(413).json({ error: `File too large. Max ${process.env.MAX_FILE_SIZE_MB}MB` });

    const fileId = `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const libraryFile = await LibraryFile.create({
      userId: req.user.uid,
      chatId,
      chatTitle,
      model,
      fileId,
      name,
      type,
      size:       size || 0,
      data,
      uploadedAt: new Date(),
    });

    res.status(201).json({
      success: true,
      file: {
        id:         libraryFile.fileId,
        name:       libraryFile.name,
        type:       libraryFile.type,
        size:       libraryFile.size,
        uploadedAt: libraryFile.uploadedAt,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/library/file/:fileId ─────────────────────
router.delete("/file/:fileId", async (req, res) => {
  try {
    const result = await LibraryFile.deleteOne({
      fileId: req.params.fileId,
      userId: req.user.uid,
    });

    if (result.deletedCount === 0)
      return res.status(404).json({ error: "File not found" });

    res.json({ success: true, message: "File deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/library/chat/:chatId ─────────────────────
// Delete all files in a chat folder
router.delete("/chat/:chatId", async (req, res) => {
  try {
    const result = await LibraryFile.deleteMany({
      chatId: req.params.chatId,
      userId: req.user.uid,
    });

    res.json({ success: true, deleted: result.deletedCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/library/sync ────────────────────────────────
// Bulk sync library from localStorage (migration)
router.post("/sync", async (req, res) => {
  try {
    const { library: localLibrary, model = "default" } = req.body;
    if (!localLibrary) return res.status(400).json({ error: "No library data" });

    let created = 0, skipped = 0;

    for (const [chatId, chatData] of Object.entries(localLibrary)) {
      for (const file of chatData.files || []) {
        const exists = await LibraryFile.findOne({ fileId: file.id, userId: req.user.uid });
        if (exists) { skipped++; continue; }

        await LibraryFile.create({
          userId:     req.user.uid,
          chatId,
          chatTitle:  chatData.chatTitle || "Unknown Chat",
          model,
          fileId:     file.id,
          name:       file.name,
          type:       file.type,
          size:       file.size || 0,
          data:       file.data || null,
          uploadedAt: file.uploadedAt ? new Date(file.uploadedAt) : new Date(),
        });
        created++;
      }
    }

    res.json({ success: true, created, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
