// model/blogViewModel.js
const mongoose = require("mongoose");

const blogViewSchema = new mongoose.Schema({
  blogId: { type: mongoose.Schema.Types.ObjectId, ref: "Blog", required: true },
  ip: { type: String, trim: true, required: true },
  userAgent: { type: String, trim: true, required: true }, // 👈 add user-agent
  viewedAt: { type: Date, default: Date.now, expires: 86400 },
  // expires after 24h (1 day)
});

// Optional: avoid duplicate entries (unique per blogId + ip + userAgent)
blogViewSchema.index({ blogId: 1, ip: 1, userAgent: 1 }, { unique: true });

module.exports = mongoose.model("BlogView", blogViewSchema);
