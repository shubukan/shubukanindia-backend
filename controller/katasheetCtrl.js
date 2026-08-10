// controller/studentCtrl.js
const KataUploadModel = require("../model/kataUploadModel");
const cloudinary = require("../config/cloudinary");

// upload images from frontend, and send the image url to backend
exports.getCloudKataSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "Shubukan/KataSheet",
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

/**
 * Student uploads a kata image (image already uploaded to Cloudinary/Storage)
 * Body: { imageUrl, publicId?, caption? }
 * Auth: studentAuth (req.student.id available)
 * Limit: max 10 active (non-deleted) uploads per student
 */
exports.createKataUpload = async (req, res) => {
  try {
    const { imageUrl, publicId, caption } = req.body;
    if (!imageUrl)
      return res.status(400).json({ message: "imageUrl is required" });

    // enforce limit 10
    const existingCount = await KataUploadModel.countDocuments({
      student: req.student.id,
      isDeleted: false,
    });

    if (existingCount >= 10) {
      return res
        .status(400)
        .json({ message: "Upload limit reached (maximum 10 images)" });
    }

    const upload = await KataUploadModel.create({
      student: req.student.id,
      imageUrl,
      publicId,
      caption,
    });

    return res.status(201).json({ message: "Uploaded", upload });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Student: get their own kata uploads
 * Auth: studentAuth
 */
exports.getMyKataUploads = async (req, res) => {
  try {
    const uploads = await KataUploadModel.find({
      student: req.student.id,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return res.json(uploads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Student updates their upload (replace imageUrl/publicId/caption)
 * Body: { imageUrl?, publicId?, caption? }
 * Auth: studentAuth
 */
exports.updateKataUpload = async (req, res) => {
  try {
    const { id } = req.params;
    const { imageUrl, publicId, caption } = req.body;

    const upload = await KataUploadModel.findById(id);
    if (!upload || upload.isDeleted)
      return res.status(404).json({ message: "Upload not found" });

    // ownership check
    if (upload.student.toString() !== req.student.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    const updateObj = {};
    if (typeof imageUrl !== "undefined") updateObj.imageUrl = imageUrl;
    if (typeof publicId !== "undefined") updateObj.publicId = publicId;
    if (typeof caption !== "undefined") updateObj.caption = caption;

    const updated = await KataUploadModel.findByIdAndUpdate(id, updateObj, {
      new: true,
      runValidators: true,
    });

    return res.json({ message: "Upload updated", upload: updated });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Student deletes (soft-delete) their upload
 * Auth: studentAuth
 */
exports.deleteKataUpload = async (req, res) => {
  try {
    const { id } = req.params;
    const upload = await KataUploadModel.findById(id);
    if (!upload || upload.isDeleted)
      return res.status(404).json({ message: "image not found" });

    if (upload.student.toString() !== req.student.id) {
      return res.status(403).json({ message: "Not authorized" });
    }

    upload.isDeleted = true;
    await upload.save();

    // NOTE: If you want to delete from Cloudinary, call Cloudinary API here using upload.publicId
    return res.json({ message: "Upload deleted" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Instructor: view a particular student's kata uploads
 * Route param: :sid (student id)
 * Auth: instructorAuth
 *
 * Instructor may only view uploads of students assigned to them.
 */
exports.getInstructorKataSheet = async (req, res) => {
  try {
    const { sid } = req.params;
    const StudentModel = require("../model/studentModel");

    const student = await StudentModel.findById(sid);
    if (!student || student.isDeleted)
      return res.status(404).json({ message: "Student not found" });

    // Accept either instructorId string or instructor _id depending on your app's stored value
    const belongsToInstructor =
      student.instructorId === req.instructor.instructorId ||
      student.instructorId === String(req.instructor._id);

    if (!belongsToInstructor) {
      return res
        .status(403)
        .json({ message: "You are not the instructor for this student" });
    }

    const uploads = await KataUploadModel.find({
      student: sid,
      isDeleted: false,
    }).sort({ createdAt: -1 });

    return res.json(uploads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

/**
 * Admin: view a student's kata uploads
 * Auth: authMiddleware (admin)
 */
exports.getAdminKataSheet = async (req, res) => {
  try {
    const { sid } = req.params;
    const StudentModel = require("../model/studentModel");

    const student = await StudentModel.findById(sid);
    if (!student || student.isDeleted)
      return res.status(404).json({ message: "Student not found" });

    const uploads = await KataUploadModel.find({
      student: sid,
    }).sort({ createdAt: -1 });

    return res.json(uploads);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};