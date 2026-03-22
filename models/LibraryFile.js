// models/LibraryFile.js
const mongoose = require("mongoose");

const LibraryFileSchema = new mongoose.Schema(
  {
    userId:     { type: String, required: true, index: true },
    chatId:     { type: String, required: true },
    chatTitle:  { type: String, default: "Unknown Chat" },
    model:      { type: String, default: "default" },
    fileId:     { type: String, required: true, unique: true }, // "file_" + timestamp
    name:       { type: String, required: true },
    type:       { type: String, required: true }, // MIME type
    size:       { type: Number, required: true },
    data:       { type: String, default: null },  // base64 for small files (<2MB)
    gridfsId:   { type: mongoose.Schema.Types.ObjectId, default: null }, // GridFS for large
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

LibraryFileSchema.index({ userId: 1, chatId: 1 });
LibraryFileSchema.index({ userId: 1, model: 1 });

module.exports = mongoose.model("LibraryFile", LibraryFileSchema);
