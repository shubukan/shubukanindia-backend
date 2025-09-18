const express = require("express");
const router = express.Router();

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
  verifyOTP,
  sendOTP,
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
  generateInstructorId,
  sendInstructorOtp,
  verifyInstructorOtp,
  signupInstructor,
  loginInstructor,
  softDeleteInstructor,
  permaDeleteInstructor,
  getAllInstructors,
} = require("../controller/instructorCtrl");
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
  refreshTokenController,
  adminLogout,
} = require("../controller/adminCtrl");
const { authMiddleware } = require("../middleware/authMiddleware");
const { emailAuth } = require("../middleware/emailAuth");

// Admin APIs ---
router.post("/admin/create", createAdmin); // one-time use
router.post("/admin/auth", adminLogin);
router.post("/admin/refresh", refreshTokenController);
router.post("/admin/logout", authMiddleware, adminLogout);
router.post("/admin/validate", authMiddleware, adminValidate);

// Public Blog APIs
router.get("/blogs", getBlogs);
router.get("/slugs", getBlogSlugs);
router.get("/blog/:slug", getBlogBySlug);
router.post("/blog/:slug/view", incrementBlogView);
// Likes/Dislikes/Comments
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
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

// Instructor APIs ---
router.post("/instructor/generate", authMiddleware, generateInstructorId);
router.get("/instructors", getAllInstructors);
router.delete(
  "/instructor/soft/:instructorid",
  authMiddleware,
  softDeleteInstructor
);
router.delete(
  "/instructor/perma/:instructorid",
  authMiddleware,
  permaDeleteInstructor
);

router.post("/instructor/signup", signupInstructor);
router.post("/instructor/login", loginInstructor);
router.post("/instructor/send-otp", sendInstructorOtp);
router.post("/instructor/verify-otp", verifyInstructorOtp);

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

// Debug API
router.get("/debug", (_, res) => {
  let data = "😍 V3";
  return res.send({ data: data });
});

module.exports = router;
