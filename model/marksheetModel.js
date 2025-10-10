// models/marksheetModel.js
const mongoose = require("mongoose");

const MarksheetSchema = new mongoose.Schema(
  {
    dojo: { type: mongoose.Schema.Types.ObjectId, ref: "Dojo", required: true },
    title: { type: String, trim: true, required: true }, // e.g. "Exam Results March 2025"
    category: { type: String }, // "belt exam", etc.
    year: { type: String },
    date: { type: Date, required: true },
    link: { type: String, trim: true, required: true }, // Cloudinary URL (Shubukan/Marksheet)
    publicId: { type: String, trim: true, required: true }, // Cloudinary public_id for deletion/updates
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Marksheet", MarksheetSchema);
