// controller/resultCtrl.js
const Result = require("../model/resultModel");
const Exam = require("../model/examModel");
const Question = require("../model/questionModel");
const Student = require("../model/studentModel");

// Admin View all results
exports.getAllResults = async (req, res) => {
  try {
    const results = await Result.find({})
      .populate("student", "name email instructorId")
      .populate(
        "exam",
        "examID examSet examDate kyu totalQuestionCount totalMarks eachQuestionMarks"
      );

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Submit exam: compute marks, save result
exports.submitExam = async (req, res) => {
  try {
    const { examId } = req.params; // exam _id
    const { selectedOptions } = req.body; // array of indexes (or null)

    if (!req.student)
      return res.status(401).json({ message: "Student auth required" });

    const exam = await Exam.findById(examId).populate("questions");
    if (!exam || exam.isDeleted)
      return res.status(404).json({ message: "Exam not found" });

    // check duplicate attempt
    const already = await Result.findOne({
      exam: exam._id,
      student: req.student._id,
    });
    if (already)
      return res.status(400).json({ message: "Exam already attempted" });

    // validate selectedOptions length
    if (!Array.isArray(selectedOptions))
      return res.status(400).json({ message: "Invalid answers" });
    if (selectedOptions.length !== exam.questions.length)
      return res.status(400).json({ message: "Answers count mismatch" });

    // grading
    let correctAnsCount = 0;
    let wrongAnsCount = 0;
    let marksObtained = 0;
    const singleMark = exam.eachQuestionMarks;

    for (let i = 0; i < exam.questions.length; i++) {
      const q = exam.questions[i];
      const sel = selectedOptions[i]; // may be null
      if (sel === null || sel === undefined) {
        // unanswered
        continue;
      }
      if (typeof sel !== "number") continue; // ignore
      if (sel === q.answer) {
        correctAnsCount++;
        marksObtained += singleMark;
      } else {
        wrongAnsCount++;
      }
    }

    // save result
    const result = await Result.create({
      exam: exam._id,
      student: req.student._id,
      examID: exam.examID,
      examSet: exam.examSet,
      kyu: exam.kyu,
      selectedOptions,
      marksObtained,
      correctAnsCount,
      wrongAnsCount,
    });

    return res.status(201).json({ message: "Submitted", result });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor: fetch results of their students (by date [date only])
exports.getResultsByInstructor = async (req, res) => {
  try {
    if (!req.instructor)
      return res.status(401).json({ message: "Instructor auth required" });
    const { date } = req.query; // YYYY-MM-DD - optional

    // find exams allocated to this instructor + exams open to all / allInstructors
    const examQuery = {
      isDeleted: false,
      $or: [
        { instructorId: req.instructor.instructorId },
        { accessability: "allInstructors" },
        { accessability: "public" },
      ],
    };
    const exams = await Exam.find(examQuery).select("_id");
    const examIds = exams.map((e) => e._id);

    const q = { exam: { $in: examIds } };
    if (date) {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(date);
      to.setHours(23, 59, 59, 999);
      q.submittedAt = { $gte: from, $lte: to };
    }

    const results = await Result.find(q)
      .populate("student", "name email instructorId")
      .populate("exam", "examID examSet examDate kyu");
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor: search student's results by name (among instructor's students)
exports.searchResultsByStudentName = async (req, res) => {
  try {
    if (!req.instructor)
      return res.status(401).json({ message: "Instructor auth required" });
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: "Name query required" });

    // find students under instructor
    const students = await Student.find({
      instructorId: req.instructor.instructorId,
      isDeleted: false,
      name: { $regex: name, $options: "i" },
    }).select("_id");
    const studentIds = students.map((s) => s._id);

    const results = await Result.find({
      student: { $in: studentIds },
    }).populate("exam", "examID examSet examDate kyu");
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor: view a submitted answer sheet (which option picked & what the correct answer is)
// Only for exams allowed to instructor (their own / allInstructors / public) and only for previous exams
exports.viewAnswerSheet = async (req, res) => {
  try {
    if (!req.instructor)
      return res.status(401).json({ message: "Instructor auth required" });
    const { resultId } = req.params;

    const result = await Result.findById(resultId)
      .populate("exam")
      .populate("student");
    if (!result) return res.status(404).json({ message: "Result not found" });

    // check exam belongs to instructor or public/allInstructors
    const exam = result.exam;
    const allowed =
      exam.instructorId === req.instructor.instructorId ||
      exam.accessability === "allInstructors" ||
      exam.accessability === "public";
    if (!allowed)
      return res
        .status(403)
        .json({ message: "Not authorized to view this result" });

    // ensure exam is past
    if (new Date(exam.examDate) > new Date())
      return res
        .status(400)
        .json({ message: "Cannot view answers for upcoming exam" });

    const questions = await Question.find({ _id: { $in: exam.questions } });

    // map questions in exam order
    const ordered = exam.questions.map((qid) =>
      questions.find((q) => q._id.equals(qid))
    );

    const sheet = ordered.map((q, idx) => ({
      question: q.question,
      options: q.options,
      correctAnswerIndex: q.answer,
      studentAnswerIndex: result.selectedOptions[idx] ?? null,
      isCorrect: result.selectedOptions[idx] === q.answer,
    }));

    return res.json({
      exam: {
        examID: exam.examID,
        examSet: exam.examSet,
        examDate: exam.examDate,
        kyu: exam.kyu,
      },
      student: { _id: result.student._id, name: result.student.name },
      sheet,
      summary: {
        correct: result.correctAnsCount,
        wrong: result.wrongAnsCount,
        marksObtained: result.marksObtained,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Fetch question paper for previous exams (instructor can fetch previous exams question papers across accessible exams)
exports.getQuestionPaper = async (req, res) => {
  try {
    if (!req.instructor)
      return res.status(401).json({ message: "Instructor auth required" });
    const { kyu, fromDate, toDate } = req.query; // filters

    const query = {
      isDeleted: false,
      examDate: { $lte: new Date() }, // only previous exams
      $or: [
        { instructorId: req.instructor.instructorId },
        { accessability: "allInstructors" },
        { accessability: "public" },
      ],
    };
    if (kyu) query.kyu = kyu;
    if (fromDate || toDate) {
      const from = fromDate ? new Date(fromDate) : new Date("1970-01-01");
      const to = toDate ? new Date(toDate) : new Date();
      query.examDate = { $gte: from, $lte: to };
    }

    const exams = await Exam.find(query).populate("questions");
    // structure response: for frontend, include examDate, kyu, examSet, questions + options + correct answer
    const papers = exams.map((e) => ({
      examID: e.examID,
      examSet: e.examSet,
      examDate: e.examDate,
      kyu: e.kyu,
      questions: e.questions.map((q) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        answer: q.answer,
        questionSet: q.questionSet,
      })),
    }));

    return res.json(papers);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Student: get all my results
exports.getMyResults = async (req, res) => {
  try {
    if (!req.student)
      return res.status(401).json({ message: "Student auth required" });
    const results = await Result.find({ student: req.student._id })
      .populate(
        "exam",
        "examID examSet examDate kyu totalQuestionCount totalMarks eachQuestionMarks"
      )
      .sort({ createdAt: -1 });

    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
