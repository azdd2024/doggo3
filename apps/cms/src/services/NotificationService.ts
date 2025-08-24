import { Server as SocketIOServer } from 'socket.io';
import { Redis } from 'ioredis';
import admin from 'firebase-admin';
import payload from 'payload';

export class NotificationService {
  private io: SocketIOServer;
  private redis: Redis;
  private firebaseApp?: admin.app.App;

  constructor(io: SocketIOServer, redis: Redis) {
    this.io = io;
    this.redis = redis;
    this.initializeFirebase();
  }

  private initializeFirebase() {
    if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY) {
      console.warn('Firebase credentials not configured for push notifications');
      return;
    }

    try {
      this.firebaseApp = admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
    }
  }

  async sendNotification(
    userId: string,
    type: string,
    title: string,
    message: string,
    data?: any
  ): Promise<void> {
    try {
      // Store notification in database
      const notification = await payload.create({
        collection: 'notifications',
        data: {
          user: userId,
          type,
          title,
          message,
          data: data || {},
        },
      });

      // Send real-time notification via Socket.io
      await this.sendSocketNotification(userId, {
        id: notification.id,
        type,
        title,
        message,
        data,
        createdAt: notification.createdAt,
      });

      // Send push notification
      await this.sendPushNotification(userId, title, message, data);

      payload.logger.info(`Notification sent to user ${userId}: ${title}`);
    } catch (error) {
      payload.logger.error('Failed to send notification:', error);
      throw error;
    }
  }

  async sendSocketNotification(userId: string, notification: any): Promise<void> {
    try {
      // Send to user's rooms
      this.io.to(`user:${userId}`).emit('notification', notification);
      
      // Store in Redis for offline users
      await this.redis.lpush(
        `notifications:${userId}`,
        JSON.stringify(notification)
      );
      await this.redis.ltrim(`notifications:${userId}`, 0, 99); // Keep last 100
      await this.redis.expire(`notifications:${userId}`, 86400); // 24 hours

    } catch (error) {
      payload.logger.error('Failed to send socket notification:', error);
    }
  }

  async sendPushNotification(
    userId: string,
    title: string,
    body: string,
    data?: any
  ): Promise<void> {
    if (!this.firebaseApp) {
      return;
    }

    try {
      // Get user's FCM tokens
      const tokens = await this.getUserFCMTokens(userId);
      
      if (tokens.length === 0) {
        return;
      }

      const message = {
        notification: {
          title,
          body,
        },
        data: {
          ...data,
          click_action: 'FLUTTER_NOTIFICATION_CLICK',
        },
        tokens,
      };

      const response = await admin.messaging().sendMulticast(message);
      
      // Remove invalid tokens
      if (response.failureCount > 0) {
        const failedTokens: string[] = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
          }
        });
        
        await this.removeInvalidTokens(userId, failedTokens);
      }

      payload.logger.info(
        `Push notification sent to ${response.successCount}/${tokens.length} devices for user ${userId}`
      );
    } catch (error) {
      payload.logger.error('Failed to send push notification:', error);
    }
  }

  async getUserFCMTokens(userId: string): Promise<string[]> {
    try {
      const tokens = await this.redis.smembers(`fcm_tokens:${userId}`);
      return tokens;
    } catch (error) {
      payload.logger.error('Failed to get FCM tokens:', error);
      return [];
    }
  }

  async addFCMToken(userId: string, token: string): Promise<void> {
    try {
      await this.redis.sadd(`fcm_tokens:${userId}`, token);
      await this.redis.expire(`fcm_tokens:${userId}`, 86400 * 30); // 30 days
    } catch (error) {
      payload.logger.error('Failed to add FCM token:', error);
    }
  }

  async removeFCMToken(userId: string, token: string): Promise<void> {
    try {
      await this.redis.srem(`fcm_tokens:${userId}`, token);
    } catch (error) {
      payload.logger.error('Failed to remove FCM token:', error);
    }
  }

  async removeInvalidTokens(userId: string, tokens: string[]): Promise<void> {
    try {
      if (tokens.length > 0) {
        await this.redis.srem(`fcm_tokens:${userId}`, ...tokens);
      }
    } catch (error) {
      payload.logger.error('Failed to remove invalid tokens:', error);
    }
  }

  async getOfflineNotifications(userId: string): Promise<any[]> {
    try {
      const notifications = await this.redis.lrange(`notifications:${userId}`, 0, -1);
      return notifications.map(n => JSON.parse(n));
    } catch (error) {
      payload.logger.error('Failed to get offline notifications:', error);
      return [];
    }
  }

  async clearOfflineNotifications(userId: string): Promise<void> {
    try {
      await this.redis.del(`notifications:${userId}`);
    } catch (error) {
      payload.logger.error('Failed to clear offline notifications:', error);
    }
  }

  // Notification types
  async sendBookingConfirmation(booking: any, user: any, veterinarian: any): Promise<void> {
    await this.sendNotification(
      user.id,
      'booking_confirmed',
      'Prenotazione Confermata',
      `La tua visita con ${veterinarian.clinicName} è confermata per il ${new Date(booking.scheduledAt).toLocaleDateString('it-IT')}`,
      {
        bookingId: booking.id,
        veterinarianId: veterinarian.id,
      }
    );
  }

  async sendBookingReminder(booking: any, user: any, veterinarian: any): Promise<void> {
    await this.sendNotification(
      user.id,
      'booking_reminder',
      'Promemoria Visita',
      `Ricorda: visita per ${booking.dog.name} domani alle ${new Date(booking.scheduledAt).toLocaleTimeString('it-IT')}`,
      {
        bookingId: booking.id,
      }
    );
  }

  async sendNewMatch(user: any, dog1: any, dog2: any, matchScore: number): Promise<void> {
    await this.sendNotification(
      user.id,
      'new_match',
      '💖 Nuovo Match!',
      `${dog1.name} ha fatto match con ${dog2.name}! Compatibilità: ${matchScore}%`,
      {
        dog1Id: dog1.id,
        dog2Id: dog2.id,
        matchScore,
      }
    );
  }

  async sendNewMessage(recipientId: string, senderName: string, message: string, chatId: string): Promise<void> {
    await this.sendNotification(
      recipientId,
      'new_message',
      `Nuovo messaggio da ${senderName}`,
      message.length > 50 ? message.substring(0, 47) + '...' : message,
      {
        chatId,
        senderId: recipientId,
      }
    );
  }

  async sendEmergencyAlert(user: any, emergency: any, distance: number): Promise<void> {
    const typeLabels = {
      lost_dog: 'Cane Smarrito',
      found_dog: 'Cane Trovato',
      injured_dog: 'Cane Ferito',
      abandoned_dog: 'Cane Abbandonato',
    };

    await this.sendNotification(
      user.id,
      'emergency_alert',
      `🚨 ${typeLabels[emergency.type] || emergency.type}`,
      `${emergency.title} - A ${distance.toFixed(1)}km da te`,
      {
        emergencyId: emergency.id,
        distance,
        location: emergency.location,
      }
    );
  }

  async sendDocumentExpiring(user: any, document: any, daysUntilExpiry: number): Promise<void> {
    await this.sendNotification(
      user.id,
      'document_expiring',
      'Documento in Scadenza',
      `Il documento ${document.title} scadrà tra ${daysUntilExpiry} giorni`,
      {
        documentId: document.id,
        daysUntilExpiry,
      }
    );
  }

  async sendAdoptionUpdate(user: any, application: any, newStatus: string): Promise<void> {
    const statusLabels = {
      approved: 'approvata',
      rejected: 'respinta',
      interview: 'richiede un colloquio',
      home_visit: 'richiede una visita domiciliare',
      completed: 'completata con successo',
    };

    await this.sendNotification(
      user.id,
      'adoption_update',
      'Aggiornamento Adozione',
      `La tua richiesta per ${application.dog.name} è stata ${statusLabels[newStatus] || newStatus}`,
      {
        applicationId: application.id,
        dogId: application.dog.id,
        status: newStatus,
      }
    );
  }
}