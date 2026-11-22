const { createHmac, randomInt, randomUUID, timingSafeEqual } = require("node:crypto");
const bcrypt = require("bcryptjs");
const GuardianModel = require("../model/guardianModel");
const { sendEmail } = require("./sendEmail");
const { guardianOtpEmailTemplate } = require("./emailTemplate");

const CODE_LIFETIME_MS = 5 * 60 * 1000;
const RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_ATTEMPTS = 5;
const codeTitles = {
  signup: "Verify your email",
  login: "Log in with your email code",
  reset: "Reset your password",
};

function accountFilter(email, purpose) {
  return {
    email,
    isDeleted: false,
    ...(purpose === "signup" && { isVerified: { $ne: true } }),
  };
}

function codeDigest(id, otp) {
  return createHmac("sha256", process.env.JWT_SECRET)
    .update(`guardian-otp:${id}:${otp}`)
    .digest("hex");
}

function makeChallenge(otp, issuedAt, expiresAt) {
  const id = randomUUID();
  return { id, digest: codeDigest(id, otp), issuedAt, expiresAt, attempts: 0 };
}

async function issueGuardianCode(email, purpose) {
  const path = `otpChallenges.${purpose}`;
  const now = Date.now();
  const otp = String(randomInt(1_000_000)).padStart(6, "0");
  const challenge = makeChallenge(otp, new Date(now), new Date(now + CODE_LIFETIME_MS));
  const guardian = await GuardianModel.findOneAndUpdate(
    {
      ...accountFilter(email, purpose),
      $or: [
        { [`${path}.issuedAt`]: { $exists: false } },
        { [`${path}.issuedAt`]: { $lte: new Date(now - RESEND_COOLDOWN_MS) } },
      ],
    },
    {
      $set: { [path]: challenge },
      ...(purpose === "signup" && { $unset: { otp: 1, otpExpiresAt: 1 } }),
    },
    { projection: { email: 1 } }
  );
  if (!guardian) return "unavailable";

  const title = codeTitles[purpose];
  const sent = await sendEmail(
    guardian.email,
    `${title} - Shubukan India Guardian Portal`,
    guardianOtpEmailTemplate(otp, title)
  );
  if (sent) return "sent";

  // Let the guardian retry when email delivery fails, without clearing a newer code.
  await GuardianModel.updateOne(
    { _id: guardian._id, [`${path}.id`]: challenge.id },
    { $unset: { [path]: 1 } }
  );
  return "failed";
}

// Keep signup codes issued before the deployment usable until they expire.
async function migrateSignupCode(email) {
  const filter = {
    ...accountFilter(email, "signup"),
    "otpChallenges.signup": { $exists: false },
    otp: { $type: "string" },
    otpExpiresAt: { $gt: new Date() },
  };
  const guardian = await GuardianModel.findOne(filter).select("+otp +otpExpiresAt");
  if (!guardian) return;

  const challenge = makeChallenge(
    guardian.otp,
    new Date(guardian.otpExpiresAt.getTime() - CODE_LIFETIME_MS),
    guardian.otpExpiresAt
  );
  await GuardianModel.updateOne(
    { ...filter, _id: guardian._id, otp: guardian.otp, otpExpiresAt: guardian.otpExpiresAt },
    {
      $set: { "otpChallenges.signup": challenge },
      $unset: { otp: 1, otpExpiresAt: 1 },
    }
  );
}

async function consumeGuardianCode(email, purpose, otp, newPassword) {
  if (purpose === "signup") await migrateSignupCode(email);

  const path = `otpChallenges.${purpose}`;
  // Reserve an attempt before checking the code so concurrent requests share the limit.
  const guardian = await GuardianModel.findOneAndUpdate(
    {
      ...accountFilter(email, purpose),
      [`${path}.digest`]: { $exists: true },
      [`${path}.expiresAt`]: { $gt: new Date() },
      [`${path}.attempts`]: { $lt: MAX_ATTEMPTS },
    },
    { $inc: { [`${path}.attempts`]: 1 } },
    { projection: { [path]: 1 } }
  );
  if (!guardian) return null;

  const { id, digest } = guardian.otpChallenges[purpose];
  if (!timingSafeEqual(Buffer.from(digest, "hex"), Buffer.from(codeDigest(id, otp), "hex"))) {
    return null;
  }

  const update = {
    $set: { isVerified: true },
    $unset: { [`${path}.digest`]: 1, otp: 1, otpExpiresAt: 1 },
  };
  if (purpose === "reset") {
    update.$set.password = await bcrypt.hash(newPassword, 10);
    update.$inc = { authVersion: 1 };
    update.$unset["otpChallenges.signup"] = 1;
    update.$unset["otpChallenges.login"] = 1;
  } else if (purpose === "login") {
    update.$unset["otpChallenges.signup"] = 1;
  }

  // Matching the challenge again makes verification single-use, even after a resend.
  return GuardianModel.findOneAndUpdate(
    {
      ...accountFilter(email, purpose),
      _id: guardian._id,
      [`${path}.id`]: id,
      [`${path}.digest`]: digest,
      [`${path}.expiresAt`]: { $gt: new Date() },
    },
    update,
    { returnDocument: "after", projection: { email: 1, authVersion: 1 } }
  );
}

module.exports = { issueGuardianCode, consumeGuardianCode };
