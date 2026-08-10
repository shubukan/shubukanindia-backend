// controller/learnerCtrl.js
const LearnerModel = require("../model/learnerModel");
const DojoModel = require("../model/dojoModel");
const InstructorIDModel = require("../model/instructorIDModel");
const EvaluationWindowModel = require("../model/evaluationWindowModel");
const { sendEmail } = require("../util/sendEmail");
const { evaluationWindowEmailTemplate } = require("../util/emailTemplate");

// Guardian adds a learner by picking a dojo+instructor card and giving a name
exports.addLearner = async (req, res) => {
  try {
    const { name, dojoId, dojoName, instructorName } = req.body;
    if (!name || !dojoId || !dojoName || !instructorName) {
      return res.status(400).json({ message: "name, dojoId, dojoName and instructorName are required" });
    }

    const dojo = await DojoModel.findOne({ _id: dojoId, isDeleted: false });
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });

    const matchedInstructor = await InstructorIDModel.findOne({
      isDeleted: false,
      name: { $regex: `^${instructorName.trim()}$`, $options: "i" },
    });

    const learner = await LearnerModel.create({
      guardianId: req.guardian._id,
      name,
      dojoId,
      dojoName,
      instructorName,
      instructorCode: matchedInstructor ? matchedInstructor.instructorId : null,
    });

    // If an active window already covers this instructor, notify the guardian right away
    // so the new learner's form is immediately fillable (per admin workflow).
    if (learner.instructorCode) {
      const now = new Date();
      const activeWindow = await EvaluationWindowModel.findOne({
        isDeleted: false,
        closedEarly: false,
        instructorCodes: learner.instructorCode,
        startDate: { $lte: now },
        endDate: { $gte: now },
      });

      if (activeWindow) {
        await sendEmail(
          req.guardian.email,
          `${activeWindow.title} is open for ${learner.name}`,
          evaluationWindowEmailTemplate({
            title: activeWindow.title,
            startDate: activeWindow.startDate,
            endDate: activeWindow.endDate,
          })
        );
      }
    }

    return res.status(201).json({ success: true, data: learner });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.getMyLearners = async (req, res) => {
  try {
    const learners = await LearnerModel.find({ guardianId: req.guardian._id, isDeleted: false }).sort({
      createdAt: -1,
    });
    return res.json({ success: true, count: learners.length, data: learners });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

exports.deleteLearner = async (req, res) => {
  try {
    const { id } = req.params;
    const learner = await LearnerModel.findOneAndUpdate(
      { _id: id, guardianId: req.guardian._id, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );
    if (!learner) return res.status(404).json({ message: "Learner not found" });
    return res.json({ success: true, message: "Learner removed" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
