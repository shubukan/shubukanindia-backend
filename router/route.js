const express = require("express");
const router = express.Router();
const crypto = require("crypto");

const { authMiddleware } = require("../middleware/authMiddleware");
const { emailAuth } = require("../middleware/emailAuth");
const { sendEmail } = require("../util/sendEmail");
const { blogOtpEmailTemplate } = require("../util/emailTemplate");
const { addVerifiedUser } = require("../middleware/emailAuth");
const {
  createBlog,
  getBlogs,
  getBlogBySlug,
  updateBlog,
  softDeleteBlog,
  permanentDeleteBlog,
  likeBlog,
  dislikeBlog,
  addComment,
  replyComment,
  getCommentsBySlug,
  getLikesBySlug,
  incrementBlogView,
  getBlogSlugs,
} = require("../controller/blogCtrl");
const {
  createGallery,
  getGallery,
  updateGallery,
  softDeleteGallery,
  permanentDeleteGallery,
  getCloudinarySignature,
  createGalleryWithUrl,
} = require("../controller/galleryCtrl");
const {
  createDojo,
  fetchAllDojo,
  updateDojo,
  deleteDojo,
} = require("../controller/dojoCtrl");
const {
  createRegistration,
  getAllRegistrations,
  getRegistration,
  updateRegistration,
  deleteRegistration,
} = require("../controller/registrationCtrl");
const {
  createMarksheet,
  getAMarksheet,
  getMarksheetSignature,
  deleteMarksheet,
} = require("../controller/marksheetCtrl");
const {
  createAdmin,
  adminLogin,
  adminValidate,
} = require("../controller/adminCtrl");

// Debug API
router.get("/debug", (_, res) => {
  let data = "😍 V3";
  return res.send({ data: data });
});

// Admin APIs ---
router.post("/admin/auth", adminLogin);
router.post("/admin/validate", authMiddleware, adminValidate);

// Temporary in-memory store (better: Redis or DB)
const otpStore = new Map();

// Send OTP
router.post("/send-otp", async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ message: "Email required" });

  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  otpStore.set(email, { otp, expiresAt: Date.now() + 5 * 60 * 1000 });

  const html = blogOtpEmailTemplate(otp);
  await sendEmail(email, "Verify your email - Shubukan India", html);

  res.json({ message: "OTP sent to email" });
});

// Verify OTP
router.post("/verify-otp", (req, res) => {
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
});

// Public Blog APIs
router.get("/blogs", getBlogs);
router.get("/slugs", getBlogSlugs);
router.get("/blog/:slug", getBlogBySlug);
router.post("/blog/:slug/view", incrementBlogView);
// Likes/Dislikes/Comments
router.post("/blog/like/:slug", emailAuth, likeBlog);
router.post("/blog/dislike/:slug", emailAuth, dislikeBlog);
router.post("/blog/comment/:slug", emailAuth, addComment);
router.post("/blog/comment/reply/:slug/:commentId", emailAuth, replyComment);
router.get("/blog/like/:slug", getLikesBySlug);
router.get("/blog/comment/:slug", getCommentsBySlug);

// Admin Blog APIs
router.post("/blog", createBlog);
router.put("/blog/:id", authMiddleware, updateBlog);
router.delete("/blog/soft/:id", authMiddleware, softDeleteBlog);
router.delete("/blog/perma/:id", authMiddleware, permanentDeleteBlog);

// Gallery APIs ---
router.post("/gallery/signature", authMiddleware, getCloudinarySignature);
router.post("/gallery", authMiddleware, createGalleryWithUrl);
router.get("/gallery", getGallery);
router.put("/gallery/:id", authMiddleware, updateGallery);
router.delete("/gallery/soft/:id", authMiddleware, softDeleteGallery);
router.delete("/gallery/perma/:id", authMiddleware, permanentDeleteGallery);

// Dojo APIs ---
router.post("/dojo", authMiddleware, createDojo);
router.get("/dojo", fetchAllDojo);
router.put("/dojo/:id", authMiddleware, updateDojo);
router.delete("/dojo/:id", authMiddleware, deleteDojo);

// Marksheet APIs ---
router.post("/marksheet/signature", authMiddleware, getMarksheetSignature);
router.post("/marksheet", authMiddleware, createMarksheet);
router.put("/marksheet", authMiddleware, createMarksheet);
router.get("/marksheet", getAMarksheet);
router.delete("/marksheet/:id", authMiddleware, deleteMarksheet);

// Registration APIs ---
router.route("/registration").post(createRegistration).get(getAllRegistrations);

router
  .route("/registration/:id")
  .get(getRegistration)
  .put(authMiddleware, updateRegistration)
  .delete(authMiddleware, deleteRegistration);

module.exports = router;
