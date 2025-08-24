import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
import payload from 'payload';

export interface ValidationSchemas {
  body?: Joi.ObjectSchema;
  query?: Joi.ObjectSchema;
  params?: Joi.ObjectSchema;
  headers?: Joi.ObjectSchema;
}

// Main validation middleware
export const validateRequest = (schemas: ValidationSchemas) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const errors: any = {};

    // Validate request body
    if (schemas.body) {
      const { error, value } = schemas.body.validate(req.body, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        errors.body = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));
      } else {
        req.body = value; // Use sanitized value
      }
    }

    // Validate query parameters
    if (schemas.query) {
      const { error, value } = schemas.query.validate(req.query, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        errors.query = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));
      } else {
        req.query = value; // Use sanitized value
      }
    }

    // Validate route parameters
    if (schemas.params) {
      const { error, value } = schemas.params.validate(req.params, {
        abortEarly: false,
        stripUnknown: true,
      });

      if (error) {
        errors.params = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));
      } else {
        req.params = value; // Use sanitized value
      }
    }

    // Validate headers
    if (schemas.headers) {
      const { error } = schemas.headers.validate(req.headers, {
        abortEarly: false,
        allowUnknown: true, // Don't strip headers
      });

      if (error) {
        errors.headers = error.details.map(detail => ({
          field: detail.path.join('.'),
          message: detail.message,
          value: detail.context?.value,
        }));
      }
    }

    // If there are validation errors, return them
    if (Object.keys(errors).length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Validation failed',
        errors,
      });
    }

    next();
  };
};

// Common validation schemas
export const commonSchemas = {
  uuid: Joi.string().uuid().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
  password: Joi.string().min(8).pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]/).required(),
  date: Joi.date().iso().required(),
  positiveNumber: Joi.number().positive().required(),
  coordinates: Joi.object({
    latitude: Joi.number().min(-90).max(90).required(),
    longitude: Joi.number().min(-180).max(180).required(),
  }),
  pagination: {
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    sort: Joi.string().optional(),
    order: Joi.string().valid('asc', 'desc').default('desc'),
  },
};

// Validate UUID parameter
export const validateUuidParam = (paramName: string = 'id') => {
  return validateRequest({
    params: Joi.object({
      [paramName]: commonSchemas.uuid,
    }),
  });
};

// Validate pagination query
export const validatePagination = validateRequest({
  query: Joi.object(commonSchemas.pagination),
});

// Validate file upload
export const validateFileUpload = (options: {
  required?: boolean;
  maxSize?: number;
  allowedTypes?: string[];
  maxFiles?: number;
} = {}) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const {
      required = false,
      maxSize = 10 * 1024 * 1024, // 10MB
      allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'],
      maxFiles = 1,
    } = options;

    // Check if file is required
    if (required && (!req.file && !req.files)) {
      return res.status(400).json({
        success: false,
        error: 'File upload required',
      });
    }

    // If no files uploaded and not required, continue
    if (!req.file && !req.files) {
      return next();
    }

    const files = req.files ? (Array.isArray(req.files) ? req.files : Object.values(req.files).flat()) : [req.file];

    // Validate file count
    if (files.length > maxFiles) {
      return res.status(400).json({
        success: false,
        error: `Maximum ${maxFiles} files allowed`,
      });
    }

    // Validate each file
    for (const file of files) {
      if (!file) continue;

      // Check file size
      if (file.size > maxSize) {
        return res.status(400).json({
          success: false,
          error: `File ${file.originalname} exceeds maximum size of ${formatFileSize(maxSize)}`,
        });
      }

      // Check file type
      if (!allowedTypes.includes(file.mimetype)) {
        return res.status(400).json({
          success: false,
          error: `File type ${file.mimetype} not allowed. Allowed types: ${allowedTypes.join(', ')}`,
        });
      }

      // Check file signature for security
      if (!validateFileSignature(file)) {
        return res.status(400).json({
          success: false,
          error: `File ${file.originalname} appears to be corrupted or of wrong type`,
        });
      }
    }

    next();
  };
};

// Validate Italian phone number
export const validateItalianPhone = (phoneNumber: string): boolean => {
  const italianPhoneRegex = /^(\+39|0039|39)?[\s]?([0-9]{2,4})[\s]?([0-9]{6,8})$/;
  return italianPhoneRegex.test(phoneNumber);
};

// Validate microchip number
export const validateMicrochip = (microchip: string): boolean => {
  return /^\d{15}$/.test(microchip);
};

// Validate Italian postal code
export const validateItalianPostalCode = (postalCode: string): boolean => {
  return /^\d{5}$/.test(postalCode);
};

// Custom validation for dog breeding
export const validateDogBreed = async (breed: string): Promise<boolean> => {
  // In production, validate against a database of recognized breeds
  const commonBreeds = [
    'Labrador Retriever', 'Golden Retriever', 'Pastore Tedesco', 'Bulldog Francese',
    'Beagle', 'Rottweiler', 'Yorkshire Terrier', 'Chihuahua', 'Siberian Husky',
    'Border Collie', 'Boxer', 'Dachshund', 'Poodle', 'Shih Tzu', 'Boston Terrier',
    'Meticcio', 'Jack Russell Terrier', 'Cocker Spaniel', 'Maltese', 'Pinscher'
  ];

  return commonBreeds.includes(breed) || breed.toLowerCase() === 'meticcio';
};

// Sanitize HTML input
export const sanitizeHtml = (html: string): string => {
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '')
    .replace(/javascript:/gi, '');
};

// Validate business hours
export const validateBusinessHours = (workingHours: any[]): boolean => {
  if (!Array.isArray(workingHours)) return false;

  return workingHours.every(hour => {
    if (!hour.dayOfWeek || !hour.startTime || !hour.endTime) return false;
    
    const dayOfWeek = Number(hour.dayOfWeek);
    if (dayOfWeek < 0 || dayOfWeek > 6) return false;

    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (!timeRegex.test(hour.startTime) || !timeRegex.test(hour.endTime)) return false;

    const startMinutes = parseInt(hour.startTime.split(':')[0]) * 60 + parseInt(hour.startTime.split(':')[1]);
    const endMinutes = parseInt(hour.endTime.split(':')[0]) * 60 + parseInt(hour.endTime.split(':')[1]);

    return startMinutes < endMinutes;
  });
};

// Validate coordinates are within Italy
export const validateItalianCoordinates = (coordinates: { latitude: number; longitude: number }): boolean => {
  const { latitude, longitude } = coordinates;
  
  // Rough bounds for Italy
  const italyBounds = {
    north: 47.1,
    south: 35.5,
    west: 6.6,
    east: 18.5,
  };

  return (
    latitude >= italyBounds.south &&
    latitude <= italyBounds.north &&
    longitude >= italyBounds.west &&
    longitude <= italyBounds.east
  );
};

// Rate limiting validation
export const validateRateLimit = (windowMs: number, max: number, keyGenerator?: (req: Request) => string) => {
  const requests = new Map<string, { count: number; resetTime: number }>();

  return (req: Request, res: Response, next: NextFunction) => {
    const key = keyGenerator ? keyGenerator(req) : req.ip;
    const now = Date.now();
    const windowStart = now - windowMs;

    // Clean old entries
    for (const [k, v] of requests.entries()) {
      if (v.resetTime < windowStart) {
        requests.delete(k);
      }
    }

    const current = requests.get(key) || { count: 0, resetTime: now + windowMs };

    if (current.resetTime < now) {
      // Reset window
      current.count = 0;
      current.resetTime = now + windowMs;
    }

    current.count++;
    requests.set(key, current);

    if (current.count > max) {
      return res.status(429).json({
        success: false,
        error: 'Too many requests',
        retryAfter: Math.ceil((current.resetTime - now) / 1000),
      });
    }

    // Set rate limit headers
    res.set({
      'X-RateLimit-Limit': max.toString(),
      'X-RateLimit-Remaining': Math.max(0, max - current.count).toString(),
      'X-RateLimit-Reset': Math.ceil(current.resetTime / 1000).toString(),
    });

    next();
  };
};

// Helper functions
const formatFileSize = (bytes: number): string => {
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const validateFileSignature = (file: any): boolean => {
  if (!file.buffer || file.buffer.length < 8) return false;

  const signatures: Record<string, number[]> = {
    'image/jpeg': [0xff, 0xd8, 0xff],
    'image/png': [0x89, 0x50, 0x4e, 0x47],
    'application/pdf': [0x25, 0x50, 0x44, 0x46],
    'image/webp': [0x52, 0x49, 0x46, 0x46],
  };

  const signature = signatures[file.mimetype];
  if (!signature) return true; // Allow unknown types to pass

  const fileSignature = Array.from(file.buffer.slice(0, signature.length));
  return signature.every((byte, index) => byte === fileSignature[index]);
};

// Export validation middleware and utilities
export default {
  validateRequest,
  validateUuidParam,
  validatePagination,
  validateFileUpload,
  validateItalianPhone,
  validateMicrochip,
  validateItalianPostalCode,
  validateDogBreed,
  sanitizeHtml,
  validateBusinessHours,
  validateItalianCoordinates,
  validateRateLimit,
  commonSchemas,
};