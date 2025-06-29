const mongoose = require("mongoose");

const ContactSchema = new mongoose.Schema({
  type: { type: String, required: true }, // e.g., "Phone", "Email", "Address"
  value: { type: String, required: true },
});

const BrunchSchema = new mongoose.Schema({
  mainLocation: { type: String, required: true },
  brunchAddress: [{ type: String, required: true }],
  // e.g., ["Address 1", "Address 2", ...]
});

const DojoSchema = new mongoose.Schema({
  dojoName: { type: String, required: true },
  dojoType: { type: String }, // Optional field
  instructor: [{ type: String, required: true }],
  // e.g., ["Instructor 1", "Instructor 2", ...]
  image: [{ type: String }],
  contact: [[ContactSchema]],
  // [[{Type1, Value1}, {Type2, Value2}], ...same for other instructors]]
  brunch: [[BrunchSchema]],
  // [[{}, {}], [instructor2]]
  isDeleted: { type: Boolean, default: false },
});

module.exports = mongoose.model("Dojo", DojoSchema);
