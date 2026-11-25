const { randomUUID } = require("node:crypto");
const { isObjectIdOrHexString } = require("mongoose");
const Exam = require("../model/examModel");
const Attempt = require("../model/examAttemptModel");
const Result = require("../model/resultModel");
const { resolveExamInstructor } = require("../util/examInstructors");

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const minutes = 60_000;

function scheduledEnd(exam) {
  return exam.examDate ? new Date(exam.examDate).getTime() + exam.examDuration * minutes : null;
}

function snapshotIsValid(question) {
  return question && !question.isDeleted && question.question?.trim() &&
    Array.isArray(question.options) && question.options.length >= 2 &&
    question.options.every((option) => typeof option === "string" && option.trim()) &&
    Number.isInteger(question.answer) && question.answer >= 0 && question.answer < question.options.length;
}

function publicAttempt(attempt) {
  return {
    status: "ok",
    attemptId: attempt._id,
    endsAt: attempt.endsAt,
    serverTime: new Date(),
    selectedOptions: attempt.selectedOptions,
    answerRevision: attempt.answerRevision,
    submitted: Boolean(attempt.submittedAt),
    exam: {
      _id: attempt.exam,
      examID: attempt.examID,
      examSet: attempt.examSet,
      examDate: attempt.examDate,
      examDuration: attempt.examDuration,
      eachQuestionMarks: attempt.eachQuestionMarks,
      totalQuestionCount: attempt.questions.length,
      questions: attempt.questions.map(({ _id, question, options }) => ({ _id, question, options })),
    },
  };
}

async function findCandidate(examID, examSet, student) {
  const instructor = student?.instructorApproved !== false && student?.instructorId
    ? await resolveExamInstructor(student.instructorId)
    : null;
  const access = [{ accessability: "public" }];
  if (instructor) {
    access.push({ accessability: "allInstructors" });
    access.push({ accessability: "instructor", instructorId: { $in: instructor.aliases } });
  }
  return Exam.find({
    examID, ...(examSet != null && { examSet }), isDeleted: false, $or: access,
  }).sort({ examDate: 1, examSet: 1 });
}

async function startExam(req, res) {
  try {
    const { examID, examSet, password, startKey, attemptId } = req.body ?? {};
    const code = typeof examID === "string" ? examID.trim().toUpperCase() : "";
    if (!/^[A-Z0-9]{6}$/.test(code) || (examSet != null && (!Number.isInteger(examSet) || examSet < 1))) {
      return res.status(400).json({ message: "Enter a valid exam ID and set." });
    }
    if (startKey != null && (typeof startKey !== "string" || !uuid.test(startKey))) {
      return res.status(400).json({ message: "Invalid exam session. Start again." });
    }
    const student = req.student?._id ?? null;
    if (typeof attemptId === "string" && uuid.test(attemptId)) {
      const resumed = await Attempt.findOne({
        _id: attemptId, student, examID: code, ...(examSet != null && { examSet }),
      });
      if (resumed) return res.json(publicAttempt(resumed));
    }

    const exams = await findCandidate(code, examSet, req.student);
    if (!exams.length) return res.status(404).json({ message: "No available exam matches this ID and set." });
    const now = Date.now();
    const live = exams.filter((exam) => exam.examDate
      ? now >= +new Date(exam.examDate) && now < scheduledEnd(exam)
      : exam.accessability === "public");
    if (live.length > 1) {
      return res.json({ status: "chooseSet", sets: live.map(({ examSet }) => examSet) });
    }
    const exam = live[0] || exams.find(({ examDate }) => examDate && +new Date(examDate) > now);
    if (!exam) {
      if (student) {
        const previous = await Attempt.findOne({ exam: exams.at(-1)._id, student, singleAttempt: true });
        if (previous) return res.json(publicAttempt(previous));
      }
      return res.json({ status: "expired" });
    }
    if (exam.password?.trim() && (typeof password !== "string" || exam.password.trim() !== password.trim())) {
      return res.status(403).json({ code: "EXAM_PASSWORD", message: password ? "Incorrect exam password." : "Enter the exam password." });
    }
    if (exam.examDate && +new Date(exam.examDate) > now) {
      return res.json({ status: "waiting", examID: code, examSet: exam.examSet, examDate: exam.examDate, serverTime: new Date() });
    }

    const singleAttempt = Boolean(student && (exam.examDate || exam.accessability !== "public"));
    const sessionKey = startKey || randomUUID();
    const lookup = { exam: exam._id, student, ...(singleAttempt ? { singleAttempt: true } : { startKey: sessionKey }) };
    await Attempt.init();
    const existing = await Attempt.findOne(lookup);
    if (existing) return res.json(publicAttempt(existing));
    if (singleAttempt && await Result.exists({ exam: exam._id, student })) {
      return res.json({ status: "submitted" });
    }

    await exam.populate({ path: "questions", options: { retainNullValues: true } });
    if (!exam.questions.length || !exam.questions.every(snapshotIsValid) ||
        !Number.isFinite(exam.examDuration) || exam.examDuration <= 0 ||
        !Number.isFinite(exam.eachQuestionMarks) || exam.eachQuestionMarks <= 0) {
      return res.status(409).json({ message: "This exam paper is unavailable. Contact your instructor." });
    }
    const end = scheduledEnd(exam) ?? Date.now() + exam.examDuration * minutes;
    if (Date.now() >= end) return res.json({ status: "expired" });
    const questions = exam.questions.map(({ _id, question, options, answer }) => ({ _id, question, options, answer }));
    try {
      const attempt = await Attempt.create({
        exam: exam._id, student, startKey: sessionKey, singleAttempt, examID: code,
        examSet: exam.examSet, examDate: exam.examDate, releaseAt: exam.examDate ? new Date(end) : null,
        endsAt: new Date(end), kyu: exam.kyu, examDuration: exam.examDuration,
        eachQuestionMarks: exam.eachQuestionMarks, questions, selectedOptions: questions.map(() => null),
        ...(!student && { purgeAt: new Date(end + 7 * 24 * 60 * minutes) }),
      });
      return res.json(publicAttempt(attempt));
    } catch (error) {
      if (error.code !== 11000) throw error;
      const attempt = await Attempt.findOne(lookup);
      if (!attempt) throw error;
      return res.json(publicAttempt(attempt));
    }
  } catch (error) {
    console.error("Exam start failed", error.message);
    return res.status(500).json({ message: "Could not start the exam." });
  }
}

function attemptQuery(req) {
  const { attemptId } = req.body ?? {};
  const { examId } = req.params;
  return typeof attemptId === "string" && uuid.test(attemptId) && isObjectIdOrHexString(examId)
    ? { _id: attemptId, exam: examId, student: req.student?._id ?? null }
    : null;
}

function validAnswers(answers, questions) {
  return Array.isArray(answers) && answers.length === questions.length &&
    answers.every((answer, index) => answer === null ||
      (Number.isInteger(answer) && answer >= 0 && answer < questions[index].options.length));
}

async function saveExamAnswers(req, res) {
  try {
    const receivedAt = new Date();
    const query = attemptQuery(req);
    const attempt = query && await Attempt.findOne(query);
    if (!attempt) return res.status(404).json({ message: "Exam attempt not found." });
    const { selectedOptions, answerRevision } = req.body;
    if (!validAnswers(selectedOptions, attempt.questions) || !Number.isSafeInteger(answerRevision) || answerRevision < 1) {
      return res.status(400).json({ message: "Invalid exam answers." });
    }
    const updated = await Attempt.findOneAndUpdate({
      ...query, submittedAt: null, endsAt: { $gt: receivedAt }, answerRevision: { $lt: answerRevision },
    }, { $set: { selectedOptions, answerRevision } });
    if (!updated && (attempt.submittedAt || +attempt.endsAt <= Date.now())) {
      return res.status(409).json({ message: "Answer editing has closed." });
    }
    return res.json({ saved: Boolean(updated), answerRevision });
  } catch (error) {
    console.error("Exam answer save failed", error.message);
    return res.status(500).json({ message: "Could not save answers." });
  }
}

function grade(attempt) {
  const details = attempt.questions.map((question, index) => {
    const chosen = attempt.selectedOptions[index] ?? null;
    return { chosen, correct: chosen === question.answer, correctOption: question.answer };
  });
  const correctCount = details.filter(({ correct }) => correct).length;
  const wrongCount = details.filter(({ correct, chosen }) => !correct && chosen !== null).length;
  return {
    score: correctCount * attempt.eachQuestionMarks,
    totalMarks: attempt.questions.length * attempt.eachQuestionMarks,
    correctCount, wrongCount, details,
  };
}

async function persistResult(attempt, score) {
  await Result.init();
  const data = {
    attempt: attempt._id, exam: attempt.exam, student: attempt.student, examID: attempt.examID,
    examSet: attempt.examSet, examDate: attempt.examDate, releaseAt: attempt.releaseAt, kyu: attempt.kyu,
    totalQuestionCount: attempt.questions.length, totalMarks: score.totalMarks, eachQuestionMarks: attempt.eachQuestionMarks,
    selectedOptions: attempt.selectedOptions, submittedAt: attempt.submittedAt,
    createdAt: attempt.submittedAt, updatedAt: attempt.submittedAt,
    marksObtained: score.score, correctAnsCount: score.correctCount, wrongAnsCount: score.wrongCount,
  };
  try {
    return await Result.findOneAndUpdate({ attempt: attempt._id }, { $setOnInsert: data }, {
      upsert: true, returnDocument: "after", timestamps: false,
    });
  } catch (error) {
    if (error.code !== 11000) throw error;
    return Result.findOne({ attempt: attempt._id });
  }
}

async function submitExam(req, res) {
  try {
    const receivedAt = new Date();
    const query = attemptQuery(req);
    let attempt = query && await Attempt.findOne(query);
    if (!attempt) return res.status(404).json({ message: "Exam attempt not found." });

    if (!attempt.submittedAt) {
      const onTime = receivedAt < attempt.endsAt;
      const { selectedOptions, answerRevision } = req.body;
      if (onTime && (!validAnswers(selectedOptions, attempt.questions) ||
        !Number.isSafeInteger(answerRevision) || answerRevision < 0)) {
        return res.status(400).json({ message: "Invalid exam answers." });
      }
      const open = { ...query, submittedAt: null };
      if (onTime) {
        attempt = await Attempt.findOneAndUpdate({
          ...open, answerRevision: { $lte: answerRevision },
        }, { $set: { selectedOptions, answerRevision, submittedAt: receivedAt } }, { returnDocument: "after" });
      }
      if (!onTime || !attempt) {
        attempt = await Attempt.findOneAndUpdate(open, { $set: { submittedAt: receivedAt } }, { returnDocument: "after" })
          || await Attempt.findOne(query);
      }
    }

    const score = grade(attempt);
    if (attempt.student) await persistResult(attempt, score);
    if (attempt.releaseAt && Date.now() < +attempt.releaseAt) {
      return res.json({ status: "submitted", availableAt: attempt.releaseAt, serverTime: new Date() });
    }
    return res.json({ status: "submitted", ...(attempt.student ? {} : score) });
  } catch (error) {
    console.error("Exam submission failed", error.message);
    return res.status(500).json({ message: "Could not submit the exam. Please retry." });
  }
}

module.exports = { startExam, saveExamAnswers, submitExam, scheduledEnd };
