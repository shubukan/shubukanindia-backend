// scripts/fixInstructorIds.js
/**
 * Usage:
 *  DRY RUN (no writes):    node scripts/fixInstructorIds.js --mongo "mongodb://..." 
 *  APPLY CHANGES:          node scripts/fixInstructorIds.js --mongo "mongodb://..." --apply
 *  Also you can set MONGO_URI env var instead of --mongo.
 *
 * Notes:
 *  - Default behavior is dry-run. Use --apply to persist changes.
 *  - By default when Instructor can't be found we only log. Use --set-null (optional) to set student.instructorId = null for missing matches.
 *  - Back up your DB before running.
 */

const mongoose = require("mongoose");
const path = require("path");

// tweak these requires if your model paths differ
const Instructor = require(path.join(__dirname, "..", "model", "instructorModel"));
const InstructorID = require(path.join(__dirname, "..", "model", "instructorIDModel"));
const Student = require(path.join(__dirname, "..", "model", "studentModel"));

const argv = process.argv.slice(2);
const argMap = {};
argv.forEach((a, i) => {
  if (a.startsWith("--")) {
    const key = a.replace(/^--/, "");
    const val = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[i + 1] : true;
    argMap[key] = val;
  }
});

const MONGO_URI = process.env.MONGO_URI || argMap.mongo || "mongodb://localhost:27017/your_db_name";
const APPLY = !!argMap.apply;
const SET_NULL_IF_MISSING = !!argMap["set-null"];
const BATCH_SIZE = parseInt(argMap["batch-size"] || "500", 10);

async function main() {
  console.log("Connecting to:", MONGO_URI);
  await mongoose.connect(MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true });

  try {
    // Find students that have an instructorId set (non-null, non-empty)
    const filter = { instructorId: { $exists: true, $ne: null, $ne: "" } };
    const totalStudents = await Student.countDocuments(filter);
    console.log(`Students with instructorId present: ${totalStudents}`);

    const cursor = Student.find(filter).cursor();

    let processed = 0;
    let skippedAlreadyCorrect = 0;
    let updated = 0;
    let notFound = 0;
    let noInstructorIDDoc = 0;

    // iterate in batches
    for (let student = await cursor.next(); student != null; student = await cursor.next()) {
      processed++;
      const currInstructorRef = student.instructorId;

      // skip falsy (shouldn't happen because of filter)
      if (!currInstructorRef) continue;

      // helper to log short
      const logPrefix = `[${processed}/${totalStudents}] student:${student._id.toString()}`;

      // 1) If the current value is a valid ObjectId, check if it already points to Instructor model _id
      let resolvedInstructor = null;

      if (mongoose.Types.ObjectId.isValid(currInstructorRef)) {
        // try as Instructor._id
        const maybeInstructorById = await Instructor.findById(currInstructorRef).select("_id").lean();
        if (maybeInstructorById) {
          console.log(`${logPrefix} -> already correct (points to Instructor _id). skipping.`);
          skippedAlreadyCorrect++;
          continue;
        }

        // try treating it as InstructorID._id (the wrong id currently stored)
        const maybeInstructorID = await InstructorID.findById(currInstructorRef).select("instructorId").lean();
        if (maybeInstructorID && maybeInstructorID.instructorId) {
          // now find Instructor by the shared instructorId string
          const instructorDoc = await Instructor.findOne({ instructorId: maybeInstructorID.instructorId }).select("_id").lean();
          if (instructorDoc) resolvedInstructor = instructorDoc;
          else {
            console.warn(`${logPrefix} -> no Instructor found for instructorId "${maybeInstructorID.instructorId}" (from InstructorID doc).`);
            notFound++;
          }
        } else {
          // maybe the stored value is a string custom instructorId (but happens to be 24 hex)
          const maybeByCustom = await Instructor.findOne({ instructorId: currInstructorRef }).select("_id").lean();
          if (maybeByCustom) resolvedInstructor = maybeByCustom;
          else {
            console.warn(`${logPrefix} -> instructorId value looks like ObjectId but not found in Instructor or InstructorID collections.`);
            noInstructorIDDoc++;
          }
        }
      } else {
        // 2) current value is not a valid ObjectId: treat as custom instructorId string
        const instructorDoc = await Instructor.findOne({ instructorId: currInstructorRef }).select("_id").lean();
        if (instructorDoc) resolvedInstructor = instructorDoc;
        else {
          console.warn(`${logPrefix} -> no Instructor found matching instructorId "${currInstructorRef}".`);
          notFound++;
        }
      }

      if (resolvedInstructor) {
        // update student.instructorId to the Instructor._id (store as string)
        const newVal = resolvedInstructor._id.toString();
        console.log(`${logPrefix} -> will set instructorId => ${newVal}`);
        if (APPLY) {
          await Student.updateOne({ _id: student._id }, { $set: { instructorId: newVal } });
          updated++;
        }
      } else {
        // resolvedInstructor not found
        if (SET_NULL_IF_MISSING && APPLY) {
          await Student.updateOne({ _id: student._id }, { $unset: { instructorId: "" } });
          console.log(`${logPrefix} -> instructor not resolved; unset instructorId field (set-null).`);
        }
      }

      // Basic batching message
      if (processed % BATCH_SIZE === 0) {
        console.log(`Processed ${processed} / ${totalStudents} students...`);
      }
    }

    console.log("----- Summary -----");
    console.log(`Processed: ${processed}`);
    console.log(`Skipped (already correct): ${skippedAlreadyCorrect}`);
    console.log(`Updated: ${updated}`);
    console.log(`No matching Instructor found (by instructorId): ${notFound}`);
    console.log(`No InstructorID doc for current instructorId (24hex but not found): ${noInstructorIDDoc}`);
    console.log("Dry run? ", APPLY ? "NO — changes applied." : "YES — no changes were written. Use --apply to persist.");

  } catch (err) {
    console.error("Fatal error:", err);
  } finally {
    await mongoose.disconnect();
    console.log("Disconnected.");
  }
}

main();
