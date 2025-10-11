// controller/instructorCtrl.js
const InstructorModel = require("../model/instructorModel");
const InstructorIDModel = require("../model/instructorIDModel");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("../util/sendEmail");
const { instructorOtpEmailTemplate } = require("../util/emailTemplate");

// Generate random 10-char alphanumeric Instructor ID
const generateId = () => {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let id = "";
  for (let i = 0; i < 10; i++) {
    const randomIndex = crypto.randomInt(0, chars.length);
    id += chars[randomIndex];
  }
  return id;
};

// Admin creates new Instructor ID
exports.generateInstructorId = async (req, res) => {
  try {
    const { name, identity } = req.body;
    if (!name) return res.status(400).json({ message: "Name required" });
    if (!identity)
      return res.status(400).json({ message: "Identity required" });

    let instructorId;
    let exists = true;

    // keep generating until a unique one is found
    while (exists) {
      instructorId = generateId();
      exists = await InstructorIDModel.exists({ instructorId });
    }

    const instructor = await InstructorIDModel.create({
      name,
      identity,
      instructorId,
    });

    return res.status(201).json(instructor);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// For public
exports.getPublicInstructors = async (req, res) => {
  try {
    const instructors = await InstructorIDModel.aggregate([
      { $match: { isDeleted: false } },
      {
        $lookup: {
          from: InstructorModel.collection.name, // ensures correct collection name
          localField: "instructorId",
          foreignField: "instructorId",
          as: "inst"
        }
      },
      { $unwind: { path: "$inst", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          name: 1,
          identity: 1,
          // Use Instructor._id (converted to string) if present; otherwise keep the original instructorId string
          _id: {
            $ifNull: [{ $toString: "$inst._id" }, "$instructorId"]
          }
        }
      }
    ]);

    return res.json({ instructors });
  } catch (error) {
    console.error("getPublicInstructors error:", error);
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

// Edit Name and Identity
exports.editInstructor = async (req, res) => {
  try {
    const { iid } = req.params; // instructorId
    const { name, identity } = req.body;

    if (!name && !identity) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    const updatedInstructor = await InstructorIDModel.findOneAndUpdate(
      { instructorId: iid, isDeleted: false },
      { $set: { ...(name && { name }), ...(identity && { identity }) } },
      { new: true }
    );

    if (!updatedInstructor) {
      return res.status(404).json({ message: "Instructor not found" });
    }

    return res.json({
      message: "Instructor updated successfully",
      instructor: updatedInstructor,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin deletes instructor
exports.softDelInstruct = async (req, res) => {
  try {
    const { iid } = req.params;
    const instructorID = await InstructorIDModel.findOneAndUpdate(
      { instructorId: iid },
      { isDeleted: true },
      { new: true }
    );

    const instructor = await InstructorModel.findOneAndUpdate(
      { instructorId: iid },
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
exports.permaDelInstruct = async (req, res) => {
  try {
    const { iid } = req.params;
    const deletedID = await InstructorIDModel.findOneAndDelete({
      instructorId: iid,
    });
    const deleted = await InstructorModel.findOneAndDelete({
      instructorId: iid,
    });

    if (!deletedID && !deleted)
      return res.status(404).json({ message: "Instructor not found" });
    return res.json({ message: "Instructor deleted successfully" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// -----------------------------------------------------------------
// ReSend OTP (Signup/Login) - using DB fields now
exports.resendInstructorOtp = async (req, res) => {
  try {
    const { email, type } = req.body; // type = "signup" | "login"
    if (!email || !type)
      return res.status(400).json({ message: "Email and type required" });

    const instructor = await InstructorModel.findOne({
      email,
      isDeleted: false,
    });
    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });

    if (type === "signup" && instructor.isVerified) {
      return res
        .status(400)
        .json({ message: "Already verified, please login instead" });
    }

    if (type === "login" && !instructor.isVerified) {
      return res
        .status(400)
        .json({ message: "Not verified yet, please signup first" });
    }

    // generate OTP and persist to DB
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    instructor.otp = otp;
    instructor.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes
    await instructor.save();

    await sendEmail(
      email,
      "OTP - Shubukan India Exam",
      instructorOtpEmailTemplate(otp)
    );

    return res.json({ message: "OTP resent to email" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Verify OTP - using DB fields now
exports.verifyInstructorOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;
    if (!email || !otp) return res.status(400).json({ message: "Email and OTP required" });

    const instructor = await InstructorModel.findOne({
      email,
      isDeleted: false,
    });
    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });

    if (!instructor.otp || !instructor.otpExpiresAt)
      return res.status(400).json({ message: "No OTP sent" });

    if (Date.now() > new Date(instructor.otpExpiresAt).getTime())
      return res.status(400).json({ message: "OTP expired" });

    if (instructor.otp !== otp)
      return res.status(400).json({ message: "Invalid OTP" });

    // Clear OTP and mark verified
    instructor.otp = undefined;
    instructor.otpExpiresAt = undefined;
    instructor.isVerified = true;
    await instructor.save();

    const token = jwt.sign(
      { id: instructor._id, email },
      process.env.JWT_SECRET,
      {
        expiresIn: "7d",
      }
    );

    return res.json({ message: "OTP verified", token });
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
      return res.status(400).json({ message: "Contact admin to get ID" });

    if (existingID.claimed) {
      return res.status(400).json({ message: "Instructor ID already claimed" });
    }

    // generate OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

    const instructor = await InstructorModel.create({
      name,
      email,
      mobile,
      instructorId,
      isVerified: false,
      otp,
      otpExpiresAt,
    });

    // Mark the ID as claimed
    existingID.claimed = true;
    await existingID.save();

    // send OTP email
    await sendEmail(
      email,
      "Verify your email - Shubukan India Exam",
      instructorOtpEmailTemplate(otp)
    );

    return res
      .status(201)
      .json({ message: "Instructor registered. OTP sent to email." });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Login
exports.loginInstructor = async (req, res) => {
  try {
    const { email } = req.body;
    const instructor = await InstructorModel.findOne({
      email,
      isDeleted: false,
    });

    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });

    // if (!instructor.isVerified)
    //   return res
    //     .status(400)
    //     .json({ message: "Instructor not verified. Please sign up first." });

    // generate OTP and persist
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    instructor.otp = otp;
    instructor.otpExpiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await instructor.save();

    await sendEmail(
      email,
      "Login OTP - Shubukan India Exam",
      instructorOtpEmailTemplate(otp)
    );

    return res.json({ message: "OTP sent to email for login" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get Profile
exports.getInstructorProfile = async (req, res) => {
  try {
    const instructor = await InstructorModel.findById(req.instructor.id).select(
      "-__v -createdAt -updatedAt -otp -otpExpiresAt"
    );
    if (!instructor)
      return res.status(404).json({ message: "Instructor not found" });
    return res.json(instructor);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Update Profile (cannot update instructorId)
exports.updateInstructorProfile = async (req, res) => {
  try {
    const { name, email, mobile } = req.body;

    const updated = await InstructorModel.findByIdAndUpdate(
      req.instructor.id,
      { name, email, mobile },
      { new: true, runValidators: true }
    ).select("-__v -createdAt -updatedAt -otp -otpExpiresAt");

    if (!updated)
      return res.status(404).json({ message: "Instructor not found" });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Logout (client removes token, server optional blacklist)
exports.logoutInstructor = async (req, res) => {
  try {
    return res.json({
      message: "Logged out successfully. Please clear your token on client.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
