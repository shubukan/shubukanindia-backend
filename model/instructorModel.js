// model/instructorModel.js
const mongoose = require("mongoose");

const instructorSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true, unique: true },
    mobile: { type: String },
    instructorId: { type: String, trim: true, required: true, unique: true },
    otp: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    emailChallenge: {
      id: { type: String, select: false },
      digest: { type: String, select: false },
      issuedAt: { type: Date, select: false },
      expiresAt: { type: Date, select: false },
      attempts: { type: Number, select: false },
    },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Instructor", instructorSchema);
