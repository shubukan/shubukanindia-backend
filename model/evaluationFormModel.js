// model/evaluationFormModel.js
const mongoose = require("mongoose");
const { Schema } = mongoose;

// A "daily or before-exam" time entry pattern repeats several times in the PDF
// (Karate practice, karate notes/theory, other arts practice)
const dailyOrBeforeExamSchema = new Schema(
  {
    mode: { type: String, enum: ["daily", "beforeExam"], default: null },
    hour: { type: Number, default: null },
    minute: { type: Number, default: null },
  },
  { _id: false }
);

const foodTimeSchema = new Schema(
  {
    breakfast: { type: String, default: "" },
    lunch: { type: String, default: "" },
    afternoonSnacks: { type: String, default: "" },
    dinner: { type: String, default: "" },
  },
  { _id: false }
);

const tiffinTimeSchema = new Schema(
  {
    no: { type: Number, required: true }, // 1 or 2
    time: { type: String, default: "" },
  },
  { _id: false }
);

const yesNoDetailSchema = new Schema(
  {
    answer: { type: Boolean, default: null }, // yes = true, no = false
    styleName: { type: String, default: "" },
    coachName: { type: String, default: "" },
    yearsLearnt: { type: String, default: "" },
  },
  { _id: false }
);

const evaluationFormSchema = new Schema(
  {
    windowId: { type: Schema.Types.ObjectId, ref: "EvaluationWindow", required: true },
    guardianId: { type: Schema.Types.ObjectId, ref: "Guardian", required: true },
    learnerId: { type: Schema.Types.ObjectId, ref: "Learner", required: true },
    dojoId: { type: Schema.Types.ObjectId, ref: "Dojo", required: true },
    instructorCode: { type: String, default: null },

    status: { type: String, enum: ["draft", "submitted"], default: "draft" },
    submittedAt: { type: Date, default: null },

    // ===== FOR STUDENTS (guardian-filled) =====
    student: {
      name: { type: String, default: "" },
      age: { type: Number, default: null },
      dob: { type: Date, default: null },
      currentRank: { type: String, default: "" },
      instructorName: { type: String, default: "" }, // snapshot
      dojoName: { type: String, default: "" }, // snapshot

      classOf: { type: String, default: "" },
      board: { type: String, default: "" },
      studyTime: { type: String, default: "" }, // School + self-study + tuition, combined

      karatePractice: { type: dailyOrBeforeExamSchema, default: () => ({}) },
      karateNotes: { type: dailyOrBeforeExamSchema, default: () => ({}) },

      otherArtsNames: { type: String, default: "" },
      otherArtsPractice: { type: dailyOrBeforeExamSchema, default: () => ({}) },

      physicalExerciseTime: { type: String, default: "" },

      screenDevice: {
        used: { type: Boolean, default: null },
        mode: { type: String, enum: ["daily", "onlyIfNecessary", null], default: null },
        hour: { type: Number, default: null },
        minute: { type: Number, default: null },
      },

      sleep: {
        totalDuration: { type: String, default: "" },
        bedTime: { type: String, default: "" }, // e.g. "9:30 PM"
        afternoonSleep: { type: String, default: "" },
      },

      food: {
        type: { type: String, enum: ["veg", "nonveg", null], default: null },
        times: { type: foodTimeSchema, default: () => ({}) },
        otherTiffinTimes: { type: [tiffinTimeSchema], default: [] },
        remarks: { type: String, default: "" },
      },

      height: { type: Number, default: null }, // cm
      weight: { type: Number, default: null }, // kg
      sportPerformance: {
        type: String,
        enum: ["Bad", "Very bad", "Good", "Very good", "Excellent", null],
        default: null,
      },

      hobby: { type: String, default: "" },
      hobbyRemarks: { type: String, default: "" },
      karateLearningRemarks: { type: String, default: "" },
    },

    // ===== FOR THE TEACHER (guardian's evaluation of the instructor) =====
    teacher: {
      punctual: { type: Boolean, default: null },
      attentionToEachStudent: { type: Boolean, default: null },
      hardWorking: { type: Boolean, default: null },
      goodTrainingAreas: {
        type: [String], // subset of: Kihon, Kata, Ido Kihon, Kumite, Theory
        default: [],
      },
      honest: { type: Boolean, default: null },
      remarks: { type: String, default: "" },
    },

    // ===== ABOUT TRAINING =====
    training: {
      trainingNeeded: {
        type: [String], // subset of: Dojo, District Camp, State Camp, National Camp, Seminar, International Session
        default: [],
      },
      studiedSportKarateBefore: { type: yesNoDetailSchema, default: () => ({}) },
      newInTraditionalFullContact: { type: Boolean, default: null },
      otherMartialArts: { type: yesNoDetailSchema, default: () => ({}) },

      preferScientificEffectiveLesson: { type: Boolean, default: null },
      preferScientificSuggestion: { type: String, default: "" }, // required if above is false

      preferOnlyFitness: { type: Boolean, default: null },
      preferOnlyFitnessSuggestion: { type: String, default: "" }, // required if above is true

      onlyNeedBeltCertificate: { type: Boolean, default: null },
      onlyNeedBeltCertificateSuggestion: { type: String, default: "" }, // required if above is false

      remarksAndSuggestion: { type: String, default: "" },
    },

    // Signature is uploaded fresh per submission and stamped on every page of the generated PDF
    guardianSignatureUrl: { type: String, default: "" },
    guardianSignaturePublicId: { type: String, default: "" },
    studentSignatureUrl: { type: String, default: "" }, // optional, only used on the final page
    studentSignaturePublicId: { type: String, default: "" },

    isDeleted: { type: Boolean, default: false },
  },
  { timestamps: true }
);

// One in-progress (draft or submitted) form per learner per window
evaluationFormSchema.index({ windowId: 1, learnerId: 1 }, { unique: true });

module.exports = mongoose.model("EvaluationForm", evaluationFormSchema);
