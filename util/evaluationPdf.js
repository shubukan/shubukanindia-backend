// util/evaluationPdf.js
//
// Generates the downloadable Guardian Evaluation Form PDF from a submitted
// EvaluationForm document. Layout mirrors the sections of the original
// "Guardian Evaluation Marksheet" template (English labels). The guardian's
// signature image (uploaded fresh per submission) is stamped on every page;
// the student's signature (if provided) appears on the final page only.
//
// NOTE: The source template is bilingual (English/Bengali). Reproducing the
// Bengali text requires embedding a Unicode Bengali font (e.g. Noto Sans
// Bengali .ttf) into this project — none is bundled here, so this generator
// currently renders English labels only. Drop a .ttf into /assets/fonts and
// register it below (doc.font(path)) to add Bengali text back in.

const PDFDocument = require("pdfkit");

const MARGIN = 50;

async function fetchImageBuffer(url) {
  if (!url) return null;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  } catch (err) {
    console.error("evaluationPdf: failed to fetch image", url, err.message);
    return null;
  }
}

const yn = (v) => (v === true ? "Yes" : v === false ? "No" : "-");
const val = (v, fallback = "-") => (v === null || v === undefined || v === "" ? fallback : String(v));
const timeVal = (entry) => {
  if (!entry || !entry.mode) return "-";
  if (entry.mode === "beforeExam") return "Only before exam";
  const h = entry.hour ?? "-";
  const m = entry.minute ?? "-";
  return `${h} hr ${m} min (daily)`;
};

function drawFooterSignature(doc, guardianSigBuffer, pageLabel) {
  const bottomY = doc.page.height - MARGIN - 60;
  doc.fontSize(9).fillColor("#666");
  if (guardianSigBuffer) {
    try {
      doc.image(guardianSigBuffer, doc.page.width - MARGIN - 140, bottomY - 40, {
        fit: [140, 40],
      });
    } catch (e) {
      // ignore malformed image
    }
  }
  doc
    .moveTo(doc.page.width - MARGIN - 160, bottomY)
    .lineTo(doc.page.width - MARGIN, bottomY)
    .strokeColor("#999")
    .stroke();
  doc.text("Signature of Guardian", doc.page.width - MARGIN - 160, bottomY + 4, {
    width: 160,
    align: "center",
  });
  if (pageLabel) {
    doc.fontSize(8).fillColor("#999").text(pageLabel, MARGIN, doc.page.height - MARGIN - 15);
  }
  doc.fillColor("#000");
}

function sectionTitle(doc, text) {
  doc.moveDown(0.8);
  doc.fontSize(13).fillColor("#B23A48").text(text, { underline: false });
  doc.moveDown(0.3);
  doc
    .moveTo(MARGIN, doc.y)
    .lineTo(doc.page.width - MARGIN, doc.y)
    .strokeColor("#ddd")
    .stroke();
  doc.moveDown(0.4);
  doc.fillColor("#000").fontSize(10);
}

function field(doc, label, value) {
  doc.fontSize(10).fillColor("#444").text(label, { continued: true });
  doc.fillColor("#000").text(`  ${val(value)}`);
}

function generateEvaluationFormPdf(form) {
  return new Promise(async (resolve, reject) => {
    try {
      const guardianSig = await fetchImageBuffer(form.guardianSignatureUrl);
      const studentSig = await fetchImageBuffer(form.studentSignatureUrl);

      const doc = new PDFDocument({ size: "A4", margin: MARGIN, bufferPages: true });
      const chunks = [];
      doc.on("data", (c) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      // ---- PAGE 1: Student basics + practice habits ----
      doc.fontSize(20).fillColor("#3C3A36").text("Guardian Evaluation Marksheet", { align: "center" });
      doc.moveDown(0.2);
      doc.fontSize(10).fillColor("#666").text("Shubukan India  |  www.shubukanindia.org", { align: "center" });
      doc.moveDown(1);

      sectionTitle(doc, "For Students");
      field(doc, "Student Name:", form.student.name);
      field(doc, "Age:", form.student.age);
      field(doc, "Date of Birth:", form.student.dob ? new Date(form.student.dob).toLocaleDateString() : "-");
      field(doc, "Current Rank:", form.student.currentRank);
      field(doc, "Instructor:", form.student.instructorName);
      field(doc, "Dojo:", form.student.dojoName);
      doc.moveDown(0.3);
      field(doc, "1. Class:", form.student.classOf);
      field(doc, "   Board:", form.student.board);
      field(doc, "2. Study Time (School + Self-study + Tuition):", form.student.studyTime);
      field(doc, "3. Karate Practice Time (self-study):", timeVal(form.student.karatePractice));
      field(doc, "4. Karate Notes / Theory Study:", timeVal(form.student.karateNotes));
      field(doc, "5. Other Arts Practiced:", form.student.otherArtsNames);
      field(doc, "   Practice Time:", timeVal(form.student.otherArtsPractice));
      field(doc, "6. Physical Exercise Time:", form.student.physicalExerciseTime);
      field(
        doc,
        "7. Uses screen device:",
        `${yn(form.student.screenDevice?.used)}${
          form.student.screenDevice?.used
            ? ` — ${
                form.student.screenDevice.mode === "onlyIfNecessary"
                  ? "only if necessary"
                  : `${val(form.student.screenDevice.hour)} hr ${val(form.student.screenDevice.minute)} min`
              }`
            : ""
        }`
      );
      drawFooterSignature(doc, guardianSig, "Page 1");

      // ---- PAGE 2: Sleep + Food ----
      doc.addPage();
      sectionTitle(doc, "Sleep & Food");
      field(doc, "8. Total Sleep Duration:", form.student.sleep?.totalDuration);
      field(doc, "   Bed Time:", form.student.sleep?.bedTime);
      field(doc, "   Afternoon Sleep:", form.student.sleep?.afternoonSleep);
      doc.moveDown(0.3);
      field(doc, "9. Food:", form.student.food?.type === "veg" ? "Vegetarian" : form.student.food?.type === "nonveg" ? "Non-vegetarian" : "-");
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#444").text("10. Approx. time of food intake:");
      field(doc, "   Breakfast:", form.student.food?.times?.breakfast);
      field(doc, "   Lunch:", form.student.food?.times?.lunch);
      field(doc, "   Afternoon Snacks:", form.student.food?.times?.afternoonSnacks);
      field(doc, "   Dinner:", form.student.food?.times?.dinner);
      const tiffins = form.student.food?.otherTiffinTimes || [];
      if (tiffins.length) {
        doc.fontSize(10).fillColor("#444").text("11. Other Tiffin Times:");
        tiffins.forEach((t) => field(doc, `   No. ${t.no}:`, t.time));
      }
      if (form.student.food?.remarks) {
        field(doc, "   Remarks:", form.student.food.remarks);
      }
      drawFooterSignature(doc, guardianSig, "Page 2");

      // ---- PAGE 3: Physical + hobby + remarks ----
      doc.addPage();
      sectionTitle(doc, "Physical & Personal");
      field(doc, "12. Height (cm):", form.student.height);
      field(doc, "    Weight (kg):", form.student.weight);
      field(doc, "13. Sport Performance:", form.student.sportPerformance);
      field(doc, "14. Hobby:", form.student.hobby);
      if (form.student.hobbyRemarks) field(doc, "    Remarks:", form.student.hobbyRemarks);
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#444").text("15. Remarks on karate learning:");
      doc.fillColor("#000").text(val(form.student.karateLearningRemarks), { width: 480 });
      drawFooterSignature(doc, guardianSig, "Page 3");

      // ---- PAGE 4: Teacher evaluation ----
      doc.addPage();
      sectionTitle(doc, "For the Teacher");
      field(doc, "1. Punctual:", yn(form.teacher?.punctual));
      field(doc, "2. Gives attention to each student:", yn(form.teacher?.attentionToEachStudent));
      field(doc, "3. Hard working in teaching:", yn(form.teacher?.hardWorking));
      field(doc, "4. Trains well in:", (form.teacher?.goodTrainingAreas || []).join(", ") || "-");
      field(doc, "5. Honest in teaching:", yn(form.teacher?.honest));
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#444").text("6. Remarks about teacher:");
      doc.fillColor("#000").text(val(form.teacher?.remarks), { width: 480 });
      drawFooterSignature(doc, guardianSig, "Page 4");

      // ---- PAGE 5: Training preferences ----
      doc.addPage();
      sectionTitle(doc, "About Training");
      field(doc, "1. Training needed:", (form.training?.trainingNeeded || []).join(", ") || "-");
      doc.moveDown(0.3);
      field(doc, "2i. Studied sport karate before:", yn(form.training?.studiedSportKarateBefore?.answer));
      if (form.training?.studiedSportKarateBefore?.answer) {
        field(doc, "    Style:", form.training.studiedSportKarateBefore.styleName);
        field(doc, "    Coach:", form.training.studiedSportKarateBefore.coachName);
        field(doc, "    Years:", form.training.studiedSportKarateBefore.yearsLearnt);
      }
      field(doc, "2ii. New in Traditional Full Contact Karate:", yn(form.training?.newInTraditionalFullContact));
      field(doc, "2iii. Practiced other martial arts:", yn(form.training?.otherMartialArts?.answer));
      if (form.training?.otherMartialArts?.answer) {
        field(doc, "    Style:", form.training.otherMartialArts.styleName);
        field(doc, "    Coach:", form.training.otherMartialArts.coachName);
        field(doc, "    Years:", form.training.otherMartialArts.yearsLearnt);
      }
      drawFooterSignature(doc, guardianSig, "Page 5");

      // ---- PAGE 6: Preferences + final signatures ----
      doc.addPage();
      sectionTitle(doc, "Training Preferences (continued)");
      field(doc, "3. Prefers scientific, effective lessons:", yn(form.training?.preferScientificEffectiveLesson));
      if (form.training?.preferScientificEffectiveLesson === false) {
        field(doc, "   Suggestion:", form.training.preferScientificSuggestion);
      }
      field(doc, "4. Wants fitness-only programme:", yn(form.training?.preferOnlyFitness));
      if (form.training?.preferOnlyFitness === true) {
        field(doc, "   Suggestion:", form.training.preferOnlyFitnessSuggestion);
      }
      field(doc, "5. Only needs belt & certificate:", yn(form.training?.onlyNeedBeltCertificate));
      if (form.training?.onlyNeedBeltCertificate === false) {
        field(doc, "   Suggestion:", form.training.onlyNeedBeltCertificateSuggestion);
      }
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor("#444").text("6. Remarks and suggestion:");
      doc.fillColor("#000").text(val(form.training?.remarksAndSuggestion), { width: 480 });

      doc.moveDown(2);
      const sigY = doc.y;
      if (studentSig) {
        try {
          doc.image(studentSig, MARGIN, sigY, { fit: [140, 40] });
        } catch (e) {}
      }
      doc
        .moveTo(MARGIN, sigY + 45)
        .lineTo(MARGIN + 160, sigY + 45)
        .strokeColor("#999")
        .stroke();
      doc.fontSize(9).fillColor("#666").text("Signature of Student", MARGIN, sigY + 48, { width: 160, align: "center" });

      doc.fontSize(9).fillColor("#666").text(
        `Submitted on: ${form.submittedAt ? new Date(form.submittedAt).toLocaleString() : "-"}`,
        MARGIN,
        sigY + 70
      );

      drawFooterSignature(doc, guardianSig, "Page 6");

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}

module.exports = { generateEvaluationFormPdf };
