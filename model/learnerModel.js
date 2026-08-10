// model/learnerModel.js
const mongoose = require("mongoose");

const learnerSchema = new mongoose.Schema(
  {
    guardianId: { type: mongoose.Schema.Types.ObjectId, ref: "Guardian", required: true },
    name: { type: String, trim: true, required: true },

    dojoId: { type: mongoose.Schema.Types.ObjectId, ref: "Dojo", required: true },
    dojoName: { type: String, trim: true, required: true }, // snapshot at creation

    // "instructor" here is the plain-text name shown on the Dojo card (Dojo.instructor /
    // dojoLocation.mainDojo[].instructor / subDojo[].instructor). It is matched by name
    // against InstructorIDModel.name to resolve the stable instructorCode below.
    instructorName: { type: String, trim: true, required: true }, // snapshot at creation
    instructorCode: { type: String, trim: true, default: null }, // InstructorIDModel.instructorId (null if unmatched/unclaimed)

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Learner", learnerSchema);
