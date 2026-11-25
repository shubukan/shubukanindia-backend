const mongoose = require("mongoose");
const { randomUUID } = require("node:crypto");

const attemptSchema = new mongoose.Schema({
  _id: { type: String, default: randomUUID },
  exam: { type: mongoose.Schema.Types.ObjectId, ref: "Exam", required: true },
  student: { type: mongoose.Schema.Types.ObjectId, ref: "student" },
  startKey: { type: String, required: true },
  singleAttempt: { type: Boolean, required: true },
  examID: { type: String, required: true },
  examSet: { type: Number, required: true },
  examDate: Date,
  releaseAt: Date,
  endsAt: { type: Date, required: true },
  kyu: Number,
  examDuration: Number,
  eachQuestionMarks: Number,
  questions: [{
    _id: mongoose.Schema.Types.ObjectId,
    question: String,
    options: [String],
    answer: Number,
  }],
  selectedOptions: [Number],
  answerRevision: { type: Number, default: 0 },
  submittedAt: Date,
  // Only guest attempts expire. Signed-in results reference their paper indefinitely.
  purgeAt: Date,
}, { timestamps: true });

attemptSchema.index({ exam: 1, student: 1 }, {
  unique: true,
  partialFilterExpression: { singleAttempt: true },
});
attemptSchema.index({ exam: 1, student: 1, startKey: 1 }, { unique: true });
attemptSchema.index({ purgeAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model("ExamAttempt", attemptSchema);
