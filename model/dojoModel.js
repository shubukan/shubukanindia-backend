// models/dojoModel.js
const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, default: "" },
  },
  { _id: false }
);

const locationSchema = new mongoose.Schema(
  {
    instructor: { type: String, trim: true },
    landmark: { type: String, default: "" },
    address: { type: String, default: "" },
  },
  { _id: false }
);

const dojoSchema = new mongoose.Schema(
  {
    index: {
      type: Number,
      required: true,
      unique: true,
    },

    dojoType: {
      type: String,
      enum: ["main", "sub"],
      required: true,
    },

    dojoName: {
      type: String,
      required: true,
      trim: true,
    },

    instructor: {
      type: String,
      trim: true,
    },

    profile: { type: String },

    gallery: {
      type: [gallerySchema],
      default: [],
    },

    contact: {
      type: [[String]], // [["Phone", "123"], ["Email", "abc@x.com"]],
      default: [],
    },

    location: {
      mainLocation: locationSchema,
      otherLocation: {
        type: [locationSchema],
        default: [],
      },
    },

    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dojo", dojoSchema);
