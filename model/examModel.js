// model/examModel.js
const mongoose = require("mongoose");

const examSchema = new mongoose.Schema(
  {
    examID: { type: String, required: true }, // 6-char alphanumeric
    examSet: { type: Number, default: 1 },
    password: { type: String }, // optional
    examDuration: { type: Number, required: true }, // minutes
    // examDate required only for non-public exams
    examDate: {
      type: Date,
      required: function () {
        // `this` is the document
        // if accessability is 'public' then examDate is NOT required
        return this.accessability !== "public";
      },
    },
    accessability: {
      type: String,
      enum: ["instructor", "allInstructors", "public"],
      required: true,
    },
    instructorId: { type: String },
    instructorName: { type: String },
    kyu: { type: Number },
    questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
    eachQuestionMarks: { type: Number, required: true },
    totalQuestionCount: { type: Number, required: true },
    totalMarks: { type: Number, required: true },
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

examSchema.index({ examID: 1, examSet: 1 }, { unique: true });

module.exports = mongoose.model("Exam", examSchema);
