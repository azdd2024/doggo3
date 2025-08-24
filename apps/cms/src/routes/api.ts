import express from 'express';
import multer from 'multer';
import { authenticateUser, requireRole } from '../middleware/auth';
import { validateRequest } from '../middleware/validation';
import Joi from 'joi';
import payload from 'payload';

const router = express.Router();

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
    files: 10,
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('File type not allowed'), false);
    }
  },
});

// ===========================================
// USER PROFILE ENDPOINTS
// ===========================================

// Get current user profile
router.get('/profile', authenticateUser, async (req, res) => {
  try {
    const user = await payload.findByID({
      collection: 'users',
      id: req.user.id,
      populate: ['dogs', 'veterinarian', 'shelter'],
    });

    res.json({
      success: true,
      user,
    });
  } catch (error) {
    payload.logger.error('Profile fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch profile',
    });
  }
});

// Update user profile
router.patch('/profile', 
  authenticateUser,
  validateRequest({
    body: Joi.object({
      firstName: Joi.string().min(1).max(50).optional(),
      lastName: Joi.string().min(1).max(50).optional(),
      phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
      address: Joi.object({
        street: Joi.string().optional(),
        city: Joi.string().optional(),
        state: Joi.string().optional(),
        zipCode: Joi.string().optional(),
        country: Joi.string().optional(),
        coordinates: Joi.object({
          latitude: Joi.number().min(-90).max(90).optional(),
          longitude: Joi.number().min(-180).max(180).optional(),
        }).optional(),
      }).optional(),
      preferences: Joi.object({
        language: Joi.string().valid('it', 'en').optional(),
        notifications: Joi.object({
          email: Joi.boolean().optional(),
          sms: Joi.boolean().optional(),
          push: Joi.boolean().optional(),
        }).optional(),
        privacy: Joi.object({
          showProfile: Joi.boolean().optional(),
          showLocation: Joi.boolean().optional(),
          allowMatching: Joi.boolean().optional(),
        }).optional(),
      }).optional(),
    }),
  }),
  async (req, res) => {
    try {
      const updatedUser = await payload.update({
        collection: 'users',
        id: req.user.id,
        data: req.body,
      });

      res.json({
        success: true,
        user: updatedUser,
      });
    } catch (error) {
      payload.logger.error('Profile update error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to update profile',
      });
    }
  }
);

// Upload profile avatar
router.post('/profile/avatar',
  authenticateUser,
  upload.single('avatar'),
  async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          error: 'No file uploaded',
        });
      }

      const fileUploadService = req.app.locals.services.fileUpload;
      const uploadResult = await fileUploadService.uploadAvatar(
        req.file.buffer,
        req.file.originalname,
        req.user.id
      );

      // Create media record
      const media = await payload.create({
        collection: 'media',
        data: {
          filename: req.file.originalname,
          mimeType: req.file.mimetype,
          filesize: req.file.size,
          url: uploadResult.url,
          alt: `Avatar for ${req.user.firstName} ${req.user.lastName}`,
        },
      });

      // Update user avatar
      await payload.update({
        collection: 'users',
        id: req.user.id,
        data: {
          avatar: media.id,
        },
      });

      res.json({
        success: true,
        avatar: {
          id: media.id,
          url: uploadResult.url,
          thumbnails: uploadResult.thumbnails,
        },
      });
    } catch (error) {
      payload.logger.error('Avatar upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload avatar',
      });
    }
  }
);

// ===========================================
// DOG MANAGEMENT ENDPOINTS
// ===========================================

// Get user's dogs
router.get('/dogs', authenticateUser, async (req, res) => {
  try {
    const dogs = await payload.find({
      collection: 'dogs',
      where: {
        owner: { equals: req.user.id },
      },
      populate: ['photos'],
      sort: '-createdAt',
    });

    res.json({
      success: true,
      dogs: dogs.docs,
    });
  } catch (error) {
    payload.logger.error('Dogs fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch dogs',
    });
  }
});

// Create new dog
router.post('/dogs',
  authenticateUser,
  validateRequest({
    body: Joi.object({
      name: Joi.string().min(1).max(50).required(),
      breed: Joi.string().min(1).max(100).required(),
      birthDate: Joi.date().max('now').required(),
      gender: Joi.string().valid('maschio', 'femmina').required(),
      size: Joi.string().valid('TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT').required(),
      weight: Joi.number().positive().max(100).required(),
      color: Joi.string().min(1).max(50).required(),
      microchipNumber: Joi.string().pattern(/^\d{15}$/).optional(),
      isNeutered: Joi.boolean().default(false),
      activityLevel: Joi.string().valid('LOW', 'MODERATE', 'HIGH', 'VERY_HIGH').required(),
      temperament: Joi.array().items(Joi.string()).optional(),
      medicalNotes: Joi.string().max(1000).optional(),
      dietaryNeeds: Joi.string().max(1000).optional(),
    }),
  }),
  async (req, res) => {
    try {
      const dog = await payload.create({
        collection: 'dogs',
        data: {
          ...req.body,
          owner: req.user.id,
        },
      });

      res.status(201).json({
        success: true,
        dog,
      });
    } catch (error) {
      payload.logger.error('Dog creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create dog profile',
      });
    }
  }
);

// Upload dog photos
router.post('/dogs/:dogId/photos',
  authenticateUser,
  upload.array('photos', 10),
  async (req, res) => {
    try {
      const { dogId } = req.params;

      // Verify dog ownership
      const dog = await payload.findByID({
        collection: 'dogs',
        id: dogId,
      });

      if (dog.owner !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      if (!req.files || !Array.isArray(req.files) || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          error: 'No files uploaded',
        });
      }

      const fileUploadService = req.app.locals.services.fileUpload;
      const uploadPromises = req.files.map(file =>
        fileUploadService.uploadDogPhoto(
          file.buffer,
          file.originalname,
          dogId
        )
      );

      const uploadResults = await Promise.all(uploadPromises);

      // Create media records
      const mediaPromises = uploadResults.map((result, index) =>
        payload.create({
          collection: 'media',
          data: {
            filename: req.files[index].originalname,
            mimeType: req.files[index].mimetype,
            filesize: req.files[index].size,
            url: result.url,
            alt: `Photo of ${dog.name}`,
          },
        })
      );

      const mediaRecords = await Promise.all(mediaPromises);

      // Update dog with new photos
      const currentPhotos = Array.isArray(dog.photos) ? dog.photos : [];
      const newPhotoIds = mediaRecords.map(media => media.id);

      await payload.update({
        collection: 'dogs',
        id: dogId,
        data: {
          photos: [...currentPhotos, ...newPhotoIds],
        },
      });

      res.json({
        success: true,
        photos: mediaRecords.map((media, index) => ({
          id: media.id,
          url: uploadResults[index].url,
          thumbnails: uploadResults[index].thumbnails,
        })),
      });
    } catch (error) {
      payload.logger.error('Dog photo upload error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to upload photos',
      });
    }
  }
);

// ===========================================
// VETERINARIAN SEARCH ENDPOINTS
// ===========================================

// Search veterinarians
router.get('/veterinarians/search', async (req, res) => {
  try {
    const {
      location,
      radius = 50,
      specializations,
      availableDate,
      minRating = 0,
      maxFee,
      telemedicine,
      limit = 20,
      page = 1,
    } = req.query;

    let where: any = {
      isVerified: { equals: true },
      isAcceptingPatients: { equals: true },
    };

    // Filter by specializations
    if (specializations) {
      const specs = Array.isArray(specializations) ? specializations : [specializations];
      where.specializations = { in: specs };
    }

    // Filter by rating
    if (minRating && Number(minRating) > 0) {
      where.rating = { greater_than_equal: Number(minRating) };
    }

    // Filter by consultation fee
    if (maxFee && Number(maxFee) > 0) {
      where.consultationFee = { less_than_equal: Number(maxFee) };
    }

    // Filter by telemedicine availability
    if (telemedicine === 'true') {
      where.servicesOffered = { in: ['telemedicine'] };
    }

    const veterinarians = await payload.find({
      collection: 'veterinarians',
      where,
      populate: ['user'],
      limit: Number(limit),
      page: Number(page),
      sort: '-rating',
    });

    // Apply location filtering if provided
    let results = veterinarians.docs;
    if (location && typeof location === 'string') {
      const [lat, lng] = location.split(',').map(Number);
      if (lat && lng) {
        const { GeoUtils } = await import('@doggo/utils');
        results = results
          .map(vet => {
            if (!vet.clinicAddress?.coordinates) return null;
            const distance = GeoUtils.calculateDistance(
              { latitude: lat, longitude: lng },
              vet.clinicAddress.coordinates
            );
            return distance <= Number(radius) ? { ...vet, distance } : null;
          })
          .filter(Boolean)
          .sort((a, b) => a.distance - b.distance);
      }
    }

    res.json({
      success: true,
      veterinarians: results,
      totalDocs: results.length,
      page: Number(page),
      limit: Number(limit),
    });
  } catch (error) {
    payload.logger.error('Veterinarian search error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to search veterinarians',
    });
  }
});

// Get veterinarian availability
router.get('/veterinarians/:id/availability', async (req, res) => {
  try {
    const { id } = req.params;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({
        success: false,
        error: 'Date parameter is required',
      });
    }

    const veterinarian = await payload.findByID({
      collection: 'veterinarians',
      id,
    });

    if (!veterinarian) {
      return res.status(404).json({
        success: false,
        error: 'Veterinarian not found',
      });
    }

    // Get available slots using database utility
    const { db } = await import('@doggo/database');
    const availableSlots = await db.getVeterinarianAvailability(
      id,
      new Date(date as string)
    );

    res.json({
      success: true,
      date,
      availableSlots,
      workingHours: veterinarian.workingHours,
    });
  } catch (error) {
    payload.logger.error('Availability check error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check availability',
    });
  }
});

// ===========================================
// BOOKING ENDPOINTS
// ===========================================

// Create booking
router.post('/bookings',
  authenticateUser,
  validateRequest({
    body: Joi.object({
      dogId: Joi.string().uuid().required(),
      veterinarianId: Joi.string().uuid().required(),
      type: Joi.string().valid('general', 'urgent', 'specialist', 'telemedicine').required(),
      scheduledAt: Joi.date().greater('now').required(),
      duration: Joi.number().min(15).max(180).default(30),
      symptoms: Joi.string().max(1000).optional(),
      triageResponses: Joi.array().items(Joi.object({
        questionId: Joi.string().required(),
        answer: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).required(),
      })).optional(),
    }),
  }),
  async (req, res) => {
    try {
      const { dogId, veterinarianId, type, scheduledAt, duration, symptoms, triageResponses } = req.body;

      // Verify dog ownership
      const dog = await payload.findByID({
        collection: 'dogs',
        id: dogId,
      });

      if (dog.owner !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Verify veterinarian exists and is available
      const veterinarian = await payload.findByID({
        collection: 'veterinarians',
        id: veterinarianId,
      });

      if (!veterinarian || !veterinarian.isAcceptingPatients) {
        return res.status(400).json({
          success: false,
          error: 'Veterinarian not available',
        });
      }

      // Check time slot availability
      const { db } = await import('@doggo/database');
      const availableSlots = await db.getVeterinarianAvailability(
        veterinarianId,
        new Date(scheduledAt)
      );

      const requestedTime = new Date(scheduledAt).toTimeString().substr(0, 5);
      if (!availableSlots.includes(requestedTime)) {
        return res.status(409).json({
          success: false,
          error: 'Time slot not available',
        });
      }

      // Calculate triage score if responses provided
      let urgencyScore = 1;
      let triageNotes = '';

      if (triageResponses && triageResponses.length > 0) {
        const { TriageSystem } = await import('@doggo/utils');
        const triageResult = TriageSystem.calculateTriageScore(triageResponses);
        urgencyScore = Math.ceil(triageResult.score / 10); // Convert to 1-10 scale
        triageNotes = `Triage score: ${triageResult.score}%. Urgency: ${triageResult.urgencyLevel}`;
      }

      // Calculate cost
      const fees = {
        general: veterinarian.consultationFee,
        urgent: veterinarian.emergencyFee,
        specialist: veterinarian.consultationFee * 1.5,
        telemedicine: veterinarian.telemedicineFee,
      };
      const totalCost = fees[type] || veterinarian.consultationFee;

      // Create booking
      const booking = await payload.create({
        collection: 'bookings',
        data: {
          user: req.user.id,
          dog: dogId,
          veterinarian: veterinarianId,
          type,
          scheduledAt,
          duration,
          symptoms,
          urgencyScore,
          triageNotes,
          totalCost,
          status: 'pending',
          paymentStatus: 'pending',
        },
      });

      // Create payment intent
      const paymentService = req.app.locals.services.payment;
      const paymentIntent = await paymentService.createBookingPayment(booking, req.user);

      res.status(201).json({
        success: true,
        booking,
        paymentIntent: {
          clientSecret: paymentIntent.client_secret,
          amount: totalCost,
        },
      });
    } catch (error) {
      payload.logger.error('Booking creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create booking',
      });
    }
  }
);

// Get user bookings
router.get('/bookings', authenticateUser, async (req, res) => {
  try {
    const { status, upcoming, limit = 20, page = 1 } = req.query;

    let where: any = {
      user: { equals: req.user.id },
    };

    if (status) {
      where.status = { equals: status };
    }

    if (upcoming === 'true') {
      where.scheduledAt = { greater_than: new Date().toISOString() };
      where.status = { in: ['pending', 'confirmed'] };
    }

    const bookings = await payload.find({
      collection: 'bookings',
      where,
      populate: ['dog', 'veterinarian'],
      sort: upcoming === 'true' ? 'scheduledAt' : '-scheduledAt',
      limit: Number(limit),
      page: Number(page),
    });

    res.json({
      success: true,
      bookings: bookings.docs,
      pagination: {
        totalDocs: bookings.totalDocs,
        page: Number(page),
        limit: Number(limit),
        totalPages: bookings.totalPages,
      },
    });
  } catch (error) {
    payload.logger.error('Bookings fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch bookings',
    });
  }
});

// ===========================================
// TRIAGE SYSTEM
// ===========================================

// Get triage questions
router.get('/triage/questions', async (req, res) => {
  try {
    const { TriageSystem } = await import('@doggo/utils');
    const questions = TriageSystem.getQuestions();

    res.json({
      success: true,
      questions,
    });
  } catch (error) {
    payload.logger.error('Triage questions error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch triage questions',
    });
  }
});

// Calculate triage score
router.post('/triage/calculate',
  authenticateUser,
  validateRequest({
    body: Joi.object({
      responses: Joi.array().items(Joi.object({
        questionId: Joi.string().required(),
        answer: Joi.alternatives().try(Joi.string(), Joi.number(), Joi.boolean()).required(),
      })).min(1).required(),
    }),
  }),
  async (req, res) => {
    try {
      const { responses } = req.body;
      const { TriageSystem } = await import('@doggo/utils');
      const result = TriageSystem.calculateTriageScore(responses);

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      payload.logger.error('Triage calculation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to calculate triage score',
      });
    }
  }
);

// ===========================================
// EMERGENCY ENDPOINTS
// ===========================================

// Create emergency report
router.post('/emergencies',
  authenticateUser,
  validateRequest({
    body: Joi.object({
      type: Joi.string().valid('lost_dog', 'found_dog', 'injured_dog', 'abandoned_dog').required(),
      title: Joi.string().min(1).max(200).required(),
      description: Joi.string().min(1).max(2000).required(),
      location: Joi.object({
        address: Joi.string().required(),
        coordinates: Joi.object({
          latitude: Joi.number().min(-90).max(90).required(),
          longitude: Joi.number().min(-180).max(180).required(),
        }).required(),
      }).required(),
      dogInfo: Joi.object({
        name: Joi.string().optional(),
        breed: Joi.string().optional(),
        color: Joi.string().optional(),
        size: Joi.string().valid('TINY', 'SMALL', 'MEDIUM', 'LARGE', 'GIANT').optional(),
        gender: Joi.string().valid('maschio', 'femmina').optional(),
        age: Joi.number().min(0).max(30).optional(),
        microchipNumber: Joi.string().pattern(/^\d{15}$/).optional(),
      }).required(),
      contactInfo: Joi.object({
        name: Joi.string().required(),
        phone: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
        preferredContactMethod: Joi.string().valid('phone', 'email', 'both').required(),
      }).required(),
      priority: Joi.string().valid('low', 'medium', 'high', 'critical').default('medium'),
    }),
  }),
  async (req, res) => {
    try {
      const emergency = await payload.create({
        collection: 'emergencies',
        data: {
          ...req.body,
          reporter: req.user.id,
          photos: [], // Will be added via separate endpoint
        },
      });

      // Send alerts to nearby users
      const notificationService = req.app.locals.services.notification;
      
      // Find users within radius (simplified - in production use PostGIS)
      const nearbyUsers = await payload.find({
        collection: 'users',
        where: {
          isActive: { equals: true },
          'preferences.notifications.push': { equals: true },
        },
        limit: 100,
      });

      // Send notifications (in background)
      nearbyUsers.docs.forEach(async (user) => {
        try {
          if (user.address?.coordinates) {
            const { GeoUtils } = await import('@doggo/utils');
            const distance = GeoUtils.calculateDistance(
              req.body.location.coordinates,
              user.address.coordinates
            );

            if (distance <= 25) { // 25km radius
              await notificationService.sendEmergencyAlert(user, emergency, distance);
            }
          }
        } catch (notifyError) {
          payload.logger.warn('Failed to send emergency notification:', notifyError);
        }
      });

      res.status(201).json({
        success: true,
        emergency,
      });
    } catch (error) {
      payload.logger.error('Emergency creation error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create emergency report',
      });
    }
  }
);

// Get nearby emergencies
router.get('/emergencies/nearby', authenticateUser, async (req, res) => {
  try {
    const { latitude, longitude, radius = 25, limit = 20 } = req.query;

    if (!latitude || !longitude) {
      return res.status(400).json({
        success: false,
        error: 'Location coordinates required',
      });
    }

    // Get all active emergencies
    const emergencies = await payload.find({
      collection: 'emergencies',
      where: {
        isResolved: { equals: false },
      },
      populate: ['reporter'],
      limit: Number(limit) * 2, // Get more to filter by distance
      sort: '-createdAt',
    });

    // Filter by distance
    const { GeoUtils } = await import('@doggo/utils');
    const nearbyEmergencies = emergencies.docs
      .map(emergency => {
        if (!emergency.location?.coordinates) return null;
        const distance = GeoUtils.calculateDistance(
          { latitude: Number(latitude), longitude: Number(longitude) },
          emergency.location.coordinates
        );
        return distance <= Number(radius) ? { ...emergency, distance } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, Number(limit));

    res.json({
      success: true,
      emergencies: nearbyEmergencies,
    });
  } catch (error) {
    payload.logger.error('Nearby emergencies error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch nearby emergencies',
    });
  }
});

// ===========================================
// MATCHING SYSTEM (TINDOG)
// ===========================================

// Get potential matches for user's dogs
router.get('/matches/potential', authenticateUser, async (req, res) => {
  try {
    const { dogId } = req.query;

    if (!dogId) {
      return res.status(400).json({
        success: false,
        error: 'Dog ID required',
      });
    }

    // Verify dog ownership
    const dog = await payload.findByID({
      collection: 'dogs',
      id: dogId as string,
      populate: ['owner'],
    });

    if (dog.owner.id !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    // Get potential matches using database utility
    const { db } = await import('@doggo/database');
    const potentialMatches = await db.findPotentialMatches(dogId as string);

    // Calculate compatibility scores
    const { MatchingAlgorithm } = await import('@doggo/utils');
    const matchesWithScores = potentialMatches.map(matchDog => ({
      ...matchDog,
      compatibilityScore: MatchingAlgorithm.calculateCompatibilityScore(
        dog,
        matchDog,
        dog.owner,
        matchDog.owner
      ),
    }))
    .filter(match => match.compatibilityScore >= 60) // Only show good matches
    .sort((a, b) => b.compatibilityScore - a.compatibilityScore)
    .slice(0, 20); // Top 20 matches

    res.json({
      success: true,
      matches: matchesWithScores,
    });
  } catch (error) {
    payload.logger.error('Potential matches error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to find potential matches',
    });
  }
});

// Create or update match action
router.post('/matches',
  authenticateUser,
  validateRequest({
    body: Joi.object({
      dog1Id: Joi.string().uuid().required(),
      dog2Id: Joi.string().uuid().required(),
      action: Joi.string().valid('like', 'pass').required(),
    }),
  }),
  async (req, res) => {
    try {
      const { dog1Id, dog2Id, action } = req.body;

      // Verify dog ownership
      const dog1 = await payload.findByID({
        collection: 'dogs',
        id: dog1Id,
      });

      if (dog1.owner !== req.user.id) {
        return res.status(403).json({
          success: false,
          error: 'Access denied',
        });
      }

      // Find or create match
      let match = await payload.find({
        collection: 'matches',
        where: {
          or: [
            { dog1Id: { equals: dog1Id }, dog2Id: { equals: dog2Id } },
            { dog1Id: { equals: dog2Id }, dog2Id: { equals: dog1Id } },
          ],
        },
        limit: 1,
      });

      const isReverse = match.docs.length > 0 && match.docs[0].dog1Id === dog2Id;
      const actionField = isReverse ? 'user2Action' : 'user1Action';

      if (match.docs.length === 0) {
        // Calculate match score
        const [dog2, user1, user2] = await Promise.all([
          payload.findByID({ collection: 'dogs', id: dog2Id, populate: ['owner'] }),
          payload.findByID({ collection: 'users', id: dog1.owner }),
          payload.findByID({ collection: 'users', id: dog1.owner }), // Will be replaced with dog2's owner
        ]);

        const { MatchingAlgorithm } = await import('@doggo/utils');
        const matchScore = MatchingAlgorithm.calculateCompatibilityScore(dog1, dog2, user1, dog2.owner);

        // Create new match
        match = await payload.create({
          collection: 'matches',
          data: {
            dog1Id,
            dog2Id,
            matchScore,
            [actionField]: action,
            status: 'pending',
          },
        });
      } else {
        // Update existing match
        const updateData: any = {
          [actionField]: action,
        };

        // Check if it's a mutual like
        const existingMatch = match.docs[0];
        const otherAction = isReverse ? existingMatch.user1Action : existingMatch.user2Action;

        if (action === 'like' && otherAction === 'liked') {
          updateData.status = 'matched';
          updateData.matchedAt = new Date();

          // Create chat for the match
          const chat = await payload.create({
            collection: 'chats',
            data: {
              type: 'direct',
              participants: [
                { user: dog1.owner },
                { user: isReverse ? existingMatch.dog1.owner : existingMatch.dog2.owner },
              ],
            },
          });

          updateData.chatId = chat.id;

          // Send match notifications
          const notificationService = req.app.locals.services.notification;
          await Promise.all([
            notificationService.sendNewMatch(
              { id: dog1.owner },
              dog1,
              isReverse ? existingMatch.dog1 : existingMatch.dog2,
              existingMatch.matchScore
            ),
            notificationService.sendNewMatch(
              { id: isReverse ? existingMatch.dog1.owner : existingMatch.dog2.owner },
              isReverse ? existingMatch.dog1 : existingMatch.dog2,
              dog1,
              existingMatch.matchScore
            ),
          ]);
        }

        match = await payload.update({
          collection: 'matches',
          id: existingMatch.id,
          data: updateData,
        });
      }

      res.json({
        success: true,
        match,
        isMatch: match.status === 'matched',
      });
    } catch (error) {
      payload.logger.error('Match action error:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to process match action',
      });
    }
  }
);

// ===========================================
// NOTIFICATIONS
// ===========================================

// Get user notifications
router.get('/notifications', authenticateUser, async (req, res) => {
  try {
    const { unreadOnly = false, limit = 50, page = 1 } = req.query;

    let where: any = {
      user: { equals: req.user.id },
    };

    if (unreadOnly === 'true') {
      where.isRead = { equals: false };
    }

    const notifications = await payload.find({
      collection: 'notifications',
      where,
      sort: '-createdAt',
      limit: Number(limit),
      page: Number(page),
    });

    res.json({
      success: true,
      notifications: notifications.docs,
      pagination: {
        totalDocs: notifications.totalDocs,
        page: Number(page),
        limit: Number(limit),
        totalPages: notifications.totalPages,
      },
    });
  } catch (error) {
    payload.logger.error('Notifications fetch error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to fetch notifications',
    });
  }
});

// Mark notification as read
router.patch('/notifications/:id/read', authenticateUser, async (req, res) => {
  try {
    const { id } = req.params;

    const notification = await payload.findByID({
      collection: 'notifications',
      id,
    });

    if (notification.user !== req.user.id) {
      return res.status(403).json({
        success: false,
        error: 'Access denied',
      });
    }

    await payload.update({
      collection: 'notifications',
      id,
      data: {
        isRead: true,
        readAt: new Date(),
      },
    });

    res.json({
      success: true,
      message: 'Notification marked as read',
    });
  } catch (error) {
    payload.logger.error('Notification update error:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update notification',
    });
  }
});

export default router;