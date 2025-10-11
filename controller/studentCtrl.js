// controller/studentCtrl.js
const StudentModel = require("../model/studentModel");
const InstructorModel = require("../model/instructorModel");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../util/sendEmail");
const {
  instructorOtpEmailTemplate,
  studentOtpEmailTemplate,
} = require("../util/emailTemplate");

// Send OTP helper - persists OTP to student document
const sendOtp = async (email, subject) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

  // update student document with otp fields
  const student = await StudentModel.findOneAndUpdate(
    { email },
    { otp, otpExpiresAt },
    { new: true }
  );

  // If student not found here, caller should handle (signup flow creates student first)
  await sendEmail(email, subject, studentOtpEmailTemplate(otp));
};

// Signup
exports.signupStudent = async (req, res) => {
  try {
    const {
      name,
      email,
      mobile,
      presentKyu,
      lastCertificateNum,
      instructorName,
      instructorId,
    } = req.body;

    const existing = await StudentModel.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const student = await StudentModel.create({
      name,
      email,
      mobile,
      presentKyu,
      lastCertificateNum,
      instructorName,
      instructorId,
      isVerified: false,
    });

    // send OTP and persist on student document
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    student.otp = otp;
    student.otpExpiresAt = otpExpiresAt;
    await student.save();

    await sendEmail(
      email,
      "Verify your email - Shubukan India Exam (Student)",
      studentOtpEmailTemplate(otp)
    );

    return res
      .status(201)
      .json({ message: "Student registered. OTP sent to email." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Verify OTP
exports.verifyStudentOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp)
      return res.status(400).json({ message: "Email and OTP required" });

    const student = await StudentModel.findOne({ email, isDeleted: false });
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (!student.otp || !student.otpExpiresAt)
      return res.status(400).json({ message: "No OTP sent" });

    if (Date.now() > new Date(student.otpExpiresAt).getTime())
      return res.status(400).json({ message: "OTP expired" });

    if (student.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    // Clear OTP and mark verified
    student.otp = undefined;
    student.otpExpiresAt = undefined;
    student.isVerified = true;
    await student.save();

    const token = jwt.sign({ id: student._id, email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    return res.json({ message: "OTP verified", token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Login
exports.loginStudent = async (req, res) => {
  try {
    const { email } = req.body;
    const student = await StudentModel.findOne({ email, isDeleted: false });

    if (!student) return res.status(404).json({ message: "Student not found" });

    // generate OTP and persist
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    student.otp = otp;
    student.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await student.save();

    await sendEmail(
      email,
      "Login OTP - Shubukan India Exam (Student)",
      studentOtpEmailTemplate(otp)
    );
    return res.json({ message: "OTP sent to email for login" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Resend OTP
exports.resendStudentOtp = async (req, res) => {
  try {
    const { email, type } = req.body; // type = signup | login
    if (!email || !type)
      return res.status(400).json({ message: "Email and type required" });

    const student = await StudentModel.findOne({ email, isDeleted: false });
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (type === "signup" && student.isVerified)
      return res
        .status(400)
        .json({ message: "Already verified, please login instead" });

    if (type === "login" && !student.isVerified)
      return res
        .status(400)
        .json({ message: "Not verified yet, please signup first" });

    // generate OTP and persist
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    student.otp = otp;
    student.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await student.save();

    await sendEmail(
      email,
      `OTP - Shubukan India Exam (Student - ${type})`,
      studentOtpEmailTemplate(otp)
    );
    return res.json({ message: "OTP resent to email" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Profile
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await StudentModel.findById(req.student.id).select(
      "-__v -createdAt -updatedAt -otp -otpExpiresAt"
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

    const updated = await StudentModel.findByIdAndUpdate(
      req.student.id,
      {
        name,
        mobile,
        presentKyu,
        lastCertificateNum,
        instructorName,
        instructorId,
      },
      { new: true, runValidators: true }
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
    const students = await StudentModel.find({
      instructorId: req.instructor.instructorId,
      isDeleted: false,
    });
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor delete only their student
exports.deleteMyStudent = async (req, res) => {
  try {
    const { sid } = req.params;
    const student = await StudentModel.findOneAndUpdate(
      { _id: sid, instructorId: req.instructor.instructorId, isDeleted: false },
      { isDeleted: true },
      { new: true }
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
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: "Name query required" });

    const students = await StudentModel.find({
      instructorId: req.instructor.instructorId,
      isDeleted: false,
      name: { $regex: name, $options: "i" }, // case-insensitive search
    });

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
      name: { $regex: name, $options: "i" },
    });

    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all students
exports.getAllStudents = async (req, res) => {
  try {
    const students = await StudentModel.find({ isDeleted: false });
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all students under instructor
exports.getStudentsByInstructor = async (req, res) => {
  try {
    const { iid } = req.params;
    const students = await StudentModel.find({
      instructorId: iid,
      isDeleted: false,
    });
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all outside students
exports.getOutsideStudents = async (req, res) => {
  try {
    const instructors = await InstructorModel.find({ isDeleted: false }).select(
      "instructorId"
    );
    const instructorIds = instructors.map((i) => i.instructorId);

    const students = await StudentModel.find({
      $or: [
        { instructorId: { $exists: false } },
        { instructorId: { $nin: instructorIds } },
      ],
      isDeleted: false,
    });

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
      { new: true }
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
    if (typeof instructorId !== "undefined") updateObj.instructorId = instructorId;

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
