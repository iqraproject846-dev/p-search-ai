// routes/profile.js — User profile CRUD
const express     = require("express");
const router      = express.Router();
const UserProfile = require("../models/UserProfile");
const { verifyToken } = require("../middleware/auth");

router.use(verifyToken);

// ── GET /api/profile ──────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let profile = await UserProfile.findOne({ uid: req.user.uid });

    if (!profile) {
      // Auto-create on first access
      profile = await UserProfile.create({
        uid:      req.user.uid,
        email:    req.user.email,
        username: req.user.name,
      });
    }

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── PATCH /api/profile ────────────────────────────────────
router.patch("/", async (req, res) => {
  try {
    const allowed = ["username", "phone", "bio", "avatar", "theme", "fontSize"];
    const updates = {};
    allowed.forEach((k) => { if (req.body[k] !== undefined) updates[k] = req.body[k]; });

    const profile = await UserProfile.findOneAndUpdate(
      { uid: req.user.uid },
      updates,
      { new: true, upsert: true }
    );

    res.json({ success: true, profile });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ── DELETE /api/profile ───────────────────────────────────
// Delete account data (called from profile.js deleteAccountBtn)
router.delete("/", async (req, res) => {
  try {
    await UserProfile.deleteOne({ uid: req.user.uid });
    // Chats and library are deleted separately or cascaded here
    const Chat        = require("../models/Chat");
    const LibraryFile = require("../models/LibraryFile");
    await Chat.deleteMany({ userId: req.user.uid });
    await LibraryFile.deleteMany({ userId: req.user.uid });

    res.json({ success: true, message: "Account data deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
