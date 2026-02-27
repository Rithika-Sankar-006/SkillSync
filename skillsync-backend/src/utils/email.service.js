// src/utils/email.service.js
const nodemailer = require('nodemailer');

/**
 * Create Nodemailer transporter (singleton)
 * Configured for Gmail – update for other providers if needed
 */
const createTransporter = () => {
  return nodemailer.createTransporter({
    service: 'gmail',
    auth: {
      user: process.env.EMAIL_USER,
      pass: process.env.EMAIL_PASS, // Use app password for Gmail
    },
  });
};

const transporter = createTransporter();

/**
 * Send OTP verification email
 * @param {string} email - Recipient's email
 * @param {string} otp - 6-digit OTP code
 * @returns {Promise<void>}
 * Usage: Called from auth.controller.js during registration
 */
const sendOtpEmail = async (email, otp) => {
  const expiresIn = 10; // minutes

  const mailOptions = {
    from: `"SkillSync Team" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Verify Your SkillSync Account',
    text: `Your SkillSync verification code is: ${otp}\n\nThis code expires in ${expiresIn} minutes. If you didn't request this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Welcome to SkillSync!</h2>
        <p>Your verification code is:</p>
        <div style="background: #f0f0f0; padding: 20px; text-align: center; font-size: 24px; letter-spacing: 5px; font-weight: bold;">
          ${otp}
        </div>
        <p>This code will expire in <strong>${expiresIn} minutes</strong>.</p>
        <p style="color: #666; font-size: 14px;">If you didn't create this account, please ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`OTP email sent to ${email}`);
};

/**
 * Send project invitation email
 * @param {string} toEmail - Recipient's email
 * @param {string} inviterName - Name of the user inviting
 * @param {string} projectTitle - Title of the project
 * @param {string} projectLink - Frontend link to accept (e.g., /projects/[id]/join)
 * @returns {Promise<void>}
 * Usage: Triggered from project controller on invite
 */
const sendProjectInviteEmail = async (toEmail, inviterName, projectTitle, projectLink) => {
  const mailOptions = {
    from: `"SkillSync Team" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject: `Invitation: Join "${projectTitle}" on SkillSync`,
    text: `${inviterName} has invited you to collaborate on the project "${projectTitle}"!\n\nAccept the invitation: ${projectLink}\n\nIf you didn't expect this, ignore this email.`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333;">Project Invitation</h2>
        <p><strong>${inviterName}</strong> wants you on their team for <strong>${projectTitle}</strong>!</p>
        <p>This is a great chance to showcase your skills and build something awesome.</p>
        <a href="${projectLink}" style="background: #28a745; color: white; padding: 12px 24px; text-decoration: none; border-radius: 4px; display: inline-block;">
          Accept Invitation
        </a>
        <p style="color: #666; font-size: 14px; margin-top: 20px;">If you didn't expect this invitation, simply ignore this email.</p>
      </div>
    `,
  };

  await transporter.sendMail(mailOptions);
  console.log(`Project invite sent to ${toEmail} for "${projectTitle}"`);
};

/**
 * Send generic notification email (e.g., reputation update, match found)
 * @param {string} toEmail - Recipient's email
 * @param {string} subject - Email subject line
 * @param {string} message - Plain text body
 * @param {string} [htmlMessage] - Optional HTML body (defaults to simple <p>)
 * @returns {Promise<void>}
 * Usage: Fallback for non-Socket notifications
 */
const sendNotificationEmail = async (toEmail, subject, message, htmlMessage = `<p>${message}</p>`) => {
  const mailOptions = {
    from: `"SkillSync Team" <${process.env.EMAIL_USER}>`,
    to: toEmail,
    subject,
    text: message,
    html: htmlMessage,
  };

  await transporter.sendMail(mailOptions);
  console.log(`Notification email sent to ${toEmail}: ${subject}`);
};

/**
 * Test email connection (for debugging)
 * @returns {Promise<boolean>}
 */
const testEmailConnection = async () => {
  try {
    await transporter.verify();
    console.log('Email transporter is ready');
    return true;
  } catch (error) {
    console.error('Email transporter error:', error);
    return false;
  }
};

module.exports = {
  sendOtpEmail,
  sendProjectInviteEmail,
  sendNotificationEmail,
  testEmailConnection,
};