// controller/questionCtrl.js
const Question = require("../model/questionModel");
const Exam = require("../model/examModel");
const Counter = require("../model/counterModel");

// controllers/questionController.js
exports.deleteAll = async (req, res) => {
  try {
    const result = await Question.deleteMany({ questionID: { $gt: 31 } });
    return res.json({
      message: "Deleted successfully",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// View all questions
exports.getAllQuestions = async (req, res) => {
  try {
    const questions = await Question.find()
      .select("-__v")
      .sort({ questionID: -1 });
    return res.json(questions);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getQnA = async (req, res) => {
  try {
    const questions = await Question.find().select(
      "questionID question options answer"
    );
    return res.json(questions);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// helper to get next sequence for questionID
const getNextQuestionID = async () => {
  const res = await Counter.findOneAndUpdate(
    { _id: "questionId" },
    { $inc: { seq: 1 } },
    { new: true, upsert: true }
  );
  return res.seq;
};

// Create question (default set = 1)
exports.createQuestion = async (req, res) => {
  try {
    const { question, options, answer, questionSet } = req.body;
    if (!question || !options || !Array.isArray(options) || options.length < 2)
      return res.status(400).json({ message: "Invalid question/options" });
    if (typeof answer !== "number" || answer < 0 || answer >= options.length)
      return res.status(400).json({ message: "Invalid answer index" });

    // get sequential questionID
    const questionID = await getNextQuestionID();

    const q = await Question.create({
      questionID,
      question,
      options,
      answer,
      questionSet: questionSet || 1,
    });

    return res.status(201).json(q);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Update question - only if not part of any scheduled upcoming exam or past exam.
// If question is only used in public-on-demand exams (no examDate) editing is allowed.
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options, answer, questionSet } = req.body;

    const q = await Question.findById(id);
    if (!q) return res.status(404).json({ message: "Question not found" });

    // Find non-deleted exams that include this question
    const exams = await Exam.find({
      questions: q._id,
      isDeleted: false,
    }).select("examDate");

    const now = new Date();

    // If there are any scheduled exams (have examDate)
    const scheduledExams = exams.filter((e) => e.examDate);
    if (scheduledExams.length > 0) {
      const inPast = scheduledExams.some((e) => new Date(e.examDate) <= now);
      const inFuture = scheduledExams.some((e) => new Date(e.examDate) > now);

      if (inPast) {
        return res
          .status(400)
          .json({ message: "Cannot edit question used in past exams" });
      }
      if (inFuture) {
        return res.status(400).json({
          message: "Cannot edit question used in upcoming scheduled exams",
        });
      }
    }

    // safe to update (either no exams, or all exams that include it are public on-demand with no examDate)
    q.question = question ?? q.question;
    q.options = options ?? q.options;
    q.answer = typeof answer === "number" ? answer : q.answer;
    q.questionSet = questionSet ?? q.questionSet;
    await q.save();

    return res.json(q);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Permanently delete question - only if not used in any exam (past or upcoming)
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await Question.findById(id);
    if (!q) return res.status(404).json({ message: "Question not found" });

    // Prevent deletion if this question is referenced by any non-deleted exam
    const usedInAnyExam = await Exam.exists({
      questions: q._id,
      isDeleted: false,
    });
    if (usedInAnyExam) {
      return res
        .status(400)
        .json({ message: "Cannot delete question allocated to any exam" });
    }

    // Permanently delete the question document
    await Question.findByIdAndDelete(id);

    return res.json({ message: "Question permanently deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
