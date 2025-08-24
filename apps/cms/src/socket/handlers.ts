import { Server as SocketIOServer, Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { CryptoUtils } from '@doggo/utils';
import payload from 'payload';

interface AuthenticatedSocket extends Socket {
  user?: any;
  rooms?: Set<string>;
}

export function setupSocketHandlers(io: SocketIOServer, redis: Redis) {
  // Authentication middleware for socket connections
  io.use(async (socket: AuthenticatedSocket, next) => {
    try {
      const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.replace('Bearer ', '');

      if (!token) {
        return next(new Error('Authentication token required'));
      }

      // Verify JWT token
      const decoded = CryptoUtils.verifyToken(token, process.env.JWT_SECRET!);

      // Get user from database
      const user = await payload.findByID({
        collection: 'users',
        id: decoded.userId,
      });

      if (!user || !user.isActive) {
        return next(new Error('Invalid or inactive user'));
      }

      socket.user = user;
      socket.rooms = new Set();
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  // Connection handler
  io.on('connection', async (socket: AuthenticatedSocket) => {
    if (!socket.user) return;

    const userId = socket.user.id;
    payload.logger.info(`User ${userId} connected via WebSocket`);

    // Join user's personal room
    await socket.join(`user:${userId}`);
    socket.rooms?.add(`user:${userId}`);

    // Send any pending offline notifications
    try {
      const notificationService = require('../services/NotificationService').NotificationService;
      if (notificationService) {
        const offlineNotifications = await notificationService.getOfflineNotifications(userId);
        if (offlineNotifications.length > 0) {
          socket.emit('offline_notifications', offlineNotifications);
          await notificationService.clearOfflineNotifications(userId);
        }
      }
    } catch (error) {
      payload.logger.error('Failed to send offline notifications:', error);
    }

    // Update user's online status
    await redis.setex(`user_online:${userId}`, 300, Date.now().toString()); // 5 minutes TTL

    // ===========================================
    // CHAT HANDLERS
    // ===========================================

    socket.on('join_chat', async (data: { chatId: string }) => {
      try {
        const { chatId } = data;

        // Verify user has access to this chat
        const chat = await payload.findByID({
          collection: 'chats',
          id: chatId,
          populate: ['participants'],
        });

        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        const hasAccess = chat.participants.some((p: any) => p.user === userId);
        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to chat' });
          return;
        }

        // Join chat room
        await socket.join(`chat:${chatId}`);
        socket.rooms?.add(`chat:${chatId}`);

        // Notify other participants that user joined
        socket.to(`chat:${chatId}`).emit('user_joined_chat', {
          chatId,
          user: {
            id: socket.user.id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            avatar: socket.user.avatar,
          },
        });

        socket.emit('chat_joined', { chatId });
      } catch (error) {
        payload.logger.error('Join chat error:', error);
        socket.emit('error', { message: 'Failed to join chat' });
      }
    });

    socket.on('leave_chat', async (data: { chatId: string }) => {
      try {
        const { chatId } = data;
        await socket.leave(`chat:${chatId}`);
        socket.rooms?.delete(`chat:${chatId}`);

        socket.to(`chat:${chatId}`).emit('user_left_chat', {
          chatId,
          userId,
        });
      } catch (error) {
        payload.logger.error('Leave chat error:', error);
      }
    });

    socket.on('send_message', async (data: { chatId: string; content: string; type?: string }) => {
      try {
        const { chatId, content, type = 'text' } = data;

        // Verify user has access to this chat
        const chat = await payload.findByID({
          collection: 'chats',
          id: chatId,
        });

        if (!chat) {
          socket.emit('error', { message: 'Chat not found' });
          return;
        }

        // Create message in database
        const message = await payload.create({
          collection: 'messages',
          data: {
            chat: chatId,
            sender: userId,
            content,
            type,
          },
        });

        // Update chat's last message time
        await payload.update({
          collection: 'chats',
          id: chatId,
          data: {
            lastMessageAt: new Date(),
          },
        });

        const messageData = {
          id: message.id,
          chatId,
          content,
          type,
          sender: {
            id: socket.user.id,
            firstName: socket.user.firstName,
            lastName: socket.user.lastName,
            avatar: socket.user.avatar,
          },
          createdAt: message.createdAt,
        };

        // Send message to chat participants
        io.to(`chat:${chatId}`).emit('new_message', messageData);

        // Send push notifications to offline users
        const participants = await payload.find({
          collection: 'chat-participants',
          where: {
            chat: { equals: chatId },
            user: { not_equals: userId },
          },
          populate: ['user'],
        });

        for (const participant of participants.docs) {
          const isOnline = await redis.exists(`user_online:${participant.user.id}`);
          if (!isOnline && participant.user.preferences?.notifications?.push) {
            try {
              const notificationService = require('../services/NotificationService').NotificationService;
              await notificationService.sendNewMessage(
                participant.user.id,
                `${socket.user.firstName} ${socket.user.lastName}`,
                content,
                chatId
              );
            } catch (error) {
              payload.logger.error('Failed to send message notification:', error);
            }
          }
        }
      } catch (error) {
        payload.logger.error('Send message error:', error);
        socket.emit('error', { message: 'Failed to send message' });
      }
    });

    socket.on('typing_start', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('user_typing', {
        chatId: data.chatId,
        userId,
        isTyping: true,
      });
    });

    socket.on('typing_stop', (data: { chatId: string }) => {
      socket.to(`chat:${data.chatId}`).emit('user_typing', {
        chatId: data.chatId,
        userId,
        isTyping: false,
      });
    });

    socket.on('message_read', async (data: { messageId: string }) => {
      try {
        const message = await payload.findByID({
          collection: 'messages',
          id: data.messageId,
        });

        if (!message) return;

        // Update read status
        const readBy = Array.isArray(message.readBy) ? message.readBy : [];
        const existingRead = readBy.find((r: any) => r.userId === userId);

        if (!existingRead) {
          readBy.push({
            userId,
            readAt: new Date(),
          });

          await payload.update({
            collection: 'messages',
            id: data.messageId,
            data: { readBy },
          });

          // Notify sender
          socket.to(`chat:${message.chat}`).emit('message_read', {
            messageId: data.messageId,
            readBy: userId,
            readAt: new Date(),
          });
        }
      } catch (error) {
        payload.logger.error('Message read error:', error);
      }
    });

    // ===========================================
    // LOCATION HANDLERS
    // ===========================================

    socket.on('update_location', async (data: { latitude: number; longitude: number }) => {
      try {
        const { latitude, longitude } = data;

        // Update user's location
        await payload.update({
          collection: 'users',
          id: userId,
          data: {
            'address.coordinates.latitude': latitude,
            'address.coordinates.longitude': longitude,
          },
        });

        // Store real-time location in Redis for nearby features
        await redis.setex(
          `user_location:${userId}`,
          3600, // 1 hour TTL
          JSON.stringify({ latitude, longitude, timestamp: Date.now() })
        );

        socket.emit('location_updated');
      } catch (error) {
        payload.logger.error('Location update error:', error);
        socket.emit('error', { message: 'Failed to update location' });
      }
    });

    // ===========================================
    // BOOKING HANDLERS
    // ===========================================

    socket.on('join_booking', async (data: { bookingId: string }) => {
      try {
        const booking = await payload.findByID({
          collection: 'bookings',
          id: data.bookingId,
          populate: ['veterinarian'],
        });

        if (!booking) {
          socket.emit('error', { message: 'Booking not found' });
          return;
        }

        // Check access
        const hasAccess = booking.user === userId || 
                         (socket.user.role === 'veterinarian' && booking.veterinarian?.user === userId) ||
                         socket.user.role === 'admin';

        if (!hasAccess) {
          socket.emit('error', { message: 'Access denied to booking' });
          return;
        }

        await socket.join(`booking:${data.bookingId}`);
        socket.rooms?.add(`booking:${data.bookingId}`);

        socket.emit('booking_joined', { bookingId: data.bookingId });
      } catch (error) {
        payload.logger.error('Join booking error:', error);
        socket.emit('error', { message: 'Failed to join booking' });
      }
    });

    socket.on('booking_status_change', async (data: { bookingId: string; status: string; notes?: string }) => {
      try {
        if (socket.user.role !== 'veterinarian' && socket.user.role !== 'admin') {
          socket.emit('error', { message: 'Not authorized to change booking status' });
          return;
        }

        const booking = await payload.update({
          collection: 'bookings',
          id: data.bookingId,
          data: {
            status: data.status,
            ...(data.notes && { consultationNotes: data.notes }),
          },
        });

        // Notify all participants in booking room
        io.to(`booking:${data.bookingId}`).emit('booking_updated', {
          bookingId: data.bookingId,
          status: data.status,
          notes: data.notes,
          updatedAt: new Date(),
        });
      } catch (error) {
        payload.logger.error('Booking status change error:', error);
        socket.emit('error', { message: 'Failed to update booking status' });
      }
    });

    // ===========================================
    // VIDEO CALL HANDLERS
    // ===========================================

    socket.on('start_video_call', async (data: { bookingId: string }) => {
      try {
        const videoCallService = require('../services/VideoCallService').VideoCallService;
        const callData = await videoCallService.startCall(data.bookingId);

        // Notify participants
        io.to(`booking:${data.bookingId}`).emit('video_call_started', {
          bookingId: data.bookingId,
          roomUrl: callData.roomUrl,
          tokens: {
            veterinarian: socket.user.role === 'veterinarian' ? callData.veterinarianToken : undefined,
            owner: socket.user.role === 'user' ? callData.ownerToken : undefined,
          },
        });
      } catch (error) {
        payload.logger.error('Start video call error:', error);
        socket.emit('error', { message: 'Failed to start video call' });
      }
    });

    socket.on('end_video_call', async (data: { bookingId: string }) => {
      try {
        const videoCallService = require('../services/VideoCallService').VideoCallService;
        await videoCallService.endCall(data.bookingId);

        io.to(`booking:${data.bookingId}`).emit('video_call_ended', {
          bookingId: data.bookingId,
        });
      } catch (error) {
        payload.logger.error('End video call error:', error);
        socket.emit('error', { message: 'Failed to end video call' });
      }
    });

    // ===========================================
    // EMERGENCY HANDLERS
    // ===========================================

    socket.on('join_emergency_alerts', async () => {
      try {
        // Join regional emergency room based on user location
        if (socket.user.address?.coordinates) {
          const region = getRegionFromCoordinates(socket.user.address.coordinates);
          await socket.join(`emergency:${region}`);
          socket.rooms?.add(`emergency:${region}`);
        }

        socket.emit('emergency_alerts_joined');
      } catch (error) {
        payload.logger.error('Join emergency alerts error:', error);
      }
    });

    // ===========================================
    // MATCHING HANDLERS (TINDOG)
    // ===========================================

    socket.on('join_matching', async () => {
      try {
        await socket.join(`matching:${userId}`);
        socket.rooms?.add(`matching:${userId}`);
        socket.emit('matching_joined');
      } catch (error) {
        payload.logger.error('Join matching error:', error);
      }
    });

    socket.on('match_action', async (data: { dog1Id: string; dog2Id: string; action: 'like' | 'pass' }) => {
      try {
        // Process match action (this would typically be handled by the API)
        // But we can send real-time updates here
        
        if (data.action === 'like') {
          // Check if it creates a mutual match
          const existingMatch = await payload.find({
            collection: 'matches',
            where: {
              or: [
                { dog1Id: { equals: data.dog1Id }, dog2Id: { equals: data.dog2Id } },
                { dog1Id: { equals: data.dog2Id }, dog2Id: { equals: data.dog1Id } },
              ],
            },
            limit: 1,
          });

          if (existingMatch.docs.length > 0) {
            const match = existingMatch.docs[0];
            const isReverse = match.dog1Id === data.dog2Id;
            const otherAction = isReverse ? match.user1Action : match.user2Action;

            if (otherAction === 'liked') {
              // It's a mutual match!
              const dog2 = await payload.findByID({
                collection: 'dogs',
                id: data.dog2Id,
                populate: ['owner'],
              });

              // Notify both users
              io.to(`matching:${userId}`).emit('new_match', {
                matchId: match.id,
                dog: dog2,
                score: match.matchScore,
              });

              io.to(`matching:${dog2.owner.id}`).emit('new_match', {
                matchId: match.id,
                dog: await payload.findByID({ collection: 'dogs', id: data.dog1Id }),
                score: match.matchScore,
              });
            }
          }
        }
      } catch (error) {
        payload.logger.error('Match action error:', error);
      }
    });

    // ===========================================
    // NOTIFICATION HANDLERS
    // ===========================================

    socket.on('mark_notification_read', async (data: { notificationId: string }) => {
      try {
        await payload.update({
          collection: 'notifications',
          id: data.notificationId,
          data: {
            isRead: true,
            readAt: new Date(),
          },
        });

        socket.emit('notification_marked_read', { notificationId: data.notificationId });
      } catch (error) {
        payload.logger.error('Mark notification read error:', error);
      }
    });

    // ===========================================
    // DISCONNECT HANDLER
    // ===========================================

    socket.on('disconnect', async () => {
      payload.logger.info(`User ${userId} disconnected`);

      // Remove from online status
      await redis.del(`user_online:${userId}`);

      // Leave all rooms
      if (socket.rooms) {
        for (const room of socket.rooms) {
          socket.leave(room);
        }
      }
    });

    // ===========================================
    // ERROR HANDLER
    // ===========================================

    socket.on('error', (error) => {
      payload.logger.error('Socket error:', error);
      socket.emit('error', { message: 'An error occurred' });
    });
  });

  // ===========================================
  // HELPER FUNCTIONS
  // ===========================================

  function getRegionFromCoordinates(coordinates: { latitude: number; longitude: number }): string {
    // Simple region mapping for Italy
    // In production, use more sophisticated geolocation
    const { latitude, longitude } = coordinates;

    if (latitude > 45.5) return 'north';
    if (latitude > 41.5) return 'center';
    return 'south';
  }

  // Broadcast system-wide notifications
  function broadcastSystemNotification(notification: any) {
    io.emit('system_notification', notification);
  }

  // Broadcast emergency alerts to region
  function broadcastEmergencyAlert(region: string, emergency: any) {
    io.to(`emergency:${region}`).emit('emergency_alert', emergency);
  }

  // Store references for use by other services
  (global as any).socketIO = {
    io,
    broadcastSystemNotification,
    broadcastEmergencyAlert,
  };

  payload.logger.info('✅ Socket.IO handlers initialized');
}

// Helper function to send notification to specific user
export async function sendSocketNotification(userId: string, notification: any) {
  const io = (global as any).socketIO?.io;
  if (io) {
    io.to(`user:${userId}`).emit('notification', notification);
  }
}

// Helper function to send message to chat
export async function sendChatMessage(chatId: string, message: any) {
  const io = (global as any).socketIO?.io;
  if (io) {
    io.to(`chat:${chatId}`).emit('new_message', message);
  }
}