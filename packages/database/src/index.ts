import { PrismaClient } from '@prisma/client';
import type { User, Dog, Veterinarian, Booking } from '@doggo/types';

// Extend PrismaClient with custom methods
class ExtendedPrismaClient extends PrismaClient {
  constructor() {
    super({
      log: process.env.NODE_ENV === 'development' ? ['query', 'info', 'warn', 'error'] : ['error'],
      errorFormat: 'minimal'
    });
  }

  // User utilities
  async findUserByEmail(email: string): Promise<User | null> {
    return this.user.findUnique({
      where: { email },
      include: {
        dogs: true,
        veterinarian: true,
        shelter: true
      }
    }) as Promise<User | null>;
  }

  async createUserWithProfile(userData: any): Promise<User> {
    return this.user.create({
      data: userData,
      include: {
        dogs: true
      }
    }) as Promise<User>;
  }

  // Dog utilities
  async findDogsByOwner(ownerId: string): Promise<Dog[]> {
    return this.dog.findMany({
      where: { ownerId },
      orderBy: { createdAt: 'desc' }
    }) as Promise<Dog[]>;
  }

  async searchDogs(filters: any): Promise<Dog[]> {
    const where: any = { isActive: true };
    
    if (filters.breed) {
      where.breed = { contains: filters.breed, mode: 'insensitive' };
    }
    
    if (filters.size) {
      where.size = { in: Array.isArray(filters.size) ? filters.size : [filters.size] };
    }
    
    if (filters.activityLevel) {
      where.activityLevel = { in: Array.isArray(filters.activityLevel) ? filters.activityLevel : [filters.activityLevel] };
    }

    return this.dog.findMany({
      where,
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            lastName: true,
            address: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    }) as Promise<Dog[]>;
  }

  // Veterinarian utilities
  async findNearbyVeterinarians(latitude: number, longitude: number, radiusKm: number = 50): Promise<Veterinarian[]> {
    // Note: This is a simplified version. In production, use PostGIS functions
    return this.veterinarian.findMany({
      where: {
        isVerified: true,
        isAcceptingPatients: true
      },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            phone: true
          }
        }
      },
      orderBy: { rating: 'desc' }
    }) as Promise<Veterinarian[]>;
  }

  async getVeterinarianAvailability(veterinarianId: string, date: Date): Promise<string[]> {
    const dayOfWeek = date.getDay();
    
    const veterinarian = await this.veterinarian.findUnique({
      where: { id: veterinarianId },
      select: { workingHours: true }
    });

    if (!veterinarian) return [];

    const workingHours = veterinarian.workingHours as any[];
    const daySchedule = workingHours.find(wh => wh.dayOfWeek === dayOfWeek && wh.isAvailable);
    
    if (!daySchedule) return [];

    // Get existing bookings for the date
    const startOfDay = new Date(date);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);

    const bookings = await this.booking.findMany({
      where: {
        veterinarianId,
        scheduledAt: {
          gte: startOfDay,
          lte: endOfDay
        },
        status: { not: 'CANCELLED' }
      },
      select: { scheduledAt: true, duration: true }
    });

    // Generate available slots
    const availableSlots: string[] = [];
    const startTime = daySchedule.startTime;
    const endTime = daySchedule.endTime;
    
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startMinutes = startHour * 60 + startMinute;
    const endMinutes = endHour * 60 + endMinute;
    
    // 30-minute slots
    for (let minutes = startMinutes; minutes < endMinutes; minutes += 30) {
      const hour = Math.floor(minutes / 60);
      const minute = minutes % 60;
      const timeString = `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      
      // Check if slot is available (not booked)
      const slotDateTime = new Date(date);
      slotDateTime.setHours(hour, minute, 0, 0);
      
      const isBooked = bookings.some(booking => {
        const bookingStart = new Date(booking.scheduledAt);
        const bookingEnd = new Date(bookingStart.getTime() + booking.duration * 60000);
        return slotDateTime >= bookingStart && slotDateTime < bookingEnd;
      });
      
      if (!isBooked) {
        availableSlots.push(timeString);
      }
    }

    return availableSlots;
  }

  // Booking utilities
  async createBookingWithTriage(bookingData: any, triageResponses?: any[]): Promise<Booking> {
    let urgencyScore = 1;
    let triageNotes = '';

    if (triageResponses) {
      // Calculate urgency score based on triage responses
      // This is a simplified version - use TriageSystem from utils
      urgencyScore = Math.min(10, triageResponses.length * 2);
      triageNotes = `Triage completato con ${triageResponses.length} risposte`;
    }

    return this.booking.create({
      data: {
        ...bookingData,
        urgencyScore,
        triageNotes
      },
      include: {
        user: true,
        dog: true,
        veterinarian: {
          include: { user: true }
        }
      }
    }) as Promise<Booking>;
  }

  async getUpcomingBookings(userId: string): Promise<Booking[]> {
    return this.booking.findMany({
      where: {
        userId,
        scheduledAt: { gte: new Date() },
        status: { in: ['PENDING', 'CONFIRMED'] }
      },
      include: {
        dog: true,
        veterinarian: {
          include: { user: true }
        }
      },
      orderBy: { scheduledAt: 'asc' }
    }) as Promise<Booking[]>;
  }

  // Emergency utilities
  async findNearbyEmergencies(latitude: number, longitude: number, radiusKm: number = 25) {
    // In production, use PostGIS ST_DWithin
    return this.emergency.findMany({
      where: {
        isResolved: false
      },
      include: {
        reporter: {
          select: {
            firstName: true,
            lastName: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 20
    });
  }

  // Match utilities
  async findPotentialMatches(dogId: string): Promise<any[]> {
    const dog = await this.dog.findUnique({
      where: { id: dogId },
      include: { owner: true }
    });

    if (!dog || !dog.owner) return [];

    // Find dogs with similar characteristics
    const potentialMatches = await this.dog.findMany({
      where: {
        id: { not: dogId },
        ownerId: { not: dog.ownerId },
        isActive: true,
        // Similar size or activity level
        OR: [
          { size: dog.size },
          { activityLevel: dog.activityLevel }
        ]
      },
      include: {
        owner: {
          select: {
            id: true,
            firstName: true,
            preferences: true,
            address: true
          }
        }
      },
      take: 20
    });

    // Filter out existing matches
    const existingMatches = await this.match.findMany({
      where: {
        OR: [
          { dog1Id: dogId },
          { dog2Id: dogId }
        ]
      },
      select: { dog1Id: true, dog2Id: true }
    });

    const existingMatchIds = new Set([
      ...existingMatches.map(m => m.dog1Id),
      ...existingMatches.map(m => m.dog2Id)
    ]);

    return potentialMatches.filter(match => !existingMatchIds.has(match.id));
  }

  // Analytics utilities
  async getDashboardStats(userId?: string) {
    const totalUsers = await this.user.count({ where: { isActive: true } });
    const totalDogs = await this.dog.count({ where: { isActive: true } });
    const totalBookings = await this.booking.count();
    const activeVeterinarians = await this.veterinarian.count({ where: { isAcceptingPatients: true } });

    const recentBookings = await this.booking.findMany({
      take: 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: { select: { firstName: true, lastName: true } },
        dog: { select: { name: true } },
        veterinarian: { 
          include: { 
            user: { select: { firstName: true, lastName: true } } 
          } 
        }
      }
    });

    // Calculate total revenue (simplified)
    const paidBookings = await this.booking.aggregate({
      where: { paymentStatus: 'PAID' },
      _sum: { totalCost: true }
    });

    const totalRevenue = paidBookings._sum.totalCost || 0;

    return {
      totalUsers,
      totalDogs,
      totalBookings,
      totalRevenue,
      activeVeterinarians,
      recentBookings
    };
  }

  async getMonthlyStats(months: number = 12) {
    const stats = [];
    const now = new Date();
    
    for (let i = months - 1; i >= 0; i--) {
      const date = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const nextMonth = new Date(now.getFullYear(), now.getMonth() - i + 1, 1);
      
      const [users, bookings, revenue] = await Promise.all([
        this.user.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextMonth
            }
          }
        }),
        this.booking.count({
          where: {
            createdAt: {
              gte: date,
              lt: nextMonth
            }
          }
        }),
        this.booking.aggregate({
          where: {
            createdAt: {
              gte: date,
              lt: nextMonth
            },
            paymentStatus: 'PAID'
          },
          _sum: { totalCost: true }
        })
      ]);

      stats.push({
        month: date.toISOString().substr(0, 7), // YYYY-MM format
        users,
        bookings,
        revenue: revenue._sum.totalCost || 0
      });
    }

    return stats;
  }

  // Document utilities
  async getDocumentsByDog(dogId: string) {
    return this.document.findMany({
      where: { dogId },
      orderBy: { createdAt: 'desc' }
    });
  }

  async getExpiringDocuments(days: number = 30) {
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + days);

    return this.document.findMany({
      where: {
        expirationDate: {
          gte: new Date(),
          lte: futureDate
        }
      },
      include: {
        owner: {
          select: { firstName: true, lastName: true, email: true }
        },
        dog: {
          select: { name: true }
        }
      },
      orderBy: { expirationDate: 'asc' }
    });
  }

  // Chat utilities
  async createOrGetChat(userIds: string[]) {
    // Check if chat already exists between these users
    const existingChat = await this.chat.findFirst({
      where: {
        participants: {
          every: {
            userId: { in: userIds }
          }
        }
      },
      include: {
        participants: true,
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (existingChat && existingChat.participants.length === userIds.length) {
      return existingChat;
    }

    // Create new chat
    const chat = await this.chat.create({
      data: {
        type: 'direct',
        participants: {
          create: userIds.map(userId => ({ userId }))
        }
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        }
      }
    });

    return chat;
  }

  async getUserChats(userId: string) {
    return this.chat.findMany({
      where: {
        participants: {
          some: { userId }
        },
        isActive: true
      },
      include: {
        participants: {
          include: {
            user: {
              select: { id: true, firstName: true, lastName: true, avatar: true }
            }
          }
        },
        messages: {
          take: 1,
          orderBy: { createdAt: 'desc' }
        }
      },
      orderBy: { lastMessageAt: 'desc' }
    });
  }

  async sendMessage(chatId: string, senderId: string, content: string, type: string = 'text') {
    const message = await this.message.create({
      data: {
        chatId,
        senderId,
        content,
        type
      },
      include: {
        sender: {
          select: { id: true, firstName: true, lastName: true, avatar: true }
        }
      }
    });

    // Update chat's lastMessageAt
    await this.chat.update({
      where: { id: chatId },
      data: { lastMessageAt: new Date() }
    });

    return message;
  }

  // Notification utilities
  async createNotification(userId: string, type: string, title: string, message: string, data?: any) {
    return this.notification.create({
      data: {
        userId,
        type: type as any,
        title,
        message,
        data: data || {}
      }
    });
  }

  async getUserNotifications(userId: string, unreadOnly: boolean = false) {
    return this.notification.findMany({
      where: {
        userId,
        ...(unreadOnly && { isRead: false })
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });
  }

  async markNotificationAsRead(notificationId: string) {
    return this.notification.update({
      where: { id: notificationId },
      data: {
        isRead: true,
        readAt: new Date()
      }
    });
  }

  // Audit logging
  async createAuditLog(userId: string | null, action: string, resource: string, resourceId: string, changes?: any, metadata?: any) {
    return this.auditLog.create({
      data: {
        userId,
        action,
        resource,
        resourceId,
        changes: changes || {},
        metadata: metadata || {}
      }
    });
  }

  // Adoption utilities
  async getAdoptableDogs(filters?: any) {
    const where: any = {
      adoptionStatus: 'AVAILABLE'
    };

    if (filters?.urgent) {
      where.urgent = true;
    }

    if (filters?.featured) {
      where.featured = true;
    }

    if (filters?.shelterId) {
      where.shelterId = filters.shelterId;
    }

    return this.adoptableDog.findMany({
      where,
      include: {
        dog: {
          include: {
            documents: {
              where: { type: 'VACCINATION' },
              orderBy: { createdAt: 'desc' },
              take: 1
            }
          }
        },
        shelter: {
          select: {
            name: true,
            contactInfo: true,
            address: true
          }
        }
      },
      orderBy: [
        { featured: 'desc' },
        { urgent: 'desc' },
        { createdAt: 'desc' }
      ]
    });
  }

  async submitAdoptionApplication(applicationData: any) {
    return this.adoptionApplication.create({
      data: applicationData,
      include: {
        dog: {
          include: { dog: true }
        },
        applicant: {
          select: { firstName: true, lastName: true, email: true, phone: true }
        },
        shelter: {
          select: { name: true, contactInfo: true }
        }
      }
    });
  }

  // Event utilities
  async getUpcomingEvents(location?: { latitude: number; longitude: number; radius: number }) {
    return this.event.findMany({
      where: {
        startDate: { gte: new Date() },
        isActive: true,
        isPublic: true
      },
      include: {
        organizer: {
          select: { name: true, contactInfo: true }
        }
      },
      orderBy: { startDate: 'asc' },
      take: 20
    });
  }

  async registerForEvent(eventId: string, userId: string) {
    // Check if already registered
    const existing = await this.eventParticipation.findUnique({
      where: {
        eventId_userId: { eventId, userId }
      }
    });

    if (existing) {
      throw new Error('Already registered for this event');
    }

    // Check event capacity
    const event = await this.event.findUnique({
      where: { id: eventId },
      select: { maxParticipants: true, currentParticipants: true }
    });

    if (event?.maxParticipants && event.currentParticipants >= event.maxParticipants) {
      throw new Error('Event is full');
    }

    // Register user
    const participation = await this.eventParticipation.create({
      data: { eventId, userId }
    });

    // Update participant count
    await this.event.update({
      where: { id: eventId },
      data: { currentParticipants: { increment: 1 } }
    });

    return participation;
  }

  // Health check
  async healthCheck() {
    try {
      await this.$queryRaw`SELECT 1`;
      return { status: 'healthy', timestamp: new Date() };
    } catch (error) {
      return { status: 'unhealthy', error: error.message, timestamp: new Date() };
    }
  }

  // Cleanup methods
  async cleanupExpiredSessions() {
    const expiredDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
    
    return this.videoCallSession.deleteMany({
      where: {
        status: 'ended',
        endedAt: { lt: expiredDate }
      }
    });
  }

  async cleanupOldAuditLogs(days: number = 90) {
    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    
    return this.auditLog.deleteMany({
      where: {
        createdAt: { lt: cutoffDate }
      }
    });
  }
}

// Create singleton instance
const db = new ExtendedPrismaClient();

// Handle graceful shutdown
process.on('beforeExit', async () => {
  await db.$disconnect();
});

process.on('SIGINT', async () => {
  await db.$disconnect();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  await db.$disconnect();
  process.exit(0);
});

export { db };
export * from '@prisma/client';
export type { User, Dog, Veterinarian, Booking } from '@doggo/types';