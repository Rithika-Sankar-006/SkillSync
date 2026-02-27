// src/routes/resume.routes.js
const express = require('express');
const router = express.Router();
const multer = require('multer');
const path = require('path');

const {
  uploadResume,
  getResumeSuggestions
} = require('../controllers/resume.controller');

const { authenticateJWT } = require('../middleware/auth.middleware');

/**
 * RESUME ROUTES – SkillSync (Section 4.4 Resume Parsing Automation)
 * All endpoints secured with JWT
 * Uses Multer for PDF upload + automatic skill extraction
 */

// ──────────────────────────────────────────────────────────────
// Multer Configuration (PDF only, 5MB max)
// ──────────────────────────────────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/'); // folder created in project root
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1E9)}`;
    cb(null, `resume-${req.user.userId}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'application/pdf') {
    cb(null, true);
  } else {
    cb(new Error('Only PDF files are allowed'), false);
  }
};

const upload = multer({
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: fileFilter
});

// ──────────────────────────────────────────────────────────────
// PROTECTED ROUTES
// ──────────────────────────────────────────────────────────────

/**
 * POST /resume/upload
 * Multipart/form-data
 * Field name: "resume"
 * Automatically parses PDF → returns suggested skills (user confirms later)
 */
router.post(
  '/upload',
  authenticateJWT,
  upload.single('resume'),
  uploadResume
);

/**
 * GET /resume/suggestions
 * Re-parses the user's already uploaded resume and returns fresh suggestions
 * Useful if user wants to re-scan or after re-upload
 */
router.get('/suggestions', authenticateJWT, getResumeSuggestions);

module.exports = router;