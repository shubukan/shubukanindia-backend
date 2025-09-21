// util/emailTemplate.js

exports.studentOtpEmailTemplate = (otp) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Student Email Verification</title>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .otp { font-size: 22px; font-weight: bold; color: #28a745; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Email Verification</h2>
        <p>Dear Student,</p>
        <p>Your OTP code is:</p>
        <p class="otp">${otp}</p>
        <p>This code is valid for <strong>5 minutes</strong>. Please do not share it with anyone.</p>
        <p>Regards,<br>Shubukan India</p>
      </div>
    </body>
    </html>
  `;
};

exports.instructorOtpEmailTemplate = (otp) => {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <title>Instructor Email Verification</title>
      <style>
        body { font-family: Arial, sans-serif; color: #333; }
        .container { max-width: 600px; margin: auto; padding: 20px; }
        .otp { font-size: 22px; font-weight: bold; color: #007bff; }
      </style>
    </head>
    <body>
      <div class="container">
        <h2>Email Verification</h2>
        <p>Dear Instructor,</p>
        <p>Your OTP code is:</p>
        <p class="otp">${otp}</p>
        <p>This code is valid for <strong>5 minutes</strong>. Please do not share it with anyone.</p>
        <p>Regards,<br>Shubukan India</p>
      </div>
    </body>
    </html>
  `;
};

// Email OTP template
exports.blogOtpEmailTemplate = (otp) => {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Email Verification</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .otp { font-size: 22px; font-weight: bold; color: #d9534f; }
                .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Shubukan India</h1>
                </div>
                <div class="content">
                    <h2>Email Verification</h2>
                    <p>Use the following One-Time Password (OTP) to verify your email for commenting or liking on our blog:</p>
                    <p class="otp">${otp}</p>
                    <p>This OTP is valid for <strong>5 minutes</strong>. Do not share it with anyone.</p>
                    <p>Best regards,<br>Shubukan India Team</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Shubukan India. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

exports.createUserEmailTemplate = (name) => {
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Registration Confirmation</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>Shubukan India</h1>
                </div>
                <div class="content">
                    <h2>Registration Confirmation</h2>
                    <p>Dear ${name},</p>
                    <p>Thank you for registering with Shubukan India. We are excited to have you join our community!</p>
                    <p>Our team will review your registration details and contact you soon with further information about classes and schedules.</p>
                    <p>If you have any questions in the meantime, please don't hesitate to contact us.</p>
                    <p>Best regards,<br>Shubukan India</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Shubukan India. All rights reserved.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};

exports.createAdminEmailTemplate = (registrationData) => {
    const { name, email, phone, state, dob, gender, karateExperience, otherMartialArtsExperience } = registrationData;
    
    return `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>New Registration Notification</title>
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background-color: #f4f4f4; padding: 20px; text-align: center; }
                .content { padding: 20px; }
                .footer { background-color: #f4f4f4; padding: 20px; text-align: center; font-size: 12px; }
                table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                th, td { padding: 10px; border-bottom: 1px solid #ddd; text-align: left; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>New Student Registration</h1>
                </div>
                <div class="content">
                    <h2>Registration Details</h2>
                    <table>
                        <tr><td><strong>Name:</strong></td><td>${name}</td></tr>
                        <tr><td><strong>Email:</strong></td><td>${email}</td></tr>
                        <tr><td><strong>Phone:</strong></td><td>${phone}</td></tr>
                        <tr><td><strong>State:</strong></td><td>${state}</td></tr>
                        <tr><td><strong>Date of Birth:</strong></td><td>${new Date(dob).toLocaleDateString()}</td></tr>
                        <tr><td><strong>Gender:</strong></td><td>${gender}</td></tr>
                        <tr><td><strong>Karate Experience:</strong></td><td>${karateExperience}</td></tr>
                        <tr><td><strong>Other Martial Arts Experience:</strong></td><td>${otherMartialArtsExperience}</td></tr>
                    </table>
                    <p>Please review and process this registration at your earliest convenience.</p>
                </div>
                <div class="footer">
                    <p>© ${new Date().getFullYear()} Shubukan India</p>
                    <p>This is an automated message from your registration system.</p>
                </div>
            </div>
        </body>
        </html>
    `;
};