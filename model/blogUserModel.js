// model/blogUserModel.js
const mongoose = require("mongoose");

const blogUserSchema = new mongoose.Schema(
  {
    slug: { type: String, required: true, index: true }, // relation to Blog.slug

    likeCount: { type: Number, default: 0 },
    dislikeCount: { type: Number, default: 0 },

    likes: [{ type: String }], // store email or userId
    dislikes: [{ type: String }], // store email or userId

    comments: [
      {
        user: { type: String }, // email or userId
        name: { type: String },
        avatar: { type: String },
        text: { type: String, required: true },
        createdAt: { type: Date, default: Date.now },
        replies: [
          {
            user: { type: String },
            name: { type: String },
            avatar: { type: String },
            text: { type: String, required: true },
            createdAt: { type: Date, default: Date.now },
          },
        ],
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("BlogUser", blogUserSchema);
