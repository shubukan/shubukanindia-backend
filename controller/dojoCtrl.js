// controller/dojoCtrl.js
const DojoModel = require("../model/dojoModel"); // adjust if your folder name differs

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
exports.getAllDojo = async (req, res) => {
  try {
    const dojos = await DojoModel.find().sort({ dojoNo: -1 });

    return res.status(200).json({
      success: true,
      count: dojos.length,
      data: dojos,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: "Failed to fetch dojo",
      error: error.message,
    });
  }
};

