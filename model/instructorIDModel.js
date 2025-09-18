const mongoose = require("mongoose");

const instructorIDSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, unique: true },
    email: { type: String },
    mobile: { type: String },
    instructorId: { type: String, required: true, unique: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("InstructorID", instructorIDSchema);
