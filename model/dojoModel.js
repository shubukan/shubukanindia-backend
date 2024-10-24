const mongoose = require("mongoose");

module.exports = mongoose.model(
  "dojo",

  new mongoose.Schema(
    {
        dojoName: String,
        dojoType: String,
        instructor: String,
        image: String,
        contact: [{ type: [String], default: [] }],
        brunch: [{
          mainLocation: String,
          brunchAddress: [{ type: String, default: [] }]
        }]
    },
    { timestamps: true }
  )
);
