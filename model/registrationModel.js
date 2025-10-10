const mongoose = require("mongoose");

const registrationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters long"],
      maxlength: [100, "Name cannot exceed 100 characters"],
    },
    xmail: {
      type: String,
      trim: true,
      required: [true, "Email is required"],
      trim: true,
      lowercase: true,
      validate: {
        validator: function (v) {
          return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
        },
        message: (props) => `${props.value} is not a valid email address!`,
      },
    },
    phone: {
      type: String,
      trim: true,
      required: [true, "Phone number is required"],
      trim: true,
      validate: {
        validator: function (v) {
          return /^\d{6,15}$/.test(v);
        },
        message: (props) => `${props.value} is not a valid phone number!`,
      },
    },
    state: {
      type: String,
      trim: true,
      required: [true, "State is required"],
      trim: true,
      minlength: [2, "State must be at least 2 characters long"],
      maxlength: [50, "State cannot exceed 50 characters"],
    },
    dob: {
      type: Date,
      required: [true, "Date of birth is required"],
      validate: {
        validator: function (v) {
          return v && v.getTime() < new Date().getTime();
        },
        message: "Date of birth cannot be in the future!",
      },
    },
    gender: {
      type: String,
      trim: true,
      enum: {
        values: ["male", "female"],
        message: "{VALUE} is not a valid gender",
      },
      required: [true, "Gender is required"],
      lowercase: true,
    },
    karateExperience: {
      type: String,
      trim: true,
      enum: {
        values: ["yes", "no"],
        message: "{VALUE} is not a valid response for karate experience",
      },
      required: [true, "Karate experience information is required"],
      lowercase: true,
    },
    otherMartialArtsExperience: {
      type: String,
      trim: true,
      enum: {
        values: ["yes", "no"],
        message:
          "{VALUE} is not a valid response for other martial arts experience",
      },
      required: [true, "Other martial arts experience information is required"],
      lowercase: true,
    },
    isFavorite: {
      type: Boolean,
      default: false,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    id: true,
  }
);

// Add virtual field for age
registrationSchema.virtual("age").get(function () {
  return Math.floor(
    (new Date() - new Date(this.dob)) / (365.25 * 24 * 60 * 60 * 1000)
  );
});

// Ensure virtuals are included in JSON
registrationSchema.set("toJSON", { virtuals: true });

// Pre-save middleware to validate date
registrationSchema.pre("save", function (next) {
  if (this.dob) {
    const dobDate = new Date(this.dob);
    if (isNaN(dobDate.getTime())) {
      next(new Error("Invalid date format for date of birth"));
    }
    if (dobDate > new Date()) {
      next(new Error("Date of birth cannot be in the future"));
    }
  }
  next();
});

module.exports = mongoose.model("Registration", registrationSchema);
