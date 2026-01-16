// models/dojoModel.js
const mongoose = require("mongoose");

const { Schema } = mongoose;

/**
 * Contact pair - replaces [["Phone","123"], ["xyz","abcd"]] with objects:
 * { label: "Phone", value: "123" }
 */
const contactPairSchema = new Schema(
  {
    label: { type: String, trim: true, default: "" },
    value: { type: String, trim: true, default: "" },
  },
  { _id: false }
);

/**
 * Gallery item
 */
const galleryItemSchema = new Schema(
  {
    url: { type: String, trim: true },
    alt: { type: String, default: "dojo image", trim: true },
  },
  { _id: false }
);

/**
 * Single location entry (used for mainDojo and subDojo arrays)
 */
const dojoDetail = new Schema(
  {
    dojoName: { type: String, trim: true, default: "" },
    instructor: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },
    contact: { type: [contactPairSchema], default: [] },
    landmark: { type: String, trim: true, default: "" },
    // location can be flexible: [addressLine, city, postalCode] or [lat, lng] depending on your usage
    location: { type: [String], default: [] },
  },
  { _id: false }
);

/**
 * Dojo location container - groups main and sub dojos
 */
const dojoLocationSchema = new Schema(
  {
    mainDojo: { type: [dojoDetail], default: [] },
    subDojo: { type: [dojoDetail], default: [] },
  },
  { _id: false }
);

/**
 * Root Dojo schema
 */
const dojoSchema = new Schema(
  {
    index: { type: Number, required: true, unique: true },
    dojoType: { type: String, trim: true, default: "" },
    dojoName: { type: String, trim: true, default: "" },
    instructor: { type: String, trim: true, default: "" },
    profileImage: { type: String, trim: true, default: "" },

    // contacts at root level (label/value pairs)
    contact: { type: [contactPairSchema], default: [] },

    landmark: { type: String, trim: true, default: "" },
    location: { type: [String], default: [] },

    // gallery of dojo-level images
    dojoGallery: { type: [galleryItemSchema], default: [] },

    // nested location structure
    dojoLocation: { type: dojoLocationSchema, default: () => ({}) },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Dojo", dojoSchema);
