// controller/examCtrl.js
const ExamModel = require("../model/examModel");
const { isObjectIdOrHexString } = require("mongoose");
const QuestionModel = require("../model/questionModel");
const { resolveExamInstructor } = require("../util/examInstructors");
const { refreshQuestionUsage } = require("../util/examQuestionUsage");
const { startExam, submitExam, saveExamAnswers, scheduledEnd } = require("./examAttemptCtrl");

exports.startExam = startExam;
exports.startExamPublic = startExam;
exports.submitExamPublic = submitExam;
exports.saveExamAnswers = saveExamAnswers;

const { randomInt } = require("node:crypto");
const generateExamId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  return Array.from({ length: 6 }, () => chars[randomInt(chars.length)]).join("");
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
      })
      .sort({ createdAt: -1 });

    return res.json(exams);
  } catch (error) {
    console.error("getAllExams error:", error);
    return res.status(500).json({ message: error.message });
  }
};

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

async function examFields(input, previous) {
  const read = (key) => input[key] !== undefined ? input[key] : previous?.[key];
  const accessability = read("accessability");
  if (!["public", "allInstructors", "instructor"].includes(accessability)) {
    throw invalid("Select a valid exam audience.");
  }
  const dateValue = read("examDate");
  const examDate = dateValue == null || dateValue === "" ? null : new Date(dateValue);
  if ((!examDate && accessability !== "public") || (examDate && !Number.isFinite(+examDate))) {
    throw invalid("Enter a valid scheduled date for this exam.");
  }
  if (examDate && +examDate <= Date.now()) throw invalid("Choose a future exam start time.");

  const examDuration = read("examDuration");
  const eachQuestionMarks = read("eachQuestionMarks");
  const examSet = read("examSet") ?? 1;
  if (!Number.isInteger(examDuration) || examDuration < 1 ||
      !Number.isFinite(eachQuestionMarks) || eachQuestionMarks <= 0 ||
      !Number.isInteger(examSet) || examSet < 1) {
    throw invalid("Enter a positive duration, marks per question, and a whole-number set.");
  }
  const questions = read("questions");
  if (!Array.isArray(questions) || !questions.length ||
      questions.some((id) => !isObjectIdOrHexString(id)) ||
      new Set(questions.map(String)).size !== questions.length) {
    throw invalid("Select at least one question and remove duplicates.");
  }
  const found = await QuestionModel.find({ _id: { $in: questions }, isDeleted: false }).select("options answer");
  if (found.length !== questions.length || found.some((q) =>
    q.options.length < 2 || !Number.isInteger(q.answer) || q.answer < 0 || q.answer >= q.options.length
  )) throw invalid("Every selected question must exist and have a valid answer key.");

  const instructor = accessability === "instructor" ? await resolveExamInstructor(read("instructorId")) : null;
  if (accessability === "instructor" && !instructor) throw invalid("Select a valid instructor.");
  const password = read("password");
  if (password != null && typeof password !== "string") throw invalid("Enter a valid password.");
  const kyu = read("kyu");
  if (kyu != null && kyu !== "" && !Number.isFinite(Number(kyu))) throw invalid("Enter a valid kyu.");

  return {
    accessability, examDate, examSet, examDuration, eachQuestionMarks, questions,
    password: password?.trim() || null,
    kyu: kyu === "" || kyu == null ? null : Number(kyu),
    instructorId: instructor?.registryId || null,
    instructorName: instructor?.name || null,
    examEndTime: examDate ? new Date(+examDate + examDuration * 60_000) : null,
    totalQuestionCount: questions.length,
    totalMarks: questions.length * eachQuestionMarks,
  };
}

function examWriteError(error, res) {
  if (error.code === 11000) return res.status(409).json({ message: "That exam set number already exists." });
  if (error.name === "VersionError") return res.status(409).json({ message: "The exam changed. Reload it and try again." });
  return res.status(error.status || 500).json({ message: error.status ? error.message : "Could not save the exam." });
}

exports.createExam = async (req, res) => {
  try {
    const fields = await examFields(req.body ?? {});
    let examID;
    do { examID = generateExamId(); } while (await ExamModel.exists({ examID }));
    const exam = await ExamModel.create({ ...fields, examID });
    await refreshQuestionUsage(exam.questions);
    return res.status(201).json(exam);
  } catch (error) {
    return examWriteError(error, res);
  }
};

exports.createExamSet = async (req, res) => {
  try {
    const { examID } = req.params;
    if (!await ExamModel.exists({ examID, isDeleted: false })) {
      return res.status(404).json({ message: "Exam group not found." });
    }
    const fields = await examFields(req.body ?? {});
    const exam = await ExamModel.create({ ...fields, examID });
    await refreshQuestionUsage(exam.questions);
    return res.status(201).json(exam);
  } catch (error) {
    return examWriteError(error, res);
  }
};

exports.updateExam = async (req, res) => {
  try {
    const exam = await ExamModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!exam) return res.status(404).json({ message: "Exam not found." });
    if (exam.examDate && +exam.examDate <= Date.now()) {
      return res.status(400).json({ message: "An exam cannot be changed after it starts." });
    }
    const previousQuestions = [...exam.questions];
    Object.assign(exam, await examFields(req.body ?? {}, exam));
    await exam.save();
    await refreshQuestionUsage([...previousQuestions, ...exam.questions]);
    return res.json(exam);
  } catch (error) {
    return examWriteError(error, res);
  }
};

exports.deleteExam = async (req, res) => {
  try {
    const exam = await ExamModel.findOne({ _id: req.params.id, isDeleted: false });
    if (!exam) return res.status(404).json({ message: "Exam not found." });
    if (exam.examDate && +exam.examDate <= Date.now()) {
      return res.status(400).json({ message: "An exam cannot be removed after it starts." });
    }
    exam.isDeleted = true;
    await exam.save();
    await refreshQuestionUsage(exam.questions);
    return res.json({ message: "Exam removed." });
  } catch (error) {
    return examWriteError(error, res);
  }
};


function availabilityFilter(now, includeDemos) {
  const scheduled = {
    examDate: { $type: "date" },
    $expr: { $gt: [{ $add: ["$examDate", { $multiply: ["$examDuration", 60_000] }] }, now] },
  };
  return includeDemos ? { $or: [scheduled, { accessability: "public", examDate: null }] } : scheduled;
}

async function listExams(query, res) {
  const exams = await ExamModel.find(query)
    .select("examID examSet examDate examDuration accessability instructorName kyu eachQuestionMarks totalQuestionCount totalMarks password")
    .sort({ examDate: 1, examID: 1, examSet: 1 })
    .lean();
  return res.json(exams.map(({ password, ...exam }) => ({
    ...exam,
    passwordRequired: Boolean(password?.trim()),
    examEndTime: scheduledEnd(exam),
  })));
}

function rankFilter(kyu) {
  return typeof kyu === "string" && kyu !== "" && Number.isFinite(Number(kyu)) ? { kyu: Number(kyu) } : {};
}

exports.getUpcomingExams = async (req, res) => {
  try {
    return await listExams({
      isDeleted: false,
      accessability: "public",
      ...availabilityFilter(new Date(), true),
      ...rankFilter(req.query.kyu),
    }, res);
  } catch (error) {
    return res.status(500).json({ message: "Could not load public exams." });
  }
};

exports.getStuUpcomingExams = async (req, res) => {
  try {
    const instructor = req.student.instructorApproved !== false && await resolveExamInstructor(req.student.instructorId);
    return await listExams({
      isDeleted: false,
      $and: [
        availabilityFilter(new Date(), true),
        { $or: [
          { accessability: "public" },
          ...(instructor ? [
            { accessability: "allInstructors" },
            { accessability: "instructor", instructorId: { $in: instructor.aliases } },
          ] : []),
        ] },
      ],
      ...rankFilter(req.query.kyu),
    }, res);
  } catch (error) {
    return res.status(500).json({ message: "Could not load student exams." });
  }
};

exports.getInsUpcomingExams = async (req, res) => {
  try {
    const instructor = await resolveExamInstructor(req.instructor._id);
    const accessability = req.query.accessability;
    return await listExams({
      isDeleted: false,
      ...(typeof accessability === "string" && accessability && { accessability }),
      $and: [
        availabilityFilter(new Date(), true),
        { $or: [
          { accessability: { $in: ["public", "allInstructors"] } },
          { accessability: "instructor", instructorId: { $in: instructor?.aliases || [] } },
        ] },
      ],
      ...rankFilter(req.query.kyu),
    }, res);
  } catch (error) {
    return res.status(500).json({ message: "Could not load instructor exams." });
  }
};

async function completedPapers(req, res, flat) {
  try {
    const instructor = await resolveExamInstructor(req.instructor._id);
    const { fromDate, toDate, kyu } = req.query;
    const examDate = { $type: "date" };
    if (fromDate) examDate.$gte = new Date(fromDate);
    if (toDate) examDate.$lte = new Date(toDate);
    if (Object.values(examDate).some((value) => value instanceof Date && !Number.isFinite(+value))) {
      return res.status(400).json({ message: "Enter a valid date range." });
    }
    const answerSheets = await ExamModel.find({
      $expr: { $lte: [{ $add: ["$examDate", { $multiply: ["$examDuration", 60_000] }] }, new Date()] },
      examDate,
      isDeleted: false,
      $or: [
        { accessability: { $in: ["public", "allInstructors"] } },
        { accessability: "instructor", instructorId: { $in: instructor?.aliases || [] } },
      ],
      ...rankFilter(kyu),
    })
      .select("examID examSet examDate kyu totalQuestionCount totalMarks eachQuestionMarks questions")
      .sort({ examDate: -1 })
      .populate({ path: "questions", match: { isDeleted: false }, select: "question options answer questionID questionSet" })
      .lean();
    return res.json(flat ? answerSheets : { count: answerSheets.length, answerSheets });
  } catch (error) {
    return res.status(500).json({ message: "Could not load completed question papers." });
  }
}

exports.viewAnswerSheets = (req, res) => completedPapers(req, res, false);
exports.getQuestionPaper = (req, res) => completedPapers(req, res, true);
