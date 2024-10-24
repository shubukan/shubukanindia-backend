const mongoose = require('mongoose');

const registrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  state: {
    type: String,
    required: true,
    trim: true
  },
  dob: {
    type: Date,
    required: true
  },
  gender: {
    type: String,
    enum: ['male', 'female'],
    required: true
  },
  karateExperience: {
    type: String,
    enum: ['yes', 'no'],
    // required: true
  },
  otherMartialArtsExperience: {
    type: String,
    enum: ['yes', 'no'],
    // required: true
  },
  isFavorite: {
    type: Boolean,
    default: false
  },
  isDeleted: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Add virtual field for age
registrationSchema.virtual('age').get(function() {
  return Math.floor((new Date() - new Date(this.dob)) / (365.25 * 24 * 60 * 60 * 1000));
});

// Ensure virtuals are included in JSON
registrationSchema.set('toJSON', { virtuals: true });

module.exports = mongoose.model('registration', registrationSchema);