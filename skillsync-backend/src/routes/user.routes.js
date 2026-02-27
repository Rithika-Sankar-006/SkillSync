// src/routes/user.routes.js
const express = require('express');
const router = express.Router();

const {
  searchUsers,
  getRecommendedUsers
} = require('../controllers/user.controller');

const { authenticateJWT } = require('../middleware/auth.middleware');

/**
 * USER ROUTES – SkillSync (Sections 4.7 Matching Engine + 4.11 Search System)
 * All endpoints secured with JWT
 * 
 * Implements:
 * - Advanced search with all filters from doc
 * - Intelligent teammate recommendation using exact ranking formula
 */

// ──────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require authentication)
// ──────────────────────────────────────────────────────────────

/**
 * GET /users/search
 * Query params (all optional):
 *   ?q=john
 *   ?skill=react
 *   ?domain=web-development
 *   ?department=CSE
 *   ?year=3
 *   ?isAvailable=true
 *   ?minReputation=80
 *   ?page=1&limit=20
 * 
 * Full-featured search as per section 4.11
 */
router.get('/search', authenticateJWT, searchUsers);

/**
 * GET /users/recommended
 * Returns top 20 intelligent matches using the exact formula from section 4.7:
 * Ranking Score = (0.5 × Reputation) + (0.3 × Skill Match %) + (0.2 × Recent Activity)
 * 
 * Enforces: Availability = true + Reputation threshold
 */
router.get('/recommended', authenticateJWT, getRecommendedUsers);

module.exports = router;