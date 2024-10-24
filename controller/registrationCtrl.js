const Registration = require('../model/registrationModel');

// Create new registration
exports.createRegistration = async (req, res) => {
    try {
      const registration = new Registration(req.body);
      await registration.save();
      res.status(201).json({
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
  