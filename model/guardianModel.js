// model/guardianModel.js
const mongoose = require("mongoose");

const otpChallengeSchema = new mongoose.Schema(
  {
    id: String,
    digest: String,
    issuedAt: Date,
    expiresAt: Date,
    attempts: Number,
  },
  { _id: false }
);

const guardianSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    email: { type: String, trim: true, required: true, unique: true, lowercase: true },
    password: { type: String, required: true }, // bcrypt hashed
    mobile: { type: String },
    otp: { type: String, select: false },
    otpExpiresAt: { type: Date, select: false },
    otpChallenges: {
      signup: { type: otpChallengeSchema, select: false },
      login: { type: otpChallengeSchema, select: false },
      reset: { type: otpChallengeSchema, select: false },
    },
    isVerified: { type: Boolean, default: false },
    authVersion: { type: Number, default: 0 },
    refreshToken: { type: String },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Guardian", guardianSchema);
