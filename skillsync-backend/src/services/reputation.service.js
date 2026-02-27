// src/services/reputation.service.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Rate a teammate after (or during/after) a project
 * Prevents duplicate ratings for the same rater-rated-project combination
 *
 * @param {string} raterId       - ID of the user giving the rating
 * @param {string} ratedUserId   - ID of the user being rated
 * @param {string} projectId     - ID of the project this rating concerns
 * @param {number} rating        - 1 to 5
 * @returns {Promise<{message: string, adjustment?: number}>}
 */
async function rateTeammate(raterId, ratedUserId, projectId, rating) {
  if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
    throw new Error('Rating must be an integer between 1 and 5');
  }

  // Check for duplicate rating (same rater → same rated → same project)
  const existingRating = await prisma.reputationLog.findFirst({
    where: {
      userId: ratedUserId,
      projectId,
      reason: { startsWith: `Rating from user ${raterId}` },
    },
  });

  if (existingRating) {
    throw new Error('You have already rated this teammate for this project');
  }

  // Calculate immediate adjustment based on your documentation rules
  let adjustment = 0;
  if (rating < 2)       adjustment = -15;
  else if (rating <= 3) adjustment = -5;
  else if (rating <= 4) adjustment = +5;
  else                  adjustment = +10;

  // Apply to user's reputation (with floor at 0 or 10 – your choice)
  const updatedUser = await prisma.user.update({
    where: { id: ratedUserId },
    data: {
      reputationScore: {
        increment: adjustment,
      },
    },
    select: { reputationScore: true },
  });

  // Prevent going below 0 (or set your own floor)
  if (updatedUser.reputationScore < 0) {
    await prisma.user.update({
      where: { id: ratedUserId },
      data: { reputationScore: 0 },
    });
  }

  // Log the rating event
  await prisma.reputationLog.create({
    data: {
      userId: ratedUserId,
      projectId,
      change: adjustment,
      reason: `Rating from user ${raterId}: ${rating}/5`,
    },
  });

  return {
    message: 'Rating recorded successfully',
    adjustment,
    newReputation: Math.max(0, updatedUser.reputationScore + adjustment),
  };
}

/**
 * Get average rating received by a user across all projects
 * (useful for display or debugging)
 */
async function getAverageRating(userId) {
  const logs = await prisma.reputationLog.findMany({
    where: {
      userId,
      reason: { startsWith: 'Rating from' },
    },
    select: { change: true },
  });

  if (logs.length === 0) return null;

  const total = logs.reduce((sum, log) => sum + log.change, 0);
  return Number((total / logs.length).toFixed(2));
}

/**
 * Get full reputation history for a user
 */
async function getReputationHistory(userId) {
  return prisma.reputationLog.findMany({
    where: { userId },
    orderBy: { createdAt: 'desc' },
  });
}

module.exports = {
  rateTeammate,
  getAverageRating,
  getReputationHistory,
};