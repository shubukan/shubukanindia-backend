// controller/evaluationCtrl.js
const EvaluationWindowModel = require("../model/evaluationWindowModel");
const EvaluationFormModel = require("../model/evaluationFormModel");
const LearnerModel = require("../model/learnerModel");
const GuardianModel = require("../model/guardianModel");
const InstructorIDModel = require("../model/instructorIDModel");
const { sendEmail } = require("../util/sendEmail");
const { evaluationWindowEmailTemplate } = require("../util/emailTemplate");
const { generateEvaluationFormPdf } = require("../util/evaluationPdf");

const EDIT_WINDOW_HOURS = 12;
const EDIT_WINDOW_MS = EDIT_WINDOW_HOURS * 60 * 60 * 1000;
const EDIT_EXPIRED_MESSAGE = `The ${EDIT_WINDOW_HOURS}-hour edit window after submission has expired.`;

const submissionEditDeadline = (form) =>
  form.submittedAt ? new Date(form.submittedAt).getTime() + EDIT_WINDOW_MS : NaN;

const windowCoversLearner = (window, learner) =>
  learner?.instructorCode && window.instructorCodes.includes(learner.instructorCode);

function getEditableUntil(form, window, learner) {
  if (form?.status !== "submitted" || !window?.isCurrentlyOpen() || !windowCoversLearner(window, learner)) {
    return null;
  }
  const deadline = Math.min(submissionEditDeadline(form), new Date(window.endDate).getTime());
  return Number.isFinite(deadline) ? new Date(deadline) : null;
}

// Select inputs on the frontend send "" before a choice is made. Mongoose enum
// paths only accept the declared values (plus null), so "" must be normalized
// to null before it ever reaches a save() call.
function sanitizeStudentEnums(student) {
  if (!student) return student;
  const s = { ...student };
  if (s.sportPerformance === "") s.sportPerformance = null;
  if (s.food) s.food = { ...s.food, type: s.food.type === "" ? null : s.food.type };
  if (s.screenDevice) s.screenDevice = { ...s.screenDevice, mode: s.screenDevice.mode === "" ? null : s.screenDevice.mode };
  ["karatePractice", "karateNotes", "otherArtsPractice"].forEach((key) => {
    if (s[key]) s[key] = { ...s[key], mode: s[key].mode === "" ? null : s[key].mode };
  });
  return s;
}

/* ===================== ADMIN: EVALUATION WINDOWS ===================== */

// Admin opens the portal for one or more instructors over a date range
exports.createEvaluationWindow = async (req, res) => {
  try {
    const { title, instructorCodes, startDate, endDate } = req.body;
    if (!title || !Array.isArray(instructorCodes) || !instructorCodes.length || !startDate || !endDate) {
      return res.status(400).json({
        message: "title, instructorCodes (non-empty array), startDate and endDate are required",
      });
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: "startDate must be before endDate" });
    }

    const window = await EvaluationWindowModel.create({
      title,
      instructorCodes,
      startDate,
      endDate,
      createdBy: req.admin._id,
    });

    // Notify every guardian who currently has a learner under any of these instructors
    const learners = await LearnerModel.find({
      instructorCode: { $in: instructorCodes },
      isDeleted: false,
    }).distinct("guardianId");

    const guardians = await GuardianModel.find({
      _id: { $in: learners },
      isDeleted: false,
      isVerified: true,
    });

    await Promise.all(
      guardians.map((g) =>
        sendEmail(
          g.email,
          `${title} is now open`,
          evaluationWindowEmailTemplate({ title, startDate, endDate })
        )
      )
    );

    window.notifiedGuardianIds = guardians.map((g) => g._id);
    await window.save();

    return res.status(201).json({ success: true, data: window });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getAllEvaluationWindows = async (req, res) => {
  try {
    const windows = await EvaluationWindowModel.find({ isDeleted: false }).sort({ createdAt: -1 });
    return res.json({ success: true, count: windows.length, data: windows });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Admin edits an open window's title, dates, or instructor coverage.
// Guardians already notified are not re-notified on edit.
exports.updateEvaluationWindow = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, instructorCodes, startDate, endDate } = req.body;
    if (!title || !Array.isArray(instructorCodes) || !instructorCodes.length || !startDate || !endDate) {
      return res.status(400).json({
        message: "title, instructorCodes (non-empty array), startDate and endDate are required",
      });
    }
    if (new Date(startDate) >= new Date(endDate)) {
      return res.status(400).json({ message: "startDate must be before endDate" });
    }

    const window = await EvaluationWindowModel.findOne({ _id: id, isDeleted: false });
    if (!window) return res.status(404).json({ message: "Window not found" });
    if (!window.isCurrentlyOpen()) {
      return res.status(400).json({ message: "Only currently open windows can be edited" });
    }

    window.title = title;
    window.instructorCodes = instructorCodes;
    window.startDate = startDate;
    window.endDate = endDate;
    await window.save();

    return res.json({ success: true, data: window });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.closeEvaluationWindowEarly = async (req, res) => {
  try {
    const { id } = req.params;
    const window = await EvaluationWindowModel.findOneAndUpdate(
      { _id: id, isDeleted: false },
      { closedEarly: true },
      { new: true }
    );
    if (!window) return res.status(404).json({ message: "Window not found" });
    return res.json({ success: true, data: window });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ===================== GUARDIAN: FILL FORM ===================== */

// All currently-open windows that cover at least one of this guardian's learners,
// with per-learner draft/submitted/pending status.
exports.getActiveWindowsForGuardian = async (req, res) => {
  try {
    const now = new Date();
    const learners = await LearnerModel.find({ guardianId: req.guardian._id, isDeleted: false });
    const codes = learners.map((l) => l.instructorCode).filter(Boolean);

    const windows = await EvaluationWindowModel.find({
      isDeleted: false,
      closedEarly: false,
      instructorCodes: { $in: codes },
      startDate: { $lte: now },
      endDate: { $gte: now },
    }).sort({ startDate: -1 });

    const result = await Promise.all(
      windows.map(async (w) => {
        const eligibleLearners = learners.filter((l) => l.instructorCode && w.instructorCodes.includes(l.instructorCode));
        const forms = await EvaluationFormModel.find({
          windowId: w._id,
          learnerId: { $in: eligibleLearners.map((l) => l._id) },
          isDeleted: false,
        });
        const formByLearner = new Map(forms.map((f) => [String(f.learnerId), f]));

        return {
          window: w,
          learners: eligibleLearners.map((l) => {
            const f = formByLearner.get(String(l._id));
            return {
              learner: l,
              status: f ? f.status : "pending",
              formId: f ? f._id : null,
              submittedAt: f ? f.submittedAt : null,
              editableUntil: getEditableUntil(f, w, l),
            };
          }),
        };
      })
    );

    return res.json({ success: true, data: result });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const assertLearnerIsGuardians = async (guardianId, learnerId) => {
  const learner = await LearnerModel.findOne({ _id: learnerId, guardianId, isDeleted: false });
  return learner;
};

const assertWindowOpenForLearner = async (windowId, learner) => {
  const window = await EvaluationWindowModel.findOne({ _id: windowId, isDeleted: false });
  if (!window) return { window: null, ok: false, reason: "Evaluation window not found" };
  if (!windowCoversLearner(window, learner)) {
    return { window, ok: false, reason: "This window does not cover this learner's instructor" };
  }
  if (!window.isCurrentlyOpen()) {
    return { window, ok: false, reason: "This evaluation window is not currently open" };
  }
  return { window, ok: true };
};

// Create or update a draft (partial fields allowed)
exports.saveDraftForm = async (req, res) => {
  try {
    const { learnerId, windowId } = req.params;
    const learner = await assertLearnerIsGuardians(req.guardian._id, learnerId);
    if (!learner) return res.status(404).json({ message: "Learner not found" });

    const { ok, reason } = await assertWindowOpenForLearner(windowId, learner);
    if (!ok) return res.status(400).json({ message: reason });

    let form = await EvaluationFormModel.findOne({ windowId, learnerId, isDeleted: false });

    if (form?.status === "submitted" && !(Date.now() < submissionEditDeadline(form))) {
      return res.status(403).json({ message: EDIT_EXPIRED_MESSAGE });
    }

    const { student, teacher, training, filledByName } = req.body;

    const update = {
      guardianId: req.guardian._id,
      learnerId,
      windowId,
      dojoId: learner.dojoId,
      instructorCode: learner.instructorCode,
    };
    if (student) update.student = { ...(form ? form.student.toObject() : {}), ...sanitizeStudentEnums(student) };
    if (teacher) update.teacher = { ...(form ? form.teacher.toObject() : {}), ...teacher };
    if (training) update.training = { ...(form ? form.training.toObject() : {}), ...training };
    if (filledByName !== undefined) update.filledByName = filledByName;

    if (!form) {
      update.status = "draft";
      form = await EvaluationFormModel.create(update);
    } else {
      Object.assign(form, update);
      if (form.status === "submitted") {
        const missing = findMissingFields(form);
        if (missing.length) return respondWithMissingFields(res, missing);
      }
      await form.save();
    }

    return res.status(200).json({ success: true, data: form });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ message: "A form for this learner already exists for this window" });
    }
    if (error.name === "VersionError") {
      return res.status(409).json({ message: "This form changed in another session. Reload it before saving." });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Validation metadata lets the form highlight questions without matching display text.
const requiredFields = {
  student: [
    ["student.name", "Student Name"],
    ["student.age", "Age"],
    ["student.dob", "Date of Birth"],
    ["student.currentRank", "Student's Current Rank"],
    ["student.classOf", "Class"],
    ["student.board", "Board"],
    ["student.studyTime", "Study Time"],
    ["student.karatePractice.mode", "Karate Practice Time"],
    ["student.karateNotes.mode", "Karate Notes/Theory Studies"],
    ["student.otherArtsNames", "Other Arts Practiced (names)"],
    ["student.otherArtsPractice.mode", "Other Arts Practice Time"],
    ["student.physicalExerciseTime", "Physical Exercise Time"],
    ["student.screenDevice.used", "Screen Device Usage"],
    ["student.screenDevice.mode", "Screen Device — How Often", { path: "student.screenDevice.used", value: true }],
    ["student.sleep.totalDuration", "Sleep Duration"],
    ["student.sleep.bedTime", "Bed Time"],
    ["student.food.type", "Food Type (Veg/Non-Veg)"],
    ["student.food.times.breakfast", "Breakfast Time"],
    ["student.food.times.lunch", "Lunch Time"],
    ["student.food.times.afternoonSnacks", "Afternoon Snacks Time"],
    ["student.food.times.dinner", "Dinner Time"],
    ["student.height", "Height"],
    ["student.weight", "Weight"],
    ["student.sportPerformance", "Sport Performance"],
    ["student.hobby", "Hobby"],
    ["student.karateLearningRemarks", "Remarks on Karate Learning"],
  ],
  teacher: [
    ["teacher.punctual", "Is Teacher Punctual"],
    ["teacher.attentionToEachStudent", "Teacher's Attention to Each Student"],
    ["teacher.hardWorking", "Teacher's Hard Work in Teaching"],
    ["teacher.goodTrainingAreas", "What Teacher Trains Well"],
    ["teacher.honest", "Is Teacher Honest"],
    ["teacher.remarks", "Remarks About Teacher"],
  ],
  training: [
    ["training.trainingNeeded", "Which Training You Need"],
    ["training.studiedSportKarateBefore.answer", "Studied Sport Karate Before"],
    ["training.studiedSportKarateBefore.styleName", "Style Name (Sport Karate)", { path: "training.studiedSportKarateBefore.answer", value: true }],
    ["training.studiedSportKarateBefore.coachName", "Coach Name (Sport Karate)", { path: "training.studiedSportKarateBefore.answer", value: true }],
    ["training.studiedSportKarateBefore.yearsLearnt", "Years Learnt (Sport Karate)", { path: "training.studiedSportKarateBefore.answer", value: true }],
    ["training.newInTraditionalFullContact", "New in Traditional Full Contact Karate"],
    ["training.otherMartialArts.answer", "Any Other Martial Arts Practiced"],
    ["training.otherMartialArts.styleName", "Style Name (Other Martial Arts)", { path: "training.otherMartialArts.answer", value: true }],
    ["training.otherMartialArts.coachName", "Coach Name (Other Martial Arts)", { path: "training.otherMartialArts.answer", value: true }],
    ["training.otherMartialArts.yearsLearnt", "Years Learnt (Other Martial Arts)", { path: "training.otherMartialArts.answer", value: true }],
    ["training.preferScientificEffectiveLesson", "Prefer Scientific, Effective Lessons"],
    ["training.preferScientificSuggestion", "Suggestion (Scientific Lessons)", { path: "training.preferScientificEffectiveLesson", value: false }],
    ["training.preferOnlyFitness", "Prefer Only a Fitness Programme"],
    ["training.preferOnlyFitnessSuggestion", "Suggestion (Fitness Programme)", { path: "training.preferOnlyFitness", value: true }],
    ["training.onlyNeedBeltCertificate", "Only Need Belt & Certificate"],
    ["training.onlyNeedBeltCertificateSuggestion", "Suggestion (Belt & Certificate)", { path: "training.onlyNeedBeltCertificate", value: false }],
    ["training.remarksAndSuggestion", "Remarks & Suggestion (Training)"],
  ],
  signature: [["filledByName", "Guardian's Name (Signature)"]],
};

function findMissingFields(form) {
  const missing = [];
  for (const [section, fields] of Object.entries(requiredFields)) {
    for (const [path, label, when] of fields) {
      if (when && form.get(when.path) !== when.value) continue;
      const value = form.get(path);
      if (value == null || (typeof value === "string" && !value.trim()) || (Array.isArray(value) && !value.length)) {
        missing.push({ section, path, label, when });
      }
    }
  }
  return missing;
}

function respondWithMissingFields(res, missing) {
  return res.status(400).json({
    message: "Form is incomplete",
    missingFields: missing.map(({ label }) => label),
    missingFieldDetails: missing,
  });
}

exports.finalizeForm = async (req, res) => {
  try {
    const { learnerId, windowId } = req.params;
    const learner = await assertLearnerIsGuardians(req.guardian._id, learnerId);
    if (!learner) return res.status(404).json({ message: "Learner not found" });

    const { ok, reason } = await assertWindowOpenForLearner(windowId, learner);
    if (!ok) return res.status(400).json({ message: reason });

    const form = await EvaluationFormModel.findOne({ windowId, learnerId, isDeleted: false });
    if (!form) return res.status(404).json({ message: "No draft found to finalize. Save the form first." });

    if (form.status === "submitted" && !(Date.now() < submissionEditDeadline(form))) {
      return res.status(403).json({ message: EDIT_EXPIRED_MESSAGE });
    }

    const missing = findMissingFields(form);
    if (missing.length) return respondWithMissingFields(res, missing);

    if (form.status !== "submitted") {
      form.status = "submitted";
      form.submittedAt = new Date();
      await form.save();
    }

    return res.json({ success: true, message: "Form submitted", data: form });
  } catch (error) {
    if (error.name === "VersionError") {
      return res.status(409).json({ message: "This form changed in another session. Reload it before submitting." });
    }
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Guardian's own submitted+draft forms
exports.getMyForms = async (req, res) => {
  try {
    const forms = await EvaluationFormModel.find({ guardianId: req.guardian._id, isDeleted: false }).sort({
      createdAt: -1,
    });
    const now = Date.now();
    const recentSubmissions = forms.filter(
      (form) => form.status === "submitted" && now < submissionEditDeadline(form)
    );
    const windowsById = new Map();
    const learnersById = new Map();
    if (recentSubmissions.length) {
      const [windows, learners] = await Promise.all([
        EvaluationWindowModel.find({
          _id: { $in: recentSubmissions.map((form) => form.windowId) },
          isDeleted: false,
        }).select("startDate endDate closedEarly instructorCodes"),
        LearnerModel.find({
          _id: { $in: recentSubmissions.map((form) => form.learnerId) },
          guardianId: req.guardian._id,
          isDeleted: false,
        }).select("instructorCode"),
      ]);
      for (const window of windows) windowsById.set(String(window._id), window);
      for (const learner of learners) learnersById.set(String(learner._id), learner);
    }
    const data = forms.map((form) => ({
      ...form.toObject(),
      editableUntil: getEditableUntil(
        form,
        windowsById.get(String(form.windowId)),
        learnersById.get(String(form.learnerId))
      ),
    }));
    return res.json({ success: true, count: data.length, data });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

/* ===================== VIEW / DOWNLOAD (role-based) ===================== */

// Admin: all submitted forms (drafts are never visible to admin)
exports.getAllSubmittedForms = async (req, res) => {
  try {
    const forms = await EvaluationFormModel.find({ status: "submitted", isDeleted: false }).sort({
      submittedAt: -1,
    });
    return res.json({ success: true, count: forms.length, data: forms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Instructor: only submitted forms for their own learners
exports.getMyInstructorForms = async (req, res) => {
  try {
    const forms = await EvaluationFormModel.find({
      instructorCode: req.instructor.instructorId,
      status: "submitted",
      isDeleted: false,
    }).sort({ submittedAt: -1 });
    return res.json({ success: true, count: forms.length, data: forms });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

const fetchFormForRole = async (req) => {
  const { id } = req.params;
  const form = await EvaluationFormModel.findOne({ _id: id, isDeleted: false });
  if (!form) return { form: null, allowed: false };

  if (req.admin) return { form, allowed: form.status === "submitted" };
  if (req.instructor) {
    return { form, allowed: form.status === "submitted" && form.instructorCode === req.instructor.instructorId };
  }
  if (req.guardian) {
    return { form, allowed: String(form.guardianId) === String(req.guardian._id) };
  }
  return { form: null, allowed: false };
};

exports.getFormById = async (req, res) => {
  try {
    const { form, allowed } = await fetchFormForRole(req);
    if (!form || !allowed) return res.status(404).json({ message: "Form not found" });
    return res.json({ success: true, data: form });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.downloadFormPdf = async (req, res) => {
  try {
    const { form, allowed } = await fetchFormForRole(req);
    if (!form || !allowed) return res.status(404).json({ message: "Form not found" });

    const pdfBuffer = await generateEvaluationFormPdf(form);
    const filename = `evaluation-${form.student?.name || form._id}.pdf`;

    // Respond as JSON (base64), not raw application/pdf bytes. Download-manager
    // browser extensions (e.g. IDM) intercept responses by Content-Type/MIME
    // sniffing - a JSON response is invisible to that, so it always reaches our
    // own JS. The frontend rebuilds the real PDF blob client-side below.
    return res.json({ success: true, filename, base64: pdfBuffer.toString("base64") });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
