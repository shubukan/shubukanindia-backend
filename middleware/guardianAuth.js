// middleware/guardianAuth.js
const jwt = require("jsonwebtoken");
const GuardianModel = require("../model/guardianModel");

exports.guardianAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const guardian = await GuardianModel.findById(decoded.id);
    if (!guardian || guardian.isDeleted) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.guardian = guardian;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
