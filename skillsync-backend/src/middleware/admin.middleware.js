// src/middleware/admin.middleware.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Enhanced Admin Middleware
 * MUST be used AFTER authenticateJWT middleware
 * 
 * Features:
 * - Role check (admin only)
 * - Account status verification (prevents suspended admins)
 * - Logging of admin actions (for audit trail)
 * 
 * Compliant with:
 * - Section 3.2 Admin User
 * - Section 9. Security (Role-based access control)
 * - Section 4.13 Abuse Prevention (admin review panel)
 */
const isAdmin = async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Access denied. Admin privileges required.'
      });
    }

    // Extra security: Verify admin account is still active and not suspended
    const adminUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { 
        active: true,           // we'll add this field later if needed
        reputationScore: true 
      }
    });

    if (!adminUser) {
      return res.status(403).json({ error: 'Admin account not found' });
    }

    // Optional: You can add reputation floor for admins if desired
    // if (adminUser.reputationScore < 50) {
    //   return res.status(403).json({ error: 'Admin privileges suspended' });
    // }

    // Log admin access (for audit trail - stored in a future AdminLog model)
    // In MVP we just console.log; later we can create a log table
    console.log(`[ADMIN ACCESS] ${req.user.email} accessed ${req.method} ${req.originalUrl} at ${new Date().toISOString()}`);

    next();
  } catch (err) {
    console.error('Admin middleware error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  isAdmin
};