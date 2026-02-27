// src/controllers/project.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * POST /projects
 * Create a new project
 * Body: { title, description, domain, deadline? }
 * - Enforces project cap (max 2 active)
 * - Automatically adds creator as "leader"
 */
const createProject = async (req, res) => {
  try {
    const { title, description, domain, deadline } = req.body;

    if (!title || !description || !domain) {
      return res.status(400).json({ error: 'Title, description and domain are required' });
    }

    // Enforce project cap (section 4.6)
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { activeProjectCount: true }
    });

    if (currentUser.activeProjectCount >= 2) {
      return res.status(400).json({ error: 'You have reached the maximum limit of 2 active projects' });
    }

    const project = await prisma.project.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        domain: domain.trim(),
        createdBy: req.user.userId,
        status: 'active',
        deadline: deadline ? new Date(deadline) : null
      }
    });

    // Add creator as leader
    await prisma.projectMember.create({
      data: {
        projectId: project.id,
        userId: req.user.userId,
        role: 'leader'
      }
    });

    // Increment active project count
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { activeProjectCount: { increment: 1 } }
    });

    res.status(201).json({
      message: 'Project created successfully',
      project: {
        id: project.id,
        title: project.title,
        description: project.description,
        domain: project.domain,
        status: project.status,
        deadline: project.deadline,
        createdAt: project.createdAt
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /projects/my
 * Get all projects the logged-in user is part of
 */
const getMyProjects = async (req, res) => {
  try {
    const memberships = await prisma.projectMember.findMany({
      where: { userId: req.user.userId },
      include: {
        project: {
          select: {
            id: true,
            title: true,
            description: true,
            domain: true,
            status: true,
            deadline: true,
            createdAt: true,
            createdBy: true
          }
        }
      },
      orderBy: { joinedAt: 'desc' }
    });

    const projects = memberships.map(m => ({
      ...m.project,
      myRole: m.role,
      joinedAt: m.joinedAt
    }));

    res.json(projects);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * GET /projects/:projectId
 * Get full details of a project (including members)
 */
const getProjectDetails = async (req, res) => {
  try {
    const { projectId } = req.params;

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: {
          include: {
            user: {
              select: {
                id: true,
                name: true,
                reputationScore: true,
                department: true,
                year: true,
                isAvailable: true
              }
            }
          }
        },
        createdByUser: {
          select: { name: true }
        }
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    // Check if requester is a member (for privacy in future, but MVP shows to all authenticated)
    const isMember = project.members.some(m => m.userId === req.user.userId);

    res.json({
      ...project,
      isMember,
      memberCount: project.members.length
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /projects/join
 * Join an active project
 * Body: { projectId }
 * - Enforces project cap
 * - Prevents duplicate join
 */
const joinProject = async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Check project cap
    const currentUser = await prisma.user.findUnique({
      where: { id: req.user.userId },
      select: { activeProjectCount: true }
    });

    if (currentUser.activeProjectCount >= 2) {
      return res.status(400).json({ error: 'You have reached the maximum limit of 2 active projects' });
    }

    // Check if project exists and is active
    const project = await prisma.project.findUnique({
      where: { id: projectId }
    });

    if (!project || project.status !== 'active') {
      return res.status(400).json({ error: 'Project not found or not active' });
    }

    // Check if already a member
    const existingMember = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.userId
        }
      }
    });

    if (existingMember) {
      return res.status(400).json({ error: 'You are already a member of this project' });
    }

    // Add member
    await prisma.projectMember.create({
      data: {
        projectId,
        userId: req.user.userId,
        role: 'member'
      }
    });

    // Increment active count
    await prisma.user.update({
      where: { id: req.user.userId },
      data: { activeProjectCount: { increment: 1 } }
    });

    res.json({ message: 'Successfully joined the project' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /projects/leave
 * Leave a project (mid-way or any time)
 * Body: { projectId }
 * - Decrements active count if project was active
 */
const leaveProject = async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    // Verify membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.userId
        }
      }
    });

    if (!membership) {
      return res.status(404).json({ error: 'You are not a member of this project' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      select: { status: true }
    });

    // Remove membership
    await prisma.projectMember.delete({
      where: {
        projectId_userId: {
          projectId,
          userId: req.user.userId
        }
      }
    });

    // Decrement active count ONLY if project is still active
    if (project.status === 'active') {
      await prisma.user.update({
        where: { id: req.user.userId },
        data: { activeProjectCount: { decrement: 1 } }
      });
    }

    res.json({ message: 'Successfully left the project' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * POST /projects/complete
 * Mark project as completed (only creator can do this)
 * Body: { projectId }
 * - Sets status = completed
 * - Decrements activeProjectCount for ALL members (section 4.6)
 */
const completeProject = async (req, res) => {
  try {
    const { projectId } = req.body;

    if (!projectId) {
      return res.status(400).json({ error: 'projectId is required' });
    }

    const project = await prisma.project.findUnique({
      where: { id: projectId },
      include: {
        members: true
      }
    });

    if (!project) {
      return res.status(404).json({ error: 'Project not found' });
    }

    if (project.createdBy !== req.user.userId) {
      return res.status(403).json({ error: 'Only the project creator can mark it as completed' });
    }

    if (project.status === 'completed') {
      return res.status(400).json({ error: 'Project is already completed' });
    }

    // Use transaction for atomicity
    const memberUpdates = project.members.map(member =>
      prisma.user.update({
        where: { id: member.userId },
        data: { activeProjectCount: { decrement: 1 } }
      })
    );

    await prisma.$transaction([
      prisma.project.update({
        where: { id: projectId },
        data: { status: 'completed' }
      }),
      ...memberUpdates
    ]);

    res.json({
      message: 'Project marked as completed. All members’ active project counts updated.',
      projectId
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  createProject,
  getMyProjects,
  getProjectDetails,
  joinProject,
  leaveProject,
  completeProject
};