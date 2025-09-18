const Blog = require("../model/blogModel");
const BlogUser = require("../model/blogUserModel");
const BlogView = require("../model/blogViewModel");
const crypto = require("crypto");
const { sendEmail } = require("../util/sendEmail");
const { blogOtpEmailTemplate } = require("../util/emailTemplate");
const { addVerifiedUser } = require("../middleware/emailAuth");

exports.incrementBlogView = async (req, res) => {
  try {
    const { slug } = req.params;
    const clientIp =
      req.headers["x-forwarded-for"]?.split(",")[0] || req.socket.remoteAddress;
    const userAgent = req.headers["user-agent"] || "unknown";

    const blog = await Blog.findOne({ slug });
    if (!blog) return res.status(404).json({ message: "Blog not found" });

    const alreadyViewed = await BlogView.findOne({
      blogId: blog._id,
      ip: clientIp,
      userAgent,
    });

    if (!alreadyViewed) {
      blog.viewCount += 1;
      await blog.save();
      await BlogView.create({ blogId: blog._id, ip: clientIp, userAgent });
    }

    return res.json({ success: true });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Create a blog
exports.createBlog = async (req, res) => {
  try {
    const blog = await Blog.create(req.body);
    return res.status(201).json(blog);
  } catch (error) {
    return res.status(400).json({ message: error.message });
  }
};

// Get all blog slugs with minimal SEO data
exports.getBlogSlugs = async (req, res) => {
  try {
    const blogs = await Blog.find(
      { status: "published", visibility: "public" }, // Only public published blogs
      "title slug thumbnailImage summary tags" // Only select required fields
    ).sort({ publishedDate: -1 });

    return res.json({ blogs });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Get all blogs (with filters, pagination, sorting)
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

// Get single blog by slug
exports.getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug });

    if (!blog) return res.status(404).json({ message: "Blog not found" });

    return res.json(blog);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Update blog
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

// Soft delete blog
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

// Permanent delete blog
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

// ------------------------------------------
// Temporary in-memory store (better: Redis or DB)
const otpStore = new Map();

// Send OTP
exports.sendOTP = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  const html = blogOtpEmailTemplate(otp);
  await sendEmail(email, "Verify your email - Shubukan India", html);

  res.json({ message: "OTP sent to email" });
};

// Verify OTP
exports.verifyOTP = (req, res) => {
  const { email, otp } = req.body;
  const data = otpStore.get(email);

  if (!data) return res.status(400).json({ message: "No OTP sent" });
  if (Date.now() > data.expiresAt)
    return res.status(400).json({ message: "OTP expired" });
  if (data.otp !== otp) return res.status(400).json({ message: "Invalid OTP" });

  otpStore.delete(email);

  // Generate a simple session token (or JWT if you want)
  const token = crypto.randomBytes(16).toString("hex");

  // ✅ Save session in verified users list
  addVerifiedUser(email, token);

  res.json({ message: "Email verified", token });
};

// Like a blog
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

// Get likes by slug
exports.getLikesBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blogUser = await BlogUser.findOne({ slug });

    if (!blogUser) return res.status(404).json({ message: "Blog not found" });

    return res.json({ likes: blogUser.likeCount });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Dislike a blog
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

// Get comments by slug
exports.getCommentsBySlug = async (req, res) => {
  try {
    const { slug } = req.params;

    const blogUser = await BlogUser.findOne({ slug });

    if (!blogUser) return res.status(404).json({ message: "Blog not found" });

    return res.json(blogUser.comments);
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Reply to a comment
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
