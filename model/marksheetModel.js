const mongoose = require("mongoose");

const marksheetSchema = new mongoose.Schema({
  dojoName: {
    type: String,
    required: true,
  },
  password: {
    type: String,
    required: true,
  },
  marksheet: [
    {
      year: { type: String, required: true },
      link: { type: String, required: true },
    },
  ],
});

module.exports = mongoose.model("Marksheet", marksheetSchema);
