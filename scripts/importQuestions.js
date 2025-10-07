// scripts/importQuestions.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const mongoose = require("mongoose");
const Question = require("../model/questionModel"); // keep your model path

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://localhost:27017/yourdb";
const QUESTIONS_JSON_PATH = path.join(__dirname, "..", "data", "questions.json");

async function loadQuestions() {
  if (!fs.existsSync(QUESTIONS_JSON_PATH)) {
    throw new Error("questions.json not found at: " + QUESTIONS_JSON_PATH);
  }
  const raw = fs.readFileSync(QUESTIONS_JSON_PATH, "utf8");
  const arr = JSON.parse(raw);
  if (!Array.isArray(arr)) throw new Error("questions.json must be an array");
  return arr;
}

async function main() {
  await mongoose.connect(MONGODB_URI);

  try {
    const raw = await loadQuestions();

    // Normalize incoming items (trim strings)
    const candidates = raw
      .map(q => ({
        question: String(q.question || "").trim(),
        options: Array.isArray(q.options) ? q.options.map(o => String(o).trim()) : [],
        answer: Number(q.answer),
      }))
      .filter(q => q.question && q.options.length >= 2 && Number.isFinite(q.answer) && q.answer >= 0 && q.answer < q.options.length);

    if (candidates.length === 0) {
      console.log("No valid questions found in questions.json");
      return;
    }

    // Skip exact duplicates by question text
    const texts = candidates.map(c => c.question);
    const existing = await Question.find({ question: { $in: texts } }).select("question").lean();
    const existingSet = new Set(existing.map(e => e.question));

    // Find current max questionID
    const maxDoc = await Question.findOne().sort({ questionID: -1 }).select("questionID").lean();
    let nextId = (maxDoc && typeof maxDoc.questionID === "number") ? maxDoc.questionID + 1 : 1;

    const toInsert = [];
    const skipped = [];

    for (const c of candidates) {
      if (existingSet.has(c.question)) {
        skipped.push({ reason: "already_exists", question: c.question });
        continue;
      }
      toInsert.push({
        questionID: nextId++,
        question: c.question,
        options: c.options,
        answer: c.answer,
      });
    }

    if (toInsert.length === 0) {
      console.log("No new questions to insert. Skipped:", skipped.length);
      if (skipped.length) console.table(skipped.slice(0, 10));
      return;
    }

    const inserted = await Question.insertMany(toInsert, { ordered: false });
    console.log(`Inserted ${inserted.length} questions. Skipped: ${skipped.length}`);
    if (skipped.length) console.table(skipped.slice(0, 10));
  } finally {
    await mongoose.disconnect();
  }
}

main()
  .then(() => {
    console.log("Done.");
    process.exit(0);
  })
  .catch(err => {
    console.error("Error:", err);
    process.exit(1);
  });
