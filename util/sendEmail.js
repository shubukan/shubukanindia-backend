// util/sendEmail.js
const nodemailer = require("nodemailer");

const host = process.env.EMAIL_HOST;
const port = Number(process.env.EMAIL_PORT) || 587;
const secure = port === 465; // use TLS for 465
const user = process.env.EMAIL_USER;
const pass = process.env.EMAIL_PASS;
const defaultFrom = process.env.EMAIL_FROM || '"Shubukan India" <no-reply@shubukan.india>';

const transporter = nodemailer.createTransport({
  host,
  port,
  secure,
  auth: {
    user,
    pass,
  },
});

/**
 * Convert HTML to a simple plain-text fallback.
 * Not perfect — for production consider a more robust library if needed.
 */
const htmlToPlain = (html = "") => {
  if (!html) return "";
  return String(html)
    .replace(/<style[\s\S]*?>[\s\S]*?<\/style>/gi, "") // remove styles
    .replace(/<(br|\/p|\/div|\/tr|\/li|\/h[1-6])\s*\/?>/gi, "\n") // break lines
    .replace(/<[^>]+>/g, "") // strip tags
    .replace(/\n\s+\n/g, "\n\n")
    .replace(/\s{2,}/g, " ")
    .trim();
};

// Optional: verify transporter once (logs problem early)
transporter.verify().then(
  () => {
    console.log("Email transporter verified.");
  },
  (err) => {
    console.warn("Warning: email transporter verification failed. Emails may not send.", err && err.message);
  }
);

/**
 * sendEmail(to, subject, html[, opts])
 *
 * - to: recipient email (string)
 * - subject: email subject (string)
 * - html: HTML string for the email body
 * - opts (optional): { text, from, mailOptions } where mailOptions can include attachments, cc, bcc, etc.
 *
 * Returns: true on success, false on failure (keeps compatibility with your current code).
 */
exports.sendEmail = async (to, subject, html, opts = {}) => {
  try {
    const from = opts.from || defaultFrom;
    const text = opts.text || htmlToPlain(html);

    const mailOptions = {
      from,
      to,
      subject,
      text,
      html,
      ...((opts.mailOptions && typeof opts.mailOptions === "object") ? opts.mailOptions : {}),
      // if opts.mailOptions includes attachments, cc, bcc they will be merged
    };

    const info = await transporter.sendMail(mailOptions);
    // optional: log info.messageId for debugging
    if (process.env.NODE_ENV !== "production") {
      console.log("Email sent:", info && info.messageId);
    }

    return true;
  } catch (error) {
    console.error("Error sending email:", error && (error.message || error));
    return false;
  }
};
