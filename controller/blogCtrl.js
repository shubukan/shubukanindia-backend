const Blog = require("../model/blogModel");
const BlogUser = require("../model/blogUserModel");

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

    const query = {};

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

// ✅ Like a blog
exports.likeBlog = async (req, res) => {
  try {
    const { slug } = req.params;
    const email = req.email;

    // ensure Blog exists
    const blog = await Blog.findOne({ slug });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    // find/create BlogUser
    let blogUser = await BlogUser.findOne({ slug });
    if (!blogUser) blogUser = await BlogUser.create({ slug });

    if (blogUser.likes.includes(email)) {
      return res.status(400).json({ message: "Already liked" });
    }

    blogUser.likes.push(email);
    blogUser.dislikes = blogUser.dislikes.filter((d) => d !== email);

    blogUser.likeCount = blogUser.likes.length;
    blogUser.dislikeCount = blogUser.dislikes.length;

    await blogUser.save();

    return res.json({
      likeCount: blogUser.likeCount,
      dislikeCount: blogUser.dislikeCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Dislike a blog
exports.dislikeBlog = async (req, res) => {
  try {
    const { slug } = req.params;
    const email = req.email;

    const blog = await Blog.findOne({ slug });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    let blogUser = await BlogUser.findOne({ slug });
    if (!blogUser) blogUser = await BlogUser.create({ slug });

    if (blogUser.dislikes.includes(email)) {
      return res.status(400).json({ message: "Already disliked" });
    }

    blogUser.dislikes.push(email);
    blogUser.likes = blogUser.likes.filter((l) => l !== email);

    blogUser.likeCount = blogUser.likes.length;
    blogUser.dislikeCount = blogUser.dislikes.length;

    await blogUser.save();

    return res.json({
      likeCount: blogUser.likeCount,
      dislikeCount: blogUser.dislikeCount,
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Comment
exports.addComment = async (req, res) => {
  try {
    const { slug } = req.params;
    const { text } = req.body;

    if (!text)
      return res.status(400).json({ message: "Comment text is required" });

    let blogUser = await BlogUser.findOne({ slug });
    if (!blogUser) blogUser = await BlogUser.create({ slug });

    const comment = {
      user: req.email,
      name: req.email,
      avatar: null,
      text,
    };

    blogUser.comments.push(comment);
    await blogUser.save();

    return res.status(201).json(comment);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// ✅ Reply to a comment
exports.replyComment = async (req, res) => {
  try {
    const { slug, commentId } = req.params;
    const { text } = req.body;

    if (!text)
      return res.status(400).json({ message: "Reply text is required" });

    const blog = await Blog.findOne({ slug });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    let blogUser = await BlogUser.findOne({ slug });
    if (!blogUser) blogUser = await BlogUser.create({ slug });

    const comment = blogUser.comments.id(commentId);
    if (!comment) return res.status(404).json({ message: "Comment not found" });

    const reply = {
      user: req.email,
      name: req.email,
      avatar: null,
      text,
    };

    comment.replies.push(reply);
    await blogUser.save();

    return res.status(201).json(reply);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
