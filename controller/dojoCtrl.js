// controller/dojoCtrl.js
const DojoModel = require("../model/dojoModel");
const cloudinary = require("../config/cloudinary");

// upload images from frontend, and send the image url to backend
exports.getCloudDojoSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "Shubukan/Dojo",
      },
      process.env.CLOUDINARY_API_SECRET
    );

    // Return the necessary data for frontend
    return res.json({
      signature,
      timestamp,
      apiKey: process.env.CLOUDINARY_API_KEY,
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// create dojo
exports.createDojo = async (req, res) => {
  try {
    const dojo = await DojoModel.create(req.body);

    return res.status(201).json({
      success: true,
      message: "Dojo created successfully",
      data: dojo,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to create dojo",
      error: error.message,
    });
  }
};

// fetch all dojo
exports.fetchAllDojo = async (req, res) => {
  try {
    const dojoList = await DojoModel.find({ isDeleted: false })
      .sort({ index: 1 })
      .lean();

    return res.status(200).json({
      success: true,
      count: dojoList.length,
      data: dojoList,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dojo",
      error: error.message,
    });
  }
};

// UPDATE DOJO
exports.updateDojo = async (req, res) => {
  try {
    const { id } = req.params;

    const updatedDojo = await DojoModel.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!updatedDojo) {
      return res.status(404).json({
        success: false,
        message: "Dojo not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dojo updated successfully",
      data: updatedDojo,
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to update dojo",
      error: error.message,
    });
  }
};

// SOFT DELETE DOJO
exports.deleteDojo = async (req, res) => {
  try {
    const { id } = req.params;

    const deletedDojo = await DojoModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!deletedDojo) {
      return res.status(404).json({
        success: false,
        message: "Dojo not found",
      });
    }

    return res.status(200).json({
      success: true,
      message: "Dojo deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({
      success: false,
      message: "Failed to delete dojo",
      error: error.message,
    });
  }
};
