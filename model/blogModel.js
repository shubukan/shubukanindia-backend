// model/blogModel.js
const mongoose = require("mongoose");

const blogSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    subtitle: { type: String },
    slug: { type: String, required: true, unique: true },
    summary: { type: String },
    shortNote: { type: String },

    coverImage: {
      url: { type: String, required: true },
      caption: { type: String },
      altText: { type: String },
      credit: { type: String },
    },
    thumbnailImage: {
      url: { type: String },
      altText: { type: String },
    },

    category: {
      primary: { type: String, required: true },
      secondary: [{ type: String }],
    },
    tags: [{ type: String }],

    authors: [
      {
        name: { type: String, required: true },
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
    status: { type: String, enum: ["draft", "published"], default: "draft" },
    visibility: { type: String, enum: ["public", "private"], default: "public" },
    layout: { type: String, default: "longform" },

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
              enum: ["text", "image", "list", "quote", "callout"],
              required: true,
            },
            order: { type: Number },
            text: { type: String },
            mediaUrl: { type: String },
            caption: { type: String },
            altText: { type: String },
            listType: { type: String, enum: ["bullet", "number"] },
            listItems: [{ type: String }],
            calloutStyle: { type: String, enum: ["info", "warning", "error"] },
          },
        ],
      },
    ],

    estimatedReadTime: { type: Number, default: 0 },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Blog", blogSchema);
