// controller/directoryCtrl.js
const DojoModel = require("../model/dojoModel");
const InstructorIDModel = require("../model/instructorIDModel");
const InstructorModel = require("../model/instructorModel");
const { resolveInstructorCode } = require("../util/instructorMatch");

// GET /guardian/dojo-instructor-directory
// Joins Dojo (root + mainDojo[] + subDojo[] entries) with InstructorIDModel by
// fuzzy name match (handles honorifics like "Sensei"), and flags whether that
// instructor has a claimed, active login account.
exports.getDojoInstructorDirectory = async (req, res) => {
  try {
    const [dojos, instructorIdDocs, instructorAccounts] = await Promise.all([
      DojoModel.find({ isDeleted: false }).sort({ index: 1 }).lean(),
      InstructorIDModel.find({ isDeleted: false }).lean(),
      InstructorModel.find({ isDeleted: false }).select("instructorId").lean(),
    ]);

    const claimedCodes = new Set(instructorAccounts.map((i) => i.instructorId).filter(Boolean));

    const buildCard = (dojoId, dojoName, instructorName, profileImage) => {
      if (!dojoName || !instructorName) return null;
      const instructorCode = resolveInstructorCode(instructorName, instructorIdDocs);
      return {
        dojoId,
        dojoName,
        instructorName,
        instructorCode,
        hasActiveAccount: instructorCode ? claimedCodes.has(instructorCode) : false,
        profileImage: profileImage || "",
      };
    };

    const cards = [];
    dojos.forEach((dojo) => {
      const root = buildCard(dojo._id, dojo.dojoName, dojo.instructor, dojo.profileImage);
      if (root) cards.push(root);

      (dojo.dojoLocation?.mainDojo || []).forEach((d) => {
        const card = buildCard(dojo._id, d.dojoName || dojo.dojoName, d.instructor, d.profileImage);
        if (card) cards.push(card);
      });
      (dojo.dojoLocation?.subDojo || []).forEach((d) => {
        const card = buildCard(dojo._id, d.dojoName || dojo.dojoName, d.instructor, d.profileImage);
        if (card) cards.push(card);
      });
    });

    return res.json({ success: true, count: cards.length, data: cards });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};
