// src/controllers/auth.controller.js
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const nodemailer = require('nodemailer');

const prisma = new PrismaClient();

// In-memory OTP store (for MVP) → in production use Redis with TTL
const otpStore = new Map(); // email → { otp, expiresAt }

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/**
 * POST /auth/register
 * Body: { name, email, password, department?, year? }
 * - Only allows college emails (configurable domain)
 * - Sends OTP to email
 */
const register = async (req, res) => {
  try {
    const { name, email, password, department, year } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email and password are required' });
    }

    // ── College email validation (MVP: single domain, later multi-campus)
    const allowedDomain = process.env.ALLOWED_EMAIL_DOMAIN || 'example.edu'; // ← set in .env
    if (!email.toLowerCase().endsWith(`@${allowedDomain}`)) {
      return res.status(400).json({
        error: `Only ${allowedDomain} email addresses are allowed`,
      });
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    // Create user – but NOT verified yet
    const user = await prisma.user.create({
      data: {
        name,
        email,
        passwordHash,
        department: department || null,
        year: year ? Number(year) : null,
        // reputation_score = 100 by default (schema)
        // active_project_count = 0 by default
        // is_available = true by default
      },
    });

    // Generate 6-digit OTP
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes

    otpStore.set(email, { otp, expiresAt });

    // Send OTP email
    await transporter.sendMail({
      from: `"SkillSync" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: 'Your SkillSync Verification Code',
      text: `Your verification code is: ${otp}\n\nIt expires in 10 minutes.`,
      html: `
        <h2>Welcome to SkillSync!</h2>
        <p>Use this code to verify your email:</p>
        <h1 style="letter-spacing: 8px; font-size: 32px;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
      `,
    });

    res.status(201).json({
      message: 'Registration successful. Please check your email for OTP.',
      userId: user.id,
      email: user.email,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /auth/verify-otp
 * Body: { email, otp }
 * - Verifies OTP → marks user as verified (we'll add isVerified later if needed)
 * - Returns JWT
 */
const verifyOtp = async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    const stored = otpStore.get(email);
    if (!stored) {
      return res.status(400).json({ error: 'No OTP found or expired' });
    }

    if (Date.now() > stored.expiresAt) {
      otpStore.delete(email);
      return res.status(400).json({ error: 'OTP has expired' });
    }

    if (stored.otp !== otp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    // OTP is correct → clean up
    otpStore.delete(email);

    // In real production: add isVerified: true field and update it here

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Issue JWT
    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        reputationScore: user.reputationScore,
        isAvailable: user.isAvailable,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /auth/login
 * Body: { email, password }
 */
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const passwordMatch = await bcrypt.compare(password, user.passwordHash);
    if (!passwordMatch) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // In production: check isVerified if you add that field

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        role: user.role,
      },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        reputationScore: user.reputationScore,
        isAvailable: user.isAvailable,
      },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /auth/me
 * Protected – returns current authenticated user
 */
const getCurrentUser = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        role: true,
        reputationScore: true,
        activeProjectCount: true,
        isAvailable: true,
        department: true,
        year: true,
        resumeUrl: true,
        createdAt: true,
      },
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  register,
  verifyOtp,
  login,
  getCurrentUser,
};