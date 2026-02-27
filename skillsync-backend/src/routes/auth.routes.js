// src/routes/auth.routes.js
const express = require('express');
const router = express.Router();

const {
  register,
  verifyOtp,
  login,
  getCurrentUser
} = require('../controllers/auth.controller');

const { authenticateJWT } = require('../middleware/auth.middleware');

/**
 * AUTH ROUTES – SkillSync (Section 4.1 + 6. API Structure)
 * All endpoints follow the exact spec in your master documentation
 */

// ──────────────────────────────────────────────────────────────
// PUBLIC ROUTES (no token required)
// ──────────────────────────────────────────────────────────────

/**
 * POST /auth/register
 * Body: { name, email, password, department?, year? }
 * College-email only + sends OTP
 */
router.post('/register', register);

/**
 * POST /auth/verify-otp
 * Body: { email, otp }
 * Verifies OTP and returns JWT
 */
router.post('/verify-otp', verifyOtp);

/**
 * POST /auth/login
 * Body: { email, password }
 * Returns JWT + user info
 */
router.post('/login', login);

// ──────────────────────────────────────────────────────────────
// PROTECTED ROUTES
// ──────────────────────────────────────────────────────────────

/**
 * GET /auth/me
 * Returns current authenticated user (full profile summary)
 * Protected with JWT
 */
router.get('/me', authenticateJWT, getCurrentUser);

module.exports = router;