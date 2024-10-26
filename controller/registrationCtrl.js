const Registration = require('../model/registrationModel');
const { createUserEmailTemplate, createAdminEmailTemplate } = require('../util/emailTemplate');
const nodemailer = require('nodemailer');
const { convert } = require('html-to-text');

// Configure nodemailer
const transporter = nodemailer.createTransport({
    host: process.env.EMAIL_HOST,
    port: process.env.EMAIL_PORT,
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
});

function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email) && !email.endsWith('.test') && !email.endsWith('.example');
}

exports.createRegistration = async (req, res) => {
  try {
      const { 
          name, 
          email, 
          phone, 
          state, 
          dob, 
          gender, 
          karateExperience, 
          otherMartialArtsExperience 
      } = req.body;

      // This portion of code is not working
      // Check for duplicate registration
      // ------------------------------------------------
      const duplicateQuery = {
          name: name.trim().toLowerCase(),
          // email: email.trim().toLowerCase(),
          phone: phone.trim(),
          state: state.trim().toLowerCase(),
          dob: new Date(dob),
          gender: gender.toLowerCase(),
          karateExperience: karateExperience.toLowerCase(),
          otherMartialArtsExperience: otherMartialArtsExperience.toLowerCase(),
          isDeleted: false
      };

      const existingRegistration = await Registration.findOne(duplicateQuery);

      if (existingRegistration) {
          return res.status(409).json({
              success: false,
              message: "A registration with identical information already exists",
              duplicateId: existingRegistration._id
          });
      }
      // ------------------------------------------------

      // Create new registration
      const registration = new Registration(req.body);
        
      // Log the registration object before saving
      console.log('Registration object before save:', registration);
      
      try {
          await registration.save();
      } catch (saveError) {
          // Log the specific save error
          console.error('Save error details:', {
              name: saveError.name,
              message: saveError.message,
              errors: saveError.errors
          });
          throw saveError; // Re-throw to be caught by outer catch
      }

      // Send email to admin
      if (process.env.EMAIL_TO) {
          const adminEmailHtml = createAdminEmailTemplate(req.body);
          const adminEmailText = convert(adminEmailHtml, { wordwrap: 130 });

          await transporter.sendMail({
              from: process.env.EMAIL_FROM,
              to: process.env.EMAIL_TO,
              subject: 'New Student Registration',
              html: adminEmailHtml,
              text: adminEmailText,
          });
      }

      // Send confirmation email to user
      if (email && isValidEmail(email)) {
          const userEmailHtml = createUserEmailTemplate(name);
          const userEmailText = convert(userEmailHtml, { wordwrap: 130 });

          await transporter.sendMail({
              from: process.env.EMAIL_FROM,
              to: email,
              subject: 'Welcome to Shubukan India',
              html: userEmailHtml,
              text: userEmailText,
          });
      }

      res.status(201).json({
          success: true,
          message: "Registration created successfully and confirmation emails sent",
          data: registration
      });

  } catch (error) {
      let errorMessage = "An error occurred while processing your registration";
      let statusCode = 400;

      if (error.name === 'ValidationError') {
          errorMessage = Object.values(error.errors).map(err => err.message).join(', ');
          statusCode = 422;
      }

      if (error.name === 'CastError') {
          errorMessage = 'Invalid data format provided';
          statusCode = 400;
      }

      res.status(statusCode).json({
          success: false,
          message: errorMessage,
          error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
  }
};
  
  // Get all registrations
  exports.getAllRegistrations = async (req, res) => {
    try {
      const registrations = await Registration.find();
      res.status(200).json({
        success: true,
        count: registrations.length,
        data: registrations
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // Get single registration
  exports.getRegistration = async (req, res) => {
    try {
      const registration = await Registration.findById(req.params.id);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // Update registration
  exports.updateRegistration = async (req, res) => {
    try {
      const registration = await Registration.findByIdAndUpdate(
        req.params.id,
        req.body,
        {
          new: true,
          runValidators: true
        }
      );
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }
      res.status(200).json({
        success: true,
        data: registration
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        error: error.message
      });
    }
  };
  
  // Delete registration
  exports.deleteRegistration = async (req, res) => {
    try {
      const registration = await Registration.findByIdAndDelete(req.params.id);
      if (!registration) {
        return res.status(404).json({
          success: false,
          error: 'Registration not found'
        });
      }
      res.status(200).json({
        success: true,
        data: {}
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  };
  