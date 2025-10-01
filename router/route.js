// router/route.js
const express = require("express");
const router = express.Router();

const {
  createBlog,
  getBlogs,
  getBlogBySlug,
  getCloudBlogSignature,
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
  getCloudGallerySignature,
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
  editInstructor,
  getPublicInstructors,
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
  getOutsideStudents,     // Admin only
  getStudentsByInstructor,// Admin only
  searchAllStudentsByName,// Admin only
  searchMyStudentsByName, // Instructor
  getMyStudents,          // Instructor
  deleteMyStudent,        // Instructor
} = require("../controller/studentCtrl");
const {
  createQuestion,
  updateQuestion,
  deleteQuestion,
  getAllQuestions
} = require("../controller/questionCtrl");
const {
  createExam,
  createExamSet,
  updateExam,
  deleteExam,
  getUpcomingExams,
  startExam,
  getAllExams
} = require("../controller/examCtrl");
const {
  submitExam,
  getResultsByInstructor,
  searchResultsByStudentName,
  viewAnswerSheet,
  getQuestionPaper,
  getMyResults,
  getAllResults
} = require("../controller/resultCtrl");
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

// Public Instructor APIs
router.get("/instructors", getPublicInstructors);
router.post("/instructor/login", loginInstructor);
router.post("/instructor/signup", signupInstructor);
router.post("/instructor/resend-otp", resendInstructorOtp);
router.post("/instructor/verify-otp", verifyInstructorOtp);
// Instructor APIs
router.post("/instructor/logout", instructorAuth, logoutInstructor);
router.get("/instructor/profile", instructorAuth, getInstructorProfile);
router.put("/instructor/profile", instructorAuth, updateInstructorProfile);
// Admin Instructor APIs
router.get("/admin/instructors", getAllInstructors);
router.put("/admin/instructor/edit/:iid", authMiddleware, editInstructor);
router.post("/admin/instructor/generate", authMiddleware, generateInstructorId);
router.delete("/admin/instructor/soft/:iid", authMiddleware, softDeleteInstructor);
router.delete("/admin/instructor/perma/:iid", authMiddleware, permaDeleteInstructor);

// Student APIs
router.post("/student/login", loginStudent);
router.post("/student/signup", signupStudent);
router.post("/student/resend-otp", resendStudentOtp);
router.post("/student/verify-otp", verifyStudentOtp);
router.get("/student/profile", studentAuth, getStudentProfile);
router.put("/student/profile", studentAuth, updateStudentProfile);
// Instructor only see/manage their own students
router.get("/instructor/students", instructorAuth, getMyStudents);
router.delete("/instructor/student/:sid", instructorAuth, deleteMyStudent);
router.get("/instructor/student/search", instructorAuth, searchMyStudentsByName);
// Admin Student APIs
router.get("/admin/students", authMiddleware, getAllStudents);
router.get("/admin/student/search", authMiddleware, searchAllStudentsByName);
router.get("/admin/student/:iid", authMiddleware, getStudentsByInstructor);
router.get("/admin/students/outside", authMiddleware, getOutsideStudents);
router.delete("/admin/student/:sid", authMiddleware, deleteStudent);

// QUESTION routes
router.get("/admin/questions", authMiddleware, getAllQuestions);
router.post("/admin/question", authMiddleware, createQuestion); // admin create
router.put("/admin/question/:id", authMiddleware, updateQuestion); // admin update
router.delete("/admin/question/:id", authMiddleware, deleteQuestion); // admin delete

// EXAM routes
router.get("/admin/exams", authMiddleware, getAllExams);
router.post("/admin/exam", authMiddleware, createExam); // admin create exam
router.post("/admin/exam/:examID/set", authMiddleware, createExamSet); // admin create another set for examID
router.put("/admin/exam/:id", authMiddleware, updateExam); // admin edit upcoming exam
router.delete("/admin/exam/:id", authMiddleware, deleteExam); // admin delete upcoming exam

// fetch upcoming exams (public)
router.get("/exams/upcoming", getUpcomingExams);

// Admin view result
router.get("/admin/results", authMiddleware, getAllResults);

// STUDENT routes to start and submit
router.post("/student/exam/start", studentAuth, startExam); // body: { examID, examSet, password? }
router.post("/student/exam/:examId/submit", studentAuth, submitExam);
router.get("/student/results", studentAuth, getMyResults);

// INSTRUCTOR routes
router.get("/instructor/results", instructorAuth, getResultsByInstructor); // optional ?date=YYYY-MM-DD
router.get("/instructor/result/search", instructorAuth, searchResultsByStudentName); // ?name=...
router.get("/instructor/result/:resultId/sheet", instructorAuth, viewAnswerSheet);
router.get("/instructor/question-papers", instructorAuth, getQuestionPaper); // ?kyu=&fromDate=&toDate=


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
router.post("/blog/signature", authMiddleware, getCloudBlogSignature);
router.post("/blog", authMiddleware, createBlog);
router.put("/blog/:id", authMiddleware, updateBlog);
router.delete("/blog/soft/:id", authMiddleware, softDeleteBlog);
router.delete("/blog/perma/:id", authMiddleware, permanentDeleteBlog);

// Gallery APIs ---
router.post("/gallery/signature", authMiddleware, getCloudGallerySignature);
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
