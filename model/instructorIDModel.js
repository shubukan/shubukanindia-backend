// model/instructorIDModel.js
const mongoose = require("mongoose");

const instructorIDSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String }, // get at signup
    mobile: { type: String }, // get at signup
    identity: { type: String, required: true },
    instructorId: { type: String, required: true, unique: true },
    claimed: { type: Boolean, default: false },
    isVerified: { type: Boolean, default: false },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InstructorID", instructorIDSchema);
