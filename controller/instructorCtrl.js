// controller/instructorCtrl.js
const InstructorModel = require("../model/instructorModel");
const InstructorIDModel = require("../model/instructorIDModel");
const crypto = require("crypto");
const { instructorOtpEmailTemplate } = require("../util/emailTemplate");
const { examEmailCode, normalizeEmail, validEmail, byEmail } = require("../util/examEmailCode");

const codes = examEmailCode(InstructorModel, "instructor", instructorOtpEmailTemplate);

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
    const { name, identity } = req.body ?? {};
    const email = normalizeEmail(req.body?.email).toLowerCase();
    if (!name) return res.status(400).json({ message: "Name required" });
    if (!identity)
      return res.status(400).json({ message: "Identity required" });
    if (!validEmail(email)) return res.status(400).json({ message: "Enter the instructor's invitation email." });

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
      email,
    });

    return res.status(201).json(instructor);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// For public
exports.getPublicInstructors = async (req, res) => {
  try {
    const instructors = await InstructorIDModel.find({ isDeleted: false }).select("name identity").lean();

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
    const { name, identity } = req.body ?? {};
    const email = normalizeEmail(req.body?.email).toLowerCase();

    if (!name && !identity && !email) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    if (email && !validEmail(email)) return res.status(400).json({ message: "Enter a valid invitation email." });
    const target = await InstructorIDModel.findOne({ instructorId: iid, isDeleted: false }).select("claimed");
    if (!target) return res.status(404).json({ message: "Instructor not found" });
    const setInvitation = Boolean(email && !target.claimed);
    const updatedInstructor = await InstructorIDModel.findOneAndUpdate(
      { _id: target._id, isDeleted: false, ...(setInvitation && { claimed: { $ne: true } }) },
      { $set: { ...(name && { name }), ...(identity && { identity }), ...(setInvitation && { email }) } },
      { returnDocument: "after" }
    );

    if (!updatedInstructor) {
      return res.status(409).json({ message: "The instructor changed. Reload and try again." });
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
// Signup binds an invitation to the email assigned by an admin.
exports.signupInstructor = async (req, res) => {
  try {
    const { name, mobile } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);
    const code = typeof req.body?.instructorId === "string" ? req.body.instructorId.trim().toUpperCase() : "";
    if (!name?.trim?.() || !validEmail(email) || !code) {
      return res.status(400).json({ message: "Enter your name, invitation email, and instructor ID." });
    }
    if (await InstructorModel.exists({ $or: [{ email: byEmail(email) }, { instructorId: code }] })) {
      return res.status(409).json({ message: "This account is already registered. Log in to request a code." });
    }
    const invitation = await InstructorIDModel.findOneAndUpdate({
      instructorId: code, email: byEmail(email), isDeleted: false, claimed: { $ne: true },
    }, { $set: { claimed: true } });
    if (!invitation) {
      return res.status(400).json({ message: "The instructor ID and invitation email did not match an available invitation." });
    }
    try {
      await InstructorModel.create({ name, email: email.toLowerCase(), mobile, instructorId: code, isVerified: false });
    } catch (error) {
      await InstructorIDModel.updateOne({ _id: invitation._id }, { $set: { claimed: false } });
      throw error;
    }
    return await codes.issue(email, res, 201);
  } catch (error) {
    return res.status(error.code === 11000 ? 409 : 500).json({ message: "Could not register the instructor account. Try logging in if you already registered." });
  }
};

exports.loginInstructor = codes.request;
exports.resendInstructorOtp = codes.request;
exports.verifyInstructorOtp = codes.verify;


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
