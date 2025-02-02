const mongoose = require("mongoose");

const adminSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  refreshToken: { type: String },
  lastActive: { type: Date },
});

module.exports = mongoose.model("Admin", adminSchema);
