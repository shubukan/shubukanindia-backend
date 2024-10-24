const Registration = require('../model/registrationModel');

exports.createRegistration = async (req, res) => {
    try {
        // Extract all fields we want to check
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

        // Create query object for exact duplicate check
        const exactDuplicateQuery = {
            $and: [
                { name: name.trim() },
                { email: email.trim().toLowerCase() },
                { phone: phone.trim() },
                { state: state.trim() },
                { dob: new Date(dob) },
                { gender: gender.toLowerCase() },
                { karateExperience: karateExperience.toLowerCase() },
                { otherMartialArtsExperience: otherMartialArtsExperience.toLowerCase() },
                { isDeleted: false }
            ]
        };

        // Check for exact duplicate (all fields match)
        const existingRegistration = await Registration.findOne(exactDuplicateQuery);

        if (existingRegistration) {
            return res.status(409).json({
                success: false,
                message: "This exact registration already exists. Please modify at least one field to create a new registration.",
            });
        }

        // If not an exact duplicate, create new registration
        const registration = new Registration({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            state: state.trim(),
            dob: new Date(dob),
            gender: gender.toLowerCase(),
            karateExperience: karateExperience.toLowerCase(),
            otherMartialArtsExperience: otherMartialArtsExperience.toLowerCase()
        });

        await registration.save();

        res.status(201).json({
            success: true,
            message: "Registration created successfully",
            data: registration
        });

    } catch (error) {
        // Enhanced error handling
        let errorMessage = "An error occurred while processing your registration";
        let statusCode = 400;

        if (error.name === 'ValidationError') {
            errorMessage = Object.values(error.errors)
                .map(err => err.message)
                .join(', ');
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
  