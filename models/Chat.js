// models/Chat.js
const mongoose = require("mongoose");

const MessageSchema = new mongoose.Schema({
  sender: { type: String, enum: ["user", "ai", "bot"], required: true },
  text:     { type: String, default: "" },
  image:    { type: String, default: null },  // base64 or GridFS file ID
  fileId:   { type: String, default: null },  // GridFS reference for large files
  fileName: { type: String, default: null },
  fileType: { type: String, default: null },
  isVoice:  { type: Boolean, default: false },
  audioUrl: { type: String, default: null },
  timestamp:{ type: Date, default: Date.now },
});

const ChatSchema = new mongoose.Schema(
  {
    userId:   { type: String, required: true, index: true }, // Firebase UID
    chatId:   { type: String, required: true, unique: true },
    title:    { type: String, default: "New Chat" },
    model:    { type: String, default: "default" },
    pinned:   { type: Boolean, default: false },
    isTemp:   { type: Boolean, default: false },
    tempExpiresAt: { type: Date, default: null },
    messages: [MessageSchema],
    firstMessageSent: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Auto-delete expired temp chats
ChatSchema.index({ tempExpiresAt: 1 }, { expireAfterSeconds: 0 });

// Index for fast user chat queries
ChatSchema.index({ userId: 1, updatedAt: -1 });

module.exports = mongoose.model("Chat", ChatSchema);
