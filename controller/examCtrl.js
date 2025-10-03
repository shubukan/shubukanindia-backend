// controller/examCtrl.js
const ExamModel = require("../model/examModel");
const QuestionModel = require("../model/questionModel");
const ResultModel = require("../model/resultModel");
const Counter = require("../model/counterModel");

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

// View all exams (admin) - include full question details and nested usedInExams.exam info
exports.getAllExams = async (req, res) => {
  try {
    const exams = await ExamModel.find({ isDeleted: false })
      // select exam fields you want; remove __v for clarity
      .select("-__v")
      .populate({
        path: "questions",
        // include almost all fields from question but omit __v and timestamps if you don't need them
        select: "-__v -createdAt -updatedAt",
        populate: {
          // this populates the `exam` ObjectId inside each usedInExams entry
          path: "usedInExams.exam",
          model: "Exam",
          select: "examID examSet accessability examDate isDeleted",
        },
      });

    return res.json(exams);
  } catch (error) {
    console.error("getAllExams error:", error);
    return res.status(500).json({ message: error.message });
  }
};

// Helper: add exam reference to given question IDs and set used true
const addExamRefToQuestions = async (exam) => {
  if (!exam.questions || exam.questions.length === 0) return;
  await QuestionModel.updateMany(
    { _id: { $in: exam.questions } },
    {
      $addToSet: {
        usedInExams: {
          exam: exam._id,
          examID: exam.examID,
          examSet: exam.examSet,
          accessability: exam.accessability,
          examDate: exam.examDate || null,
        },
      },
      $set: { used: true },
    }
  );
};

// Helper: remove exam reference from given question IDs (and update used flag accordingly)
const removeExamRefFromQuestions = async (examId, questionIds) => {
  if (!questionIds || questionIds.length === 0) return;

  // pull the exam reference
  await QuestionModel.updateMany(
    { _id: { $in: questionIds } },
    { $pull: { usedInExams: { exam: examId } } }
  );

  // After pulling, recalc used flag for affected questions
  const affected = await QuestionModel.find({
    _id: { $in: questionIds },
  }).select("_id usedInExams");
  const bulkOps = affected.map((q) => ({
    updateOne: {
      filter: { _id: q._id },
      update: { $set: { used: q.usedInExams && q.usedInExams.length > 0 } },
    },
  }));
  if (bulkOps.length) await QuestionModel.bulkWrite(bulkOps);
};

// Create new exam (admin)
exports.createExam = async (req, res) => {
  try {
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

    // examDate is required only for non-public exams
    if (
      !examDuration ||
      accessability === undefined ||
      !questions ||
      !eachQuestionMarks
    ) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (accessability !== "public" && !examDate) {
      return res
        .status(400)
        .json({ message: "examDate is required for non-public exams" });
    }

    // validate questions exist
    const foundCount = await QuestionModel.countDocuments({
      _id: { $in: questions },
      isDeleted: false,
    });
    if (foundCount !== questions.length)
      return res.status(400).json({ message: "Some questions not found" });

    // generate unique examID
    let eid;
    let exists = true;
    while (exists) {
      eid = generateExamId();
      exists = await ExamModel.exists({ examID: eid });
    }

    // If examDate provided, check clash for same examID at exact time (only relevant when examDate exists)
    if (examDate) {
      const clash = await ExamModel.findOne({
        examID: eid,
        examDate: examDate,
        isDeleted: false,
      });
      if (clash) {
        return res.status(400).json({
          message: "Another set already scheduled at this exact time",
        });
      }
    }

    // compute totals
    const totalQuestionCount = questions.length;
    const totalMarks = totalQuestionCount * eachQuestionMarks;

    const exam = await ExamModel.create({
      examID: eid,
      examSet: examSet || 1,
      password,
      examDuration,
      examDate: examDate || undefined,
      accessability,
      instructorId,
      instructorName,
      kyu,
      questions,
      eachQuestionMarks,
      totalQuestionCount,
      totalMarks,
    });
    await addExamRefToQuestions(exam);

    return res.status(201).json(exam);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Create new set for existing examID (admin)
exports.createExamSet = async (req, res) => {
  try {
    const { examID } = req.params;
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

    // examDate required only for non-public
    if (!examSet || !examDuration || !questions || !eachQuestionMarks) {
      return res.status(400).json({ message: "Missing required fields" });
    }
    if (accessability !== "public" && !examDate) {
      return res
        .status(400)
        .json({ message: "examDate is required for non-public exams" });
    }

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
      examDate: examDate || undefined,
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

    // cannot edit past exam — but if exam has no examDate (public on-demand), allow edits
    if (exam.examDate && new Date(exam.examDate) <= new Date()) {
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

      // compute added / removed
      const oldQuestionIds = exam.questions.map(String);
      const newQuestionIds = updates.questions.map(String);

      const added = newQuestionIds.filter((id) => !oldQuestionIds.includes(id));
      const removed = oldQuestionIds.filter(
        (id) => !newQuestionIds.includes(id)
      );

      // apply to exam doc
      exam.questions = updates.questions;
      exam.totalQuestionCount = updates.questions.length;
      if (updates.eachQuestionMarks) {
        exam.eachQuestionMarks = updates.eachQuestionMarks;
        exam.totalMarks = updates.questions.length * updates.eachQuestionMarks;
      } else {
        exam.totalMarks = updates.questions.length * exam.eachQuestionMarks;
      }

      // update question usage
      if (added.length > 0) {
        // temporarily create a small object to mimic exam for helper usage
        const miniExam = {
          _id: exam._id,
          examID: exam.examID,
          examSet: exam.examSet,
          accessability: exam.accessability,
          examDate: exam.examDate || null,
          questions: added,
        };
        await addExamRefToQuestions(miniExam);
      }
      if (removed.length > 0) {
        await removeExamRefFromQuestions(exam._id, removed);
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

    // If exam has an examDate, enforce cannot delete past exams. If no date (public on-demand), allow delete.
    if (exam.examDate && new Date(exam.examDate) <= new Date()) {
      return res.status(400).json({ message: "Cannot delete past exams" });
    }

    // before setting exam.isDeleted = true
    await removeExamRefFromQuestions(exam._id, exam.questions);
    exam.isDeleted = true;
    await exam.save();

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
    const { accessability, kyu } = req.query;
    const now = new Date();

    // Build flexible query:
    // - Include any exam with examDate >= now
    // - ALSO include public exams that don't have examDate (available anytime)
    const baseConditions = [{ examDate: { $gte: now } }]; // scheduled & not passed

    // public-on-demand (no examDate) condition
    baseConditions.push({
      accessability: "public",
      examDate: { $exists: false },
    });
    baseConditions.push({ accessability: "public", examDate: null });

    const query = { isDeleted: false, $or: baseConditions };

    if (accessability) query.accessability = accessability;
    if (kyu) query.kyu = kyu;

    // If accessability is provided and is not "public", we should only include scheduled exams (examDate >= now).
    // To handle that correctly, adjust query when accessability !== 'public'
    if (accessability && accessability !== "public") {
      // only scheduled of that accessibility
      Object.assign(query, {
        isDeleted: false,
        accessability,
        examDate: { $gte: now },
      });
      delete query.$or;
    } else if (accessability === "public") {
      // when asking for only public, include both scheduled (>= now) and unscheduled (null/missing)
      Object.assign(query, { isDeleted: false, accessability });
      query.$or = [
        { examDate: { $gte: now } },
        { examDate: { $exists: false } },
        { examDate: null },
      ];
    }

    const exams = await ExamModel.find(query).select(
      "-__v -createdAt -updatedAt"
    );
    return res.json(exams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Upcoming exams for students (only public)
exports.getStudentUpcomingExams = async (req, res) => {
  try {
    const now = new Date();
    // Include public scheduled exams (examDate >= now) AND public without date
    const exams = await ExamModel.find({
      isDeleted: false,
      accessability: "public",
      $or: [
        { examDate: { $gte: now } },
        { examDate: { $exists: false } },
        { examDate: null },
      ],
    }).select("-__v -createdAt -updatedAt");

    return res.json(exams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Upcoming exams for instructors (public + allInstructors + own exams)
exports.getInstructorUpcomingExams = async (req, res) => {
  try {
    const now = new Date();
    const instructorId = req.user?.id; // from authMiddleware

    // For public exams: include scheduled (>= now) and unscheduled (no examDate)
    const exams = await ExamModel.find({
      isDeleted: false,
      $or: [
        {
          accessability: "public",
          $or: [
            { examDate: { $gte: now } },
            { examDate: { $exists: false } },
            { examDate: null },
          ],
        },
        { accessability: "allInstructors", examDate: { $gte: now } },
        {
          accessability: "instructor",
          instructorId: instructorId,
          examDate: { $gte: now },
        },
      ],
    }).select("-__v -createdAt -updatedAt");

    return res.json(exams);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Student tries to start exam by examID + optional password
exports.startExam = async (req, res) => {
  try {
    const { examID, password } = req.body;
    if (!examID) {
      return res.status(400).json({ message: "examID required" });
    }

    // Get all sets of this examID
    const exams = await ExamModel.find({
      examID,
      isDeleted: false,
    }).populate("questions", "-answer -__v -createdAt -updatedAt");

    if (!exams || exams.length === 0) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Ensure password is required for all sets if any set has one
    const requiresPassword = exams.some(
      (e) => e.password && e.password.trim() !== ""
    );
    if (requiresPassword) {
      if (!password) {
        return res.status(403).json({ message: "Password required" });
      }
      const match = exams.some(
        (e) => e.password && e.password.trim() === password.trim()
      );
      if (!match) {
        return res.status(403).json({ message: "Invalid password" });
      }
    }

    const now = new Date();

    // Find live exam:
    // - scheduled exam: now between examDate and examDate + duration
    // - OR public exam with NO examDate: treat as live-on-demand (start now)
    let liveExam = exams.find((e) => {
      // public on-demand (no examDate) -> live
      if (
        e.accessability === "public" &&
        (!e.examDate || e.examDate === null)
      ) {
        return true;
      }
      if (!e.examDate) return false;
      const start = new Date(e.examDate);
      const end = new Date(start.getTime() + e.examDuration * 60000);
      return now >= start && now <= end;
    });

    if (!liveExam) {
      // check if any exam already expired (past its end time)
      const expiredExam = exams.find((e) => {
        if (!e.examDate) return false;
        return now > new Date(e.examDate).getTime() + e.examDuration * 60000;
      });

      if (expiredExam) {
        return res.json({
          status: "expired",
          examID: expiredExam.examID,
          examSet: expiredExam.examSet,
        });
      }

      // else, it's a future exam (for scheduled sets)
      const nextExam = exams
        .filter((e) => e.examDate && new Date(e.examDate) > now)
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate))[0];

      if (!nextExam) {
        return res
          .status(404)
          .json({ message: "No upcoming sets for this examID" });
      }

      const ms = new Date(nextExam.examDate) - now;
      return res.json({
        status: "waiting",
        examID: nextExam.examID,
        examSet: nextExam.examSet,
        examDate: nextExam.examDate,
        timeRemains: Math.max(0, Math.floor(ms / 1000)),
      });
    }

    // Already attempted? — only enforce for non-public exams
    if (liveExam.accessability !== "public") {
      const already = await ResultModel.findOne({
        exam: liveExam._id,
        student: req.student._id,
      });
      if (already) {
        return res.status(400).json({ message: "Exam already attempted" });
      }
    }
    // If exam is public, we allow multiple attempts by the same student.

    // For public on-demand exam with no examDate, we still return the examDuration and questions
    return res.json({
      status: "ok",
      exam: {
        _id: liveExam._id,
        examID: liveExam.examID,
        examSet: liveExam.examSet,
        examDuration: liveExam.examDuration,
        questions: liveExam.questions,
        eachQuestionMarks: liveExam.eachQuestionMarks,
        totalQuestionCount: liveExam.totalQuestionCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Public start (no authentication required)
// Body: { examID, password? }
exports.startExamPublic = async (req, res) => {
  try {
    const { examID, password } = req.body;
    if (!examID) return res.status(400).json({ message: "examID required" });

    const exams = await ExamModel.find({
      examID,
      isDeleted: false,
    }).populate("questions", "-answer -__v -createdAt -updatedAt");

    if (!exams || exams.length === 0) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // if any set requires password, validate password
    const requiresPassword = exams.some(
      (e) => e.password && e.password.trim() !== ""
    );
    if (requiresPassword) {
      if (!password)
        return res.status(403).json({ message: "Password required" });
      const match = exams.some(
        (e) => e.password && e.password.trim() === password.trim()
      );
      if (!match) return res.status(403).json({ message: "Invalid password" });
    }

    const now = new Date();

    // find a live exam:
    // public-on-demand (no examDate) -> live
    // or scheduled exam where now is between start and end
    let liveExam = exams.find((e) => {
      if (
        e.accessability === "public" &&
        (!e.examDate || e.examDate === null)
      ) {
        return true;
      }
      if (!e.examDate) return false;
      const start = new Date(e.examDate);
      const end = new Date(start.getTime() + e.examDuration * 60000);
      return now >= start && now <= end;
    });

    if (!liveExam) {
      // expired check (only for those that have dates)
      const expiredExam = exams.find((e) => {
        if (!e.examDate) return false;
        return now > new Date(e.examDate).getTime() + e.examDuration * 60000;
      });

      if (expiredExam) {
        return res.json({
          status: "expired",
          examID: expiredExam.examID,
          examSet: expiredExam.examSet,
        });
      }

      // otherwise next scheduled
      const nextExam = exams
        .filter((e) => e.examDate && new Date(e.examDate) > now)
        .sort((a, b) => new Date(a.examDate) - new Date(b.examDate))[0];

      if (!nextExam) {
        return res
          .status(404)
          .json({ message: "No upcoming sets for this examID" });
      }

      const ms = new Date(nextExam.examDate) - now;
      return res.json({
        status: "waiting",
        examID: nextExam.examID,
        examSet: nextExam.examSet,
        examDate: nextExam.examDate,
        timeRemains: Math.max(0, Math.floor(ms / 1000)),
      });
    }

    // NOTE: for public exams we DO NOT block repeated attempts.
    // (If you want to block repeated attempts *only* for scheduled public exams, adjust logic here.)

    return res.json({
      status: "ok",
      exam: {
        _id: liveExam._id,
        examID: liveExam.examID,
        examSet: liveExam.examSet,
        examDuration: liveExam.examDuration,
        questions: liveExam.questions,
        eachQuestionMarks: liveExam.eachQuestionMarks,
        totalQuestionCount: liveExam.totalQuestionCount,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Public submit: no auth required
// POST /exam/:examId/submit
// body: { answers: [...], guestName?: string, guestEmail?: string }
// Public submit: does not save result in DB
exports.submitExamPublic = async (req, res) => {
  try {
    const { examId } = req.params;
    const { selectedOptions } = req.body;

    if (!selectedOptions) {
      return res.status(400).json({ message: "Answers required" });
    }

    const exam = await ExamModel.findById(examId).populate("questions");
    if (!exam || exam.isDeleted) {
      return res.status(404).json({ message: "Exam not found" });
    }
    if (exam.accessability !== "public") {
      return res
        .status(403)
        .json({ message: "Only public exams allowed here" });
    }

    let score = 0;
    let correctCount = 0;
    const details = [];

    exam.questions.forEach((q, idx) => {
      const chosen = selectedOptions[idx];
      const correct = q.answer; // assuming `answer` stores correct option index
      const isCorrect = chosen === correct;
      if (isCorrect) {
        score += exam.eachQuestionMarks;
        correctCount++;
      }
      details.push({
        qIndex: idx,
        chosen,
        correctOption: correct,
        correct: isCorrect,
      });
    });

    return res.json({
      score,
      totalMarks: exam.totalMarks,
      correctCount,
      details,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
