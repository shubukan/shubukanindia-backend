const mongoose = require("mongoose");

const gallerySchema = new mongoose.Schema({
  image: {
    type: String,
    trim: true,
    required: true,
  },
  // store the image’s width and height so that in the frontend I can set placeholders with the correct aspect ratio before the image loads.
  width: {
    type: Number,
    required: true,
  },
  height: {
    type: Number,
    required: true,
  },
  title: {
    type: String,
    trim: true,
    required: true,
  },
  description: {
    type: String,
    trim: true,
    required: true,
  },
  year: {
    type: String,
    trim: true,
    required: true,
  },
  category: {
    type: String,
    trim: true,
    required: true,
  },
  tags: {
    type: [String],
    required: true,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
});

module.exports = mongoose.model("Gallery", gallerySchema);
