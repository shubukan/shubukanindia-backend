// models/dojoModel.js
const mongoose = require("mongoose");

/* --- Contact Schema --- */
const contactSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["Phone", "Email", "Address"],
      required: true,
    },
    value: {
      type: String,
      required: true,
    },
  },
  { _id: false }
);

/* --- Branch Schema --- */
const branchSchema = new mongoose.Schema(
  {
    mainLocation: {
      type: String,
      required: true,
      trim: true,
    },
    branchAddresses: {
      type: [String],
      required: true,
    },
  },
  { _id: false }
);

/* --- Dojo Schema --- */
const dojoSchema = new mongoose.Schema(
  {
    dojoName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },

    dojoType: {
      type: String,
      default: "Branch Dojo",
    },

    instructors: {
      type: [String],
      required: true,
    },

    images: {
      type: [String],
      default: [],
    },

    contacts: {
      type: [contactSchema],
      default: [],
    },

    branches: {
      type: [branchSchema],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = mongoose.model("Dojo", dojoSchema);
