// src/controllers/resume.controller.js
const { PrismaClient } = require('@prisma/client');
const pdfParse = require('pdf-parse');
const fs = require('fs').promises;
const path = require('path');

const prisma = new PrismaClient();

// Comprehensive MVP skill keyword dictionary (expandable)
// Matches section 4.4: "NLP engine scans for known skill keywords, technologies, tools"
const SKILL_DICTIONARY = [
  // Programming Languages
  { name: 'javascript', category: 'technical' },
  { name: 'python', category: 'technical' },
  { name: 'java', category: 'technical' },
  { name: 'c++', category: 'technical' },
  { name: 'c#', category: 'technical' },
  { name: 'typescript', category: 'technical' },
  { name: 'go', category: 'technical' },
  { name: 'rust', category: 'technical' },
  { name: 'kotlin', category: 'technical' },
  { name: 'swift', category: 'technical' },

  // Web & Frontend
  { name: 'react', category: 'technical' },
  { name: 'angular', category: 'technical' },
  { name: 'vue', category: 'technical' },
  { name: 'html', category: 'technical' },
  { name: 'css', category: 'technical' },
  { name: 'tailwind', category: 'technical' },
  { name: 'bootstrap', category: 'technical' },
  { name: 'next.js', category: 'technical' },

  // Backend & Frameworks
  { name: 'node.js', category: 'technical' },
  { name: 'express', category: 'technical' },
  { name: 'django', category: 'technical' },
  { name: 'flask', category: 'technical' },
  { name: 'spring', category: 'technical' },
  { name: 'laravel', category: 'technical' },

  // Databases & Cloud
  { name: 'sql', category: 'technical' },
  { name: 'mysql', category: 'technical' },
  { name: 'postgresql', category: 'technical' },
  { name: 'mongodb', category: 'technical' },
  { name: 'firebase', category: 'technical' },
  { name: 'aws', category: 'technical' },
  { name: 'azure', category: 'technical' },
  { name: 'docker', category: 'technical' },
  { name: 'kubernetes', category: 'technical' },

  // Data Science & ML
  { name: 'machine learning', category: 'technical' },
  { name: 'data science', category: 'technical' },
  { name: 'tensorflow', category: 'technical' },
  { name: 'pytorch', category: 'technical' },
  { name: 'pandas', category: 'technical' },
  { name: 'numpy', category: 'technical' },

  // Design & Tools
  { name: 'figma', category: 'non-technical' },
  { name: 'adobe xd', category: 'non-technical' },
  { name: 'photoshop', category: 'non-technical' },
  { name: 'illustrator', category: 'non-technical' },
  { name: 'ui/ux', category: 'non-technical' },

  // Others (very common in resumes)
  { name: 'git', category: 'technical' },
  { name: 'github', category: 'technical' },
  { name: 'agile', category: 'non-technical' },
  { name: 'scrum', category: 'non-technical' },
  { name: 'jira', category: 'technical' },
  { name: 'postman', category: 'technical' },
  { name: 'linux', category: 'technical' },
];

const SKILL_KEYWORDS = SKILL_DICTIONARY.map(s => s.name.toLowerCase());

/**
 * POST /resume/upload
 * Protected route
 * Expects multipart/form-data with field name: "resume"
 * - Validates PDF only
 * - Extracts text using pdf-parse
 * - Scans for known skills (section 4.4)
 * - Saves resume path to user profile
 * - Returns suggested skills for user confirmation (user will add via /profile/skills)
 */
const uploadResume = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No resume file uploaded' });
    }

    // Validate PDF
    if (req.file.mimetype !== 'application/pdf') {
      await fs.unlink(req.file.path); // clean up invalid file
      return res.status(400).json({ error: 'Only PDF files are allowed' });
    }

    // Optional: file size check (multer already limits in routes, but extra safety)
    if (req.file.size > 5 * 1024 * 1024) { // 5MB
      await fs.unlink(req.file.path);
      return res.status(400).json({ error: 'File size must be under 5MB' });
    }

    const filePath = req.file.path;
    const fileName = req.file.filename;

    // Extract text
    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text.toLowerCase();

    // Skill extraction – simple but effective keyword matching (MVP "NLP")
    const suggestedSkills = [];
    const foundNames = new Set();

    for (const entry of SKILL_DICTIONARY) {
      const keyword = entry.name.toLowerCase();
      // Match whole word or common variations
      const regex = new RegExp(`\\b${keyword.replace(/\./g, '\\.')}\\b`, 'i');
      if (regex.test(text) && !foundNames.has(entry.name)) {
        suggestedSkills.push({
          name: entry.name,
          category: entry.category
        });
        foundNames.add(entry.name);
      }
    }

    // Save resume URL (served statically later via Express)
    const resumeUrl = `/uploads/${fileName}`;

    await prisma.user.update({
      where: { id: req.user.userId },
      data: { resumeUrl }
    });

    res.status(200).json({
      message: 'Resume uploaded and parsed successfully',
      resumeUrl,
      suggestedSkills,                    // e.g. [{name: "react", category: "technical"}, ...]
      totalSuggestions: suggestedSkills.length,
      note: 'Use these suggestions with POST /profile/skills to add them to your profile'
    });
  } catch (err) {
    console.error('Resume upload error:', err);

    // Clean up file on error
    if (req.file && req.file.path) {
      try {
        await fs.unlink(req.file.path);
      } catch (cleanupErr) {
        console.error('File cleanup failed:', cleanupErr);
      }
    }

    res.status(500).json({ error: 'Failed to process resume' });
  }
};

/**
 * GET /resume/suggestions
 * (Optional helper) Re-parse already uploaded resume
 * Useful if user wants fresh suggestions later
 */
const getResumeSuggestions = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { resumeUrl: true }
    });

    if (!user || !user.resumeUrl) {
      return res.status(404).json({ error: 'No resume uploaded yet' });
    }

    // Extract filename from URL
    const fileName = user.resumeUrl.split('/').pop();
    const filePath = path.join(__dirname, '../../uploads', fileName);

    // Check if file still exists
    try {
      await fs.access(filePath);
    } catch {
      return res.status(404).json({ error: 'Resume file not found on server' });
    }

    const dataBuffer = await fs.readFile(filePath);
    const pdfData = await pdfParse(dataBuffer);
    const text = pdfData.text.toLowerCase();

    const suggestedSkills = [];
    const foundNames = new Set();

    for (const entry of SKILL_DICTIONARY) {
      const keyword = entry.name.toLowerCase();
      const regex = new RegExp(`\\b${keyword.replace(/\./g, '\\.')}\\b`, 'i');
      if (regex.test(text) && !foundNames.has(entry.name)) {
        suggestedSkills.push({ name: entry.name, category: entry.category });
        foundNames.add(entry.name);
      }
    }

    res.json({
      suggestedSkills,
      totalSuggestions: suggestedSkills.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to re-parse resume' });
  }
};

module.exports = {
  uploadResume,
  getResumeSuggestions
};