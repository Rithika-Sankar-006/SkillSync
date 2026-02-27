# SkillSync Backend

**SkillSync** is a structured web platform designed for college students to find teammates, form project groups, and collaborate more effectively using skill matching, reputation scoring, availability tracking, and workload regulation.

This is the **backend** repository (Node.js + Express + Prisma + PostgreSQL + Socket.io).

> The platform replaces chaotic WhatsApp groups and random friend requests with a transparent, rule-based, reputation-driven collaboration system.

## Core Features (MVP)

- College-email-only registration + OTP verification
- Profile with skills, proficiency levels, domains of interest, availability
- Resume upload & automatic skill suggestion (PDF parsing)
- Project creation, joining, leaving, completion
- **Hard cap of 2 active projects** per user (prevents overcommitment)
- Intelligent teammate matching (reputation + skill match + availability)
- Post-project peer rating → reputation score adjustment
- Real-time 1-on-1 chat (Socket.io)
- Notifications (real-time + stored)
- Basic abuse prevention (rate limiting, duplicate rating block)

## Tech Stack

- **Runtime**: Node.js ≥ 18
- **Framework**: Express
- **Database**: PostgreSQL + Prisma ORM
- **Authentication**: JWT + bcrypt
- **Real-time**: Socket.io
- **File Upload**: Multer (resumes)
- **PDF Parsing**: pdf-parse
- **Email**: Nodemailer (Gmail for OTP)
- **Security**: helmet, express-rate-limit
- **Environment**: dotenv

## Project Structure
skillsync-backend/
├── prisma/
│   └── schema.prisma
├── src/
│   ├── controllers/
│   ├── middleware/
│   ├── routes/
│   ├── services/
│   ├── socket/
│   ├── utils/
│   └── index.js
├── uploads/                # temporary resume PDFs
├── .env
├── .env.example
├── package.json
└── README.md

## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- PostgreSQL (local or cloud)
- (optional) Redis for production caching/sockets


## Quick Start

### 1. Prerequisites

- Node.js ≥ 18
- PostgreSQL (local or cloud)
- (optional) Redis for production caching/sockets

### 2. Setup

```bash
# Clone the repo
git clone <your-repo-url>
cd skillsync-backend

# Install dependencies
npm install

# Copy example env and fill it
cp .env.example .env
# → edit .env (DATABASE_URL, JWT_SECRET, EMAIL_USER/PASS, etc.)

# Generate Prisma client
npx prisma generate

# Run migrations (create tables)
npx prisma migrate dev --name init

# (optional) Seed some data or open Prisma Studio
npx prisma studio

3. Run the server
# Development (with auto-reload)
npm run dev

# Production
npm start

Server starts on http://localhost:5000 (or your PORT)
Health check:
GET http://localhost:5000/health
4. Important Environment Variables (.env)
PORT=5000
DATABASE_URL="postgresql://..."
JWT_SECRET=super-long-random-secret-...
ALLOWED_EMAIL_DOMAIN=yourcollege.edu
EMAIL_USER=your@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:3000
API Endpoints (main ones)
Method,Endpoint,Description,Auth?
POST,/api/auth/register,Register + send OTP,No
POST,/api/auth/verify-otp,Verify OTP + get JWT,No
POST,/api/auth/login,Login + get JWT,No
GET,/api/auth/me,Get current user,Yes
PUT,/api/profile,Update profile,Yes
POST,/api/profile/skills,Add skill,Yes
POST,/api/projects,Create project,Yes
POST,/api/projects/join,Join project,Yes
POST,/api/projects/complete,Mark project complete,Yes

Full API documentation can be added later (Swagger / Postman collection).
Development Guidelines

All protected routes use protect middleware (JWT verification)
Use controllers → services pattern for business logic
Reputation changes are logged in reputation_logs table
Chat messages are persisted in messages table
Notifications are both stored (DB) and sent real-time (Socket.io)

Future / Advanced Features (roadmap)

GitHub OAuth + repo-based skill inference
Advanced ML matching model
Contribution tracking / git commit analysis
Admin dashboard (analytics, suspend users)
Multi-campus support
Redis caching + horizontal scaling

Contributing

Fork the repo
Create feature branch (git checkout -b feature/amazing-feature)
Commit changes (git commit -m 'Add amazing feature')
Push (git push origin feature/amazing-feature)
Open Pull Request