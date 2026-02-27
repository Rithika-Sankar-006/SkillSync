// src/controllers/notification.controller.js
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Helper function (exported) – can be imported by ANY controller/service
 * Used to create stored notifications + will later trigger Socket.io emit
 * 
 * Types (as per doc 4.12):
 * - project_invite
 * - project_accepted
 * - match_found
 * - reputation_update
 * - message_received
 * - project_completed
 * - rating_received
 */
const createNotification = async (userId, type, title, message) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title,
        message,
        isRead: false
      }
    });

    // TODO: Later in socket.js we will emit real-time here
    // For now, just store (real-time will be added in socket layer)

    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
    // Do NOT throw – notifications are non-critical
    return null;
  }
};

/**
 * GET /notifications
 * Protected
 * Query params:
 * - page (default 1)
 * - limit (default 20)
 * - unreadOnly (true/false)
 * 
 * Returns notifications sorted newest first + unread count
 */
const getNotifications = async (req, res) => {
  try {
    const { page = 1, limit = 20, unreadOnly = 'false' } = req.query;

    const take = Math.min(Math.max(Number(limit), 1), 50);
    const skip = (Math.max(Number(page), 1) - 1) * take;

    const where = {
      userId: req.user.userId,
      ...(unreadOnly === 'true' && { isRead: false })
    };

    const [notifications, total, unreadCount] = await prisma.$transaction([
      prisma.notification.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take,
        select: {
          id: true,
          type: true,
          title: true,
          message: true,
          isRead: true,
          createdAt: true
        }
      }),
      prisma.notification.count({ where }),
      prisma.notification.count({
        where: { userId: req.user.userId, isRead: false }
      })
    ]);

    res.json({
      notifications,
      unreadCount,
      pagination: {
        page: Number(page),
        limit: take,
        total,
        hasMore: notifications.length === take
      }
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /notifications/:id/read
 * Mark single notification as read
 */
const markAsRead = async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await prisma.notification.update({
      where: {
        id,
        userId: req.user.userId // security: only own notifications
      },
      data: { isRead: true }
    });

    res.json({
      message: 'Notification marked as read',
      notification
    });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Notification not found' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * PUT /notifications/read-all
 * Mark ALL notifications as read for the user
 */
const markAllAsRead = async (req, res) => {
  try {
    await prisma.notification.updateMany({
      where: {
        userId: req.user.userId,
        isRead: false
      },
      data: { isRead: true }
    });

    res.json({ message: 'All notifications marked as read' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

/**
 * DELETE /notifications/:id
 * Optional: delete a single notification (user can clear)
 */
const deleteNotification = async (req, res) => {
  try {
    const { id } = req.params;

    await prisma.notification.delete({
      where: {
        id,
        userId: req.user.userId
      }
    });

    res.json({ message: 'Notification deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Notification not found' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
};

module.exports = {
  getNotifications,
  markAsRead,
  markAllAsRead,
  deleteNotification,
  createNotification   // ← IMPORTANT: export helper for other controllers
};