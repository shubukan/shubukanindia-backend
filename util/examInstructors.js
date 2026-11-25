const { isObjectIdOrHexString } = require("mongoose");
const Instructor = require("../model/instructorModel");
const Registry = require("../model/instructorIDModel");

async function resolveExamInstructor(reference) {
  if (!reference) return null;
  const canBeId = isObjectIdOrHexString(reference);
  const account = canBeId ? await Instructor.findOne({
    _id: reference, isDeleted: false,
  }).select("instructorId") : null;
  const instructorId = account?.instructorId || String(reference);
  const registry = await Registry.findOne({
    isDeleted: false,
    $or: [
      { instructorId },
      ...(canBeId && !account ? [{ _id: reference }] : []),
    ],
  }).select("instructorId name");
  if (!registry) return null;
  const linkedAccount = account || await Instructor.findOne({
    instructorId: registry.instructorId, isDeleted: false,
  }).select("_id");
  return {
    registryId: String(registry._id),
    name: registry.name,
    aliases: [String(registry._id), registry.instructorId, ...(linkedAccount ? [String(linkedAccount._id)] : [])],
  };
}

function instructorStudentsFilter(instructor) {
  return { instructorId: { $in: instructor?.aliases || [] }, instructorApproved: { $ne: false } };
}

module.exports = { resolveExamInstructor, instructorStudentsFilter };
