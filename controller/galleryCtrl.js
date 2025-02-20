const galleryModel = require("../model/galleryModel");
const cloudinary = require("cloudinary").v2;

exports.createGallery = async (req, res) => {
  try {
    const { title, description, year, category, tags } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "Image is required" });
    }

    // Upload to Cloudinary
    const result = await cloudinary.uploader.upload(req.file.path);

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

    res.status(201).json(gallery);
  } catch (error) {
    res.status(400).json({ message: error.message });
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

    const [items, total] = await Promise.all([
      galleryModel.find(query).sort(sortOptions).skip(skip).limit(parseInt(limit)),
      galleryModel.countDocuments(query),
    ]);

    res.json({
      items,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
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
      const result = await cloudinary.uploader.upload(req.file.path);
      updateData.image = result.secure_url;
    }

    const gallery = await galleryModel.findByIdAndUpdate(id, updateData, {
      new: true,
    });

    if (!gallery) {
      return res.status(404).json({ message: "Gallery item not found" });
    }

    res.json(gallery);
  } catch (error) {
    res.status(400).json({ message: error.message });
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

    res.json({ message: "Gallery item soft deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
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
    const publicId = gallery.image.split("/").pop().split(".")[0];

    // Delete from Cloudinary
    await cloudinary.uploader.destroy(publicId);

    // Delete from database
    await galleryModel.findByIdAndDelete(id);

    res.json({ message: "Gallery item permanently deleted successfully" });
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};
