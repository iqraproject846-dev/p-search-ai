// routes/ai.js — Direct AI endpoints (generate response, title)
const express  = require("express");
const router   = express.Router();
const { verifyToken } = require("../middleware/auth");
const { generateAIResponse, generateChatTitle } = require("../utils/gemini");

router.use(verifyToken);

// ── POST /api/ai/generate ──────────────────────────────────
// Generate AI response without saving to DB (for voice chat, temp use)
router.post("/generate", async (req, res) => {
  try {
    const { messages, model = "default", fileData = null } = req.body;

    if (!messages || !Array.isArray(messages) || messages.length === 0)
      return res.status(400).json({ error: "messages array is required" });

    const aiText = await generateAIResponse(messages, model, fileData);
    res.json({ success: true, text: aiText });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai/title ─────────────────────────────────────
// Generate a chat title from first message
router.post("/title", async (req, res) => {
  try {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "message is required" });

    const title = await generateChatTitle(message);
    res.json({ success: true, title });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
