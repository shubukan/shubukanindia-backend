// controller/resultCtrl.js
const ResultModel = require("../model/resultModel");
const ExamModel = require("../model/examModel");
const QuestionModel = require("../model/questionModel");
const StudentModel = require("../model/studentModel");
const InstructorModel = require("../model/instructorModel");

// Admin View all results
// exports.getAllResults = async (req, res) => {
//   try {
//     const results = await ResultModel.find({})
//       .populate("student", "name email instructorId")
//       .populate(
//         "exam",
//         "examID examSet examDate kyu totalQuestionCount totalMarks eachQuestionMarks"
//       );

//     return res.json(results);
//   } catch (error) {
//     return res.status(500).json({ message: error.message });
//   }
// };

const safeRegex = (s) => {
  if (!s) return null;
  // escape regex special chars
  return new RegExp(String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
};

exports.getAllResults = async (req, res) => {
  try {
    // Query params
    const {
      q, // general search (student name/email or examID)
      examID,
      instructorId,
      from, // ISO date string
      to,   // ISO date string
      minMarks,
      maxMarks,
      sortBy = "submittedAt",
      sortDir = "desc",
      page = 1,
      limit = 20,
    } = req.query;

    const pageNum = Math.max(1, parseInt(page));
    const pageSize = Math.min(200, parseInt(limit) || 20);
    const skip = (pageNum - 1) * pageSize;

    // Build match after lookups (so keys are like "student.name" and "exam.examID")
    const match = {};

    if (q) {
      const re = safeRegex(q);
      match.$or = [
        { "student.name": re },
        { "student.email": re },
        { "exam.examID": re },
      ];
    }
    if (examID) match["exam.examID"] = examID;
    if (instructorId) match["student.instructorId"] = instructorId;
    if (from || to) {
      match.submittedAt = {};
      if (from) match.submittedAt.$gte = new Date(from);
      if (to) match.submittedAt.$lte = new Date(to);
    }
    if (minMarks || maxMarks) {
      match.marksObtained = {};
      if (minMarks) match.marksObtained.$gte = Number(minMarks);
      if (maxMarks) match.marksObtained.$lte = Number(maxMarks);
    }

    // Sorting
    const sortDirection = sortDir === "asc" ? 1 : -1;
    const allowedSortFields = [
      "submittedAt",
      "marksObtained",
      "createdAt",
      "updatedAt",
      "exam.examDate",
      "student.name",
    ];
    const sortField = allowedSortFields.includes(sortBy) ? sortBy : "submittedAt";

    // Build aggregation pipeline
    const pipeline = [
      // lookup student
      {
        $lookup: {
          from: "students", // collection name (lowercase plural of model)
          localField: "student",
          foreignField: "_id",
          as: "student",
        },
      },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      // lookup exam
      {
        $lookup: {
          from: "exams",
          localField: "exam",
          foreignField: "_id",
          as: "exam",
        },
      },
      { $unwind: { path: "$exam", preserveNullAndEmptyArrays: true } },
      // match (on joined fields)
      { $match: match },
      // project a handy, small shape for the UI
      {
        $project: {
          exam: {
            _id: "$exam._id",
            examID: "$exam.examID",
            examSet: "$exam.examSet",
            examDate: "$exam.examDate",
            totalMarks: "$exam.totalMarks",
          },
          student: {
            _id: "$student._id",
            name: "$student.name",
            email: "$student.email",
            instructorId: "$student.instructorId",
          },
          examID: 1,
          examSet: 1,
          selectedOptions: 1,
          marksObtained: 1,
          correctAnsCount: 1,
          wrongAnsCount: 1,
          submittedAt: 1,
          createdAt: 1,
          updatedAt: 1,
        },
      },
    ];

    // Normalise sortField path for aggregation sort stage
    const sortStage = {};
    // allow nested fields like "exam.examDate" or "student.name"
    sortStage[sortField] = sortDirection;

    // Use facet for total count + data page
    pipeline.push({
      $sort: sortStage,
    });

    pipeline.push({
      $facet: {
        metadata: [{ $count: "total" }],
        data: [{ $skip: skip }, { $limit: pageSize }],
      },
    });

    const aggRes = await ResultModel.aggregate(pipeline).allowDiskUse(true);
    const metadata = aggRes[0].metadata[0] || { total: 0 };
    const total = metadata.total;
    const data = aggRes[0].data;

    return res.json({
      total,
      page: pageNum,
      limit: pageSize,
      data,
    });
  } catch (error) {
    console.error("getAllResults error:", error);
    return res.status(500).json({ message: error.message });
  }
};

/**
 * GET /admin/results/summary?groupBy=examID|instructorId|examDate&from=&to=&limit=
 * returns aggregated counts/averages for admin grouping UI
 */
exports.getResultsSummary = async (req, res) => {
  try {
    const { groupBy = "examID", from, to, limit = 50 } = req.query;
    // allowed group keys map to fields after lookup
    const groupMap = {
      examID: "$exam.examID",
      instructorId: "$student.instructorId",
      examDate: {
        // group by date (YYYY-MM-DD) so results per-day
        $dateToString: { format: "%Y-%m-%d", date: "$exam.examDate" },
      },
    };
    if (!groupMap[groupBy]) {
      return res.status(400).json({ message: "Invalid groupBy" });
    }

    const match = {};
    if (from || to) {
      match.submittedAt = {};
      if (from) match.submittedAt.$gte = new Date(from);
      if (to) match.submittedAt.$lte = new Date(to);
    }

    const pipeline = [
      { $lookup: { from: "students", localField: "student", foreignField: "_id", as: "student" } },
      { $unwind: { path: "$student", preserveNullAndEmptyArrays: true } },
      { $lookup: { from: "exams", localField: "exam", foreignField: "_id", as: "exam" } },
      { $unwind: { path: "$exam", preserveNullAndEmptyArrays: true } },
      { $match: match },
      {
        $group: {
          _id: groupMap[groupBy],
          count: { $sum: 1 },
          avgMarks: { $avg: "$marksObtained" },
          maxMarks: { $max: "$marksObtained" },
          minMarks: { $min: "$marksObtained" },
        },
      },
      { $sort: { count: -1 } },
      { $limit: Math.min(1000, parseInt(limit) || 50) },
    ];

    const summary = await ResultModel.aggregate(pipeline).allowDiskUse(true);
    return res.json({ groupBy, summary });
  } catch (error) {
    console.error("getResultsSummary error:", error);
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

    const exam = await ExamModel.findById(examId).populate("questions");
    if (!exam || exam.isDeleted)
      return res.status(404).json({ message: "Exam not found" });

    // check duplicate attempt
    const already = await ResultModel.findOne({
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
    const result = await ResultModel.create({
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
        { instructorId: req.instructor._id },
        { accessability: "allInstructors" },
        { accessability: "public" },
      ],
    };
    const exams = await ExamModel.find(examQuery).select("_id");
    const examIds = exams.map((e) => e._id);

    const q = { exam: { $in: examIds } };
    if (date) {
      const from = new Date(date);
      from.setHours(0, 0, 0, 0);
      const to = new Date(date);
      to.setHours(23, 59, 59, 999);
      q.submittedAt = { $gte: from, $lte: to };
    }

    const results = await ResultModel.find(q)
      .populate("student", "name email instructorId")
      .populate("exam", "examID examSet examDate kyu");
    return res.json(results);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor: search student's results by name (among instructor's students)
exports.getResultsByStudent = async (req, res) => {
  try {
    if (!req.instructor)
      return res.status(401).json({ message: "Instructor auth required" });
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: "Name query required" });

    // find students under instructor
    const students = await StudentModel.find({
      instructorId: req.instructor._id,
      isDeleted: false,
      name: { $regex: name, $options: "i" },
    }).select("_id");
    const studentIds = students.map((s) => s._id);

    const results = await ResultModel.find({
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

    const result = await ResultModel.findById(resultId)
      .populate("exam")
      .populate("student");
    if (!result) return res.status(404).json({ message: "Result not found" });

    // check exam belongs to instructor or public/allInstructors
    const exam = result.exam;
    const allowed =
      exam.instructorId === req.instructor._id ||
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

    const questions = await QuestionModel.find({
      _id: { $in: exam.questions },
    });

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
        { instructorId: req.instructor._id },
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

    const exams = await ExamModel.find(query).populate("questions");
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
    const results = await ResultModel.find({ student: req.student._id })
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

exports.getThisStudentResult = async (req, res) => {
  try {
    const instructorId = req.instructor._id; // from instructorAuth
    const { studentId } = req.query;

    if (!studentId)
      return res.status(400).json({ message: "Student ID is required" });

    // Verify student ownership
    const student = await StudentModel.findById(studentId);
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (student.instructorId !== String(instructorId))
      return res
        .status(403)
        .json({ message: "Unauthorized to view this student's results" });

    // Fetch all results of this student
    const results = await ResultModel.find({ student: studentId })
      .populate(
        "exam",
        "examID examSet examDate kyu totalQuestionCount totalMarks eachQuestionMarks questions"
      )
      .sort({ createdAt: -1 });

    // Attach detailed answer sheet
    const detailedResults = [];

    for (const result of results) {
      const exam = result.exam;
      if (!exam) continue;
      console.log(exam);

      // Fetch questions for this exam
      const questions = await ExamModel.findById({
        _id: exam._id,
      })
        .populate({
          path: "questions",
          select: "-__v -createdAt -updatedAt",
        })
        .select("questions");

      // Merge student's selected options with question data
      const questionData = questions.questions.map((q, idx) => ({
        _id: q._id,
        question: q.question,
        options: q.options,
        correctAnswer: q.answer,
        studentSelected:
          result.selectedOptions && result.selectedOptions[idx] != null
            ? result.selectedOptions[idx]
            : null,
      }));

      detailedResults.push({
        _id: result._id,
        exam: {
          examID: exam.examID,
          examSet: exam.examSet,
          examDate: exam.examDate,
          kyu: exam.kyu,
          totalQuestionCount: exam.totalQuestionCount,
          totalMarks: exam.totalMarks,
          eachQuestionMarks: exam.eachQuestionMarks,
          questions: questionData,
        },
        marksObtained: result.marksObtained,
        correctAnsCount: result.correctAnsCount,
        wrongAnsCount: result.wrongAnsCount,
        submittedAt: result.submittedAt,
      });
    }

    return res.json({
      studentName: student.name,
      results: detailedResults,
    });
  } catch (error) {
    console.error("Error fetching student results:", error);
    return res.status(500).json({ message: error.message });
  }
};
