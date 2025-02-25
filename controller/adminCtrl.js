const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const AdminModal = require("../model/adminModel");

exports.createAdmin = async (req, res) => {
  try {
    const { id, password } = req.body;

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await AdminModal.create({
      id,
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      data: admin,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { id, password } = req.body;

    const admin = await AdminModal.findOne({ id });

    if (!admin) {
      return res.status(404).json({
        success: false,
        error: "Authentication failed",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);

    if (!isMatch) {
      return res.status(404).json({
        success: false,
        error: "Authentication failed",
      });
    }

    // Add refresh token
    const refreshToken = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // Store refresh token in database
    admin.refreshToken = refreshToken;
    await admin.save();
    console.log("user login");
    return res.status(200).json({
      success: true,
      token,
      refreshToken,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
};

exports.adminValidate = async (req, res) => {
  return res.json({ success: true });
};
