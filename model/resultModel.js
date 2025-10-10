// model/resultModel.js
const mongoose = require("mongoose");

const resultSchema = new mongoose.Schema(
  {
    exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "student",
      required: true,
    },
    examID: { type: String, trim: true, required: true },
    examSet: { type: Number, required: true },
    kyu: { type: Number },
    selectedOptions: [{ type: Number }], // positions or null for unanswered
    marksObtained: { type: Number, default: 0 },
    correctAnsCount: { type: Number, default: 0 },
    wrongAnsCount: { type: Number, default: 0 },
    submittedAt: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

// Prevent duplicate attempt to same exam for same student at DB level (optional)
// you can create a unique compound index if you prefer:
// resultSchema.index({ exam: 1, student: 1 }, { unique: true });

module.exports = mongoose.model("Result", resultSchema);
