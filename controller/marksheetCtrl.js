// controller/marksheetCtrl.js
const cloudinary = require("../config/cloudinary");
const Marksheet = require("../model/marksheetModel");
const Dojo = require("../model/dojoModel");
const bcrypt = require("bcryptjs");

// Signature for direct PDF upload to Cloudinary (resource_type: raw)
exports.getMarksheetSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    const signature = cloudinary.utils.api_sign_request(
      { timestamp, folder: "Shubukan/Marksheet" },
      process.env.CLOUDINARY_API_SECRET
    );

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

// Helper: extract Cloudinary publicId from URL that has /upload/… and keep path under Shubukan/…
function publicIdFromUrl(url) {
  const parts = url.split("/upload/");
  if (parts.length < 2) return null;
  const afterUpload = parts[1];
  const withoutVersion = afterUpload.replace(/^v\d+\//, "");
  const publicId = withoutVersion.substring(0, withoutVersion.lastIndexOf("."));
  return publicId;
}

// Create Marksheet (after PDF uploaded to Cloudinary by admin)
exports.createMarksheet = async (req, res) => {
  try {
    const { dojoId, title, category, year, date, link } = req.body;

    if (!dojoId || !title || !date || !link) {
      return res.status(400).json({ message: "dojoId, title, date and link are required" });
    }

    const dojo = await Dojo.findById(dojoId);
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });

    const publicId = publicIdFromUrl(link);
    if (!publicId) return res.status(400).json({ message: "Invalid Cloudinary URL format" });

    // Validate that the resource exists (raw)
    await cloudinary.api.resource(publicId, { resource_type: "raw" });

    const ms = await Marksheet.create({
      dojo: dojoId,
      title,
      category,
      year,
      date: new Date(date),
      link,
      publicId,
    });

    return res.status(201).json(ms);
  } catch (error) {
    // If MongoDB save failed but file was uploaded, do not auto-delete here:
    // PDFs may be shared; handle manual cleanup if desired.
    return res.status(400).json({ message: error.message });
  }
};

// Update Marksheet (optionally replace PDF)
exports.updateMarksheet = async (req, res) => {
  try {
    const { id, title, category, year, date, link } = req.body;

    const ms = await Marksheet.findById(id);
    if (!ms) return res.status(404).json({ message: "Marksheet not found" });

    if (title !== undefined) ms.title = title;
    if (category !== undefined) ms.category = category;
    if (year !== undefined) ms.year = year;
    if (date !== undefined) ms.date = new Date(date);

    if (link && link !== ms.link) {
      // delete old raw file
      try {
        await cloudinary.uploader.destroy(ms.publicId, { resource_type: "raw" });
      } catch (e) {
        console.error("Failed to delete old Cloudinary raw file:", e);
      }

      const newPublicId = publicIdFromUrl(link);
      if (!newPublicId) {
        return res.status(400).json({ message: "Invalid Cloudinary URL format" });
      }

      await cloudinary.api.resource(newPublicId, { resource_type: "raw" });

      ms.link = link;
      ms.publicId = newPublicId;
    }

    await ms.save();
    return res.json(ms);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Secure fetch by dojo + password (for dojo portal)
exports.getAMarksheet = async (req, res) => {
  try {
    const { dojoId, password } = req.query;
    if (!dojoId || !password) {
      return res.status(400).json({ message: "dojoId and password are required" });
    }

    const dojo = await Dojo.findById(dojoId);
    if (!dojo) return res.status(404).json({ message: "Dojo not found" });

    const ok = await bcrypt.compare(password, dojo.passwordHash);
    if (!ok) return res.status(401).json({ message: "Invalid password" });

    const list = await Marksheet.find({ dojo: dojoId, isDeleted: false })
      .sort({ date: -1 })
      .lean();

    return res.json({ dojo: { _id: dojo._id, dojoName: dojo.dojoName }, marksheets: list });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// OPTIONAL: Permanent delete (admin only)
exports.deleteMarksheet = async (req, res) => {
  try {
    const { id } = req.params;
    const ms = await Marksheet.findById(id);
    if (!ms) return res.status(404).json({ message: "Marksheet not found" });

    try {
      await cloudinary.uploader.destroy(ms.publicId, { resource_type: "raw" });
    } catch (e) {
      console.error("Cloudinary deletion failed:", e);
    }
    await Marksheet.findByIdAndDelete(id);

    return res.json({ message: "Marksheet deleted" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
