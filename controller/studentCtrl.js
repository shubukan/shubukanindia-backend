// controller/studentCtrl.js
const Student = require("../model/studentModel");
const Instructor = require("../model/instructorModel");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../util/sendEmail");
const { instructorOtpEmailTemplate } = require("../util/emailTemplate");
const { studentOtpEmailTemplate } = require("../util/emailTemplate");
// temporary OTP store
const otpStore = new Map();

// Send OTP helper
const sendOtp = async (email, subject) => {
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

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

    // const existing = await Student.findOne({ email });
    // if (existing)
    //   return res.status(400).json({ message: "Email already registered" });

    const student = await Student.create({
      name,
      email,
      mobile,
      presentKyu,
      lastCertificateNum,
      instructorName,
      instructorId,
      isVerified: false,
    });

    await sendOtp(email, "Verify your email - Shubukan India Exam (Student)");

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
    const data = otpStore.get(email);

    if (!data) return res.status(400).json({ message: "No OTP sent" });
    if (Date.now() > data.expiresAt)
      return res.status(400).json({ message: "OTP expired" });
    if (data.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    const student = await Student.findOne({ email, isDeleted: false });
    if (!student) return res.status(404).json({ message: "Student not found" });

    otpStore.delete(email);
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
    const student = await Student.findOne({ email, isDeleted: false });

    if (!student) return res.status(404).json({ message: "Student not found" });
    if (!student.isVerified)
      return res
        .status(400)
        .json({ message: "Student not verified. Please signup first." });

    await sendOtp(email, "Login OTP - Shubukan India Exam (Student)");
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

    const student = await Student.findOne({ email, isDeleted: false });
    if (!student) return res.status(404).json({ message: "Student not found" });

    if (type === "signup" && student.isVerified)
      return res
        .status(400)
        .json({ message: "Already verified, please login instead" });

    if (type === "login" && !student.isVerified)
      return res
        .status(400)
        .json({ message: "Not verified yet, please signup first" });

    await sendOtp(email, `OTP - Shubukan India Exam (Student - ${type})`);
    return res.json({ message: "OTP resent to email" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Profile
exports.getStudentProfile = async (req, res) => {
  try {
    const student = await Student.findById(req.student.id).select(
      "-__v -createdAt -updatedAt"
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

    const updated = await Student.findByIdAndUpdate(
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
    ).select("-__v -createdAt -updatedAt");

    if (!updated) return res.status(404).json({ message: "Student not found" });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor fetch their students
exports.getMyStudents = async (req, res) => {
  try {
    const students = await Student.find({
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
    const student = await Student.findOneAndUpdate(
      { _id: sid, instructorId: req.instructor.instructorId, isDeleted: false },
      { isDeleted: true },
      { new: true }
    );

    if (!student) return res.status(404).json({ message: "Student not found or not under you" });
    return res.json({ message: "Student soft deleted by instructor" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Instructor: search only among their own students
exports.searchMyStudentsByName = async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ message: "Name query required" });

    const students = await Student.find({
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

    const students = await Student.find({
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
    const students = await Student.find({ isDeleted: false });
    return res.json(students);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: fetch all students under instructor
exports.getStudentsByInstructor = async (req, res) => {
  try {
    const { iid } = req.params;
    const students = await Student.find({
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
    const instructors = await Instructor.find({ isDeleted: false }).select(
      "instructorId"
    );
    const instructorIds = instructors.map((i) => i.instructorId);

    const students = await Student.find({
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
    const student = await Student.findByIdAndUpdate(
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