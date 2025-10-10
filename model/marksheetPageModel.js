const mongoose = require("mongoose");

const marksheetPageSchema = new mongoose.Schema({
  title: {
    type: String,
    trim: true,
  },
  description: {
    type: String,
    trim: true,
  },
  dojoList: [{ dojoName: String, years: [String] }],
});

module.exports = mongoose.model("MarksheetPage", marksheetPageSchema);
