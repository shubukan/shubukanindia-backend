const jwt = require("jsonwebtoken");
const AdminModel = require("../model/adminModel");

exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.body.token;
    if (!token) {
      return res.status(401).json({
        success: false,
        error: "No token provided",
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const admin = await AdminModel.findOne({ id: decoded.id });

    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "Invalid token",
      });
    }

    // Add last active timestamp
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
