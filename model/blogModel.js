// model/blogModel.js
const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true },
    subtitle: { type: String },
    slug: { type: String, trim: true, required: true, unique: true },
    summary: { type: String },
    shortNote: { type: String },
    viewCount: { type: Number, default: 0 },

    coverImage: {
      url: { type: String, trim: true, required: true },
      caption: { type: String },
      altText: { type: String },
      credit: { type: String },
    },
    thumbnailImage: {
      url: { type: String },
      altText: { type: String },
    },

    category: {
      primary: { type: String, trim: true, required: true },
      secondary: [{ type: String }],
    },
    tags: [{ type: String }],

    authors: [
      {
        name: { type: String, trim: true, required: true },
        title: { type: String },
        biography: { type: String },
        avatarImage: { type: String },
        socialMedia: {
          twitter: { type: String },
          linkedin: { type: String },
        },
      },
    ],

    publishedDate: { type: Date, default: Date.now },
    modifiedDate: { type: Date },
    status: {
      type: String,
      trim: true,
      enum: ["draft", "published"],
      default: "draft",
    },
    visibility: {
      type: String,
      trim: true,
      enum: ["public", "private"],
      default: "public",
    },
    layout: { type: String, trim: true, default: "longform" },

    sections: [
      {
        title: { type: String },
        subtitle: { type: String },
        layout: { type: String },
        order: { type: Number },
        contentBlocks: [
          {
            type: {
              type: String,
              trim: true,
              enum: ["text", "image", "list", "quote", "callout"],
              required: true,
            },
            order: { type: Number },
            text: { type: String },
            mediaUrl: { type: String },
            caption: { type: String },
            altText: { type: String },
            listType: { type: String, trim: true, enum: ["bullet", "number"] },
            listItems: [{ type: String }],
            calloutStyle: {
              type: String,
              trim: true,
              enum: ["info", "warning", "error"],
            },
          },
        ],
      },
    ],

    estimatedReadTime: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
