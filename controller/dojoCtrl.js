const dojoModel = require("../model/dojoModel");

// Create a dojo
exports.createDojo = async (req, res) => {
  try {
    const dojo = req.body;
    const createdDojo = await dojoModel.create({ ...dojo });
    res.status(201).json({
      success: true,
      data: createdDojo,
    });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Fetch all dojos (excluding deleted ones)
exports.fetchAllDojo = async (req, res) => {
  try {
    const dojos = await dojoModel.find({ isDeleted: false });
    return res.json(dojos);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a dojo
exports.updateDojo = async (req, res) => {
  try {
    const dojo = await dojoModel.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
    });
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });
    return res.json(dojo);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Soft delete a dojo
exports.deleteDojo = async (req, res) => {
  try {
    const dojo = await dojoModel.findByIdAndUpdate(
      req.params.id,
      { isDeleted: true },
      { new: true }
    );
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });
    return res.json({ message: "Dojo deleted successfully", dojo });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
