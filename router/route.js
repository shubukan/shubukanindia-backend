const express = require("express");
const router = express.Router();

const { createDojo, fetchDojo } = require("../controller/dojoCtrl");
const {
  createRegistration,
  getAllRegistrations,
  getRegistration,
  updateRegistration,
  deleteRegistration,
} = require("../controller/registrationCtrl");

// Debug API
router.get("/debug", (_, res) => {
  let data = "😍";
  return res.send({ data: data });
});

// ToDo APIs ---
router.post("/createdojo", createDojo);
router.get("/fetchdojo", fetchDojo);

router.route('/registration')
  .post(createRegistration)
  .get(getAllRegistrations);

router.route('/registration/:id')
  .get(getRegistration)
  .put(updateRegistration)
  .delete(deleteRegistration);

module.exports = router;
