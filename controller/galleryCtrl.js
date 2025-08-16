const galleryModel = require("../model/galleryModel");
const cloudinary = require("../config/cloudinary");

exports.getCloudinarySignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "Shubukan/Gallery",
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

// This api is in use
// save gallery data with a pre-uploaded image URL
exports.createGalleryWithUrl = async (req, res) => {
  let publicId = null;

  try {
    // image: String
    // In frontend, uploading image in Cloudinary > get image url
    const { image, title, description, year, category, tags } = req.body;

    if (!image) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    const parts = image.split("/upload/");
    if (parts.length < 2) {
      return res.status(400).json({ message: "Invalid Cloudinary URL format" });
    }

    const afterUpload = parts[1];
    const withoutVersion = afterUpload.replace(/^v\d+\//, "");
    publicId = withoutVersion.substring(0, withoutVersion.lastIndexOf("."));

    const imgDetails = await cloudinary.api.resource(publicId);

    const gallery = await galleryModel.create({
      image,
      width: imgDetails.width,
      height: imgDetails.height,
      title,
      description,
      year,
      category,
      tags: Array.isArray(tags)
        ? tags
        : tags.split(",").map((tag) => tag.trim()),
    });

    return res.status(201).json(gallery);
  } catch (error) {
    // If MongoDB save failed but image was uploaded, remove it from Cloudinary
    if (publicId) {
      try {
        // if MongoDB save fails after the Cloudinary upload, delete the file from Cloudinary before sending the error.
        await cloudinary.uploader.destroy(publicId);
      } catch (cleanupError) {
        console.error(
          "Failed to delete orphan image from Cloudinary:",
          cleanupError
        );
      }
    }
    console.error(error);
    return res.status(400).json({ message: error.message });
  }
};

exports.getGallery = async (req, res) => {
  try {
    const { category, tags, year, sort, page = 1, limit = 20 } = req.query;

    // Build query
    const query = { isDeleted: false };

    if (category) query.category = category;
    if (year) query.year = year;
    if (tags) {
      const tagArray = Array.isArray(tags)
        ? tags
        : tags.split(",").map((tag) => tag.trim());
      query.tags = { $in: tagArray };
    }

    // Build sort options
    const sortOptions = {};
    if (sort === "year-asc") sortOptions.year = 1;
    if (sort === "year-desc") sortOptions.year = -1;

    const skip = (page - 1) * limit;

    const [images, total] = await Promise.all([
      galleryModel
        .find(query)
        .sort(sortOptions)
        .skip(skip)
        .limit(parseInt(limit)),
      galleryModel.countDocuments(query),
    ]);

    return res.json({
      images,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateGallery = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, year, category, tags, image } = req.body;

    // Find existing gallery item
    const existingGallery = await galleryModel.findById(id);
    if (!existingGallery) {
      return res.status(404).json({ message: "Gallery item not found" });
    }

    const updateData = {
      title,
      description,
      year,
      category,
      tags: Array.isArray(tags)
        ? tags
        : tags.split(",").map((tag) => tag.trim()),
    };

    if (image && image !== existingGallery.image) {
      // --- 1. Delete old image from Cloudinary ---
      // Extract public ID from Cloudinary URL
      if (existingGallery.image) {
        try {
          const oldUrlParts = existingGallery.image.split("/");
          const folderIndex = oldUrlParts.indexOf("Shubukan");
          const oldPublicId = oldUrlParts
            .slice(folderIndex, oldUrlParts.length)
            .join("/")
            .split(".")[0];

          await cloudinary.uploader.destroy(oldPublicId);
        } catch (err) {
          console.error("Failed to delete old Cloudinary image:", err);
        }
      }

      // --- 2. Save new image details ---
      const parts = image.split("/upload/");
      if (parts.length >= 2) {
        const afterUpload = parts[1];
        const withoutVersion = afterUpload.replace(/^v\d+\//, "");
        const publicId = withoutVersion.substring(
          0,
          withoutVersion.lastIndexOf(".")
        );

        const imgDetails = await cloudinary.api.resource(publicId);
        // the same cloudinary.api.resource logic you used in createGalleryWithUrl to get width & height.
        // Get image dimensions from Cloudinary
        updateData.image = image;
        updateData.width = imgDetails.width;
        updateData.height = imgDetails.height;
      }
    }

    const updatedGallery = await galleryModel.findByIdAndUpdate(
      id,
      updateData,
      {
        new: true,
      }
    );

    return res.json(updatedGallery);
  } catch (error) {
    console.error("Update error:", error);
    return res.status(400).json({ message: error.message });
  }
};

// Soft delete (set isDeleted to true)
exports.softDeleteGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await galleryModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!gallery) {
      return res.status(404).json({ message: "Gallery item not found" });
    }

    return res.json({ message: "Gallery item soft deleted successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Permanent delete (remove from database and Cloudinary)
exports.permanentDeleteGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const gallery = await galleryModel.findById(id);

    if (!gallery) {
      return res.status(404).json({ message: "Gallery item not found" });
    }

    // Extract public_id from Cloudinary URL
    const urlParts = gallery.image.split("/");
    const folderIndex = urlParts.indexOf("Shubukan");
    const publicId = urlParts
      .slice(folderIndex, urlParts.length)
      .join("/")
      .split(".")[0];

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from database
    await galleryModel.findByIdAndDelete(id);

    return res.json({
      message: "Gallery item permanently deleted successfully",
    });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
