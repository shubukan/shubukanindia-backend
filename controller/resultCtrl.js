// controller/resultCtrl.js
const ResultModel = require("../model/resultModel");
const ExamModel = require("../model/examModel");
const Attempt = require("../model/examAttemptModel");
const StudentModel = require("../model/studentModel");
const { isObjectIdOrHexString } = require("mongoose");
const { scheduledEnd, submitExam } = require("./examAttemptCtrl");
const { resolveExamInstructor, instructorStudentsFilter } = require("../util/examInstructors");

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

    const pageNum = Math.max(1, parseInt(page) || 1);
    const pageSize = Math.max(1, Math.min(200, parseInt(limit) || 20));
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
    if (typeof instructorId === "string" && instructorId) {
      const instructor = await resolveExamInstructor(instructorId);
      match["student.instructorId"] = instructor ? { $in: instructor.aliases } : instructorId;
    }
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
            examSet: { $ifNull: ["$examSet", "$exam.examSet"] },
            examDate: { $cond: [{ $ifNull: ["$attempt", false] }, "$examDate", "$exam.examDate"] },
            totalMarks: { $ifNull: ["$totalMarks", "$exam.totalMarks"] },
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


exports.submitExam = submitExam;

const examProjection = "examID examSet examDate examDuration kyu totalQuestionCount totalMarks eachQuestionMarks";

function releaseTime(result) {
  return result.releaseAt ? +new Date(result.releaseAt) : scheduledEnd(result.exam ?? {});
}

function publicResult(result) {
  const exam = result.exam || {};
  const availableAt = releaseTime(result);
  const pending = availableAt && Date.now() < availableAt;
  return {
    _id: result._id,
    examID: result.examID,
    examSet: result.examSet,
    kyu: result.kyu ?? exam.kyu,
    exam: {
      _id: exam._id,
      examID: result.examID || exam.examID,
      examSet: result.examSet ?? exam.examSet,
      examDate: result.attempt ? result.examDate : exam.examDate,
      kyu: result.kyu ?? exam.kyu,
      totalQuestionCount: result.totalQuestionCount ?? exam.totalQuestionCount,
      totalMarks: result.totalMarks ?? exam.totalMarks,
      eachQuestionMarks: result.eachQuestionMarks ?? exam.eachQuestionMarks,
    },
    submittedAt: result.submittedAt,
    ...(pending ? { availableAt: new Date(availableAt) } : {
      marksObtained: result.marksObtained,
      correctAnsCount: result.correctAnsCount,
      wrongAnsCount: result.wrongAnsCount,
    }),
  };
}

async function resultQuestions(results) {
  const released = results.filter((result) => !(Date.now() < releaseTime(result)));
  const attempts = await Attempt.find({ _id: { $in: released.filter((r) => r.attempt).map((r) => r.attempt) } })
    .select("questions").lean();
  const exams = await ExamModel.find({ _id: { $in: released.filter((r) => !r.attempt && r.exam?._id).map((r) => r.exam._id) } })
    .select("questions").populate("questions", "question options answer").lean();
  const papers = new Map([...attempts, ...exams].map((paper) => [String(paper._id), paper.questions]));
  return new Map(released.map((result) => {
    const paper = papers.get(String(result.attempt || result.exam?._id)) || [];
    return [String(result._id), paper.map((q, index) => ({
      _id: q._id,
      question: q.question,
      options: q.options,
      correctAnswer: q.answer,
      studentSelected: result.selectedOptions[index] ?? null,
    }))];
  }));
}

exports.getMyResults = async (req, res) => {
  try {
    const results = await ResultModel.find({ student: req.student._id })
      .populate("exam", examProjection).sort({ submittedAt: -1 }).lean();
    return res.json(results.map(publicResult));
  } catch (error) {
    return res.status(500).json({ message: "Could not load your results." });
  }
};

exports.getResultsByStudent = async (req, res) => {
  try {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Student name is required." });
    const instructor = await resolveExamInstructor(req.instructor._id);
    const students = await StudentModel.find({
      ...instructorStudentsFilter(instructor), isDeleted: false, name: safeRegex(name),
    }).select("_id");
    const results = await ResultModel.find({ student: { $in: students.map(({ _id }) => _id) } })
      .populate("exam", examProjection).sort({ submittedAt: -1 }).lean();
    return res.json(results.map(publicResult));
  } catch (error) {
    return res.status(500).json({ message: "Could not search student results." });
  }
};

exports.getThisStudentResult = async (req, res) => {
  try {
    const { studentId } = req.query;
    if (typeof studentId !== "string" || !isObjectIdOrHexString(studentId)) {
      return res.status(400).json({ message: "Select a student." });
    }
    const instructor = await resolveExamInstructor(req.instructor._id);
    const student = await StudentModel.findOne({
      _id: studentId, ...instructorStudentsFilter(instructor), isDeleted: false,
    }).select("name");
    if (!student) return res.status(404).json({ message: "Student not found." });
    const results = await ResultModel.find({ student: student._id })
      .populate("exam", examProjection).sort({ submittedAt: -1 }).lean();
    const questions = await resultQuestions(results);
    const detailedResults = results.map((result) => {
      const response = publicResult(result);
      return {
        ...response,
        exam: { ...response.exam, questions: questions.get(String(result._id)) || [] },
      };
    });
    return res.json({ studentName: student.name, results: detailedResults });
  } catch (error) {
    return res.status(500).json({ message: "Could not load the student's results." });
  }
};

exports.viewAnswerSheet = async (req, res) => {
  try {
    const { resultId } = req.params;
    if (!isObjectIdOrHexString(resultId)) return res.status(404).json({ message: "Result not found." });
    const result = await ResultModel.findById(resultId).populate("exam", examProjection).lean();
    if (!result) return res.status(404).json({ message: "Result not found." });
    const instructor = await resolveExamInstructor(req.instructor._id);
    const student = await StudentModel.findOne({
      _id: result.student, ...instructorStudentsFilter(instructor), isDeleted: false,
    }).select("name");
    if (!student) return res.status(404).json({ message: "Result not found." });

    const published = publicResult(result);
    if (published.availableAt) {
      return res.status(409).json({ message: "Answers are available after the exam ends.", availableAt: published.availableAt });
    }
    const questions = await resultQuestions([result]);
    return res.json({
      exam: published.exam,
      student: { _id: student._id, name: student.name },
      sheet: (questions.get(String(result._id)) || []).map((q) => ({
        question: q.question, options: q.options, correctAnswerIndex: q.correctAnswer,
        studentAnswerIndex: q.studentSelected, isCorrect: q.studentSelected === q.correctAnswer,
      })),
      summary: {
        correct: published.correctAnsCount, wrong: published.wrongAnsCount, marksObtained: published.marksObtained,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: "Could not load the answer sheet." });
  }
};
