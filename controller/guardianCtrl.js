// controller/guardianCtrl.js
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const GuardianModel = require("../model/guardianModel");
const { issueGuardianCode, consumeGuardianCode } = require("../util/guardianOtp");

const INVALID_CODE = "Code is invalid or expired. Check the code or request a new one.";

function normalizeEmail(email) {
  return typeof email === "string" ? email.trim().toLowerCase() : "";
}

function signGuardianToken(guardian) {
  return jwt.sign(
    { id: guardian._id, email: guardian.email, authVersion: guardian.authVersion ?? 0 },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

async function consumeCode(res, email, purpose, otp, password) {
  const normalizedEmail = normalizeEmail(email);
  if (!normalizedEmail || typeof otp !== "string" || !/^[0-9]{6}$/.test(otp)) {
    res.status(400).json({ message: "Enter your email and a six-digit code." });
    return null;
  }

  const guardian = await consumeGuardianCode(normalizedEmail, purpose, otp, password);
  if (!guardian) res.status(400).json({ message: INVALID_CODE });
  return guardian;
}

exports.signupGuardian = async (req, res) => {
  try {
    const { name, password, mobile } = req.body ?? {};
    const email = normalizeEmail(req.body?.email);
    if (!name || !email || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Name, email and password are required" });
    }

    const existing = await GuardianModel.findOne({ email });
    if (existing) return res.status(400).json({ message: "Email already registered" });

    const hashed = await bcrypt.hash(password, 10);
    const guardian = await GuardianModel.create({
      name,
      email,
      password: hashed,
      mobile,
      isVerified: false,
    });

    const result = await issueGuardianCode(guardian.email, "signup");
    return res.status(201).json({
      message: result === "sent"
        ? "Guardian registered. OTP sent to email."
        : "Guardian registered. Request a new code to verify your email.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.verifyGuardianOtp = async (req, res) => {
  try {
    const { email, otp } = req.body ?? {};
    const guardian = await consumeCode(res, email, "signup", otp);
    if (guardian) return res.json({ message: "OTP verified", token: signGuardianToken(guardian) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.resendGuardianOtp = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    if (!email) return res.status(400).json({ message: "Email required" });

    const result = await issueGuardianCode(email, "signup");
    if (result === "failed") {
      return res.status(503).json({ message: "Could not send a code. Please try again." });
    }
    return res.json({
      message: result === "sent"
        ? "OTP resent to email"
        : "If verification is pending, check your email for the latest code.",
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.loginGuardian = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = req.body?.password;
    if (!email || typeof password !== "string" || !password) {
      return res.status(400).json({ message: "Email and password required" });
    }

    const guardian = await GuardianModel.findOne({ email, isDeleted: false });
    if (!guardian) return res.status(404).json({ message: "Guardian not found" });

    const match = await bcrypt.compare(password, guardian.password);
    if (!match) return res.status(401).json({ message: "Incorrect password" });

    if (!guardian.isVerified) {
      await issueGuardianCode(guardian.email, "signup");
      return res.status(403).json({ message: "Please verify your email first" });
    }

    return res.json({ message: "Login successful", token: signGuardianToken(guardian) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.requestGuardianCode = async (req, res) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const purpose = req.body?.purpose;
    if (!email || email.length > 254 || !/^[^\s@]+@[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address." });
    }
    if (purpose !== "login" && purpose !== "reset") {
      return res.status(400).json({ message: "Choose email login or password reset." });
    }

    await issueGuardianCode(email, purpose);
    return res.json({ message: "If this email is registered, check your inbox for a six-digit code." });
  } catch (error) {
    console.error("Could not request guardian code:", error.message);
    return res.status(500).json({ message: "Could not request a code. Please try again." });
  }
};

exports.loginGuardianWithOtp = async (req, res) => {
  try {
    const { email, otp } = req.body ?? {};
    const guardian = await consumeCode(res, email, "login", otp);
    if (guardian) return res.json({ message: "Login successful", token: signGuardianToken(guardian) });
  } catch (error) {
    console.error("Guardian code login failed:", error.message);
    return res.status(500).json({ message: "Could not log in. Please try again." });
  }
};

exports.resetGuardianPassword = async (req, res) => {
  try {
    const { email, otp, password } = req.body ?? {};
    if (typeof password !== "string" || password.length < 8 || bcrypt.truncates(password)) {
      return res.status(400).json({ message: "Use a password with at least 8 characters and at most 72 bytes." });
    }

    const guardian = await consumeCode(res, email, "reset", otp, password);
    if (guardian) return res.json({ message: "Password reset. Log in with your new password." });
  } catch (error) {
    console.error("Guardian password reset failed:", error.message);
    return res.status(500).json({ message: "Could not reset your password. Please try again." });
  }
};

exports.getGuardianProfile = async (req, res) => {
  try {
    const guardian = await GuardianModel.findById(req.guardian._id).select(
      "-__v -password -authVersion -otpChallenges"
    );
    if (!guardian) return res.status(404).json({ message: "Guardian not found" });
    return res.json(guardian);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateGuardianProfile = async (req, res) => {
  try {
    const { name, mobile } = req.body;
    const updated = await GuardianModel.findByIdAndUpdate(
      req.guardian._id,
      { name, mobile },
      { new: true, runValidators: true }
    ).select("-__v -password -authVersion -otpChallenges");
    if (!updated) return res.status(404).json({ message: "Guardian not found" });
    return res.json(updated);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
