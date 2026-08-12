// util/instructorMatch.js
const HONORIFIC_WORDS = new Set([
  "sensei",
  "shihan",
  "sifu",
  "master",
  "sir",
  "shri",
  "sri",
  "coach",
  "instructor",
  "renshi",
  "kyoshi",
  "hanshi",
]);

function normalizeName(name = "") {
  return name
    .toLowerCase()
    .replace(/[.,]/g, "")
    .split(/\s+/)
    .filter((word) => word && !HONORIFIC_WORDS.has(word))
    .join(" ")
    .trim();
}

// instructorIdDocs: array of { name, instructorId, ... } from InstructorIDModel
// Returns the matched instructorId, or null.
function resolveInstructorCode(dojoInstructorName, instructorIdDocs = []) {
  if (!dojoInstructorName) return null;
  const target = normalizeName(dojoInstructorName);
  if (!target) return null;

  // 1. exact match after stripping honorifics
  let match = instructorIdDocs.find((i) => normalizeName(i.name) === target);
  if (match) return match.instructorId;

  // 2. containment match, either direction (handles partial/extra names)
  match = instructorIdDocs.find((i) => {
    const n = normalizeName(i.name);
    return n && (target.includes(n) || n.includes(target));
  });
  return match ? match.instructorId : null;
}

module.exports = { resolveInstructorCode, normalizeName };
