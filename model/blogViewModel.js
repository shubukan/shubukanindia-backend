// model/blogViewModel.js
const mongoose = require("mongoose");

const blogViewSchema = new mongoose.Schema({
  blogId: { type: mongoose.Schema.Types.ObjectId, ref: "Blog", required: true },
  ip: { type: String, required: true },
  viewedAt: { type: Date, default: Date.now, expires: 86400 }, 
  // expires after 24h (1 day)
});

module.exports = mongoose.model("BlogView", blogViewSchema);
