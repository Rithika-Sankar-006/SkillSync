// src/services/resumeParser.service.js
const fs = require('fs').promises;
const pdfParse = require('pdf-parse');

/**
 * Very simple keyword-based resume parser
 * Returns suggested skills based on common technology & soft-skill keywords
 *
 * @param {string} filePath - path to the uploaded PDF file
 * @returns {Promise<{skills: Array<{name: string, category: string, source: string}>}>}
 */
async function extractSkillsFromResume(filePath) {
  let dataBuffer;
  try {
    dataBuffer = await fs.readFile(filePath);
  } catch (err) {
    throw new Error(`Cannot read file: ${err.message}`);
  }

  let data;
  try {
    data = await pdfParse(dataBuffer);
  } catch (err) {
    throw new Error(`PDF parsing failed: ${err.message}`);
  }

  const text = data.text.toLowerCase();

  // ────────────────────────────────────────────────
  // Keyword lists – expand these significantly in production
  // ────────────────────────────────────────────────
  const techKeywords = [
    // Languages & core tech
    'javascript', 'typescript', 'python', 'java', 'c++', 'c#', 'go', 'rust', 'ruby',
    'php', 'kotlin', 'swift', 'dart', 'scala',
    // Frontend
    'react', 'next.js', 'nextjs', 'vue', 'angular', 'svelte', 'tailwind', 'bootstrap',
    // Backend / fullstack
    'node', 'nodejs', 'express', 'nest', 'nestjs', 'django', 'flask', 'spring', 'laravel',
    // Databases
    'sql', 'mysql', 'postgresql', 'postgres', 'mongodb', 'firebase', 'redis',
    // DevOps / tools
    'docker', 'kubernetes', 'aws', 'azure', 'gcp', 'terraform', 'jenkins', 'github actions',
    'git', 'github', 'gitlab', 'bitbucket',
    // Others popular among students
    'machine learning', 'ml', 'tensorflow', 'pytorch', 'scikit-learn',
    'android', 'flutter', 'react native',
  ];

  const softKeywords = [
    'leadership', 'teamwork', 'communication', 'problem solving', 'time management',
    'project management', 'presentation', 'public speaking',
    'research', 'analytical', 'critical thinking',
  ];

  const foundSkills = new Set();

  // Look for exact or near-exact matches
  for (const kw of techKeywords) {
    if (text.includes(kw)) {
      foundSkills.add({
        name: capitalize(kw.replace(/\./g, '')),
        category: 'technical',
        source: 'resume',
      });
    }
  }

  for (const kw of softKeywords) {
    if (text.includes(kw)) {
      foundSkills.add({
        name: capitalize(kw),
        category: 'non-technical',
        source: 'resume',
      });
    }
  }

  return {
    skills: Array.from(foundSkills),
    rawTextLength: text.length,
    // You can also return a short preview of the text if useful for debugging
    // preview: text.substring(0, 300) + '...'
  };
}

function capitalize(str) {
  return str
    .split(/[\s-]/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

module.exports = {
  extractSkillsFromResume,
};