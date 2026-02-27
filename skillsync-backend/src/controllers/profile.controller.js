// src/controllers/profile.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * GET /profile/me
 * Protected – Returns full profile of the logged-in user
 * Includes: skills, domains, current projects, reputation, availability, etc.
 */
const getMyProfile = async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        year: true,
        reputationScore: true,
        activeProjectCount: true,
        isAvailable: true,
        resumeUrl: true,
        createdAt: true,
        skills: {
          include: {
            skill: {
              select: { id: true, name: true, category: true }
            }
          }
        },
        domains: {
          include: {
            domain: {
              select: { id: true, name: true }
            }
          }
        },
        projectMembers: {
          where: { project: { status: 'active' } },
          include: {
            project: {
              select: {
                id: true,
                title: true,
                domain: true,
                status: true,
                deadline: true
              }
            }
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'Profile not found' });
    }

    // Format response for frontend
    const formattedProfile = {
      ...user,
      skills: user.skills.map(us => ({
        id: us.skill.id,
        name: us.skill.name,
        category: us.skill.category,
        proficiencyLevel: us.proficiencyLevel
      })),
      domains: user.domains.map(ud => ({
        id: ud.domain.id,
        name: ud.domain.name
      })),
      activeProjects: user.projectMembers.map(pm => pm.project)
    };

    res.json(formattedProfile);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /profile/:userId
 * Public view of any user's profile (used in search / match cards)
 * Limited fields for privacy
 */
const getUserProfile = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        department: true,
        year: true,
        reputationScore: true,
        isAvailable: true,
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
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const formatted = {
      ...user,
      skills: user.skills.map(us => ({
        id: us.skill.id,
        name: us.skill.name,
        category: us.skill.category,
        proficiencyLevel: us.proficiencyLevel
      })),
      domains: user.domains.map(ud => ud.domain.name)
    };

    res.json(formatted);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /profile
 * Update basic profile info + availability
 * Body: { name?, department?, year?, isAvailable? }
 */
const updateProfile = async (req, res) => {
  try {
    const { name, department, year, isAvailable } = req.body;

    const updatedUser = await prisma.user.update({
      where: { id: req.user.userId },
      data: {
        ...(name && { name }),
        ...(department !== undefined && { department }),
        ...(year !== undefined && { year: Number(year) }),
        ...(isAvailable !== undefined && { isAvailable })
      },
      select: {
        id: true,
        name: true,
        department: true,
        year: true,
        isAvailable: true,
        reputationScore: true
      }
    });

    res.json({
      message: 'Profile updated successfully',
      user: updatedUser
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /profile/skills
 * Add a skill with proficiency
 * Body: { skillName, category?, proficiencyLevel }
 * - Creates skill if it doesn't exist
 */
const addSkill = async (req, res) => {
  try {
    const { skillName, category = 'technical', proficiencyLevel = 3 } = req.body;

    if (!skillName) {
      return res.status(400).json({ error: 'Skill name is required' });
    }

    const level = Math.max(1, Math.min(5, Number(proficiencyLevel)));

    // Find or create global Skill
    let skill = await prisma.skill.findUnique({
      where: { name: skillName.toLowerCase().trim() }
    });

    if (!skill) {
      skill = await prisma.skill.create({
        data: {
          name: skillName.toLowerCase().trim(),
          category
        }
      });
    }

    // Add to UserSkill (upsert to prevent duplicates)
    const userSkill = await prisma.userSkill.upsert({
      where: {
        userId_skillId: {
          userId: req.user.userId,
          skillId: skill.id
        }
      },
      update: { proficiencyLevel: level },
      create: {
        userId: req.user.userId,
        skillId: skill.id,
        proficiencyLevel: level
      }
    });

    res.status(201).json({
      message: 'Skill added/updated',
      skill: {
        id: skill.id,
        name: skill.name,
        category: skill.category,
        proficiencyLevel: userSkill.proficiencyLevel
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /profile/skills/:skillId
 * Remove a skill from user profile
 */
const removeSkill = async (req, res) => {
  try {
    const { skillId } = req.params;

    await prisma.userSkill.delete({
      where: {
        userId_skillId: {
          userId: req.user.userId,
          skillId
        }
      }
    });

    res.json({ message: 'Skill removed successfully' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Skill not found on your profile' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /profile/domains
 * Add domain interest
 * Body: { domainName }
 */
const addDomainInterest = async (req, res) => {
  try {
    const { domainName } = req.body;

    if (!domainName) {
      return res.status(400).json({ error: 'Domain name is required' });
    }

    let domain = await prisma.domain.findUnique({
      where: { name: domainName.toLowerCase().trim() }
    });

    if (!domain) {
      domain = await prisma.domain.create({
        data: { name: domainName.toLowerCase().trim() }
      });
    }

    await prisma.userDomain.upsert({
      where: {
        userId_domainId: {
          userId: req.user.userId,
          domainId: domain.id
        }
      },
      update: {},
      create: {
        userId: req.user.userId,
        domainId: domain.id
      }
    });

    res.status(201).json({
      message: 'Domain interest added',
      domain: { id: domain.id, name: domain.name }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /profile/domains/:domainId
 * Remove domain interest
 */
const removeDomainInterest = async (req, res) => {
  try {
    const { domainId } = req.params;

    await prisma.userDomain.delete({
      where: {
        userId_domainId: {
          userId: req.user.userId,
          domainId
        }
      }
    });

    res.json({ message: 'Domain interest removed' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Domain not found on your profile' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getMyProfile,
  getUserProfile,
  updateProfile,
  addSkill,
  removeSkill,
  addDomainInterest,
  removeDomainInterest
};