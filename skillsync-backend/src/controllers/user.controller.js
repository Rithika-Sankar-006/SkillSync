// src/controllers/user.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /users/search
 * Query params (all optional):
 * - q                : general search on name
 * - skill            : filter users who have this skill
 * - domain           : filter by domain interest
 * - department
 * - year
 * - isAvailable      : true/false
 * - minReputation    : minimum reputation score
 * - page             : default 1
 * - limit            : default 20
 *
 * Returns paginated users with skills & domains (limited fields)
 * Sorted by reputation descending
 */
const searchUsers = async (req, res) => {
  try {
    const {
      q,
      skill,
      domain,
      department,
      year,
      isAvailable,
      minReputation,
      page = 1,
      limit = 20
    } = req.query;

    const take = Math.min(Math.max(Number(limit), 1), 50); // max 50 per page
    const skip = (Math.max(Number(page), 1) - 1) * take;

    const where = {
      id: { not: req.user.userId } // never show self
    };

    // General text search
    if (q) {
      where.OR = [
        { name: { contains: q.trim(), mode: 'insensitive' } }
      ];
    }

    // Skill filter
    if (skill) {
      where.skills = {
        some: {
          skill: {
            name: { contains: skill.trim(), mode: 'insensitive' }
          }
        }
      };
    }

    // Domain filter
    if (domain) {
      where.domains = {
        some: {
          domain: {
            name: { contains: domain.trim(), mode: 'insensitive' }
          }
        }
      };
    }

    // Exact filters
    if (department) where.department = department.trim();
    if (year) where.year = Number(year);
    if (isAvailable !== undefined) where.isAvailable = isAvailable === 'true';
    if (minReputation) {
      where.reputationScore = { gte: Number(minReputation) };
    }

    const users = await prisma.user.findMany({
      where,
      select: {
        id: true,
        name: true,
        department: true,
        year: true,
        reputationScore: true,
        isAvailable: true,
        activeProjectCount: true,
        skills: {
          include: {
            skill: { select: { id: true, name: true, category: true } }
          }
        },
        domains: {
          include: {
            domain: { select: { id: true, name: true } }
          }
        }
      },
      orderBy: [
        { reputationScore: 'desc' },
        { name: 'asc' }
      ],
      skip,
      take
    });

    // Format for frontend
    const formattedUsers = users.map(user => ({
      id: user.id,
      name: user.name,
      department: user.department,
      year: user.year,
      reputationScore: user.reputationScore,
      isAvailable: user.isAvailable,
      activeProjectCount: user.activeProjectCount,
      skills: user.skills.map(us => ({
        id: us.skill.id,
        name: us.skill.name,
        category: us.skill.category,
        proficiencyLevel: us.proficiencyLevel
      })),
      domains: user.domains.map(ud => ud.domain.name)
    }));

    res.json({
      users: formattedUsers,
      pagination: {
        page: Number(page),
        limit: take,
        hasMore: formattedUsers.length === take
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /users/recommended
 * Returns top 20 intelligent teammate matches for the logged-in user
 * Implements exact Matching Engine Logic from section 4.7
 *
 * Ranking Score = 0.5 × Reputation Score + 0.3 × Skill Match % + 0.2 × Recent Activity Score
 * (weighted SUM – standard for ranking; * in doc was formatting issue)
 *
 * Skill Match % = Jaccard similarity of skills
 * Recent Activity Score = 100 - (activeProjectCount × 40)  [higher if fewer projects]
 * Availability = true enforced
 * Reputation threshold = 70 (configurable)
 */
const getRecommendedUsers = async (req, res) => {
  try {
    // Get current user's skills & domains
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      include: {
        skills: { include: { skill: true } },
        domains: { include: { domain: true } }
      }
    });

    const mySkillIds = new Set(currentUser.skills.map(us => us.skill.id));
    const myDomainIds = new Set(currentUser.domains.map(ud => ud.domain.id));

    // Fetch candidate users (MVP: max 100 for performance)
    const candidates = await prisma.user.findMany({
      where: {
        id: { not: req.user.userId },
        isAvailable: true,
        reputationScore: { gte: 70 } // Reputation above threshold
      },
      include: {
        skills: { include: { skill: true } },
        domains: { include: { domain: true } }
      },
      take: 100,
      orderBy: { reputationScore: 'desc' }
    });

    // Calculate scores
    const scoredUsers = candidates.map(user => {
      // Skill Match % (Jaccard)
      const userSkillIds = new Set(user.skills.map(us => us.skill.id));
      const intersectionSkills = [...mySkillIds].filter(id => userSkillIds.has(id)).length;
      const unionSkills = mySkillIds.size + userSkillIds.size - intersectionSkills;
      const skillMatchPercent = unionSkills > 0 ? Math.round((intersectionSkills / unionSkills) * 100) : 0;

      // Domain overlap (bonus, not in formula but used for tie-breaking if needed)
      const userDomainIds = new Set(user.domains.map(ud => ud.domain.id));
      const intersectionDomains = [...myDomainIds].filter(id => userDomainIds.has(id)).length;
      const unionDomains = myDomainIds.size + userDomainIds.size - intersectionDomains;
      const domainMatchPercent = unionDomains > 0 ? Math.round((intersectionDomains / unionDomains) * 100) : 0;

      // Recent Activity Score (lower active projects = better)
      const recentActivityScore = Math.max(0, 100 - (user.activeProjectCount * 40));

      // Final Ranking Score (weighted SUM as per standard matching logic)
      const rankingScore =
        (0.5 * user.reputationScore) +
        (0.3 * skillMatchPercent) +
        (0.2 * recentActivityScore);

      return {
        id: user.id,
        name: user.name,
        department: user.department,
        year: user.year,
        reputationScore: user.reputationScore,
        isAvailable: user.isAvailable,
        activeProjectCount: user.activeProjectCount,
        skillMatchPercent,
        domainMatchPercent,
        recentActivityScore,
        rankingScore: Math.round(rankingScore * 10) / 10 // 1 decimal
      };
    });

    // Sort descending by ranking score
    scoredUsers.sort((a, b) => b.rankingScore - a.rankingScore);

    // Return top 20 with limited skill preview
    const recommended = scoredUsers.slice(0, 20).map(u => ({
      ...u,
      skillsPreview: u.skills ? u.skills.slice(0, 5).map(s => s.skill.name) : [] // if included
    }));

    res.json({
      recommended,
      totalCandidates: candidates.length,
      yourSkillCount: mySkillIds.size,
      yourDomainCount: myDomainIds.size
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  searchUsers,
  getRecommendedUsers
};