// src/index.js
require('dotenv').config();

const express = require('express');
const http = require('http');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const { PrismaClient } = require('@prisma/client');

const { initSocket } = require('./socket/socket');

// Import routes (create these files in src/routes/)
const authRoutes = require('./routes/auth.routes');
const profileRoutes = require('./routes/profile.routes');
const projectRoutes = require('./routes/project.routes');
// const userRoutes       = require('./routes/user.routes');
// const resumeRoutes     = require('./routes/resume.routes');
// const notificationRoutes = require('./routes/notification.routes');

const app = express();
const server = http.createServer(app);

// Initialize Socket.io
const io = initSocket(server);
global.io = io; // so controllers/services can access io if needed

// ────────────────────────────────────────────────
//  Middleware
// ────────────────────────────────────────────────

app.use(helmet()); // basic security headers

app.use(cors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json({ limit: '10mb' }));           // for resume uploads etc.
app.use(express.urlencoded({ extended: true }));

// Rate limiting (global for now – you can make it route-specific later)
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,   // 15 minutes
    max: 300,                   // limit each IP to 300 requests per window
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests, please try again later.' }
});

app.use('/api/', limiter);

// ────────────────────────────────────────────────
//  Routes
// ────────────────────────────────────────────────

app.get('/health', (req, res) => {
    res.status(200).json({
        status: 'ok',
        uptime: process.uptime(),
        timestamp: new Date().toISOString()
    });
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/projects', projectRoutes);
// app.use('/api/users', userRoutes);
// app.use('/api/resume', resumeRoutes);
// app.use('/api/notifications', notificationRoutes);

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Endpoint not found' });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('Global error handler:', err);
    const status = err.status || 500;
    const message = err.message || 'Internal Server Error';
    res.status(status).json({ error: message });
});

// ────────────────────────────────────────────────
//  Start server
// ────────────────────────────────────────────────

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    console.log(`┌───────────────────────────────────────────────┐`);
    console.log(`│  SkillSync Backend                            │`);
    console.log(`│  listening on http://localhost:${PORT}           │`);
    console.log(`│  Environment : ${process.env.NODE_ENV || 'development'}          │`);
    console.log(`└───────────────────────────────────────────────┘`);
});

// Graceful shutdown
const prisma = new PrismaClient();

const shutdown = async (signal) => {
    console.log(`\n${signal} received. Shutting down gracefully...`);
    await prisma.$disconnect();
    server.close(() => {
        console.log('HTTP server closed.');
        process.exit(0);
    });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));