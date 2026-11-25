const Exam = require("../model/examModel");
const Question = require("../model/questionModel");

async function questionUsage(ids) {
  const byQuestion = new Map([...new Set(ids.map(String))].map((id) => [id, []]));
  if (!byQuestion.size) return byQuestion;

  const exams = await Exam.find({ questions: { $in: [...byQuestion.keys()] }, isDeleted: false })
    .select("examID examSet questions accessability examDate");
  for (const exam of exams) {
    for (const question of exam.questions) {
      byQuestion.get(String(question))?.push({
        exam: exam._id, examID: exam.examID, examSet: exam.examSet,
        accessability: exam.accessability, examDate: exam.examDate,
      });
    }
  }
  return byQuestion;
}

async function refreshQuestionUsage(ids) {
  // The question-bank response reads current references directly. Cached metadata can be repaired independently.
  try {
    const usage = await questionUsage(ids);
    if (usage.size) {
      await Question.bulkWrite(Array.from(usage, ([_id, usedInExams]) => ({
        updateOne: { filter: { _id }, update: { $set: { usedInExams, used: usedInExams.length > 0 } } },
      })));
    }
  } catch (error) {
    console.error("Could not refresh exam question usage", error.message);
  }
}

module.exports = { questionUsage, refreshQuestionUsage };
