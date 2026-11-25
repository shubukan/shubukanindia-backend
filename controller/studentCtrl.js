// controller/studentCtrl.js
const StudentModel = require("../model/studentModel");
const InstructorModel = require("../model/instructorModel");
const InstructorRegistry = require("../model/instructorIDModel");
const { studentOtpEmailTemplate } = require("../util/emailTemplate");
const { examEmailCode, examAccountProjection, normalizeEmail, validEmail, byEmail, escapeRegex } = require("../util/examEmailCode");
const { resolveExamInstructor, instructorStudentsFilter } = require("../util/examInstructors");

const codes = examEmailCode(StudentModel, "student", studentOtpEmailTemplate);
exports.loginStudent = codes.request;
exports.resendStudentOtp = codes.request;
exports.verifyStudentOtp = codes.verify;

exports.signupStudent = async (req, res) => {
  try {
    const { name, mobile, presentKyu, lastCertificateNum, instructorName, instructorId } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);
    if (typeof name !== "string" || !name.trim() || !validEmail(email)) {
      return res.status(400).json({ message: "Enter your name and a valid email." });
    }
    if (await StudentModel.exists({ email: byEmail(email) })) {
      return res.status(409).json({ message: "This email is already registered. Log in to request a code." });
    }
    const instructor = await resolveExamInstructor(instructorId);
    if (instructorId && !instructor) return res.status(400).json({ message: "Select an instructor from the list." });
    await StudentModel.create({
      name, email: email.toLowerCase(), mobile, presentKyu, lastCertificateNum,
      instructorName: instructor?.name || instructorName,
      instructorId: instructor?.registryId || "",
      instructorApproved: false,
      isVerified: false,
    });
    return await codes.issue(email, res, 201);
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 500).json({ message: error.code === 11000
      ? "This email is already registered. Log in to request a code."
      : "Could not create your student account." });
  }
};


// Profile
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await StudentModel.findById(req.student.id).select(
      "-__v -createdAt -updatedAt -otp -otpExpiresAt",
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    return res.json(student);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateStudentProfile = async (req, res) => {
  try {
    const {
      name,
      mobile,
      presentKyu,
      lastCertificateNum,
      instructorName,
      instructorId,
    } = req.body;

    const instructor = await resolveExamInstructor(instructorId);
    if (instructorId && !instructor) return res.status(400).json({ message: "Select an instructor from the list." });
    const sameInstructor = instructor?.aliases.includes(req.student.instructorId);
    const updated = await StudentModel.findByIdAndUpdate(
      req.student.id,
      {
        name,
        mobile,
        presentKyu,
        lastCertificateNum,
        ...(instructorId !== undefined && {
          instructorName: instructor?.name || instructorName,
          instructorId: instructor?.registryId || "",
          ...(!sameInstructor && { instructorApproved: false }),
        }),
      },
      { new: true, runValidators: true },
    ).select("-__v -createdAt -updatedAt -otp -otpExpiresAt");

    if (!updated) return res.status(404).json({ message: "Student not found" });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor fetch their students
exports.getMyStudents = async (req, res) => {
  try {
    const instructor = await resolveExamInstructor(req.instructor._id);
    const students = await StudentModel.find({
      ...instructorStudentsFilter(instructor),
      isDeleted: false,
    }).select(examAccountProjection);
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor delete only their student
exports.deleteMyStudent = async (req, res) => {
  try {
    const { sid } = req.params;
    const instructor = await resolveExamInstructor(req.instructor._id);
    const student = await StudentModel.findOneAndUpdate(
      { _id: sid, ...instructorStudentsFilter(instructor), isDeleted: false },
      { isDeleted: true },
      { new: true },
    );

    if (!student)
      return res
        .status(404)
        .json({ message: "Student not found or not under you" });
    return res.json({ message: "Student soft deleted by instructor" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor: search only among their own students
exports.searchMyStudents = async (req, res) => {
  try {
    const name = typeof req.query.name === "string" ? req.query.name.trim() : "";
    if (!name) return res.status(400).json({ message: "Name query required" });

    const instructor = await resolveExamInstructor(req.instructor._id);
    const students = await StudentModel.find({
      ...instructorStudentsFilter(instructor),
      isDeleted: false,
      name: { $regex: escapeRegex(name), $options: "i" },
    }).select(examAccountProjection).limit(30);

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: search all students
exports.searchAllStudentsByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: "Name query required" });

    const students = await StudentModel.find({
      isDeleted: false,
      name: { $regex: escapeRegex(name), $options: "i" },
    }).select(examAccountProjection);

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await StudentModel.find({ isDeleted: false }).select(examAccountProjection);
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all students under instructor
exports.getStudentsByInstructor = async (req, res) => {
  try {
    const { iid } = req.params;
    const instructor = await resolveExamInstructor(iid);
    const students = await StudentModel.find({
      ...instructorStudentsFilter(instructor),
      isDeleted: false,
    }).select(examAccountProjection);
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all outside students
exports.getOutsideStudents = async (req, res) => {
  try {
    const [registry, instructors] = await Promise.all([
      InstructorRegistry.find({ isDeleted: false }).select("instructorId"),
      InstructorModel.find({ isDeleted: false }).select("instructorId"),
    ]);
    const codes = new Set(registry.map(({ instructorId }) => instructorId));
    const instructorIds = [
      ...registry.flatMap((record) => [String(record._id), record.instructorId]),
      ...instructors.filter((record) => codes.has(record.instructorId)).map((record) => String(record._id)),
    ];

    const students = await StudentModel.find({
      $or: [
        { instructorApproved: false },
        { instructorId: { $nin: instructorIds } },
      ],
      isDeleted: false,
    }).select(examAccountProjection);

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Delete by admin
exports.deleteStudent = async (req, res) => {
  try {
    const { sid } = req.params;
    const student = await StudentModel.findByIdAndUpdate(
      sid,
      { isDeleted: true },
      { new: true },
    );
    if (!student) return res.status(404).json({ message: "Student not found" });
    return res.json({ message: "Student soft deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: update student (admin can change name, email, mobile, presentKyu, lastCertificateNum, isVerified, and instructor fields)
exports.adminUpdateStudent = async (req, res) => {
  try {
    const { sid } = req.params;
    // Only allow these fields to be updated by admin
    const {
      name,
      email,
      mobile,
      presentKyu,
      lastCertificateNum,
      isVerified,
      instructorName,
      instructorIdentity,
      instructorId,
    } = req.body;

    // Build update object only with provided fields
    const updateObj = {};
    if (typeof name !== "undefined") updateObj.name = name;
    if (typeof email !== "undefined") updateObj.email = email;
    if (typeof mobile !== "undefined") updateObj.mobile = mobile;
    if (typeof presentKyu !== "undefined") updateObj.presentKyu = presentKyu;
    if (typeof lastCertificateNum !== "undefined")
      updateObj.lastCertificateNum = lastCertificateNum;
    if (typeof isVerified !== "undefined") updateObj.isVerified = isVerified;
    if (typeof instructorName !== "undefined")
      updateObj.instructorName = instructorName;
    if (typeof instructorIdentity !== "undefined")
      updateObj.instructorIdentity = instructorIdentity;
    if (typeof instructorId !== "undefined") {
      const instructor = await resolveExamInstructor(instructorId);
      if (instructorId && !instructor) return res.status(400).json({ message: "Select a valid instructor." });
      updateObj.instructorId = instructor?.registryId || "";
      updateObj.instructorApproved = Boolean(instructor);
      if (instructor) updateObj.instructorName = instructor.name;
    }

    const updated = await StudentModel.findByIdAndUpdate(sid, updateObj, {
      new: true,
      runValidators: true,
    }).select("-__v -otp -otpExpiresAt");

    if (!updated) return res.status(404).json({ message: "Student not found" });

    return res.json({ message: "Student updated", student: updated });
  } catch (error) {
    // If unique email constraint error
    if (error.code === 11000 && error.keyPattern && error.keyPattern.email) {
      return res.status(400).json({ message: "Email already registered" });
    }
    return res.status(500).json({ message: error.message });
  }
};
