const jwt = require("jsonwebtoken");
const StudentModel = require("../model/studentModel");

exports.studentAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ message: "No token provided" });
    }

    const token = authHeader.split(" ")[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const student = await StudentModel.findById(decoded.id);
    if (!student || student.isDeleted) {
      return res.status(401).json({ message: "Invalid token" });
    }

    req.student = student;
    next();
  } catch (error) {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
};
