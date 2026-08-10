// model/kataUploadModel.js
const mongoose = require("mongoose");

const kataUploadSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      required: true,
    },
    imageUrl: { type: String, required: true },
    publicId: { type: String }, // optional cloudinary public_id if you store it
    caption: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("KataUpload", kataUploadSchema);