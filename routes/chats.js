// routes/chats.js — All chat-related endpoints
const express  = require("express");
const router   = express.Router();
const { v4: uuidv4 } = require("uuid");
const Chat     = require("../models/Chat");
const { verifyToken } = require("../middleware/auth");
const { generateAIResponse, generateChatTitle } = require("../utils/gemini");

// ─────────────────────────────────────────
// All routes require valid Firebase token
// ─────────────────────────────────────────
router.use(verifyToken);

// ── GET /api/chats ─────────────────────────────────────────
// Fetch all chats for the logged-in user (no messages, just metadata)
router.get("/", async (req, res) => {
  try {
    const chats = await Chat.find(
      { userId: req.user.uid },
      { messages: 0 } // exclude messages for speed
    ).sort({ updatedAt: -1 });

    res.json({ success: true, chats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/chats/:chatId ──────────────────────────────────
// Fetch a single chat with all messages
router.get("/:chatId", async (req, res) => {
  try {
    const chat = await Chat.findOne({
      chatId: req.params.chatId,
      userId: req.user.uid,
    });

    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/chats ─────────────────────────────────────────
// Create a new chat
router.post("/", async (req, res) => {
  try {
    const { model = "default", isTemp = false, tempDuration = null } = req.body;

    const chatId = "chat_" + Date.now() + "_" + uuidv4().split("-")[0];

    let tempExpiresAt = null;
    if (isTemp && tempDuration) {
      tempExpiresAt = new Date(Date.now() + tempDuration * 60 * 1000); // minutes → ms
    }

    const chat = await Chat.create({
      userId:        req.user.uid,
      chatId,
      title:         "New Chat",
      model,
      isTemp,
      tempExpiresAt,
    });

    res.status(201).json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/chats/:chatId ────────────────────────────────
// Update chat metadata (title, pinned)
router.patch("/:chatId", async (req, res) => {
  try {
    const allowed = ["title", "pinned"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const chat = await Chat.findOneAndUpdate(
      { chatId: req.params.chatId, userId: req.user.uid },
      updates,
      { new: true }
    );

    if (!chat) return res.status(404).json({ error: "Chat not found" });
    res.json({ success: true, chat });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/chats/:chatId ───────────────────────────────
router.delete("/:chatId", async (req, res) => {
  try {
    const result = await Chat.deleteOne({
      chatId: req.params.chatId,
      userId: req.user.uid,
    });

    if (result.deletedCount === 0)
      return res.status(404).json({ error: "Chat not found" });

    res.json({ success: true, message: "Chat deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/chats ───────────────────────────────────────
// Delete ALL chats for user
router.delete("/", async (req, res) => {
  try {
    await Chat.deleteMany({ userId: req.user.uid });
    res.json({ success: true, message: "All chats deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/chats/:chatId/message ────────────────────────
// Send a message → get AI response (MAIN CHAT ENDPOINT)
router.post("/:chatId/message", async (req, res) => {
  try {
    const { text = "", image = null, fileData = null, model = "default" } = req.body;

    if (!text && !image && !fileData)
      return res.status(400).json({ error: "Message cannot be empty" });

    // Find or create chat
    let chat = await Chat.findOne({
      chatId: req.params.chatId,
      userId: req.user.uid,
    });

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    // Check temp chat expiry
    if (chat.isTemp && chat.tempExpiresAt && new Date() > chat.tempExpiresAt) {
      return res.status(410).json({ error: "Temporary chat has expired" });
    }

    // Add user message
    const userMessage = {
      sender: "user",
      text:   text || "",
      image:  image || null,
      ...(fileData && {
        fileName: fileData.name,
        fileType: fileData.type,
      }),
      timestamp: new Date(),
    };
    chat.messages.push(userMessage);

    // Generate AI response
    const aiText = await generateAIResponse(
      chat.messages.map((m) => ({ sender: m.sender, text: m.text, image: m.image })),
      model,
      fileData
    );

    // Add AI message
    const aiMessage = {
      sender:    "ai",
      text:      aiText,
      timestamp: new Date(),
    };
    chat.messages.push(aiMessage);

    // Auto-generate title from first message
    if (!chat.firstMessageSent || chat.title === "New Chat") {
      chat.title = await generateChatTitle(text || fileData?.name || "File");
      chat.firstMessageSent = true;
    }

    await chat.save();

    res.json({
      success:    true,
      userMessage,
      aiMessage,
      chatTitle:  chat.title,
    });
  } catch (err) {
    console.error("Message error:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ── GET /api/chats/:chatId/messages ────────────────────────
// Get paginated messages
router.get("/:chatId/messages", async (req, res) => {
  try {
    const page  = parseInt(req.query.page)  || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip  = (page - 1) * limit;

    const chat = await Chat.findOne(
      { chatId: req.params.chatId, userId: req.user.uid },
      { messages: { $slice: [skip, limit] }, title: 1, model: 1 }
    );

    if (!chat) return res.status(404).json({ error: "Chat not found" });

    res.json({
      success:  true,
      messages: chat.messages,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── POST /api/chats/sync ────────────────────────────────────
// Bulk sync chats from localStorage to MongoDB (migration endpoint)
router.post("/sync", async (req, res) => {
  try {
    const { chats: localChats } = req.body;
    if (!localChats || typeof localChats !== "object")
      return res.status(400).json({ error: "Invalid chats data" });

    let created = 0;
    let skipped = 0;

    for (const [chatId, chatData] of Object.entries(localChats)) {
      const exists = await Chat.findOne({ chatId, userId: req.user.uid });
      if (exists) { skipped++; continue; }

      await Chat.create({
        userId:           req.user.uid,
        chatId,
        title:            chatData.title  || "New Chat",
        model:            chatData.model  || "default",
        pinned:           chatData.pinned || false,
        isTemp:           chatData.isTemp || false,
        messages:         (chatData.messages || []).map((m) => ({
          sender:    m.sender,
          text:      m.text      || "",
          image:     m.image     || null,
          isVoice:   m.isVoice   || false,
          audioUrl:  m.audioUrl  || null,
          timestamp: m.timestamp ? new Date(m.timestamp) : new Date(),
        })),
        firstMessageSent: chatData.firstMessageSent || false,
      });
      created++;
    }

    res.json({ success: true, created, skipped });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
