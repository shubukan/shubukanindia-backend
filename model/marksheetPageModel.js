const mongoose = require("mongoose");

const marksheetPageSchema = new mongoose.Schema({
  title: {
    type: String,
  },
  description: {
    type: String,
  },
  dojoList: [{ dojoName: String, years: [String] }],
});

module.exports = mongoose.model("MarksheetPage", marksheetPageSchema);
