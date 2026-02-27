// src/routes/project.routes.js
const express = require('express');
const router = express.Router();

const {
  createProject,
  getMyProjects,
  getProjectDetails,
  joinProject,
  leaveProject,
  completeProject
} = require('../controllers/project.controller');

const { authenticateJWT } = require('../middleware/auth.middleware');

/**
 * PROJECT ROUTES – SkillSync (Sections 4.5, 4.6, 6)
 * All endpoints secured with JWT as per security model
 * Includes full Project Cap Regulation enforcement
 */

// ──────────────────────────────────────────────────────────────
// PROTECTED ROUTES (require authentication)
// ──────────────────────────────────────────────────────────────

/**
 * POST /projects
 * Create a new project
 * Body: { title, description, domain, deadline? }
 * Auto-enforces max 2 active projects (section 4.6)
 */
router.post('/', authenticateJWT, createProject);

/**
 * GET /projects/my
 * Get all projects the current user is part of (active + completed)
 */
router.get('/my', authenticateJWT, getMyProjects);

/**
 * GET /projects/:projectId
 * Get full project details + members
 */
router.get('/:projectId', authenticateJWT, getProjectDetails);

/**
 * POST /projects/join
 * Join an existing active project
 * Body: { projectId }
 * Enforces project cap + duplicate prevention
 */
router.post('/join', authenticateJWT, joinProject);

/**
 * POST /projects/leave
 * Leave a project (mid-way support – edge case handling)
 * Body: { projectId }
 */
router.post('/leave', authenticateJWT, leaveProject);

/**
 * POST /projects/complete
 * Mark project as completed (only creator allowed)
 * Body: { projectId }
 * Decrements activeProjectCount for ALL members (section 4.6)
 */
router.post('/complete', authenticateJWT, completeProject);

module.exports = router;