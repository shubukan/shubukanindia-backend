const galleryModel = require("../model/galleryModel");
const cloudinary = require("../config/cloudinary");
const { shuffleArray } = require("../util/shuffle");


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
      cloudName: process.env.CLOUDINARY_CLOUD_NAME
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// save gallery data with a pre-uploaded image URL
exports.createGalleryWithUrl = async (req, res) => {
  try {
    const { image, title, description, year, category, tags } = req.body;

    if (!image) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    const gallery = await galleryModel.create({
      image,
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
    return res.status(400).json({ message: error.message });
  }
};

exports.createGallery = async (req, res) => {
  try {
    const { title, description, year, category, tags } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Convert buffer to base64
    const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(base64Image, {folder: "Shubukan/Gallery"});

    const gallery = await galleryModel.create({
      image: result.secure_url,
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
    return res.status(400).json({ message: error.message });
  }
};

exports.getGallery = async (req, res) => {
  try {
    const { category, tags, year, sort, page = 1, limit = 10 } = req.query;

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
      galleryModel.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit)),
      galleryModel.countDocuments(query),
    ]);

    shuffleArray(images)

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
    const { title, description, year, category, tags } = req.body;

    const updateData = {
      title,
      description,
      year,
      category,
      tags: Array.isArray(tags)
        ? tags
        : tags.split(",").map((tag) => tag.trim()),
    };

    // If new image is uploaded
    if (req.file) {
      const base64Image = `data:${req.file.mimetype};base64,${req.file.buffer.toString("base64")}`;
      const result = await cloudinary.uploader.upload(base64Image, {folder: "Shubukan/Gallery"});
      updateData.image = result.secure_url;
    }

    const gallery = await galleryModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!gallery) {
      return res.status(404).json({ message: "Gallery item not found" });
    }

    return res.json(gallery);
  } catch (error) {
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
    const urlParts = gallery.image.split('/');
    const folderIndex = urlParts.indexOf('Shubukan');
    const publicId = urlParts
      .slice(folderIndex, urlParts.length)
      .join('/')
      .split('.')[0];

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from database
    await galleryModel.findByIdAndDelete(id);

    return res.json({ message: "Gallery item permanently deleted successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};
