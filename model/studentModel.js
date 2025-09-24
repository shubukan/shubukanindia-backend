// model/studentModel.js
const mongoose = require("mongoose");

const studentSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    mobile: { type: String },
    presentKyu: { type: String },
    lastCertificateNum: { type: String },
    instructorName: { type: String },
    instructorId: { type: String },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("student", studentSchema);
