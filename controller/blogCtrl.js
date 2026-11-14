// controller/blogCtrl.js
const Blog = require("../model/blogModel");
const BlogUser = require("../model/blogUserModel");
const BlogView = require("../model/blogViewModel");
const crypto = require("crypto");
const { sendEmail } = require("../util/sendEmail");
const { blogOtpEmailTemplate } = require("../util/emailTemplate");
const { createEmailSession, hashValue } = require("../middleware/emailAuth");
const { EmailOtp } = require("../model/emailAuthModel");
const cloudinary = require("../config/cloudinary");

exports.getCloudBlogSignature = async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);

    // Generate the signature
    const signature = cloudinary.utils.api_sign_request(
      {
        timestamp: timestamp,
        folder: "Shubukan/Blog",
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

// Build the shared filter for blog lists
function buildBlogQuery({ category, tags, search }) {
  const query = {};
  if (category) query["category.primary"] = category;
  if (tags) {
    const tagArray = Array.isArray(tags) ? tags : String(tags).split(",");
    query.tags = { $in: tagArray };
  }
  if (search) {
    // escape regex metacharacters so user input can't break / slow the query
    const safe = String(search).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    query.$or = [
      { title: { $regex: safe, $options: "i" } },
      { summary: { $regex: safe, $options: "i" } },
    ];
  }
  return query;
}

function pageParams(req, defaultLimit) {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || defaultLimit));
  return { page, limit, skip: (page - 1) * limit };
}

// Public: list published blogs (with filters, pagination, sorting).
// Always published-only, and without the full article body (`sections`),
// which list views never use.
exports.getBlogs = async (req, res) => {
  try {
    const query = { ...buildBlogQuery(req.query), status: "published" };
    const { page, limit, skip } = pageParams(req, 10);

    const [blogs, total] = await Promise.all([
      Blog.find(query)
        .select("-sections")
        .sort({ publishedDate: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Blog.countDocuments(query),
    ]);

    return res.json({
      blogs,
      total,
      currentPage: page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Admin: list all blogs including drafts, full documents (used by the editor).
exports.getAdminBlogs = async (req, res) => {
  try {
    const query = buildBlogQuery(req.query);
    if (req.query.status) query.status = req.query.status;
    const { page, limit, skip } = pageParams(req, 50);

    const [blogs, total] = await Promise.all([
      Blog.find(query).sort({ publishedDate: -1 }).skip(skip).limit(limit).lean(),
      Blog.countDocuments(query),
    ]);

    return res.json({
      blogs,
      total,
      currentPage: page,
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
    const blog = await Blog.findOne({ slug, status: "published" }).lean();

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
// Blog reader email OTP - stored in MongoDB (see model/emailAuthModel.js)
const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_MS = 60 * 1000; // at most one email per minute per address
const OTP_MAX_ATTEMPTS = 5;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Send OTP
exports.sendOTP = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    if (!EMAIL_RE.test(email))
      return res.status(400).json({ message: "Valid email required" });

    const existing = await EmailOtp.findOne({ email }).lean();
    if (existing && existing.expiresAt - OTP_TTL_MS + OTP_RESEND_MS > Date.now()) {
      return res
        .status(429)
        .json({ message: "Please wait a minute before requesting another OTP" });
    }

    const otp = crypto.randomInt(100000, 1000000).toString();
    await EmailOtp.findOneAndUpdate(
      { email },
      { otpHash: hashValue(otp), attempts: 0, expiresAt: new Date(Date.now() + OTP_TTL_MS) },
      { upsert: true }
    );

    const html = blogOtpEmailTemplate(otp);
    await sendEmail(email, "Verify your email - Shubukan India", html);

    res.json({ message: "OTP sent to email" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

// Verify OTP
exports.verifyOTP = async (req, res) => {
  try {
    const email = String(req.body.email || "").trim().toLowerCase();
    const otp = String(req.body.otp || "").trim();

    const data = await EmailOtp.findOne({ email });
    if (!data || data.expiresAt < new Date())
      return res.status(400).json({ message: "OTP expired or not sent" });
    if (data.attempts >= OTP_MAX_ATTEMPTS) {
      await data.deleteOne();
      return res.status(429).json({ message: "Too many attempts, request a new OTP" });
    }
    if (data.otpHash !== hashValue(otp)) {
      data.attempts += 1;
      await data.save();
      return res.status(400).json({ message: "Invalid OTP" });
    }

    await data.deleteOne();
    const token = await createEmailSession(email);

    res.json({ message: "Email verified", token, email });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
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
