// middleware/emailAuth.js
const crypto = require("crypto");
const { EmailSession } = require("../model/emailAuthModel");

const SESSION_DAYS = 30;
const hash = (v) => crypto.createHash("sha256").update(String(v)).digest("hex");

exports.hashValue = hash;

exports.emailAuth = async (req, res, next) => {
  try {
    const token = req.headers["x-email-token"];
    const email = String(req.headers["x-email"] || "").trim().toLowerCase();

    if (!token || !email) {
      return res.status(401).json({ message: "Email verification required" });
    }

    const session = await EmailSession.findOne({
      email,
      tokenHash: hash(token),
      expiresAt: { $gt: new Date() },
    }).lean();

    if (!session) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    req.email = email; // pass email to controller
    next();
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Call this after OTP verification - returns the raw token for the client.
exports.createEmailSession = async (email) => {
  const token = crypto.randomBytes(24).toString("hex");
  await EmailSession.create({
    email,
    tokenHash: hash(token),
    expiresAt: new Date(Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000),
  });
  return token;
};
