const InstructorModel = require("../model/instructorModel");
const InstructorIDModel = require("../model/instructorIDModel");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../util/sendEmail");
const { blogOtpEmailTemplate } = require("../util/emailTemplate");

// Temporary in-memory OTP store
const otpStore = new Map();

// Generate random 10-digit alphanumeric Instructor ID
const generateInstructorId = () => {
  return crypto.randomBytes(5).toString("hex").toUpperCase(); // 10 chars
};

// Admin creates new Instructor ID
exports.generateInstructorId = async (req, res) => {
  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });

    const instructorId = generateInstructorId();
    const instructor = await InstructorIDModel.create({
      name,
      instructorId,
    });

    return res.status(201).json(instructor);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get All Instructor
exports.getAllInstructors = async (req, res) => {
  try {
    const instructors = await InstructorIDModel.find({ isDeleted: false });
    return res.json({ instructors });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin deletes instructor
exports.softDeleteInstructor = async (req, res) => {
  try {
    const { instructorid } = req.params;
    const instructorID = await InstructorIDModel.findOneAndUpdate(
      { instructorId: instructorid },
      { isDeleted: true },
      { new: true }
    );

    const instructor = await InstructorModel.findOneAndUpdate(
      { instructorId: instructorid },
      { isDeleted: true },
      { new: true }
    );

    if (!instructorID && !instructor)
      return res.status(404).json({ message: "Instructor not found" });
    return res.json({ message: "Instructor soft deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin deletes instructor
exports.permaDeleteInstructor = async (req, res) => {
  try {
    const { instructorid } = req.params;
    const deletedID = await InstructorIDModel.findOneAndDelete({
      instructorId: instructorid,
    });
    const deleted = await InstructorModel.findOneAndDelete({
      instructorId: instructorid,
    });

    if (!deletedID && !deleted)
      return res.status(404).json({ message: "Instructor not found" });
    return res.json({ message: "Instructor deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------------------

// Send OTP (Signup/Login)
exports.sendInstructorOtp = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email required" });

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

    const html = blogOtpEmailTemplate(otp);
    await sendEmail(email, "Verify your email - Shubukan India Exam", html);

    return res.json({ message: "OTP sent to email" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Verify OTP
exports.verifyInstructorOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    const data = otpStore.get(email);

    if (!data) return res.status(400).json({ message: "No OTP sent" });
    if (Date.now() > data.expiresAt)
      return res.status(400).json({ message: "OTP expired" });
    if (data.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    otpStore.delete(email);

    // Issue JWT token
    const token = jwt.sign({ email }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    // Mark instructor verified
    await InstructorModel.findOneAndUpdate({ email }, { isVerified: true });

    return res.json({ message: "Email verified", token });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Signup
exports.signupInstructor = async (req, res) => {
  try {
    const { name, email, mobile, instructorId } = req.body;

    const existing = await InstructorModel.findOne({ email });
    if (existing)
      return res.status(400).json({ message: "Email already registered" });

    const existingID = await InstructorIDModel.findOne({
      instructorId,
      isDeleted: false,
    });
    if (!existingID)
      return res.status(400).json({ message: "Contact your admin to get id" });

    const used = await InstructorModel.findOne({ instructorId });
    if (used)
      return res.status(400).json({ message: "Instructor ID already used" });

    await InstructorModel.create({
      name,
      email,
      mobile,
      instructorId,
      isVerified: false,
    });

    return res
      .status(201)
      .json({ message: "Instructor registered. Verify OTP." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Login
exports.loginInstructor = async (req, res) => {
  try {
    const { name, email } = req.body;
    const instructor = await InstructorModel.findOne({ email, name });

    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });

    // Require OTP verification
    return res.json({ message: "OTP required for login" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
