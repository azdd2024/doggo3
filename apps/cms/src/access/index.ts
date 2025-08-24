import type { AccessArgs } from 'payload/config';
import type { User } from 'payload/generated-types';

// Admin access
export const isAdmin = ({ req: { user } }: AccessArgs<any, User>): boolean => {
  return user?.role === 'admin';
};

// Admin or self access (for user profiles)
export const isAdminOrSelf = ({ req: { user } }: AccessArgs<any, User>) => {
  if (user?.role === 'admin') return true;
  
  return {
    id: {
      equals: user?.id,
    },
  };
};

// Owner or admin access (for owned resources)
export const isOwnerOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (user?.role === 'admin') return true;
  
  return {
    owner: {
      equals: user?.id,
    },
  };
};

// Veterinarian or admin access
export const isVeterinarianOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (user?.role === 'admin') return true;
  
  if (user?.role === 'veterinarian') {
    return {
      user: {
        equals: user.id,
      },
    };
  }
  
  return false;
};

// Booking access: owner, veterinarian, or admin
export const isBookingOwnerOrVetOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  // If user is the booking owner
  const ownerQuery = {
    user: {
      equals: user.id,
    },
  };
  
  // If user is a veterinarian involved in the booking
  if (user.role === 'veterinarian') {
    try {
      const vetProfile = await payload.find({
        collection: 'veterinarians',
        where: {
          user: { equals: user.id },
        },
        limit: 1,
      });
      
      if (vetProfile.docs.length > 0) {
        return {
          or: [
            ownerQuery,
            {
              veterinarian: {
                equals: vetProfile.docs[0].id,
              },
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error finding veterinarian profile:', error);
    }
  }
  
  return ownerQuery;
};

// Shelter access
export const isShelterOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (user?.role === 'admin') return true;
  
  if (user?.role === 'shelter') {
    return {
      user: {
        equals: user.id,
      },
    };
  }
  
  return false;
};

// Document access: owner or admin
export const isDocumentOwnerOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return {
    owner: {
      equals: user.id,
    },
  };
};

// Emergency access: reporter or admin
export const isEmergencyReporterOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return {
    reporter: {
      equals: user.id,
    },
  };
};

// Match access: dog owners or admin
export const isMatchParticipantOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  try {
    // Get user's dogs
    const userDogs = await payload.find({
      collection: 'dogs',
      where: {
        owner: { equals: user.id },
      },
      limit: 100,
    });
    
    const dogIds = userDogs.docs.map(dog => dog.id);
    
    if (dogIds.length === 0) return false;
    
    return {
      or: [
        {
          dog1: {
            in: dogIds,
          },
        },
        {
          dog2: {
            in: dogIds,
          },
        },
      ],
    };
  } catch (error) {
    console.error('Error checking match access:', error);
    return false;
  }
};

// Chat access: participants or admin
export const isChatParticipantOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return {
    participants: {
      contains: user.id,
    },
  };
};

// Message access: chat participants or admin
export const isMessageSenderOrParticipantOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  // User can see messages they sent
  const senderQuery = {
    sender: {
      equals: user.id,
    },
  };
  
  // User can see messages in chats they participate in
  try {
    const userChats = await payload.find({
      collection: 'chats',
      where: {
        participants: {
          contains: user.id,
        },
      },
      limit: 100,
    });
    
    const chatIds = userChats.docs.map(chat => chat.id);
    
    if (chatIds.length === 0) return senderQuery;
    
    return {
      or: [
        senderQuery,
        {
          chat: {
            in: chatIds,
          },
        },
      ],
    };
  } catch (error) {
    console.error('Error checking message access:', error);
    return senderQuery;
  }
};

// Notification access: recipient or admin
export const isNotificationRecipientOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return {
    user: {
      equals: user.id,
    },
  };
};

// Adoption application access: applicant, shelter, or admin
export const isAdoptionApplicantOrShelterOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  const applicantQuery = {
    applicant: {
      equals: user.id,
    },
  };
  
  if (user.role === 'shelter') {
    try {
      const shelterProfile = await payload.find({
        collection: 'shelters',
        where: {
          user: { equals: user.id },
        },
        limit: 1,
      });
      
      if (shelterProfile.docs.length > 0) {
        return {
          or: [
            applicantQuery,
            {
              shelter: {
                equals: shelterProfile.docs[0].id,
              },
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error finding shelter profile:', error);
    }
  }
  
  return applicantQuery;
};

// Donation access: donor, shelter, or admin
export const isDonationDonorOrShelterOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  const donorQuery = {
    donor: {
      equals: user.id,
    },
  };
  
  if (user.role === 'shelter') {
    try {
      const shelterProfile = await payload.find({
        collection: 'shelters',
        where: {
          user: { equals: user.id },
        },
        limit: 1,
      });
      
      if (shelterProfile.docs.length > 0) {
        return {
          or: [
            donorQuery,
            {
              shelter: {
                equals: shelterProfile.docs[0].id,
              },
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error finding shelter profile:', error);
    }
  }
  
  return donorQuery;
};

// Event access: public events, organizer, participants, or admin
export const isEventPublicOrParticipantOrOrganizerOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (user?.role === 'admin') return true;
  
  // Public events are visible to everyone
  const publicQuery = {
    isPublic: {
      equals: true,
    },
    isActive: {
      equals: true,
    },
  };
  
  if (!user) return publicQuery;
  
  // Organizer query
  let organizerQuery = {};
  if (user.role === 'shelter') {
    try {
      const shelterProfile = await payload.find({
        collection: 'shelters',
        where: {
          user: { equals: user.id },
        },
        limit: 1,
      });
      
      if (shelterProfile.docs.length > 0) {
        organizerQuery = {
          organizer: {
            equals: shelterProfile.docs[0].id,
          },
        };
      }
    } catch (error) {
      console.error('Error finding shelter profile:', error);
    }
  }
  
  // Participant query
  let participantQuery = {};
  try {
    const userParticipations = await payload.find({
      collection: 'event-participations',
      where: {
        user: { equals: user.id },
      },
      limit: 100,
    });
    
    const eventIds = userParticipations.docs.map(p => p.event);
    if (eventIds.length > 0) {
      participantQuery = {
        id: {
          in: eventIds,
        },
      };
    }
  } catch (error) {
    console.error('Error finding event participations:', error);
  }
  
  const queries = [publicQuery];
  if (Object.keys(organizerQuery).length > 0) queries.push(organizerQuery);
  if (Object.keys(participantQuery).length > 0) queries.push(participantQuery);
  
  return queries.length === 1 ? publicQuery : { or: queries };
};

// Prescription access: veterinarian, patient owner, or admin
export const isPrescriptionVetOrOwnerOrAdmin = async ({ req: { user, payload } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  // Owner of the patient (dog)
  const ownerQuery = {
    owner: {
      equals: user.id,
    },
  };
  
  // Veterinarian who issued the prescription
  if (user.role === 'veterinarian') {
    try {
      const vetProfile = await payload.find({
        collection: 'veterinarians',
        where: {
          user: { equals: user.id },
        },
        limit: 1,
      });
      
      if (vetProfile.docs.length > 0) {
        return {
          or: [
            ownerQuery,
            {
              veterinarian: {
                equals: vetProfile.docs[0].id,
              },
            },
          ],
        };
      }
    } catch (error) {
      console.error('Error finding veterinarian profile:', error);
    }
  }
  
  return ownerQuery;
};

// Media access: uploader or admin
export const isMediaUploaderOrAdmin = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return {
    uploadedBy: {
      equals: user.id,
    },
  };
};

// Public read access (for public content)
export const isPublic = () => true;

// Authenticated users only
export const isAuthenticated = ({ req: { user } }: AccessArgs<any, User>): boolean => {
  return !!user;
};

// Role-based access helpers
export const hasRole = (roles: string[]) => ({ req: { user } }: AccessArgs<any, User>): boolean => {
  return user ? roles.includes(user.role) : false;
};

export const isVeterinarian = hasRole(['veterinarian']);
export const isShelter = hasRole(['shelter']);
export const isUser = hasRole(['user']);

// Combined role access
export const isVeterinarianOrShelter = hasRole(['veterinarian', 'shelter']);
export const isVeterinarianOrAdmin = hasRole(['veterinarian', 'admin']);
export const isShelterOrAdmin = hasRole(['shelter', 'admin']);

// Location-based access (for emergencies and nearby services)
export const isWithinRadius = (latitude: number, longitude: number, radiusKm: number = 50) => {
  return async ({ req: { user, payload } }: AccessArgs<any, User>) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    // Get user's location
    const userProfile = await payload.findByID({
      collection: 'users',
      id: user.id,
    });
    
    if (!userProfile?.address?.coordinates) return false;
    
    // Calculate distance (simplified - in production use PostGIS)
    const { GeoUtils } = await import('@doggo/utils');
    const distance = GeoUtils.calculateDistance(
      { latitude, longitude },
      userProfile.address.coordinates
    );
    
    return distance <= radiusKm;
  };
};

// Time-based access (for bookings in specific time ranges)
export const isWithinTimeRange = (startDate: Date, endDate: Date) => {
  return ({ req: { user } }: AccessArgs<any, User>) => {
    if (!user) return false;
    if (user.role === 'admin') return true;
    
    return {
      scheduledAt: {
        greater_than_equal: startDate.toISOString(),
        less_than_equal: endDate.toISOString(),
      },
    };
  };
};

// Business hours access
export const isBusinessHours = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();
  
  // Monday to Friday, 9 AM to 6 PM
  const isBusinessTime = day >= 1 && day <= 5 && hour >= 9 && hour < 18;
  
  return isBusinessTime;
};

// Feature flag access
export const hasFeatureFlag = (flagName: string) => {
  return ({ req: { user } }: AccessArgs<any, User>): boolean => {
    // In production, check against a feature flags service
    const featureFlags = {
      telemedicine: true,
      matching: true,
      donations: true,
      events: true,
      prescriptions: user?.role === 'veterinarian' || user?.role === 'admin',
    };
    
    return featureFlags[flagName as keyof typeof featureFlags] || false;
  };
};

// Emergency access based on urgency
export const canAccessEmergency = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  // Allow access to high priority emergencies for veterinarians
  if (user.role === 'veterinarian') {
    return {
      or: [
        { reporter: { equals: user.id } },
        { priority: { in: ['high', 'critical'] } },
      ],
    };
  }
  
  // Regular users can only see their own reports and resolved emergencies
  return {
    or: [
      { reporter: { equals: user.id } },
      { isResolved: { equals: true } },
    ],
  };
};

// Audit log access (admin only, users can see their own actions)
export const isAuditLogAdminOrSelf = ({ req: { user } }: AccessArgs<any, User>) => {
  if (!user) return false;
  if (user.role === 'admin') return true;
  
  return {
    userId: {
      equals: user.id,
    },
  };
};

// Export all access functions
export default {
  isAdmin,
  isAdminOrSelf,
  isOwnerOrAdmin,
  isVeterinarianOrAdmin,
  isBookingOwnerOrVetOrAdmin,
  isShelterOrAdmin,
  isDocumentOwnerOrAdmin,
  isEmergencyReporterOrAdmin,
  isMatchParticipantOrAdmin,
  isChatParticipantOrAdmin,
  isMessageSenderOrParticipantOrAdmin,
  isNotificationRecipientOrAdmin,
  isAdoptionApplicantOrShelterOrAdmin,
  isDonationDonorOrShelterOrAdmin,
  isEventPublicOrParticipantOrOrganizerOrAdmin,
  isPrescriptionVetOrOwnerOrAdmin,
  isMediaUploaderOrAdmin,
  isPublic,
  isAuthenticated,
  hasRole,
  isVeterinarian,
  isShelter,
  isUser,
  isVeterinarianOrShelter,
  isVeterinarianOrAdmin,
  isShelterOrAdmin,
  isWithinRadius,
  isWithinTimeRange,
  isBusinessHours,
  hasFeatureFlag,
  canAccessEmergency,
  isAuditLogAdminOrSelf,
};