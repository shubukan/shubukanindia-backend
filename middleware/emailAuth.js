const verifiedUsers = new Map(); // key=email, value=token

exports.emailAuth = (req, res, next) => {
  const token = req.headers["x-email-token"];
  const email = req.headers["x-email"];

  if (!token || !email) {
    return res.status(401).json({ message: "Email verification required" });
  }

  const validToken = verifiedUsers.get(email);
  if (validToken !== token) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }

  req.email = email; // pass email to controller
  next();
};

// Call this after OTP verification
exports.addVerifiedUser = (email, token) => {
  verifiedUsers.set(email, token);
};
