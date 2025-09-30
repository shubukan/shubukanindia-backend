// controller/adminCtrl.js
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const AdminModel = require("../model/adminModel");

exports.createAdmin = async (req, res) => {
  try {
    const { id, password } = req.body;

    if (!id || !password) {
      return res.status(400).json({ success: false, error: "Missing fields" });
    }

    const existing = await AdminModel.findOne({ id });
    if (existing) {
      return res
        .status(409)
        .json({ success: false, error: "Admin already exists" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const admin = await AdminModel.create({
      id,
      password: hashedPassword,
    });

    res.status(201).json({
      success: true,
      message: "Admin created successfully",
      data: { id: admin.id },
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

exports.adminLogin = async (req, res) => {
  try {
    const { id, password } = req.body;

    const admin = await AdminModel.findOne({ id });
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    const isMatch = await bcrypt.compare(password, admin.password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        error: "Authentication failed",
      });
    }

    const token = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    const refreshToken = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    admin.refreshToken = refreshToken;
    await admin.save();

    // ✅ Set cookies
    res.cookie("adminToken", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 1000, // 1 hour
    });

    res.cookie("refreshToken", refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    return res.status(200).json({
      success: true,
      message: "Login successful",
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({
      success: false,
      error: "Internal server error",
    });
  }
};

exports.refreshTokenController = async (req, res) => {
  const refreshToken = req.cookies.refreshToken; // ✅ now read from cookies
  if (!refreshToken) {
    return res
      .status(401)
      .json({ success: false, error: "Missing refresh token" });
  }

  try {
    const decoded = jwt.verify(refreshToken, process.env.JWT_SECRET);
    const admin = await AdminModel.findOne({ id: decoded.id, refreshToken });

    if (!admin) {
      return res
        .status(403)
        .json({ success: false, error: "Invalid refresh token" });
    }

    const newAccessToken = jwt.sign({ id: admin.id }, process.env.JWT_SECRET, {
      expiresIn: "1h",
    });

    // ✅ update cookie
    res.cookie("adminToken", newAccessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 1000,
    });

    return res.json({ success: true });
  } catch (err) {
    return res
      .status(403)
      .json({ success: false, error: "Invalid refresh token" });
  }
};

exports.adminLogout = async (req, res) => {
  try {
    if (req.admin) {
      req.admin.refreshToken = null;
      await req.admin.save();
    }

    // ✅ Clear cookies
    res.clearCookie("adminToken", { path: "/" });
    res.clearCookie("refreshToken", { path: "/" });

    return res.json({ success: true, message: "Logged out successfully" });
  } catch (error) {
    return res
      .status(500)
      .json({ success: false, error: "Internal server error" });
  }
};

exports.adminValidate = async (req, res) => {
  return res.json({
    success: true,
    admin: { id: req.admin.id, lastActive: req.admin.lastActive },
  });
};
