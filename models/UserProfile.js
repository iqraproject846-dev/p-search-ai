// models/UserProfile.js
const mongoose = require("mongoose");

const UserProfileSchema = new mongoose.Schema(
  {
    uid:      { type: String, required: true, unique: true }, // Firebase UID
    email:    { type: String, default: "" },
    username: { type: String, default: "" },
    phone:    { type: String, default: "" },
    bio:      { type: String, default: "" },
    avatar:   { type: String, default: null }, // base64 or URL
    theme:    { type: String, default: "dark" },
    fontSize: { type: String, default: "medium" },
  },
  { timestamps: true }
);

module.exports = mongoose.model("UserProfile", UserProfileSchema);
