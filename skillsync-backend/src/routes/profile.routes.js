// src/routes/profile.routes.js
const express = require('express');
const router = express.Router();

const {
  getMyProfile,
  getUserProfile,
  updateProfile,
  addSkill,
  removeSkill,
  addDomainInterest,
  removeDomainInterest
} = require('../controllers/profile.controller');

const { authenticateJWT } = require('../middleware/auth.middleware');

/**
 * PROFILE ROUTES – SkillSync (Section 4.2 Profile System)
 * All endpoints secured with JWT as per section 6 & 9
 */

// ──────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require authentication)
// ──────────────────────────────────────────────────────────────

/**
 * GET /profile/me
 * Get full profile of the logged-in user (skills, domains, active projects, etc.)
 */
router.get('/me', authenticateJWT, getMyProfile);

/**
 * PUT /profile
 * Update basic profile info (name, department, year, availability)
 * Body: { name?, department?, year?, isAvailable? }
 */
router.put('/', authenticateJWT, updateProfile);

/**
 * POST /profile/skills
 * Add or update a skill with proficiency level
 * Body: { skillName, category?, proficiencyLevel }
 */
router.post('/skills', authenticateJWT, addSkill);

/**
 * DELETE /profile/skills/:skillId
 * Remove a skill from user's profile
 */
router.delete('/skills/:skillId', authenticateJWT, removeSkill);

/**
 * POST /profile/domains
 * Add a domain interest
 * Body: { domainName }
 */
router.post('/domains', authenticateJWT, addDomainInterest);

/**
 * DELETE /profile/domains/:domainId
 * Remove a domain interest
 */
router.delete('/domains/:domainId', authenticateJWT, removeDomainInterest);

/**
 * GET /profile/:userId
 * Public view of any user's profile (used in search, match cards, etc.)
 * Limited fields for privacy – still protected to prevent unauth scraping
 */
router.get('/:userId', authenticateJWT, getUserProfile);

module.exports = router;