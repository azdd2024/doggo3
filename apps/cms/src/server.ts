import express from 'express';
import payload from 'payload';
import { Server } from 'socket.io';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import Redis from 'ioredis';
import Bull from 'bull';
import cron from 'node-cron';
import * as Sentry from '@sentry/node';
import { config } from 'dotenv';
import path from 'path';

// Load environment variables
config();

// Services
import { EmailService } from './services/EmailService';
import { SMSService } from './services/SMSService';
import { NotificationService } from './services/NotificationService';
import { PaymentService } from './services/PaymentService';
import { FileUploadService } from './services/FileUploadService';
import { VideoCallService } from './services/VideoCallService';

// Routes
import authRoutes from './routes/auth';
import apiRoutes from './routes/api';
import webhookRoutes from './routes/webhooks';
import healthRoutes from './routes/health';

// Socket handlers
import { setupSocketHandlers } from './socket/handlers';

// Initialize Sentry
if (process.env.SENTRY_DSN) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
  });
}

const app = express();
const server = createServer(app);

// Redis connection
const redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379', {
  retryDelayOnFailover: 100,
  enableReadyCheck: false,
  maxRetriesPerRequest: null,
});

// Job queues
const emailQueue = new Bull('email', process.env.REDIS_URL || 'redis://localhost:6379');
const smsQueue = new Bull('sms', process.env.REDIS_URL || 'redis://localhost:6379');
const notificationQueue = new Bull('notifications', process.env.REDIS_URL || 'redis://localhost:6379');

// Socket.IO
const io = new Server(server, {
  cors: {
    origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "fonts.googleapis.com"],
      fontSrc: ["'self'", "fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "*.amazonaws.com", "*.cloudflare.com"],
      scriptSrc: ["'self'"],
      connectSrc: ["'self'", "ws://localhost:*", "wss://localhost:*"],
    },
  },
}));

// CORS
app.use(cors({
  origin: process.env.CORS_ORIGIN?.split(',') || ['http://localhost:3001'],
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000'), // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100'),
  message: {
    error: 'Too many requests, please try again later.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api/', limiter);

// Compression
app.use(compression());

// Logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined'));
}

// Body parsing for webhooks (before payload)
app.use('/api/webhooks', express.raw({ type: 'application/json' }));

// Initialize Payload
const start = async (): Promise<void> => {
  try {
    // Initialize Payload
    await payload.init({
      secret: process.env.PAYLOAD_SECRET!,
      express: app,
      onInit: async () => {
        payload.logger.info('Payload Admin initialized successfully');
      },
    });

    // Initialize services
    const emailService = new EmailService();
    const smsService = new SMSService();
    const notificationService = new NotificationService(io, redis);
    const paymentService = new PaymentService();
    const fileUploadService = new FileUploadService();
    const videoCallService = new VideoCallService();

    // Store services in app locals for access in routes
    app.locals.services = {
      email: emailService,
      sms: smsService,
      notification: notificationService,
      payment: paymentService,
      fileUpload: fileUploadService,
      videoCall: videoCallService,
    };
    app.locals.redis = redis;
    app.locals.io = io;

    // Process job queues
    setupJobProcessors();

    // Setup routes
    app.use('/auth', authRoutes);
    app.use('/api', apiRoutes);
    app.use('/api/webhooks', webhookRoutes);
    app.use('/health', healthRoutes);

    // Socket.IO handlers
    setupSocketHandlers(io, redis);

    // Serve static files
    app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

    // Error handling
    app.use(Sentry.Handlers.errorHandler());
    
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      payload.logger.error('Unhandled error:', err);
      
      if (process.env.NODE_ENV === 'development') {
        return res.status(500).json({
          error: 'Internal server error',
          details: err.message,
          stack: err.stack,
        });
      }
      
      return res.status(500).json({
        error: 'Internal server error',
      });
    });

    // 404 handler
    app.use('*', (req, res) => {
      res.status(404).json({ error: 'Route not found' });
    });

    // Schedule cron jobs
    setupCronJobs();

    // Start server
    const PORT = process.env.PORT || 3000;
    server.listen(PORT, () => {
      payload.logger.info(`🚀 Server listening on port ${PORT}`);
      payload.logger.info(`📊 Admin panel: http://localhost:${PORT}/admin`);
      payload.logger.info(`🔗 GraphQL: http://localhost:${PORT}/api/graphql`);
    });

  } catch (error) {
    payload.logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Job processors
function setupJobProcessors() {
  // Email queue processor
  emailQueue.process('send-email', async (job) => {
    const { to, subject, templateId, data } = job.data;
    const emailService: EmailService = app.locals.services.email;
    
    try {
      await emailService.sendTemplatedEmail(to, subject, templateId, data);
      payload.logger.info(`Email sent successfully to ${to}`);
    } catch (error) {
      payload.logger.error(`Failed to send email to ${to}:`, error);
      throw error;
    }
  });

  // SMS queue processor
  smsQueue.process('send-sms', async (job) => {
    const { to, templateId, data } = job.data;
    const smsService: SMSService = app.locals.services.sms;
    
    try {
      await smsService.sendTemplatedSMS(to, templateId, data);
      payload.logger.info(`SMS sent successfully to ${to}`);
    } catch (error) {
      payload.logger.error(`Failed to send SMS to ${to}:`, error);
      throw error;
    }
  });

  // Notification queue processor
  notificationQueue.process('send-push', async (job) => {
    const { userId, title, body, data } = job.data;
    const notificationService: NotificationService = app.locals.services.notification;
    
    try {
      await notificationService.sendPushNotification(userId, title, body, data);
      payload.logger.info(`Push notification sent to user ${userId}`);
    } catch (error) {
      payload.logger.error(`Failed to send push notification to user ${userId}:`, error);
      throw error;
    }
  });

  // Queue event listeners
  emailQueue.on('completed', (job) => {
    payload.logger.info(`Email job ${job.id} completed`);
  });

  emailQueue.on('failed', (job, err) => {
    payload.logger.error(`Email job ${job.id} failed:`, err);
  });

  smsQueue.on('completed', (job) => {
    payload.logger.info(`SMS job ${job.id} completed`);
  });

  smsQueue.on('failed', (job, err) => {
    payload.logger.error(`SMS job ${job.id} failed:`, err);
  });

  notificationQueue.on('completed', (job) => {
    payload.logger.info(`Notification job ${job.id} completed`);
  });

  notificationQueue.on('failed', (job, err) => {
    payload.logger.error(`Notification job ${job.id} failed:`, err);
  });
}

// Cron jobs
function setupCronJobs() {
  // Send booking reminders (runs every hour)
  cron.schedule('0 * * * *', async () => {
    payload.logger.info('Running booking reminder job...');
    
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      tomorrow.setHours(0, 0, 0, 0);
      
      const dayAfterTomorrow = new Date(tomorrow);
      dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 1);
      
      // Find bookings scheduled for tomorrow
      const bookings = await payload.find({
        collection: 'bookings',
        where: {
          scheduledAt: {
            greater_than_equal: tomorrow.toISOString(),
            less_than: dayAfterTomorrow.toISOString(),
          },
          status: { equals: 'confirmed' },
        },
        populate: ['user', 'dog', 'veterinarian'],
      });
      
      // Send reminders
      for (const booking of bookings.docs) {
        if (booking.user?.preferences?.notifications?.email) {
          emailQueue.add('send-email', {
            to: booking.user.email,
            subject: 'Promemoria Visita Veterinaria',
            templateId: 'booking_reminder',
            data: {
              firstName: booking.user.firstName,
              dogName: booking.dog.name,
              clinicName: booking.veterinarian.clinicName,
              date: new Date(booking.scheduledAt).toLocaleDateString('it-IT'),
              time: new Date(booking.scheduledAt).toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
            },
          });
        }
        
        if (booking.user?.preferences?.notifications?.sms && booking.user.phone) {
          smsQueue.add('send-sms', {
            to: booking.user.phone,
            templateId: 'booking_reminder',
            data: {
              dogName: booking.dog.name,
              clinicName: booking.veterinarian.clinicName,
              time: new Date(booking.scheduledAt).toLocaleTimeString('it-IT', { 
                hour: '2-digit', 
                minute: '2-digit' 
              }),
              phone: booking.veterinarian.contactInfo?.phone || '',
            },
          });
        }
      }
      
      payload.logger.info(`Sent ${bookings.docs.length} booking reminders`);
    } catch (error) {
      payload.logger.error('Booking reminder job failed:', error);
    }
  });

  // Check expiring documents (runs daily at 9 AM)
  cron.schedule('0 9 * * *', async () => {
    payload.logger.info('Running document expiration check...');
    
    try {
      const { db } = await import('@doggo/database');
      const expiringDocuments = await db.getExpiringDocuments(30); // 30 days
      
      for (const doc of expiringDocuments) {
        if (doc.owner?.email) {
          emailQueue.add('send-email', {
            to: doc.owner.email,
            subject: 'Documento in Scadenza',
            templateId: 'document_expiring',
            data: {
              firstName: doc.owner.firstName,
              documentType: doc.type,
              dogName: doc.dog?.name || 'N/A',
              expirationDate: new Date(doc.expirationDate!).toLocaleDateString('it-IT'),
            },
          });
        }
      }
      
      payload.logger.info(`Sent ${expiringDocuments.length} document expiration notifications`);
    } catch (error) {
      payload.logger.error('Document expiration check failed:', error);
    }
  });

  // Clean up old data (runs daily at 2 AM)
  cron.schedule('0 2 * * *', async () => {
    payload.logger.info('Running cleanup job...');
    
    try {
      const { db } = await import('@doggo/database');
      
      // Clean up expired video call sessions
      await db.cleanupExpiredSessions();
      
      // Clean up old audit logs (keep 90 days)
      await db.cleanupOldAuditLogs(90);
      
      // Clean up old notifications (keep 30 days)
      const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
      await payload.delete({
        collection: 'notifications',
        where: {
          createdAt: { less_than: thirtyDaysAgo.toISOString() },
          isRead: { equals: true },
        },
      });
      
      payload.logger.info('Cleanup job completed');
    } catch (error) {
      payload.logger.error('Cleanup job failed:', error);
    }
  });

  // Update statistics (runs every 6 hours)
  cron.schedule('0 */6 * * *', async () => {
    payload.logger.info('Running statistics update...');
    
    try {
      // TODO: Update cached statistics for dashboards
      payload.logger.info('Statistics updated');
    } catch (error) {
      payload.logger.error('Statistics update failed:', error);
    }
  });
}

// Graceful shutdown
process.on('SIGTERM', async () => {
  payload.logger.info('SIGTERM received, shutting down gracefully...');
  
  // Close queues
  await emailQueue.close();
  await smsQueue.close();
  await notificationQueue.close();
  
  // Close Redis connection
  await redis.quit();
  
  // Close server
  server.close(() => {
    payload.logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', async () => {
  payload.logger.info('SIGINT received, shutting down gracefully...');
  
  // Close queues
  await emailQueue.close();
  await smsQueue.close();
  await notificationQueue.close();
  
  // Close Redis connection
  await redis.quit();
  
  // Close server
  server.close(() => {
    payload.logger.info('Server closed');
    process.exit(0);
  });
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  payload.logger.error('Unhandled Rejection at:', promise, 'reason:', reason);
  // Application specific logging, throwing an error, or other logic here
});

// Export app and start function for testing
export { app, start };

// Start the server if this file is run directly
if (require.main === module) {
  start();
}