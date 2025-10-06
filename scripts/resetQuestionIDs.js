// scripts/resetQuestionIDs.js
require("dotenv").config();
const mongoose = require("mongoose");
const Question = require("../model/questionModel");
const Counter = require("../model/counterModel");

/**
 * Usage:
 *   node scripts/resetQuestionIDs.js            # reset using existing questionID order (ascending)
 *   node scripts/resetQuestionIDs.js --by-created  # reset using createdAt order (older -> newer)
 *   node scripts/resetQuestionIDs.js --dry-run     # show what would change, don't write
 */

(async () => {
  try {
    const MONGO_URI = process.env.MONGO_URI || process.env.DB_URI;
    if (!MONGO_URI) {
      throw new Error("Set MONGO_URI in .env (e.g. MONGO_URI='mongodb+srv://user:pass@host/db')");
    }

    await mongoose.connect(MONGO_URI, {
      useNewUrlParser: true,
      useUnifiedTopology: true,
    });

    const dryRun = process.argv.includes("--dry-run");
    const byCreated = process.argv.includes("--by-created");

    // Choose stable sort field: default by questionID ascending, fallback to createdAt if missing
    // If you want deterministic ordering when questionID values are equal/missing, add _id tie-breaker.
    const sortField = byCreated ? "createdAt" : "questionID";
    console.log(`Starting resetQuestionIDs (dryRun=${dryRun}, sortField=${sortField})`);

    // create a cursor so we don't load everything into memory
    const cursor = Question.find()
      .sort({ [sortField]: 1, _id: 1 })
      .cursor();

    let seq = 0;
    const bulkOps = [];
    const BATCH_SIZE = 500;
    let changedCount = 0;
    let total = 0;

    for await (const doc of cursor) {
      total++;
      seq++;
      // Only update if value differs (so we minimize writes)
      if (doc.questionID !== seq) {
        changedCount++;
        const msg = `Will set question ${doc._id} : ${doc.questionID} -> ${seq}`;
        if (dryRun) {
          console.log(msg);
        } else {
          bulkOps.push({
            updateOne: {
              filter: { _id: doc._id },
              update: { $set: { questionID: seq } },
            },
          });
        }
      }

      if (!dryRun && bulkOps.length >= BATCH_SIZE) {
        await Question.bulkWrite(bulkOps);
        console.log(`Applied ${bulkOps.length} updates (processed ${total} docs so far)`);
        bulkOps.length = 0;
      }
    }

    if (!dryRun && bulkOps.length) {
      await Question.bulkWrite(bulkOps);
      console.log(`Applied final ${bulkOps.length} updates`);
    }

    console.log(`Processed ${total} questions. ${changedCount} questionIDs changed.`);

    if (!dryRun) {
      // set counter to last seq so new creations continue sequence
      await Counter.findOneAndUpdate(
        { _id: "questionId" },
        { $set: { seq } },
        { upsert: true }
      );
      console.log(`Counter 'questionId' set to ${seq}`);
    } else {
      console.log("Dry run finished. No changes were written.");
    }

    await mongoose.disconnect();
    process.exit(0);
  } catch (err) {
    console.error("Error:", err);
    try { await mongoose.disconnect(); } catch (e) {}
    process.exit(1);
  }
})();
