const jwt = require('jsonwebtoken');
const AdminModal = require('../model/adminModel');

exports.authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({
        success: false,
        error: 'No token provided'
      });
    }

    const decoded = jwt.verify(token, process.env.SECRET_KEY);
    const admin = await AdminModal.findOne({ id: decoded.id });
    
    if (!admin) {
      return res.status(401).json({
        success: false,
        error: 'Invalid token'
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
      error: 'Invalid token'
    });
  }
};