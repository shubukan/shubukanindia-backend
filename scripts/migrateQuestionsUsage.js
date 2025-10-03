// scripts/migrateQuestionsUsage.js
const mongoose = require("mongoose");
const Question = require("../model/questionModel");
const Exam = require("../model/examModel");
const Counter = require("../model/counterModel");

(async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    // Ensure counter starts after max existing questionID
    const maxQ = await Question.findOne().sort({ questionID: -1 }).select("questionID");
    const startSeq = (maxQ && maxQ.questionID) ? maxQ.questionID : 0;
    await Counter.findOneAndUpdate(
      { _id: "questionId" },
      { $set: { seq: startSeq } },
      { upsert: true }
    );

    // assign questionIDs to those missing
    const missing = await Question.find({ questionID: { $exists: false } }).sort({ createdAt: 1 });
    for (const q of missing) {
      const res = await Counter.findOneAndUpdate({ _id: "questionId" }, { $inc: { seq: 1 } }, { new: true });
      q.questionID = res.seq;
      await q.save();
      console.log("Assigned QID", q._id, res.seq);
    }

    // rebuild used & usedInExams from non-deleted exams
    // clear usedInExams/used for all questions first
    await Question.updateMany({}, { $set: { used: false, usedInExams: [] } });

    const exams = await Exam.find({ isDeleted: false }).select("_id examID examSet questions accessability examDate");
    for (const ex of exams) {
      if (!ex.questions || ex.questions.length === 0) continue;
      await Question.updateMany(
        { _id: { $in: ex.questions } },
        { 
          $addToSet: { usedInExams: { exam: ex._id, examID: ex.examID, examSet: ex.examSet, accessability: ex.accessability, examDate: ex.examDate || null } },
          $set: { used: true }
        }
      );
    }

    console.log("Migration done.");
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
})();
