// middleware/authMiddleware.js
const jwt = require("jsonwebtoken");
const AdminModel = require("../model/adminModel");

exports.authMiddleware = async (req, res, next) => {
  try {
    // Expecting: Authorization: Bearer <token>
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    const token = authHeader.split(" ")[1]; // extract token after "Bearer"

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await AdminModel.findOne({ id: decoded.id });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    // Track activity
    admin.lastActive = new Date();
    await admin.save();

    req.admin = admin;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      error: "Invalid token",
    });
  }
};
