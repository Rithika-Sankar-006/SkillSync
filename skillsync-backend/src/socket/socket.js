// src/socket/socket.js
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

/**
 * Initialize Socket.io server
 * @param {http.Server} server - Express HTTP server
 * @returns {Server} io instance
 */
const initSocket = (server) => {
  const io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
  });

  // Track online users: userId → socketId
  const onlineUsers = new Map();

  io.on('connection', (socket) => {
    console.log('New client connected:', socket.id);

    // Authenticate user with JWT (sent from frontend on connect)
    socket.on('authenticate', async (token) => {
      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const userId = decoded.userId;

        if (!userId) {
          socket.disconnect(true);
          return;
        }

        // Store user info on socket
        socket.userId = userId;
        socket.data = { userId }; // For socket.io rooms

        // Add to online map
        onlineUsers.set(userId, socket.id);

        // Join personal room for notifications/messages
        socket.join(`user:${userId}`);

        // Broadcast online status to relevant rooms (e.g., project rooms later)
        io.emit('userOnline', { userId });

        console.log(`User ${userId} authenticated and joined`);
      } catch (error) {
        console.error('Socket auth failed:', error.message);
        socket.disconnect(true);
      }
    });

    // 1-1 Send Message (section 4.9)
    socket.on('sendMessage', async (data) => {
      const { receiverId, content } = data;

      if (!socket.userId || !receiverId || !content.trim()) {
        socket.emit('error', { message: 'Invalid message data' });
        return;
      }

      try {
        // Persist message in DB
        const message = await prisma.message.create({
          data: {
            senderId: socket.userId,
            receiverId,
            content: content.trim(),
            isRead: false,
          },
          include: {
            sender: { select: { id: true, name: true } },
            receiver: { select: { id: true, name: true } },
          },
        });

        // Emit to receiver if online (their personal room)
        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          io.to(`user:${receiverId}`).emit('newMessage', {
            ...message,
            sender: message.sender,
          });
        }

        // Emit confirmation to sender
        socket.emit('messageSent', {
          ...message,
          receiver: message.receiver,
        });

        // Trigger notification for receiver (section 4.12)
        await createNotification(
          receiverId,
          'message_received',
          `New message from ${message.sender.name}`,
          io,
          socket.userId // sender for context
        );
      } catch (error) {
        console.error('Message send error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    // Mark message as read (section 4.9)
    socket.on('markAsRead', async (messageId) => {
      try {
        const updated = await prisma.message.update({
          where: { id: messageId },
          data: { isRead: true },
          include: { sender: true },
        });

        // Notify sender (if online) about read receipt
        const senderSocketId = onlineUsers.get(updated.senderId);
        if (senderSocketId) {
          io.to(`user:${updated.senderId}`).emit('messageRead', {
            messageId,
            readBy: socket.userId,
          });
        }

        socket.emit('readConfirmed', { messageId });
      } catch (error) {
        console.error('Mark read error:', error);
        socket.emit('error', { message: 'Failed to update read status' });
      }
    });

    // Typing indicator (section 4.9)
    socket.on('typing', (receiverId) => {
      if (!socket.userId || !receiverId) return;

      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(`user:${receiverId}`).emit('userTyping', {
          userId: socket.userId,
          isTyping: true,
        });
      }
    });

    socket.on('stopTyping', (receiverId) => {
      if (!socket.userId || !receiverId) return;

      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(`user:${receiverId}`).emit('userTyping', {
          userId: socket.userId,
          isTyping: false,
        });
      }
    });

    // Check if user is online
    socket.on('isOnline', (targetUserId) => {
      const isOnline = onlineUsers.has(targetUserId);
      socket.emit('onlineStatus', { userId: targetUserId, isOnline });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      if (socket.userId) {
        onlineUsers.delete(socket.userId);
        io.emit('userOffline', { userId: socket.userId });
        console.log(`User ${socket.userId} disconnected`);
      }
      console.log('Client disconnected:', socket.id);
    });
  });

  return io;
};

/**
 * Create a stored notification + emit real-time via Socket.io
 * Used for triggers like new message, project invite, reputation update (section 4.12)
 * @param {string} userId - Recipient user ID
 * @param {string} type - e.g., 'message_received', 'project_invite', 'reputation_update'
 * @param {string} message - Notification body
 * @param {Server} io - Socket.io instance
 * @param {any} metadata - Optional extra data (e.g., senderId, projectId)
 */
const createNotification = async (userId, type, message, io, metadata = {}) => {
  try {
    const notification = await prisma.notification.create({
      data: {
        userId,
        type,
        title: type.replace('_', ' ').toUpperCase(), // e.g., 'Message Received'
        message,
        ...metadata, // e.g., { projectId, senderId }
      },
    });

    // Emit real-time to user's room (if connected)
    io?.to(`user:${userId}`).emit('newNotification', notification);

    console.log(`Notification created for user ${userId}: ${type}`);
    return notification;
  } catch (error) {
    console.error('Notification creation error:', error);
    throw error;
  }
};

module.exports = { initSocket, createNotification };