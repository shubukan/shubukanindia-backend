// util/emailTemplate.js

const logoUrl =
  "https://res.cloudinary.com/daspiwjet/image/upload/v1755369663/shubukan_kjeaou.png";
const year = new Date().getFullYear();

// Shared colors from your palette
const COLORS = {
  dark: "#3C3A36",
  charcoal: "#403D3C",
  warmBeige: "#D9C8A9",
  softCream: "#F5F0E6",
  accentOrange: "#F2935C",
  accentPeach: "#F28157",
  deepRed: "#B23A48",
  olive: "#7B9E89",
  forest: "#6A994E",
  pale: "#F2F2F2",
  muted: "#594943",
  gold: "#C19A6B",
};

const baseStyles = `
  margin:0;padding:0;background-color:${COLORS.softCream};
  font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif;
  color:${COLORS.dark};
`;

/**
 * Helper to sanitize simple text into HTML-safe (very small helper).
 * (Note: for production consider a proper sanitizer if inputs are untrusted)
 */
const escapeHtml = (str = "") =>
  String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

/* ===== STUDENT OTP ===== */
exports.studentOtpEmailTemplate = (otp) => {
  const safeOtp = escapeHtml(otp);
  return `
  <!doctype html>
  <html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width,initial-scale=1" />
    <title>Verify your email — Shubukan India</title>
  </head>
  <body style='${baseStyles}'>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr>
        <td align="center" style="padding:24px 12px;">
          <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#ffffff;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(60,58,54,0.08);">
            <tr style="background:${COLORS.charcoal};color:${COLORS.warmBeige}">
              <td style="padding:18px 22px;display:flex;align-items:center;gap:12px;">
                <img src="${logoUrl}" width="56" height="56" alt="Shubukan India" style="display:block;border-radius:8px;object-fit:cover" />
                <div>
                  <h1 style="margin:0;font-size:18px;letter-spacing:0.2px;">Shubukan India</h1>
                  <div style="font-size:12px;color:${COLORS.warmBeige};opacity:0.95;">Martial Student Verification</div>
                </div>
              </td>
            </tr>

            <tr>
              <td style="padding:28px 34px 18px;">
                <h2 style="margin:0 0 8px;color:${COLORS.dark};font-size:20px;">Verify your email</h2>
                <p style="margin:0 0 16px;color:${COLORS.muted};line-height:1.5;">Dear Student,</p>

                <div style="font-size:13px;color:${COLORS.muted};margin-bottom:8px;">Your One-Time Password (OTP)</div>
                
                <div style="margin:18px 0;padding:18px;border-radius:10px;background:${COLORS.pale};display:flex;align-items:center;justify-content:center;flex-direction:column;">
                  
                  <div style="font-family: 'Courier New', monospace; font-weight:700;font-size:34px;color:${COLORS.forest};letter-spacing:4px;background:#fff;padding:10px 20px;border-radius:8px;box-shadow:0 2px 8px rgba(0,0,0,0.04);">
                    ${safeOtp}
                  </div>
                  
                </div>

                <div style="margin-top:10px;font-size:13px;color:${COLORS.muted};">Valid for <strong>5 minutes</strong></div>

                <p style="color:${COLORS.dark};line-height:1.5;margin:14px 0 0;">
                  Keep this code confidential. If you didn't request this, please ignore this email or contact support.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:18px 34px 32px;">
                <hr style="border:none;border-top:1px solid #eee;margin:18px 0;" />

                <div style="font-size:13px;color:${COLORS.muted};">
                  Regards,<br/><strong style="color:${COLORS.charcoal}">Shubukan India</strong>
                </div>
              </td>
            </tr>

            <tr style="background:${COLORS.warmBeige};color:${COLORS.charcoal};font-size:12px;">
              <td style="padding:12px 22px;text-align:center;">
                © ${year} Shubukan India — All rights reserved
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
  </html>
  `;
};

/* ===== INSTRUCTOR OTP ===== */
exports.instructorOtpEmailTemplate = (otp) => {
  const safeOtp = escapeHtml(otp);
  return `
  <!doctype html>
  <html lang="en">
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style='${baseStyles}'>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:20px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(60,58,54,0.06);">
          <tr style="background:${COLORS.gold};color:#fff;">
            <td style="padding:16px 20px;display:flex;gap:12px;align-items:center;">
              <img src="${logoUrl}" width="48" height="48" alt="Shubukan India" style="border-radius:6px;display:block" />
              <div>
                <strong style="display:block;font-size:16px;">Shubukan India</strong>
                <small style="opacity:0.9;">Instructor verification</small>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:26px 28px;">
              <h2 style="margin:0 0 8px;color:${COLORS.charcoal};font-size:20px;">Instructor OTP</h2>
              <p style="margin:0 0 18px;color:${COLORS.muted};line-height:1.5;">Hello Instructor — use the code below to complete your sign-in or registration.</p>

              <div style="text-align:center;margin:18px 0;">
                <div style="display:inline-block;padding:16px 22px;border-radius:10px;background:${COLORS.accentPeach};box-shadow:0 4px 12px rgba(0,0,0,0.06);">
                  <div style="font-family:'Courier New',monospace;font-size:32px;font-weight:700;color:#fff;letter-spacing:3px;">
                    ${safeOtp}
                  </div>
                </div>
                <div style="margin-top:10px;font-size:13px;color:${COLORS.muted};">Expires in <strong>5 minutes</strong></div>
              </div>

              <p style="color:${COLORS.dark};margin-top:8px;">For security, do not share this code with anyone. If you did not request this, please contact support.</p>
            </td>
          </tr>

          <tr style="background:${COLORS.pale};">
            <td style="padding:14px 20px;text-align:center;color:${COLORS.muted};font-size:13px;">
              © ${year} Shubukan India
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
};

/* ===== BLOG OTP ===== */
exports.blogOtpEmailTemplate = (otp) => {
  const safeOtp = escapeHtml(otp);
  return `
  <!doctype html>
  <html lang="en">
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style='${baseStyles}'>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:22px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:12px;overflow:hidden;">
          <tr style="background:${COLORS.deepRed};color:#fff;">
            <td style="padding:14px 18px;text-align:center;">
              <img src="${logoUrl}" width="44" height="44" alt="Shubukan India" style="display:block;margin:0 auto 8px;border-radius:6px"/>
              <strong style="font-size:18px;">Shubukan India — Blog</strong>
            </td>
          </tr>

          <tr>
            <td style="padding:20px 22px;">
              <h2 style="margin:0 0 8px;color:${COLORS.charcoal};font-size:18px;">Commenting / Interaction OTP</h2>
              <p style="margin:0 0 12px;color:${COLORS.muted};">Use the OTP below to verify actions like commenting, liking or replying on our blog.</p>

              <div style="margin:14px 0;padding:12px;border-radius:8px;background:${COLORS.pale};text-align:center;">
                <span style="font-family:'Courier New',monospace;font-size:28px;font-weight:700;color:${COLORS.deepRed};">
                  ${safeOtp}
                </span>
                <div style="font-size:13px;color:${COLORS.muted};margin-top:8px;">Valid for <strong>5 minutes</strong></div>
              </div>

              <p style="color:${COLORS.dark};margin-top:6px;">If you didn't request this, safely ignore this message.</p>
            </td>
          </tr>

          <tr style="background:${COLORS.warmBeige};color:${COLORS.charcoal};text-align:center;font-size:12px;">
            <td style="padding:12px 18px;">© ${year} Shubukan India. All rights reserved.</td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
};

/* ===== CREATE USER (REGISTRATION CONFIRMATION) ===== */
exports.createUserEmailTemplate = (name) => {
  const safeName = escapeHtml(name);
  return `
  <!doctype html>
  <html lang="en">
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style='${baseStyles}'>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:24px 12px;">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 6px 18px rgba(0,0,0,0.04);">
          <tr style="background:${COLORS.olive};color:#fff;">
            <td style="padding:18px 20px;display:flex;gap:12px;align-items:center;">
              <img src="${logoUrl}" width="48" height="48" alt="Shubukan India" style="border-radius:6px;display:block"/>
              <div>
                <strong style="display:block;font-size:16px;">Shubukan India</strong>
                <small style="opacity:0.95;">Welcome to our community</small>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:22px 26px;">
              <h2 style="margin:0 0 8px;color:${COLORS.charcoal};font-size:20px;">Welcome, ${safeName}!</h2>
              <p style="margin:0 0 12px;color:${COLORS.muted};line-height:1.5;">
                Thank you for registering with Shubukan India. We're excited to have you with us. Our team will review your details and reach out with class details and next steps soon.
              </p>

              <div style="margin-top:16px;">
                <a href="#" style="display:inline-block;padding:10px 14px;border-radius:8px;background:${COLORS.accentOrange};color:#fff;text-decoration:none;font-weight:600;">Explore Classes</a>
                <span style="margin-left:12px;color:${COLORS.muted};font-size:13px;">or check your dashboard</span>
              </div>

              <p style="color:${COLORS.dark};margin-top:18px;">If you have questions, reply to this email or contact us via our site.</p>
            </td>
          </tr>

          <tr style="background:${COLORS.pale};color:${COLORS.muted};text-align:center;font-size:12px;">
            <td style="padding:14px 18px;">
              © ${year} Shubukan India — Empowering martial arts journeys.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
};

/* ===== CREATE ADMIN NOTIFICATION ===== */
exports.createAdminEmailTemplate = (registrationData = {}) => {
  const {
    name = "",
    email = "",
    phone = "",
    state = "",
    dob = "",
    gender = "",
    karateExperience = "",
    otherMartialArtsExperience = "",
  } = registrationData;

  return `
  <!doctype html>
  <html lang="en">
  <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/></head>
  <body style='${baseStyles}'>
    <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
      <tr><td align="center" style="padding:20px 12px;">
        <table width="700" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 8px 26px rgba(60,58,54,0.06);">
          <tr style="background:${COLORS.charcoal};color:${COLORS.warmBeige};">
            <td style="padding:16px 20px;display:flex;align-items:center;gap:12px;">
              <img src="${logoUrl}" width="52" height="52" alt="Shubukan India" style="border-radius:8px;display:block"/>
              <div>
                <strong style="display:block;font-size:16px;">New Registration Received</strong>
                <small style="opacity:0.9;">Review applicant details below</small>
              </div>
            </td>
          </tr>

          <tr>
            <td style="padding:20px;">
              <h3 style="margin:0 0 12px;color:${
                COLORS.charcoal
              };font-size:18px;">Applicant details</h3>

              <table width="100%" cellpadding="6" cellspacing="0" role="presentation" style="border-collapse:collapse;font-size:14px;">
                <tr>
                  <td style="width:160px;color:${
                    COLORS.muted
                  };font-weight:600;">Name</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(name)}</td>
                </tr>
                <tr>
                  <td style="color:${COLORS.muted};font-weight:600;">Email</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(
    email
  )}</td>
                </tr>
                <tr>
                  <td style="color:${COLORS.muted};font-weight:600;">Phone</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(
    phone
  )}</td>
                </tr>
                <tr>
                  <td style="color:${COLORS.muted};font-weight:600;">State</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(
    state
  )}</td>
                </tr>
                <tr>
                  <td style="color:${
                    COLORS.muted
                  };font-weight:600;">Date of Birth</td>
                  <td style="color:${COLORS.charcoal};">${
    dob ? new Date(dob).toLocaleDateString() : ""
  }</td>
                </tr>
                <tr>
                  <td style="color:${COLORS.muted};font-weight:600;">Gender</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(
    gender
  )}</td>
                </tr>
                <tr>
                  <td style="color:${
                    COLORS.muted
                  };font-weight:600;">Karate Experience</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(
    karateExperience
  )}</td>
                </tr>
                <tr>
                  <td style="color:${
                    COLORS.muted
                  };font-weight:600;">Other Martial Arts</td>
                  <td style="color:${COLORS.charcoal};">${escapeHtml(
    otherMartialArtsExperience
  )}</td>
                </tr>
              </table>

              <p style="color:${
                COLORS.muted
              };margin-top:16px;">Please review this registration and follow up as required.</p>
            </td>
          </tr>

          <tr style="background:${COLORS.warmBeige};color:${
    COLORS.charcoal
  };text-align:center;font-size:12px;">
            <td style="padding:12px 18px;">
              © ${year} Shubukan India — This is an automated notification.
            </td>
          </tr>
        </table>
      </td></tr>
    </table>
  </body>
  </html>
  `;
};
