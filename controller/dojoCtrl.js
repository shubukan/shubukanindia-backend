// controller/dojoCtrl.js
const bcrypt = require("bcryptjs");
const Dojo = require("../model/dojoModel"); // adjust if your folder name differs

// Create Dojo
exports.createDojo = async (req, res) => {
  try {
    const {
      dojoName,
      dojoType,
      password, // plain text from admin; we'll hash it
      image = [],
      instructors = [],
      contact = [],
      brunch = [],
    } = req.body;

    if (!dojoName || !password) {
      return res.status(400).json({ message: "dojoName and password are required" });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const dojo = await Dojo.create({
      dojoName,
      dojoType,
      passwordHash,
      image,
      instructors,
      contact,
      brunch,
    });

    return res.status(201).json(dojo);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// Fetch all (public, no password leakage)
exports.fetchAllDojo = async (req, res) => {
  try {
    const dojos = await Dojo.find({ isDeleted: false }).select("-passwordHash");
    return res.json(dojos);
  } catch (err) {
    return res.status(500).json({ message: err.message });
  }
};

// Update Dojo
exports.updateDojo = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      dojoName,
      dojoType,
      password, // optional new password; if present, we hash and replace
      image,
      instructors,
      contact,
      brunch,
      isDeleted,
    } = req.body;

    const dojo = await Dojo.findById(id);
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });

    if (dojoName !== undefined) dojo.dojoName = dojoName;
    if (dojoType !== undefined) dojo.dojoType = dojoType;
    if (Array.isArray(image)) dojo.image = image;
    if (Array.isArray(instructors)) dojo.instructors = instructors;
    if (Array.isArray(contact)) dojo.contact = contact;
    if (Array.isArray(brunch)) dojo.brunch = brunch;
    if (typeof isDeleted === "boolean") dojo.isDeleted = isDeleted;

    if (password) {
      dojo.passwordHash = await bcrypt.hash(password, 10);
    }

    await dojo.save();
    return res.json(dojo);
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};

// Delete Dojo
exports.deleteDojo = async (req, res) => {
  try {
    const { id } = req.params;
    const dojo = await Dojo.findById(id);
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });

    await Dojo.findByIdAndDelete(id);
    // NOTE: Not cascading deletes to marksheets; keep history. You can soft-delete marksheets here if needed.

    return res.json({ message: "Dojo deleted" });
  } catch (err) {
    return res.status(400).json({ message: err.message });
  }
};
