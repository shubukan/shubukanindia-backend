const Registration = require('../model/registrationModel');

exports.createRegistration = async (req, res) => {
    try {
        // Extract only the fields we want to check for duplicates
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

        // Create query object for duplicate check
        const duplicateQuery = {
            name: name.trim().toLowerCase(),
            email: email.trim().toLowerCase(),
            phone: phone.trim(),
            state: state.trim().toLowerCase(),
            dob: new Date(dob), // Convert to Date object for comparison
            gender: gender.toLowerCase(),
            karateExperience: karateExperience.toLowerCase(),
            otherMartialArtsExperience: otherMartialArtsExperience.toLowerCase(),
            isDeleted: false // Only check among non-deleted records
        };

        // Check for exact duplicate
        const existingRegistration = await Registration.findOne(duplicateQuery);

        if (existingRegistration) {
            return res.status(409).json({
                success: false,
                message: "A registration with identical information already exists",
                duplicateId: existingRegistration._id // Optional: Return the ID of the duplicate entry
            });
        }

        // If no duplicate found, create new registration
        const registration = new Registration(req.body);
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

        // Handle specific validation errors
        if (error.name === 'ValidationError') {
            errorMessage = Object.values(error.errors)
                .map(err => err.message)
                .join(', ');
            statusCode = 422;
        }

        // Handle other specific errors
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

// Optional: Helper function to check for similar registrations
exports.checkSimilarRegistrations = async (req, res) => {
    try {
        const { 
            name, 
            email, 
            phone 
        } = req.body;

        // Create an OR query to find similar registrations
        const similarQuery = {
            $or: [
                { email: email.trim().toLowerCase() },
                { phone: phone.trim() },
                { 
                    name: {
                        $regex: `^${name.trim()}$`,
                        $options: 'i'
                    }
                }
            ],
            isDeleted: false
        };

        const similarRegistrations = await Registration.find(similarQuery)
            .select('name email phone dob gender')
            .limit(5);

        return res.status(200).json({
            success: true,
            hasSimilar: similarRegistrations.length > 0,
            similarRegistrations
        });
    } catch (error) {
        res.status(400).json({
            success: false,
            message: "Error checking for similar registrations",
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
  