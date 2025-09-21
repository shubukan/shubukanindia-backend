// middleware/instructorAuth.js
const jwt = require("jsonwebtoken");
const InstructorModel = require("../model/instructorModel");

exports.instructorAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const instructor = await InstructorModel.findById(decoded.id);
    if (!instructor || instructor.isDeleted) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.instructor = instructor;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
