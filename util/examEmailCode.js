const { createHmac, randomInt, randomUUID, timingSafeEqual } = require("node:crypto");
const jwt = require("jsonwebtoken");
const { sendEmail } = require("./sendEmail");

const examAccountProjection = "-otp -otpExpiresAt -emailChallenge -__v";
const normalizeEmail = (value) => typeof value === "string" ? value.trim() : "";
const validEmail = (value) => value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const byEmail = (email) => new RegExp(`^${escapeRegex(email)}$`, "i");

function digestCode(role, id, code) {
  return createHmac("sha256", process.env.JWT_SECRET).update(`exam:${role}:${id}:${code}`).digest("hex");
}

function examEmailCode(Model, role, template) {
  const account = (email) => ({ email: byEmail(email), isDeleted: false });

  async function issue(email, res, status = 200) {
    const now = Date.now();
    const code = String(randomInt(1_000_000)).padStart(6, "0");
    const id = randomUUID();
    const emailChallenge = {
      id, digest: digestCode(role, id, code), issuedAt: new Date(now),
      expiresAt: new Date(now + 300_000), attempts: 0,
    };
    const target = await Model.findOneAndUpdate({
      ...account(email),
      $or: [
        { "emailChallenge.issuedAt": { $exists: false } },
        { "emailChallenge.issuedAt": { $lte: new Date(now - 60_000) } },
      ],
    }, { $set: { emailChallenge }, $unset: { otp: 1, otpExpiresAt: 1 } }, { projection: { email: 1 } });
    if (!target) {
      return res.status(status).json({ message: "If this email is registered, check your inbox or try again in a minute." });
    }
    const sent = await sendEmail(target.email, `Your Shubukan India Exam code (${role})`, template(code));
    if (!sent) {
      await Model.updateOne({ _id: target._id, "emailChallenge.id": id }, { $unset: { "emailChallenge.digest": 1 } });
      return res.status(503).json({ code: "OTP_DELIVERY_FAILED", message: "Email delivery failed. Try again in one minute." });
    }
    return res.status(status).json({ message: "Check your inbox for a six-digit code." });
  }

  async function request(req, res) {
    try {
      const email = normalizeEmail(req.body?.email);
      if (!validEmail(email)) return res.status(400).json({ message: "Enter a valid email address." });
      if (req.body?.type != null && !["login", "signup"].includes(req.body.type)) {
        return res.status(400).json({ message: "Start verification again." });
      }
      return await issue(email, res);
    } catch (error) {
      return res.status(500).json({ message: "Could not request a verification code." });
    }
  }

  async function verify(req, res) {
    try {
      const email = normalizeEmail(req.body?.email);
      const code = req.body?.otp;
      if (!validEmail(email) || typeof code !== "string" || !/^\d{6}$/.test(code)) {
        return res.status(400).json({ message: "Enter your email and six-digit code." });
      }
      const invalidCode = () => res.status(400).json({ message: "The code is invalid or expired. Request a new code." });
      const target = await Model.findOneAndUpdate({
        ...account(email), "emailChallenge.digest": { $exists: true },
        "emailChallenge.attempts": { $lt: 5 }, "emailChallenge.expiresAt": { $gt: new Date() },
      }, { $inc: { "emailChallenge.attempts": 1 } }, {
        projection: { "emailChallenge.id": 1, "emailChallenge.digest": 1 },
      });
      if (!target) return invalidCode();
      const { id, digest } = target.emailChallenge;
      if (!timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(digestCode(role, id, code), "hex"))) {
        return invalidCode();
      }
      const verified = await Model.findOneAndUpdate({
        _id: target._id, isDeleted: false, "emailChallenge.id": id,
        "emailChallenge.digest": digest, "emailChallenge.expiresAt": { $gt: new Date() },
      }, { $set: { isVerified: true }, $unset: { "emailChallenge.digest": 1 } }, {
        returnDocument: "after", projection: { email: 1 },
      });
      if (!verified) return invalidCode();
      const token = jwt.sign({ id: verified._id, email: verified.email }, process.env.JWT_SECRET, { expiresIn: "7d" });
      return res.json({ message: "Email verified.", token });
    } catch (error) {
      return res.status(500).json({ message: "Could not verify the code." });
    }
  }

  return { issue, request, verify };
}

module.exports = { examEmailCode, examAccountProjection, normalizeEmail, validEmail, byEmail, escapeRegex };
