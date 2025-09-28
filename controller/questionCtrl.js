// controller/questionCtrl.js
const Question = require("../model/questionModel");
const Exam = require("../model/examModel");

// View all questions
exports.getAllQuestions = async (req, res) => {
  try {
    const questions = await Question.find({ isDeleted: false }).select("-__v");
    return res.json(questions);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};


// Create question (default set = 1)
exports.createQuestion = async (req, res) => {
  try {
    const { question, options, answer, questionSet } = req.body;
    if (!question || !options || !Array.isArray(options) || options.length < 2)
      return res.status(400).json({ message: "Invalid question/options" });
    if (typeof answer !== "number" || answer < 0 || answer >= options.length)
      return res.status(400).json({ message: "Invalid answer index" });

    const q = await Question.create({
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

// Update question - only if not allocated to any previous exam or allocated only in upcoming exam(s)
exports.updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const { question, options, answer, questionSet } = req.body;

    const q = await Question.findById(id);
    if (!q || q.isDeleted) return res.status(404).json({ message: "Question not found" });

    // check if question is used in any past (examDate <= now) exam
    const usedInPast = await Exam.exists({
      questions: q._id,
      examDate: { $lte: new Date() }
    });

    if (usedInPast) {
      return res.status(400).json({ message: "Cannot edit question used in past exams" });
    }

    // safe to update
    q.question = question ?? q.question;
    q.options = options ?? q.options;
    q.answer = (typeof answer === "number") ? answer : q.answer;
    q.questionSet = questionSet ?? q.questionSet;
    await q.save();

    return res.json(q);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Soft delete question - only if not used in any exam (past or upcoming)
exports.deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    const q = await Question.findById(id);
    if (!q || q.isDeleted) return res.status(404).json({ message: "Question not found" });

    const usedInAnyExam = await Exam.exists({ questions: q._id });
    if (usedInAnyExam) {
      return res.status(400).json({ message: "Cannot delete question allocated to any exam" });
    }

    q.isDeleted = true;
    await q.save();
    return res.json({ message: "Question soft deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
