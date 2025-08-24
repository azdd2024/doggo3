import { Request, Response, NextFunction } from 'express';
import { CryptoUtils } from '@doggo/utils';
import payload from 'payload';

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: any;
    }
  }
}

// Authenticate user middleware
export const authenticateUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // Verify JWT token
    const decoded = CryptoUtils.verifyToken(token, process.env.JWT_SECRET!);

    // Get user from database
    const user = await payload.findByID({
      collection: 'users',
      id: decoded.userId,
    });

    if (!user || !user.isActive) {
      return res.status(401).json({
        success: false,
        error: 'Invalid or inactive user',
      });
    }

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        error: 'Invalid token',
      });
    }

    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        error: 'Token expired',
      });
    }

    payload.logger.error('Authentication error:', error);
    return res.status(401).json({
      success: false,
      error: 'Authentication failed',
    });
  }
};

// Require specific role middleware
export const requireRole = (roles: string | string[]) => {
  const allowedRoles = Array.isArray(roles) ? roles : [roles];

  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: 'Insufficient permissions',
      });
    }

    next();
  };
};

// Admin only middleware
export const requireAdmin = requireRole('admin');

// Veterinarian or admin middleware
export const requireVeterinarianOrAdmin = requireRole(['veterinarian', 'admin']);

// Shelter or admin middleware
export const requireShelterOrAdmin = requireRole(['shelter', 'admin']);

// Optional authentication middleware (sets user if token present, but doesn't require it)
export const optionalAuth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(); // Continue without user
    }

    const token = authHeader.substring(7);
    const decoded = CryptoUtils.verifyToken(token, process.env.JWT_SECRET!);

    const user = await payload.findByID({
      collection: 'users',
      id: decoded.userId,
    });

    if (user && user.isActive) {
      req.user = user;
    }

    next();
  } catch (error) {
    // Silently continue without user if token is invalid
    next();
  }
};

// API key authentication middleware (for external services)
export const authenticateApiKey = (req: Request, res: Response, next: NextFunction) => {
  const apiKey = req.headers['x-api-key'];

  if (!apiKey) {
    return res.status(401).json({
      success: false,
      error: 'API key required',
    });
  }

  // In production, validate against stored API keys in database
  const validApiKeys = [
    process.env.WEBHOOK_API_KEY,
    process.env.INTERNAL_API_KEY,
  ].filter(Boolean);

  if (!validApiKeys.includes(apiKey as string)) {
    return res.status(401).json({
      success: false,
      error: 'Invalid API key',
    });
  }

  next();
};

// Resource ownership middleware factory
export const requireOwnership = (resourceType: string, idParam: string = 'id') => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // Admin bypass
      if (req.user.role === 'admin') {
        return next();
      }

      const resourceId = req.params[idParam];
      if (!resourceId) {
        return res.status(400).json({
          success: false,
          error: `${idParam} parameter required`,
        });
      }

      // Get resource and check ownership
      let resource;
      let ownerField = 'owner';

      switch (resourceType) {
        case 'dog':
          resource = await payload.findByID({
            collection: 'dogs',
            id: resourceId,
          });
          break;

        case 'booking':
          resource = await payload.findByID({
            collection: 'bookings',
            id: resourceId,
          });
          ownerField = 'user';
          break;

        case 'document':
          resource = await payload.findByID({
            collection: 'documents',
            id: resourceId,
          });
          ownerField = 'owner';
          break;

        case 'emergency':
          resource = await payload.findByID({
            collection: 'emergencies',
            id: resourceId,
          });
          ownerField = 'reporter';
          break;

        case 'veterinarian':
          resource = await payload.findByID({
            collection: 'veterinarians',
            id: resourceId,
          });
          ownerField = 'user';
          break;

        case 'shelter':
          resource = await payload.findByID({
            collection: 'shelters',
            id: resourceId,
          });
          ownerField = 'user';
          break;

        default:
          return res.status(400).json({
            success: false,
            error: 'Unknown resource type',
          });
      }

      if (!resource) {
        return res.status(404).json({
          success: false,
          error: 'Resource not found',
        });
      }

      if (resource[ownerField] !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Attach resource to request for further use
      req.resource = resource;
      next();
    } catch (error) {
      payload.logger.error('Ownership check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify ownership',
      });
    }
  };
};

// Specific ownership middlewares
export const requireDogOwnership = requireOwnership('dog');
export const requireBookingOwnership = requireOwnership('booking');
export const requireDocumentOwnership = requireOwnership('document');
export const requireEmergencyOwnership = requireOwnership('emergency');
export const requireVeterinarianOwnership = requireOwnership('veterinarian');
export const requireShelterOwnership = requireOwnership('shelter');

// Booking access middleware (owner, veterinarian, or admin)
export const requireBookingAccess = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    if (req.user.role === 'admin') {
      return next();
    }

    const bookingId = req.params.id || req.params.bookingId;
    if (!bookingId) {
      return res.status(400).json({
        success: false,
        error: 'Booking ID required',
      });
    }

    const booking = await payload.findByID({
      collection: 'bookings',
      id: bookingId,
      populate: ['veterinarian'],
    });

    if (!booking) {
      return res.status(404).json({
        success: false,
        error: 'Booking not found',
      });
    }

    // Check if user is the booking owner
    if (booking.user === req.user.id) {
      req.resource = booking;
      return next();
    }

    // Check if user is the veterinarian
    if (req.user.role === 'veterinarian' && booking.veterinarian?.user === req.user.id) {
      req.resource = booking;
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'Access denied',
    });
  } catch (error) {
    payload.logger.error('Booking access check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify booking access',
    });
  }
};

// Rate limiting bypass for authenticated users
export const bypassRateLimitForAuth = (req: Request, res: Response, next: NextFunction) => {
  if (req.user) {
    // Skip rate limiting for authenticated users
    req.skipRateLimit = true;
  }
  next();
};

// Verified user only middleware
export const requireVerifiedUser = (req: Request, res: Response, next: NextFunction) => {
  if (!req.user) {
    return res.status(401).json({
      success: false,
      error: 'Authentication required',
    });
  }

  if (!req.user.isVerified) {
    return res.status(403).json({
      success: false,
      error: 'Email verification required',
    });
  }

  next();
};

// Business hours only middleware
export const requireBusinessHours = (req: Request, res: Response, next: NextFunction) => {
  const now = new Date();
  const hour = now.getHours();
  const day = now.getDay();

  // Monday to Friday, 8 AM to 8 PM
  const isBusinessHours = day >= 1 && day <= 5 && hour >= 8 && hour <= 20;

  if (!isBusinessHours && req.user?.role !== 'admin') {
    return res.status(403).json({
      success: false,
      error: 'This service is only available during business hours (Mon-Fri 8AM-8PM)',
    });
  }

  next();
};

// Feature flag middleware
export const requireFeature = (featureName: string) => {
  return (req: Request, res: Response, next: NextFunction) => {
    // In production, check against feature flags service
    const featureFlags = {
      telemedicine: true,
      matching: true,
      donations: true,
      events: true,
      prescriptions: true,
      video_calls: true,
      emergency_alerts: true,
    };

    if (!featureFlags[featureName as keyof typeof featureFlags]) {
      return res.status(503).json({
        success: false,
        error: 'Feature not available',
      });
    }

    next();
  };
};

// Location-based access middleware
export const requireLocation = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        success: false,
        error: 'Authentication required',
      });
    }

    const user = await payload.findByID({
      collection: 'users',
      id: req.user.id,
    });

    if (!user.address?.coordinates) {
      return res.status(400).json({
        success: false,
        error: 'Location information required. Please update your profile.',
      });
    }

    req.userLocation = user.address.coordinates;
    next();
  } catch (error) {
    payload.logger.error('Location check error:', error);
    return res.status(500).json({
      success: false,
      error: 'Failed to verify location',
    });
  }
};

// Audit logging middleware
export const auditLog = (action: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const originalSend = res.send;
    
    res.send = function(data) {
      // Log the action after response
      setImmediate(async () => {
        try {
          await payload.create({
            collection: 'audit-logs',
            data: {
              userId: req.user?.id || null,
              action,
              resource: req.route?.path || req.path,
              resourceId: req.params.id || null,
              metadata: {
                method: req.method,
                url: req.originalUrl,
                userAgent: req.get('User-Agent'),
                ip: req.ip,
                statusCode: res.statusCode,
              },
            },
          });
        } catch (error) {
          payload.logger.error('Audit log error:', error);
        }
      });

      return originalSend.call(this, data);
    };

    next();
  };
};

// GDPR consent middleware
export const requireConsent = (consentType: string) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({
          success: false,
          error: 'Authentication required',
        });
      }

      // Check user consent (in production, store in separate consent table)
      const user = await payload.findByID({
        collection: 'users',
        id: req.user.id,
      });

      const consents = user.consents || {};
      if (!consents[consentType]) {
        return res.status(403).json({
          success: false,
          error: `Consent required for ${consentType}`,
          consentRequired: consentType,
        });
      }

      next();
    } catch (error) {
      payload.logger.error('Consent check error:', error);
      return res.status(500).json({
        success: false,
        error: 'Failed to verify consent',
      });
    }
  };
};

// Emergency access middleware (allows access during emergencies)
export const emergencyAccess = (req: Request, res: Response, next: NextFunction) => {
  // Check if it's an emergency situation
  const isEmergency = req.body.priority === 'critical' || 
                     req.body.type === 'injured_dog' ||
                     req.query.emergency === 'true';

  if (isEmergency) {
    // Bypass certain restrictions during emergencies
    req.isEmergency = true;
  }

  next();
};

// Maintenance mode middleware
export const checkMaintenanceMode = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Check maintenance mode from database
    const maintenanceConfig = await payload.findGlobal({
      slug: 'site-settings',
    });

    if (maintenanceConfig.maintenanceMode && req.user?.role !== 'admin') {
      return res.status(503).json({
        success: false,
        error: 'System under maintenance. Please try again later.',
        maintenance: true,
      });
    }

    next();
  } catch (error) {
    // If we can't check maintenance mode, assume it's off
    next();
  }
};

// Export all middleware
export default {
  authenticateUser,
  requireRole,
  requireAdmin,
  requireVeterinarianOrAdmin,
  requireShelterOrAdmin,
  optionalAuth,
  authenticateApiKey,
  requireOwnership,
  requireDogOwnership,
  requireBookingOwnership,
  requireDocumentOwnership,
  requireEmergencyOwnership,
  requireVeterinarianOwnership,
  requireShelterOwnership,
  requireBookingAccess,
  bypassRateLimitForAuth,
  requireVerifiedUser,
  requireBusinessHours,
  requireFeature,
  requireLocation,
  auditLog,
  requireConsent,
  emergencyAccess,
  checkMaintenanceMode,
};