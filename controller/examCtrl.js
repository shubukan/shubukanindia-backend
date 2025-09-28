// controller/examCtrl.js
const ExamModel = require("../model/examModel");
const QuestionModel = require("../model/questionModel");
const ResultModel = require("../model/resultModel");

// helper to generate unique 6 char examID
const crypto = require("crypto");
const generateExamId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 6; i++) {
    id += chars[crypto.randomInt(0, chars.length)];
  }
  return id;
};

// View all exams
exports.getAllExams = async (req, res) => {
  try {
    const exams = await ExamModel.find({ isDeleted: false }).populate(
      "questions"
    );
    return res.json(exams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Create new exam (admin)
exports.createExam = async (req, res) => {
  try {
    const {
      // examID,
      examSet,
      password,
      examDuration,
      examDate,
      accessability,
      instructorId,
      instructorName,
      kyu,
      questions,
      eachQuestionMarks,
    } = req.body;

    if (
      !examDuration ||
      !examDate ||
      !accessability ||
      !questions ||
      !eachQuestionMarks
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // validate questions exist
    const foundCount = await QuestionModel.countDocuments({
      _id: { $in: questions },
      isDeleted: false,
    });
    if (foundCount !== questions.length)
      return res.status(400).json({ message: "Some questions not found" });

    // generate examID if not provided
    let eid;
    // ensure uniqueness
    let exists = true;
    while (exists) {
      eid = generateExamId();
      exists = await ExamModel.exists({ examID: eid });
    }

    // Prevent duplicate examDate for same examID
    const clash = await ExamModel.findOne({
      examID,
      examDate: examDate,
      isDeleted: false,
    });
    if (clash) {
      return res
        .status(400)
        .json({ message: "Another set already scheduled at this exact time" });
    }

    // compute totals
    const totalQuestionCount = questions.length;
    const totalMarks = totalQuestionCount * eachQuestionMarks;

    const exam = await ExamModel.create({
      examID: eid,
      examSet: examSet || 1,
      password,
      examDuration,
      examDate,
      accessability,
      instructorId,
      instructorName,
      kyu,
      questions,
      eachQuestionMarks,
      totalQuestionCount,
      totalMarks,
    });

    return res.status(201).json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Create new set for existing examID (admin)
exports.createExamSet = async (req, res) => {
  try {
    const { examID } = req.params; // e.g. /admin/exam/:examID/set
    const {
      examSet,
      password,
      examDuration,
      examDate,
      accessability,
      instructorId,
      instructorName,
      kyu,
      questions,
      eachQuestionMarks,
    } = req.body;
    if (
      !examSet ||
      !examDuration ||
      !examDate ||
      !questions ||
      !eachQuestionMarks
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    // ensure examID exists in some base form? not necessary.
    const foundCount = await QuestionModel.countDocuments({
      _id: { $in: questions },
      isDeleted: false,
    });
    if (foundCount !== questions.length)
      return res.status(400).json({ message: "Some questions not found" });

    const totalQuestionCount = questions.length;
    const totalMarks = totalQuestionCount * eachQuestionMarks;

    const exam = await ExamModel.create({
      examID,
      examSet,
      password,
      examDuration,
      examDate,
      accessability,
      instructorId,
      instructorName,
      kyu,
      questions,
      eachQuestionMarks,
      totalQuestionCount,
      totalMarks,
    });

    return res.status(201).json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Edit upcoming exam only (admin/instructor)
exports.updateExam = async (req, res) => {
  try {
    const { id } = req.params; // exam _id
    const updates = req.body;

    const exam = await ExamModel.findById(id);
    if (!exam || exam.isDeleted)
      return res.status(404).json({ message: "Exam not found" });

    // cannot edit past exam
    if (new Date(exam.examDate) <= new Date()) {
      return res.status(400).json({ message: "Cannot edit past exams" });
    }

    // if questions updated, validate them
    if (updates.questions) {
      const foundCount = await QuestionModel.countDocuments({
        _id: { $in: updates.questions },
        isDeleted: false,
      });
      if (foundCount !== updates.questions.length)
        return res.status(400).json({ message: "Some questions not found" });
      exam.questions = updates.questions;
      exam.totalQuestionCount = updates.questions.length;
      if (updates.eachQuestionMarks) {
        exam.eachQuestionMarks = updates.eachQuestionMarks;
        exam.totalMarks = updates.questions.length * updates.eachQuestionMarks;
      } else {
        exam.totalMarks = updates.questions.length * exam.eachQuestionMarks;
      }
    }

    // update allowed fields
    const allowed = [
      "password",
      "examDuration",
      "examDate",
      "accessability",
      "instructorId",
      "instructorName",
      "kyu",
      "eachQuestionMarks",
    ];
    allowed.forEach((field) => {
      if (updates[field] !== undefined) exam[field] = updates[field];
    });

    await exam.save();
    return res.json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Soft-delete upcoming exam
exports.deleteExam = async (req, res) => {
  try {
    const { id } = req.params;
    const exam = await ExamModel.findById(id);
    if (!exam || exam.isDeleted)
      return res.status(404).json({ message: "Exam not found" });

    if (new Date(exam.examDate) <= new Date()) {
      return res.status(400).json({ message: "Cannot delete past exams" });
    }

    exam.isDeleted = true;
    await exam.save();
    return res.json({ message: "Exam soft deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get upcoming exams available for a student or instructor (filter by accessability/kyu)
exports.getUpcomingExams = async (req, res) => {
  try {
    const { accessability, kyu } = req.query; // optional filters
    const now = new Date();
    const query = { examDate: { $gte: now }, isDeleted: false };
    if (accessability) query.accessability = accessability;
    if (kyu) query.kyu = kyu;
    const exams = await ExamModel.find(query).select(
      "-__v -createdAt -updatedAt"
    );
    return res.json(exams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Student tries to start exam by examID + examSet + optional password
// returns waiting info or the exam payload (questions with options only, not correct answer)
exports.startExam = async (req, res) => {
  try {
    const { examID, examSet, password } = req.body;
    if (!examID || !examSet)
      return res.status(400).json({ message: "examID and examSet required" });

    const exam = await ExamModel.findOne({
      examID,
      examSet,
      isDeleted: false,
    }).populate("questions", "-answer -__v -createdAt -updatedAt");
    if (!exam) return res.status(404).json({ message: "Exam not found" });

    // access checks
    if (exam.accessability === "instructor") {
      // student must belong to the instructor or be allowed; assume studentAuth sets req.student
      if (!req.student)
        return res.status(401).json({ message: "Student auth required" });
      if (
        !req.student.instructorId ||
        req.student.instructorId !== exam.instructorId
      ) {
        return res.status(403).json({ message: "Not allowed for this exam" });
      }
    }

    if (exam.password) {
      if (!password || password !== exam.password) {
        return res.status(403).json({ message: "Invalid password" });
      }
    }

    const now = new Date();
    if (now < new Date(exam.examDate)) {
      // waiting page info
      const ms = new Date(exam.examDate) - now;
      const timeRemains = Math.max(0, Math.floor(ms / 1000)); // seconds
      return res.json({
        status: "waiting",
        examID: exam.examID,
        examSet: exam.examSet,
        examDate: exam.examDate,
        timeRemains, // in seconds
      });
    }

    // check if student already attempted - don't allow second attempt
    if (req.student) {
      const already = await ResultModel.findOne({
        exam: exam._id,
        student: req.student._id,
      });
      if (already)
        return res.status(400).json({ message: "Exam already attempted" });
    }

    // return questions WITHOUT correct answer
    // questions were populated without 'answer'
    return res.json({
      status: "ok",
      exam: {
        _id: exam._id,
        examID: exam.examID,
        examSet: exam.examSet,
        examDuration: exam.examDuration,
        questions: exam.questions,
        eachQuestionMarks: exam.eachQuestionMarks,
        totalQuestionCount: exam.totalQuestionCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
