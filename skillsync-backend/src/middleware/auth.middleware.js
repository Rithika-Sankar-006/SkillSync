// src/middleware/auth.middleware.js
const jwt = require('jsonwebtoken');

/**
 * Main authentication middleware
 * Protects all private routes
 * 
 * Expects header: Authorization: Bearer <token>
 * On success: attaches req.user = { userId, email, role }
 * On failure: 401 Unauthorized
 */
const authenticateJWT = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Access denied. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = {
      userId: decoded.userId,
      email: decoded.email,
      role: decoded.role || 'student'
    };

    next();
  } catch (err) {
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token has expired. Please login again.' });
    }
    if (err.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token.' });
    }

    console.error('JWT verification error:', err);
    return res.status(401).json({ error: 'Authentication failed.' });
  }
};

/**
 * Admin-only middleware (used on admin routes)
 * Must be used AFTER authenticateJWT
 */
const isAdmin = (req, res, next) => {
  if (req.user.role !== 'admin') {
    return res.status(403).json({
      error: 'Access denied. Admin privileges required.'
    });
  }
  next();
};

/**
 * Optional: Refresh token logic can be added here later
 * For MVP this is sufficient
 */

module.exports = {
  authenticateJWT,
  isAdmin
};