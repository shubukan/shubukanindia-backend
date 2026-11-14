// model/emailAuthModel.js
// Blog reader email verification. Stored in MongoDB (not in memory) because
// Vercel serverless requests can land on different instances - an in-memory
// Map loses the OTP / session between "send", "verify" and "like".
const mongoose = require("mongoose");

// One pending OTP per email. Mongo deletes it automatically after expiresAt.
const emailOtpSchema = new mongoose.Schema({
  email: { type: String, trim: true, lowercase: true, required: true, unique: true },
  otpHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});
emailOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Verified-reader sessions (token is sent as x-email-token).
const emailSessionSchema = new mongoose.Schema({
  email: { type: String, trim: true, lowercase: true, required: true, index: true },
  tokenHash: { type: String, required: true, unique: true },
  expiresAt: { type: Date, required: true },
});
emailSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = {
  EmailOtp: mongoose.model("EmailOtp", emailOtpSchema),
  EmailSession: mongoose.model("EmailSession", emailSessionSchema),
};
