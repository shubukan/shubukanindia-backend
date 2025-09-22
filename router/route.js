// router/route.js
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
  verifyInstructorOtp,
  signupInstructor,
  loginInstructor,
  softDeleteInstructor,
  permaDeleteInstructor,
  getAllInstructors,
  getInstructorProfile,
  updateInstructorProfile,
  logoutInstructor,
  resendInstructorOtp,
} = require("../controller/instructorCtrl");
const {
  signupStudent,
  loginStudent,
  resendStudentOtp,
  verifyStudentOtp,
  getStudentProfile,
  updateStudentProfile,
  deleteStudent,          // Admin only
  getAllStudents,         // Admin only
  getStudentsByInstructor,// Admin only
  getOutsideStudents,     // Admin only
  getMyStudents,          // Instructor
  deleteMyStudent,        // Instructor
} = require("../controller/studentCtrl");
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
const { instructorAuth } = require("../middleware/instructorAuth");
const { studentAuth } = require("../middleware/studentAuth");

// Admin APIs ---
router.post("/admin/login", adminLogin);
router.post("/admin/refresh", refreshTokenController);
router.post("/admin/logout", authMiddleware, adminLogout);
router.post("/admin/validate", authMiddleware, adminValidate);
// router.post("/admin/create", createAdmin); // one-time use

// Instructor APIs ---
router.get("/instructors", getAllInstructors);
router.post("/instructor/generate", authMiddleware, generateInstructorId);
router.delete("/instructor/soft/:iid", authMiddleware, softDeleteInstructor);
router.delete("/instructor/perma/:iid", authMiddleware, permaDeleteInstructor);

router.post("/instructor/login", loginInstructor);
router.post("/instructor/signup", signupInstructor);
router.post("/instructor/resend-otp", resendInstructorOtp);
router.post("/instructor/verify-otp", verifyInstructorOtp);
router.get("/instructor/profile", instructorAuth, getInstructorProfile);
router.put("/instructor/profile", instructorAuth, updateInstructorProfile);
router.post("/instructor/logout", instructorAuth, logoutInstructor);

// Student APIs
router.post("/student/signup", signupStudent);
router.post("/student/login", loginStudent);
router.post("/student/resend-otp", resendStudentOtp);
router.post("/student/verify-otp", verifyStudentOtp);
router.get("/student/profile", studentAuth, getStudentProfile);
router.put("/student/profile", studentAuth, updateStudentProfile);

// Instructor APIs (only see/manage their own students)
router.get("/instructor/students", instructorAuth, getMyStudents);
router.delete("/instructor/student/:sid", instructorAuth, deleteMyStudent);

// Admin APIs
router.get("/admin/students", authMiddleware, getAllStudents);
router.get("/admin/students/instructor/:iid", authMiddleware, getStudentsByInstructor);
router.get("/admin/students/outside", authMiddleware, getOutsideStudents);
router.delete("/admin/student/:sid", authMiddleware, deleteStudent);

// Public Blog APIs
router.get("/blogs", getBlogs);
router.get("/slugs", getBlogSlugs);
router.get("/blog/:slug", getBlogBySlug);
router.post("/blog/:slug/view", incrementBlogView);
// Likes/Dislikes/Comments
router.post("/send-otp", sendOTP);
router.post("/verify-otp", verifyOTP);
router.get("/blog/like/:slug", getLikesBySlug);
router.post("/blog/like/:slug", emailAuth, likeBlog);
router.post("/blog/dislike/:slug", emailAuth, dislikeBlog);
router.get("/blog/comment/:slug", getCommentsBySlug);
router.post("/blog/comment/:slug", emailAuth, addComment);
router.post("/blog/comment/reply/:slug/:commentId", emailAuth, replyComment);

// Admin Blog APIs
router.post("/blog", authMiddleware, createBlog);
router.put("/blog/:id", authMiddleware, updateBlog);
router.delete("/blog/soft/:id", authMiddleware, softDeleteBlog);
router.delete("/blog/perma/:id", authMiddleware, permanentDeleteBlog);

// Gallery APIs ---
router.post("/gallery/signature", authMiddleware, getCloudinarySignature);
router.post("/gallery", authMiddleware, createGalleryWithUrl);
router.put("/gallery/:id", authMiddleware, updateGallery);
router.get("/gallery", getGallery);
router.delete("/gallery/soft/:id", authMiddleware, softDeleteGallery);
router.delete("/gallery/perma/:id", authMiddleware, permanentDeleteGallery);

// Dojo APIs ---
router.get("/dojo", fetchAllDojo);
router.post("/dojo", authMiddleware, createDojo);
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
