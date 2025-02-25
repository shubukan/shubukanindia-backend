const express = require("express");
const router = express.Router();
const multer = require("multer");
// Configure Multer to store files in memory
const upload = multer({ storage: multer.memoryStorage() })

const {
  createGallery,
  getGallery,
  updateGallery,
  softDeleteGallery,
  permanentDeleteGallery,
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
  createAdmin,
  adminLogin,
  adminValidate,
} = require("../controller/adminCtrl");
const { authMiddleware } = require("../middleware/authMiddleware");

// Debug API
router.get("/debug", (_, res) => {
  let data = "😍 V3";
  return res.send({ data: data });
});

// Admin APIs ---
router.post("/admin/auth", adminLogin);
router.post("/admin/validate", authMiddleware, adminValidate);

// Admin protected APIs ---

// Gallery APIs ---
router.post("/gallery", upload.single("image"), createGallery);
router.get("/gallery", getGallery);
router.put("/gallery/:id", authMiddleware, upload.single("image"), updateGallery);
router.delete("/gallery/soft/:id", authMiddleware, softDeleteGallery);
router.delete("/gallery/perma/:id", authMiddleware, permanentDeleteGallery);

// Dojo APIs ---
router.post("/dojo", authMiddleware, createDojo);
router.get("/dojo", fetchAllDojo);
router.put("/dojo/:id", authMiddleware, updateDojo);
router.delete("/dojo/:id", authMiddleware, deleteDojo);

// Registration APIs ---
router.route("/registration").post(createRegistration).get(getAllRegistrations);

router
  .route("/registration/:id")
  .get(getRegistration)
  .put(authMiddleware, updateRegistration)
  .delete(authMiddleware, deleteRegistration);

module.exports = router;
