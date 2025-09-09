const Blog = require("../model/blogModel");

// ✅ Create a blog
exports.createBlog = async (req, res) => {
  try {
    const blog = await Blog.create(req.body);
    return res.status(201).json(blog);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ✅ Get all blogs (with filters, pagination, sorting)
exports.getBlogs = async (req, res) => {
  try {
    const { category, tags, status, search, page = 1, limit = 10 } = req.query;

    const query = { };

    if (category) query["category.primary"] = category;
    if (status) query.status = status;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : tags.split(",");
      query.tags = { $in: tagArray };
    }
    if (search) {
      query.$or = [
        { title: { $regex: search, $options: "i" } },
        { summary: { $regex: search, $options: "i" } },
      ];
    }

    const skip = (page - 1) * limit;

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .sort({ publishedDate: -1 })
        .skip(skip)
        .limit(parseInt(limit)),
      Blog.countDocuments(query),
    ]);

    return res.json({
      blogs,
      total,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Get single blog by slug
exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Increment view count
    blog.viewCount += 1;
    await blog.save();

    return res.json(blog);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Update blog
exports.updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const updatedBlog = await Blog.findByIdAndUpdate(id, req.body, {
      new: true,
    });

    if (!updatedBlog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json(updatedBlog);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ✅ Soft delete blog
exports.softDeleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true }
    );

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog soft deleted successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// ✅ Permanent delete blog
exports.permanentDeleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndDelete(id);

    if (!blog) {
      return res.status(404).json({ message: "Blog not found" });
    }

    return res.json({ message: "Blog permanently deleted successfully" });
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

exports.likeBlog = async (req, res) => {
  try {
    const { id } = req.params; // blog id
    const userId = req.user ? req.user._id : null; // if you use authMiddleware

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // Prevent duplicate like
    if (userId && blog.likes.includes(userId)) {
      return res.status(400).json({ message: "Already liked" });
    }

    if (userId) {
      blog.likes.push(userId);
      blog.dislikes = blog.dislikes.filter(
        (dislikeId) => dislikeId.toString() !== userId.toString()
      );
    }

    blog.likeCount = blog.likes.length;
    blog.dislikeCount = blog.dislikes.length;

    await blog.save();

    return res.json({ likeCount: blog.likeCount, dislikeCount: blog.dislikeCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.dislikeBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user ? req.user._id : null;

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    if (userId && blog.dislikes.includes(userId)) {
      return res.status(400).json({ message: "Already disliked" });
    }

    if (userId) {
      blog.dislikes.push(userId);
      blog.likes = blog.likes.filter(
        (likeId) => likeId.toString() !== userId.toString()
      );
    }

    blog.likeCount = blog.likes.length;
    blog.dislikeCount = blog.dislikes.length;

    await blog.save();

    return res.json({ likeCount: blog.likeCount, dislikeCount: blog.dislikeCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.addComment = async (req, res) => {
  try {
    const { id } = req.params; // blog id
    const { name, avatar, text } = req.body;

    if (!text) return res.status(400).json({ message: "Comment text is required" });

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const comment = { name, avatar, text };

    blog.comments.push(comment);
    await blog.save();

    return res.status(201).json(blog.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.replyComment = async (req, res) => {
  try {
    const { id, commentId } = req.params; // blogId + commentId
    const { name, avatar, text } = req.body;

    const blog = await Blog.findById(id);
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const comment = blog.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    comment.replies.push({ name, avatar, text });

    await blog.save();
    return res.status(201).json(comment.replies);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
