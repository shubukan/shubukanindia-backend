// models/dojoModel.js
const mongoose = require("mongoose");

const InstructorSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    photo: { type: String }, // Cloudinary URL (Shubukan/Dojo)
  },
  { _id: true }
);

const BranchSchema = new mongoose.Schema(
  {
    mainLocation: { type: String, required: true },
    brunchAddress: [{ type: String, required: true }], // keeping your "brunch" key for compatibility
  },
  { _id: true }
);

const ContactSchema = new mongoose.Schema(
  {
    label: { type: String, required: true }, // e.g. "Phone", "Email", "Address"
    value: { type: String, required: true },
  },
  { _id: true }
);

const DojoSchema = new mongoose.Schema(
  {
    dojoName: { type: String, required: true, trim: true },
    dojoType: { type: String, default: "Branch Dojo" },
    // Store a bcrypt hash, not the raw password:
    passwordHash: { type: String, required: true },
    // Optional dojo images (if you want a general image gallery for a dojo)
    image: [{ type: String }], // Cloudinary URLs (Shubukan/Dojo)
    instructors: [InstructorSchema],
    contact: [[ContactSchema]], // compatible with your nested array use
    brunch: [[BranchSchema]],   // matches your provided shape
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dojo", DojoSchema);
