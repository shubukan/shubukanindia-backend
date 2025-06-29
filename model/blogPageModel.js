const mongoose = require("mongoose");

const blogPageSchema = new mongoose.Schema({})

module.exports = mongoose.model("BlogPage", blogPageSchema);