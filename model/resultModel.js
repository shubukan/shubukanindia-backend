// model/resultModel.js
const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    attempt: String,
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      required: true,
    },
    examID: { type: String, trim: true, required: true },
    examSet: { type: Number, required: true },
    kyu: { type: Number },
    examDate: Date,
    releaseAt: Date,
    totalQuestionCount: Number,
    totalMarks: Number,
    eachQuestionMarks: Number,
    selectedOptions: [{ type: Number }], // positions or null for unanswered
    marksObtained: { type: Number, default: 0 },
    correctAnsCount: { type: Number, default: 0 },
    wrongAnsCount: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

resultSchema.index({ attempt: 1 }, { unique: true, partialFilterExpression: { attempt: { $type: "string" } } });

module.exports = mongoose.model("Result", resultSchema);
