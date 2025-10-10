// model/adminModel.js
const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  id: {
    type: String,
    trim: true,
    required: true,
    unique: true,
  },
  password: {
    type: String,
    trim: true,
    required: true,
  },
  refreshToken: { type: String },
  lastActive: { type: Date },
});

module.exports = mongoose.model("Admin", adminSchema);
