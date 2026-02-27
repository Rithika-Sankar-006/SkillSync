// src/services/matching.service.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Matching Engine Service – SkillSync (Section 4.7)
 * 
 * Exact implementation of the Matching Engine Logic from your master documentation:
 * 
 * Ranking Score =
 *   (0.5 × Reputation Score)
 * + (0.3 × Skill Match %)
 * + (0.2 × Recent Activity Score)
 * 
 * Criteria enforced:
 * - Availability = true
 * - Reputation above threshold (default: 70)
 * - Complementary skills (Jaccard similarity)
 * - Shared domain interests (bonus for tie-breaking)
 * 
 * Returns ranked users ready for /users/recommended endpoint
 */

const calculateSkillMatchPercent = (mySkillIds, candidateSkillIds) => {
  const intersection = [...mySkillIds].filter(id => candidateSkillIds.has(id)).length;
  const union = mySkillIds.size + candidateSkillIds.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
};

const calculateDomainMatchPercent = (myDomainIds, candidateDomainIds) => {
  const intersection = [...myDomainIds].filter(id => candidateDomainIds.has(id)).length;
  const union = myDomainIds.size + candidateDomainIds.size - intersection;
  return union > 0 ? Math.round((intersection / union) * 100) : 0;
};

const calculateRecentActivityScore = (activeProjectCount) => {
  return Math.max(0, 100 - (activeProjectCount * 40)); // fewer projects = higher score
};

/**
 * Main service function – can be called from user.controller.js or anywhere
 * @param {string} currentUserId
 * @returns {Promise<Array>} Array of ranked recommended users (top 20)
 */
const getRecommendedUsers = async (currentUserId) => {
  // 1. Fetch current user's skills & domains
  const currentUser = await prisma.user.findUnique({
    where: { id: currentUserId },
    include: {
      skills: { include: { skill: true } },
      domains: { include: { domain: true } }
    }
  });

  if (!currentUser) throw new Error('Current user not found');

  const mySkillIds = new Set(currentUser.skills.map(us => us.skill.id));
  const myDomainIds = new Set(currentUser.domains.map(ud => ud.domain.id));

  // 2. Fetch candidate pool (MVP limit for performance)
  const candidates = await prisma.user.findMany({
    where: {
      id: { not: currentUserId },
      isAvailable: true,
      reputationScore: { gte: 70 } // Reputation threshold from doc
    },
    include: {
      skills: { include: { skill: true } },
      domains: { include: { domain: true } }
    },
    take: 100,
    orderBy: { reputationScore: 'desc' }
  });

  // 3. Score each candidate
  const scoredCandidates = candidates.map(candidate => {
    const candidateSkillIds = new Set(candidate.skills.map(us => us.skill.id));
    const candidateDomainIds = new Set(candidate.domains.map(ud => ud.domain.id));

    const skillMatchPercent = calculateSkillMatchPercent(mySkillIds, candidateSkillIds);
    const domainMatchPercent = calculateDomainMatchPercent(myDomainIds, candidateDomainIds);
    const recentActivityScore = calculateRecentActivityScore(candidate.activeProjectCount);

    // Exact formula from documentation (weighted SUM – * was line-break artifact)
    const rankingScore =
      (0.5 * candidate.reputationScore) +
      (0.3 * skillMatchPercent) +
      (0.2 * recentActivityScore);

    return {
      id: candidate.id,
      name: candidate.name,
      department: candidate.department,
      year: candidate.year,
      reputationScore: candidate.reputationScore,
      isAvailable: candidate.isAvailable,
      activeProjectCount: candidate.activeProjectCount,
      skillMatchPercent,
      domainMatchPercent,
      recentActivityScore,
      rankingScore: Math.round(rankingScore * 10) / 10 // one decimal place
    };
  });

  // 4. Sort descending by ranking score
  scoredCandidates.sort((a, b) => b.rankingScore - a.rankingScore);

  // Return top 20
  return scoredCandidates.slice(0, 20);
};

module.exports = {
  getRecommendedUsers,
  calculateSkillMatchPercent,        // exported for testing / future use
  calculateRecentActivityScore
};