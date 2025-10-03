// model/questionModel.js
const mongoose = require("mongoose");
const questionSchema = new mongoose.Schema(
  {
    questionID: { type: Number, unique: true, index: true }, // sequential ID
    question: { type: String, required: true },
    options: [{ type: String, required: true }],
    answer: { type: Number, required: true }, // index of correct option
    questionSet: { type: Number, default: 1 },
    isDeleted: { type: Boolean, default: false },

    // New fields:
    used: { type: Boolean, default: false }, // true if used by any non-deleted exam
    usedInExams: [
      {
        exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam" }, // exam _id
        examID: { type: String }, // 6-char examID
        examSet: { type: Number },
        accessability: { type: String },
        examDate: { type: Date },
        addedAt: { type: Date, default: Date.now },
      },
    ],
  },
  { timestamps: true }
);

module.exports = mongoose.model("Question", questionSchema);
