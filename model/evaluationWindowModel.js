// model/evaluationWindowModel.js
const mongoose = require("mongoose");

const evaluationWindowSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, required: true }, // e.g. "Q1 2026 Evaluation"
    instructorCodes: {
      type: [String], // InstructorIDModel.instructorId values this window covers
      required: true,
      validate: (v) => Array.isArray(v) && v.length > 0,
    },
    startDate: { type: Date, required: true },
    endDate: { type: Date, required: true },
    closedEarly: { type: Boolean, default: false }, // admin can force-close before endDate
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "Admin" },
    notifiedGuardianIds: { type: [mongoose.Schema.Types.ObjectId], default: [] }, // sent-email log
    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// Virtual: is this window currently open for submissions
evaluationWindowSchema.methods.isCurrentlyOpen = function () {
  if (this.closedEarly || this.isDeleted) return false;
  const now = Date.now();
  return now >= new Date(this.startDate).getTime() && now <= new Date(this.endDate).getTime();
};

module.exports = mongoose.model("EvaluationWindow", evaluationWindowSchema);
